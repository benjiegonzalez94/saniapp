/**
 * Copia de seguridad de SaniTi.
 *
 *   npm run backup                        # la base local, a ./copias/
 *   npm run backup -- --destino D:/copias
 *   npm run backup -- --url "postgresql://…"   # otra base (producción)
 *
 * Una copia se compone de tres cosas, y las tres tienen que estar:
 *
 *   1. LOS DATOS de Postgres, incluidas las identidades de `auth`. Sin ellas
 *      nadie puede entrar, por muy intacto que esté el historial clínico.
 *   2. LOS ARCHIVOS del bucket de estudios. No viven en Postgres: un `pg_dump`
 *      trae la fila de `storage.objects` y no el PDF del laboratorio. Restaurar
 *      sólo la base dejaría el expediente lleno de enlaces a la nada.
 *   3. EL MANIFIESTO, en claro, con conteos y huellas. Es lo que permite
 *      detectar una copia truncada SIN descifrarla.
 *
 * Lo que NO se copia, a propósito:
 *
 *   · El esquema. Vive en `supabase/migrations/`, versionado. Restaurar es
 *     aplicar las migraciones y cargar los datos encima; así cada ensayo de
 *     restauración comprueba además que las migraciones siguen siendo
 *     reproducibles desde cero.
 *   · Las claves de cifrado. No están en la base y no deben acabar junto a la
 *     copia: quien robe el disco de copias tendría entonces las notas clínicas
 *     en claro. Van en un gestor de secretos aparte, y el manifiesto anota qué
 *     versiones de clave hacen falta para leer estos datos.
 *
 * La copia va cifrada con AES-256-GCM y `SANITI_BACKUP_KEY`, que es una clave
 * DISTINTA de la de los campos. Contiene nombres, teléfonos y diagnósticos en
 * claro: un volcado sin cifrar en un disco externo es una brecha esperando.
 */
import { createHash, randomBytes, createCipheriv } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const ejecutar = promisify(execFile);

/**
 * La CLI de Supabase se lanza con el Node que ya está corriendo, apuntando a su
 * script, en vez de a través de `npx`.
 *
 * Con `npx` hay que elegir entre dos males en Windows: sin `shell: true` Node
 * se niega a ejecutar un `.cmd` desde la mitigación del CVE-2024-27980 y lanza
 * `spawn EINVAL`; con `shell: true` avisa (DEP0190) de que concatena los
 * argumentos sin escapar, y uno de ellos es la cadena de conexión con la
 * contraseña dentro. Apuntar al .js esquiva ambos y además usa exactamente la
 * versión fijada en package-lock.json, no la que `npx` decida resolver.
 */
const cliSupabase = createRequire(import.meta.url).resolve('supabase/dist/supabase.js');

const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) config({ path: envLocal, quiet: true });

/* -------------------------------------------------------------------------- */
/* Argumentos                                                                  */
/* -------------------------------------------------------------------------- */

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const urlBase = argumento('url') ?? process.env.DATABASE_URL;
const destinoRaiz = argumento('destino') ?? join(process.cwd(), 'copias');

if (!urlBase) {
  console.error(
    'Falta la cadena de conexión. Ponga DATABASE_URL en .env.local o pase --url.'
  );
  process.exit(1);
}

const claveB64 = process.env.SANITI_BACKUP_KEY;
if (!claveB64) {
  console.error(
    [
      'Falta SANITI_BACKUP_KEY. Genere una con:',
      '',
      '    openssl rand -base64 32',
      '',
      'Guárdela en el gestor de secretos, NO junto a las copias: la clave y el',
      'archivo cifrado en el mismo sitio equivalen a no cifrar nada.',
    ].join('\n')
  );
  process.exit(1);
}

const clave = Buffer.from(claveB64, 'base64');
if (clave.length !== 32) {
  console.error('SANITI_BACKUP_KEY debe ser de 32 bytes en base64 (256 bits).');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* Cifrado de cada pieza                                                       */
/* -------------------------------------------------------------------------- */

/**
 * El AAD liga cada pieza a SU copia y a SU nombre. Sin él, alguien con acceso
 * al disco podría sustituir el volcado de hoy por el de hace un mes —ambos
 * cifrados con la misma clave, ambos auténticos por separado— y la restauración
 * no notaría nada. Es el mismo razonamiento que ata cada campo cifrado a su
 * fila en `src/lib/security/crypto.ts`.
 */
function cifrar(contenido: Buffer, idCopia: string, pieza: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave, iv);
  cipher.setAAD(Buffer.from(`saniti:backup:v1:${idCopia}:${pieza}`, 'utf8'));
  const cuerpo = Buffer.concat([cipher.update(contenido), cipher.final()]);
  return Buffer.concat([iv, cuerpo, cipher.getAuthTag()]);
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/* -------------------------------------------------------------------------- */
/* Piezas de la copia                                                          */
/* -------------------------------------------------------------------------- */

type Pieza = {
  nombre: string;
  bytesEnClaro: number;
  bytesCifrados: number;
  sha256EnClaro: string;
};

async function escribirPieza(
  raiz: string,
  idCopia: string,
  nombre: string,
  contenido: Buffer
): Promise<Pieza> {
  const cifrado = cifrar(contenido, idCopia, nombre);
  const ruta = join(raiz, `${nombre}.enc`);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, cifrado);

  return {
    nombre,
    bytesEnClaro: contenido.length,
    bytesCifrados: cifrado.length,
    sha256EnClaro: sha256(contenido),
  };
}

/* -------------------------------------------------------------------------- */
/* Inventario de la base                                                       */
/* -------------------------------------------------------------------------- */

type Inventario = {
  filas: Record<string, number>;
  migracionMasAlta: string | null;
  versionesDeClave: number[];
  tablasCifradas: string[];
  particionesAudit: string[];
};

async function inventariar(url: string): Promise<Inventario> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    // Conteo por tabla real (las particiones se cuentan por su padre, que es lo
    // que un humano quiere leer en el manifiesto).
    const filas = await sql<{ tabla: string; n: number }[]>`
      select
        n.nspname || '.' || c.relname as tabla,
        (xpath(
          '/row/c/text()',
          query_to_xml(
            format('select count(*) as c from %I.%I', n.nspname, c.relname),
            false, true, ''
          )
        ))[1]::text::bigint as n
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p')
        and c.relispartition = false
        and n.nspname in ('public', 'auth', 'storage')
        and c.relname not in ('schema_migrations', 'migrations')
      order by 1
    `;

    const migracion = await sql<{ version: string }[]>`
      select version from supabase_migrations.schema_migrations
      order by version desc limit 1
    `;

    // Qué versiones de clave hacen falta para leer estos datos. Si el manifiesto
    // dice {1,2} y el gestor de secretos sólo guarda la 2, la copia está
    // incompleta aunque el archivo esté perfecto — y más vale saberlo hoy.
    //
    // Las tablas se descubren por catálogo en vez de ir en una lista a mano: una
    // tabla cifrada nueva entra sola. La primera versión de esto sí llevaba la
    // lista escrita, nombraba una columna que no existía, y un `.catch` convertía
    // el error en «ninguna clave necesaria» — un manifiesto que afirmaba en falso
    // que los datos se podían leer sin nada más. Aquí no se atrapa nada: si esta
    // consulta falla, la copia falla.
    const tablasConClave = await sql<{ tabla: string }[]>`
      select table_name as tabla
      from information_schema.columns
      where table_schema = 'public' and column_name = 'key_version'
      order by 1
    `;

    const claves = new Set<number>();
    for (const { tabla } of tablasConClave) {
      const filas = await sql<{ v: number }[]>`
        select distinct key_version as v
        from ${sql(tabla)}
        where key_version is not null
      `;
      for (const f of filas) claves.add(Number(f.v));
    }

    const particiones = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_inherits i on i.inhrelid = c.oid
      join pg_class p on p.oid = i.inhparent
      where p.relname = 'audit_log'
      order by 1
    `;

    return {
      filas: Object.fromEntries(
        filas.filter((f) => Number(f.n) > 0).map((f) => [f.tabla, Number(f.n)])
      ),
      migracionMasAlta: migracion[0]?.version ?? null,
      versionesDeClave: [...claves].sort((a, b) => a - b),
      tablasCifradas: tablasConClave.map((t) => t.tabla),
      particionesAudit: particiones.map((p) => p.relname),
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/* -------------------------------------------------------------------------- */
/* Volcado de datos                                                            */
/* -------------------------------------------------------------------------- */

async function volcarDatos(url: string, temporal: string): Promise<Buffer> {
  // Se usa la CLI de Supabase y no un pg_dump del sistema: aquí no hay ninguno
  // instalado, y la versión de la CLI está fijada en package-lock.json, así que
  // el volcado se hace con la misma herramienta en el portátil y en el servidor.
  //
  // El volcado arranca con `session_replication_role = replica`, que desactiva
  // los triggers durante la carga. Es imprescindible: con ellos activos,
  // `app.audit_seal()` recalcularía el hash de cada evento al reinsertarlo y la
  // bitácora restaurada no sería la original, sino una cadena nueva con el
  // mismo contenido. Una bitácora que se re-sella al restaurarse no prueba
  // nada.
  await ejecutar(
    process.execPath,
    [cliSupabase, 'db', 'dump', '--db-url', url, '--data-only', '-f', temporal],
    { maxBuffer: 1024 * 1024 * 64 }
  );

  const sql = await readFile(temporal);
  await rm(temporal, { force: true });
  return sql;
}

/* -------------------------------------------------------------------------- */
/* Archivos del bucket                                                         */
/* -------------------------------------------------------------------------- */

const BUCKET = 'clinical';

type ArchivoCopiado = { ruta: string; pieza: Pieza };

async function copiarArchivos(
  raiz: string,
  idCopia: string
): Promise<{ archivos: ArchivoCopiado[]; aviso: string | null }> {
  const urlApi = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!urlApi || !servicio) {
    return {
      archivos: [],
      aviso:
        'Sin NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY: los estudios NO se han copiado.',
    };
  }

  const supabase = createClient(urlApi, servicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // El bucket está organizado por institución: `<tenant_id>/<paciente>/<archivo>`.
  // `list()` no es recursivo, así que se recorre a mano.
  async function listar(prefijo: string): Promise<string[]> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefijo, { limit: 1000 });
    if (error) throw error;

    const rutas: string[] = [];
    for (const entrada of data ?? []) {
      const completa = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
      // Una carpeta se distingue por no tener metadatos de objeto.
      if (entrada.id === null) rutas.push(...(await listar(completa)));
      else rutas.push(completa);
    }
    return rutas;
  }

  const rutas = await listar('');
  const archivos: ArchivoCopiado[] = [];

  for (const ruta of rutas) {
    const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
    if (error) throw new Error(`No se pudo descargar ${ruta}: ${error.message}`);
    const contenido = Buffer.from(await data.arrayBuffer());
    const pieza = await escribirPieza(
      raiz,
      idCopia,
      `archivos/${ruta}`,
      contenido
    );
    archivos.push({ ruta, pieza });
  }

  return { archivos, aviso: null };
}

/* -------------------------------------------------------------------------- */
/* Principal                                                                   */
/* -------------------------------------------------------------------------- */

async function main() {
  // La marca de tiempo va en UTC y con guiones: ordena bien alfabéticamente y
  // no lleva `:`, que Windows no admite en nombres de archivo.
  const ahora = new Date();
  const idCopia = ahora.toISOString().replace(/[:.]/g, '-');
  const raiz = join(destinoRaiz, `saniti-${idCopia}`);

  await mkdir(raiz, { recursive: true });
  console.log(`Copia de seguridad → ${raiz}`);

  console.log('  · inventariando…');
  const inventario = await inventariar(urlBase!);

  console.log('  · volcando datos…');
  const sqlPlano = await volcarDatos(urlBase!, join(raiz, '.datos.tmp.sql'));
  // Se comprime antes de cifrar: al revés no serviría de nada, porque el texto
  // cifrado es incompresible por construcción.
  const datos = gzipSync(sqlPlano, { level: 9 });
  const piezaDatos = await escribirPieza(raiz, idCopia, 'datos.sql.gz', datos);

  console.log('  · copiando estudios…');
  const { archivos, aviso } = await copiarArchivos(raiz, idCopia);

  const totalFilas = Object.values(inventario.filas).reduce((a, b) => a + b, 0);

  const manifiesto = {
    formato: 'saniti-backup/v1',
    idCopia,
    creada: ahora.toISOString(),
    origen: urlBase!.replace(/:\/\/[^@]*@/, '://***@'),
    cifrado: {
      algoritmo: 'aes-256-gcm',
      aad: `saniti:backup:v1:${idCopia}:<pieza>`,
      clave: 'SANITI_BACKUP_KEY',
    },
    // Lo que hace falta para poder LEER estos datos una vez restaurados. Sin
    // estas versiones de clave, lo cifrado queda ilegible para siempre.
    clavesDeCifradoNecesarias: inventario.versionesDeClave,
    tablasCifradas: inventario.tablasCifradas,
    esquema: {
      migracionMasAlta: inventario.migracionMasAlta,
      nota: 'El esquema no se copia: se reconstruye con supabase/migrations/.',
      particionesAudit: inventario.particionesAudit,
    },
    datos: { ...piezaDatos, bytesSinComprimir: sqlPlano.length },
    filas: inventario.filas,
    totalFilas,
    archivos: {
      bucket: BUCKET,
      total: archivos.length,
      bytes: archivos.reduce((a, f) => a + f.pieza.bytesEnClaro, 0),
      piezas: archivos.map((f) => ({ ruta: f.ruta, ...f.pieza })),
    },
    avisos: aviso ? [aviso] : [],
  };

  await writeFile(
    join(raiz, 'manifiesto.json'),
    JSON.stringify(manifiesto, null, 2) + '\n',
    'utf8'
  );

  console.log('');
  console.log(`  datos        ${totalFilas} filas en ${Object.keys(inventario.filas).length} tablas`);
  console.log(`  estudios     ${archivos.length} archivos`);
  console.log(`  bitácora     ${inventario.filas['public.audit_log'] ?? 0} eventos`);
  console.log(
    `  claves       versión(es) ${inventario.versionesDeClave.join(', ') || '—'} necesarias para descifrar`
  );
  if (aviso) console.log(`\n  AVISO: ${aviso}`);
  console.log('');
  console.log('Una copia que nunca se ha restaurado no es una copia. Ensáyela:');
  console.log('    npm run backup:ensayo');
}

main().catch((err) => {
  console.error('\nLa copia FALLÓ:', err instanceof Error ? err.message : err);
  process.exit(1);
});
