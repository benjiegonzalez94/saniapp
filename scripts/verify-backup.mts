/**
 * Ensayo de restauración.
 *
 *   npm run backup:ensayo              # verifica la copia SIN tocar la base
 *   npm run backup:ensayo -- --si      # además la restaura de verdad
 *   npm run backup:ensayo -- --copia copias/saniti-2026-…
 *
 * Una copia que nunca se ha restaurado no es una copia: es un archivo del que
 * se supone algo. Esto lo comprueba en dos fases.
 *
 * FASE 1 — sin tocar nada. Descifra cada pieza, coteja su huella contra el
 * manifiesto y confirma que las claves de cifrado que hay hoy en el entorno son
 * las que la copia dice necesitar. Si algo falla aquí, se sabe ANTES de haber
 * borrado nada.
 *
 * FASE 2 — la restauración real, sólo con `--si`. Y es la restauración real a
 * propósito: reaplica las migraciones sobre la base local y carga el volcado
 * encima, que es palabra por palabra lo que habría que hacer un martes a las
 * tres de la mañana. Un ensayo que siguiera un camino distinto del real
 * ensayaría el camino equivocado.
 *
 * Lo que se comprueba después de restaurar:
 *
 *   · Los conteos por tabla cuadran con el manifiesto.
 *   · La cadena de auditoría sigue íntegra. Esto es más fino de lo que parece:
 *     el volcado desactiva los triggers al cargar, así que los hashes son los
 *     originales y no unos nuevos recalculados. Si alguien "arreglara" eso, la
 *     bitácora restaurada dejaría de probar nada y esta comprobación lo caza.
 *   · Lo cifrado vuelve a ser LEGIBLE. Es la diferencia entre recuperar filas y
 *     recuperar un historial clínico: sin las claves, lo segundo no ocurre.
 *
 * AVISO: `--si` reemplaza la base LOCAL. Los datos de desarrollo se pierden y
 * se recuperan con `npm run db:reset && npm run db:seed-cifrado`.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { config } from 'dotenv';
import postgres from 'postgres';

import { decryptField } from '../src/lib/security/crypto';

const ejecutar = promisify(execFile);
const cliSupabase = createRequire(import.meta.url).resolve('supabase/dist/supabase.js');

const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) config({ path: envLocal, quiet: true });

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tiene = (n: string) => process.argv.includes(`--${n}`);

const urlBase = argumento('url') ?? process.env.DATABASE_URL;
const claveB64 = process.env.SANITI_BACKUP_KEY;

if (!urlBase || !claveB64) {
  console.error('Faltan DATABASE_URL o SANITI_BACKUP_KEY en .env.local.');
  process.exit(1);
}
const clave = Buffer.from(claveB64, 'base64');

/* -------------------------------------------------------------------------- */
/* Localizar la copia                                                          */
/* -------------------------------------------------------------------------- */

function ultimaCopia(): string {
  const raiz = join(process.cwd(), 'copias');
  if (!existsSync(raiz)) {
    console.error('No hay carpeta ./copias. Ejecute antes: npm run backup');
    process.exit(1);
  }
  // Los nombres llevan la marca de tiempo ISO, que ordena alfabéticamente.
  const dirs = readdirSync(raiz)
    .filter((d) => d.startsWith('saniti-'))
    .sort();
  if (dirs.length === 0) {
    console.error('No hay ninguna copia en ./copias. Ejecute: npm run backup');
    process.exit(1);
  }
  return join(raiz, dirs[dirs.length - 1]);
}

const dirCopia = argumento('copia') ?? ultimaCopia();

/* -------------------------------------------------------------------------- */
/* Descifrado                                                                  */
/* -------------------------------------------------------------------------- */

function descifrar(cifrado: Buffer, idCopia: string, pieza: string): Buffer {
  if (cifrado.length < 12 + 16) {
    throw new Error(`La pieza "${pieza}" está truncada.`);
  }
  const iv = cifrado.subarray(0, 12);
  const tag = cifrado.subarray(cifrado.length - 16);
  const cuerpo = cifrado.subarray(12, cifrado.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAAD(Buffer.from(`saniti:backup:v1:${idCopia}:${pieza}`, 'utf8'));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(cuerpo), decipher.final()]);
  } catch {
    // GCM no distingue "clave equivocada" de "bytes alterados": en ambos casos
    // falla la etiqueta. Decirlo así evita que alguien concluya que la copia
    // está rota cuando lo que tiene es la clave de otro entorno.
    throw new Error(
      `La pieza "${pieza}" no autentica. O SANITI_BACKUP_KEY no es la que la ` +
        'cifró, o el archivo fue alterado o truncado.'
    );
  }
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/* -------------------------------------------------------------------------- */

type Manifiesto = {
  formato: string;
  idCopia: string;
  creada: string;
  clavesDeCifradoNecesarias: number[];
  tablasCifradas: string[];
  esquema: { migracionMasAlta: string | null };
  datos: { nombre: string; sha256EnClaro: string; bytesSinComprimir: number };
  filas: Record<string, number>;
  totalFilas: number;
  archivos: {
    total: number;
    piezas: { ruta: string; nombre: string; sha256EnClaro: string }[];
  };
  avisos: string[];
};

let fallos = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const mal = (m: string) => {
  fallos++;
  console.log(`  ✗ ${m}`);
};

async function main() {
  console.log(`Ensayo de restauración\n  copia: ${dirCopia}\n`);

  const manifiesto = JSON.parse(
    await readFile(join(dirCopia, 'manifiesto.json'), 'utf8')
  ) as Manifiesto;

  if (manifiesto.formato !== 'saniti-backup/v1') {
    console.error(`Formato desconocido: ${manifiesto.formato}`);
    process.exit(1);
  }

  console.log(`  creada el ${manifiesto.creada}`);
  console.log(`  migraciones hasta ${manifiesto.esquema.migracionMasAlta}`);
  if (manifiesto.avisos.length) {
    for (const a of manifiesto.avisos) console.log(`  AVISO DE LA COPIA: ${a}`);
  }

  /* --- Fase 1: integridad, sin tocar la base --------------------------- */
  console.log('\nFase 1 · integridad de la copia');

  const datosCifrados = await readFile(join(dirCopia, `${manifiesto.datos.nombre}.enc`));
  const datosGz = descifrar(datosCifrados, manifiesto.idCopia, manifiesto.datos.nombre);

  if (sha256(datosGz) === manifiesto.datos.sha256EnClaro) {
    ok('el volcado descifra y su huella coincide con el manifiesto');
  } else {
    mal('la huella del volcado NO coincide: la copia está alterada');
  }

  const sqlPlano = gunzipSync(datosGz);
  const sqlTexto = sqlPlano.toString('utf8');

  // Se compara la longitud del Buffer, no la de la cadena. `String.length`
  // cuenta unidades UTF-16 y el volcado va en UTF-8: cada tilde de los
  // comentarios en español vale dos bytes y uno solo de cadena, así que
  // compararlas daba un descuadre de doscientos y pico en una copia perfecta.
  if (sqlPlano.length === manifiesto.datos.bytesSinComprimir) {
    ok(`descomprime a ${sqlPlano.length} bytes, como dice el manifiesto`);
  } else {
    mal(
      `descomprime a ${sqlPlano.length} bytes y el manifiesto dice ${manifiesto.datos.bytesSinComprimir}`
    );
  }

  // Sin esta línea los triggers se dispararían al cargar y `app.audit_seal()`
  // resellaría la bitácora con hashes nuevos.
  if (sqlTexto.includes('session_replication_role = replica')) {
    ok('el volcado desactiva los triggers al cargar (la bitácora no se resella)');
  } else {
    mal('el volcado NO desactiva los triggers: la bitácora se resellaría al restaurar');
  }

  let archivosMal = 0;
  for (const pieza of manifiesto.archivos.piezas) {
    const bytes = descifrar(
      await readFile(join(dirCopia, `${pieza.nombre}.enc`)),
      manifiesto.idCopia,
      pieza.nombre
    );
    if (sha256(bytes) !== pieza.sha256EnClaro) archivosMal++;
  }
  if (manifiesto.archivos.total === 0) {
    console.log('  – no hay estudios en esta copia (nada que verificar)');
  } else if (archivosMal === 0) {
    ok(`los ${manifiesto.archivos.total} estudios descifran y sus huellas coinciden`);
  } else {
    mal(`${archivosMal} de ${manifiesto.archivos.total} estudios no verifican`);
  }

  // Las claves de campo no están en la copia. Comprobar aquí que las del
  // entorno cubren lo que la copia necesita evita descubrirlo después de haber
  // reemplazado la base.
  const disponibles = new Set(
    Object.keys(JSON.parse(process.env.SANITI_ENCRYPTION_KEYS ?? '{}')).map(Number)
  );
  const faltan = manifiesto.clavesDeCifradoNecesarias.filter((v) => !disponibles.has(v));
  if (manifiesto.clavesDeCifradoNecesarias.length === 0) {
    console.log('  – la copia no contiene nada cifrado a nivel de campo');
  } else if (faltan.length === 0) {
    ok(
      `están las claves de cifrado que la copia necesita (versión ${manifiesto.clavesDeCifradoNecesarias.join(', ')})`
    );
  } else {
    mal(
      `FALTAN las claves de versión ${faltan.join(', ')}: lo cifrado sería irrecuperable`
    );
  }

  if (!tiene('si')) {
    console.log(
      [
        '',
        fallos === 0
          ? 'La copia está íntegra. Pero restaurarla es lo único que lo demuestra.'
          : `La copia tiene ${fallos} problema(s). NO se ha restaurado nada.`,
        '',
        'Para ensayar la restauración de verdad:',
        '',
        '    npm run backup:ensayo -- --si',
        '',
        'Reemplaza la base LOCAL con el contenido de la copia. Los datos de',
        'desarrollo se recuperan después con:',
        '',
        '    npm run db:reset && npm run db:seed-cifrado',
      ].join('\n')
    );
    process.exit(fallos === 0 ? 0 : 1);
  }

  if (fallos > 0) {
    console.error('\nNo se restaura una copia que ya falló la verificación.');
    process.exit(1);
  }

  /* --- Fase 2: restaurar de verdad ------------------------------------- */
  console.log('\nFase 2 · restauración real sobre la base local');

  console.log('  · reaplicando migraciones (db reset --no-seed)…');
  await ejecutar(process.execPath, [cliSupabase, 'db', 'reset', '--no-seed'], {
    maxBuffer: 1024 * 1024 * 32,
  });

  console.log('  · cargando el volcado…');
  const sql = postgres(urlBase!, { max: 1, onnotice: () => {} });

  try {
    // Vaciar antes de cargar. No es una precaución: sin esto la restauración
    // FALLA, y así es como se descubrió.
    //
    // Varias tablas las llenan las propias migraciones, no la semilla:
    // `icd10_codes` (0013), `medications` (0014), `permissions` y
    // `role_permissions` (0002), `plans` (0010). Tras reaplicar migraciones
    // esas tablas ya tienen sus filas, y el volcado —que también las trae—
    // choca contra su propia clave primaria:
    //
    //     duplicate key value violates unique constraint "icd10_codes_pkey"
    //
    // O sea: el procedimiento de recuperación estaba roto y ninguna
    // comprobación de integridad del archivo lo habría dicho. Sólo restaurar
    // de verdad lo delata.
    //
    // Se vacía TODO lo que el volcado va a reponer, no sólo los catálogos: el
    // volcado es la verdad y mezclarlo con restos de las migraciones daría una
    // base que no es ni lo uno ni lo otro. `session_replication_role` apaga
    // las claves ajenas y los triggers de bloqueo mientras dura.
    const tablas = await sql<{ t: string }[]>`
      select quote_ident(n.nspname) || '.' || quote_ident(c.relname) as t
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p')
        and c.relispartition = false
        and n.nspname in ('public', 'auth', 'storage')
        -- El control de versiones interno de Supabase NO se toca: describe el
        -- estado de la instancia, no los datos de SaniTi.
        and c.relname not in ('schema_migrations', 'migrations')
        -- Storage trae tablas propias que no pertenecen al rol postgres
        -- (buckets_vectors entre ellas) y truncarlas da «permission denied».
        -- Tampoco las vuelca pg_dump, así que no hay nada que reponer en ellas:
        -- se filtran por privilegio real en vez de por una lista de nombres que
        -- se quedaría corta en la próxima versión de Supabase.
        and has_table_privilege(current_user, c.oid, 'TRUNCATE')
    `;

    await sql.unsafe(
      `set session_replication_role = replica;
       truncate table ${tablas.map((x) => x.t).join(', ')} cascade;`
    );
    console.log(`  · vaciadas ${tablas.length} tablas antes de cargar`);

    // Protocolo simple: el volcado son muchas sentencias sin parámetros, y
    // `unsafe` las envía tal cual. El nombre asusta pero aquí el contenido es
    // nuestro propio pg_dump ya autenticado por GCM en la fase 1.
    await sql.unsafe(sqlTexto);
    console.log('  · verificando…\n');

    /* Conteos */
    let descuadres = 0;
    for (const [tabla, esperado] of Object.entries(manifiesto.filas)) {
      const [esquema, nombre] = tabla.split('.');
      const [fila] = await sql<{ n: string }[]>`
        select count(*)::text as n from ${sql(esquema)}.${sql(nombre)}
      `;
      if (Number(fila.n) !== esperado) {
        mal(`${tabla}: ${fila.n} filas, el manifiesto dice ${esperado}`);
        descuadres++;
      }
    }
    if (descuadres === 0) {
      ok(`las ${manifiesto.totalFilas} filas están, tabla por tabla`);
    }

    /* Cadena de auditoría */
    const instituciones = await sql<{ id: string; nombre: string }[]>`
      select id, coalesce(commercial_name, legal_name) as nombre from public.tenants
    `;
    let cadenasRotas = 0;
    for (const t of instituciones) {
      const roto = await sql<{ broken_at_id: string | null }[]>`
        select broken_at_id from app.verify_audit_chain(${t.id})
      `;
      if (roto.length > 0 && roto[0].broken_at_id !== null) {
        mal(`la bitácora de «${t.nombre}» está rota en el evento ${roto[0].broken_at_id}`);
        cadenasRotas++;
      }
    }
    if (cadenasRotas === 0) {
      ok(
        `la cadena de auditoría sigue íntegra en ${instituciones.length} institución/es tras restaurar`
      );
    }

    /* Lo cifrado vuelve a leerse */
    const notas = await sql<
      { id: string; content_enc: string; key_version: number }[]
    >`select id, content_enc, key_version from public.clinical_notes limit 3`;

    let ilegibles = 0;
    for (const n of notas) {
      try {
        const texto = decryptField(
          { ciphertext: n.content_enc, keyVersion: n.key_version },
          { table: 'clinical_notes', column: 'content', rowId: n.id }
        );
        if (texto.length === 0) ilegibles++;
      } catch {
        ilegibles++;
      }
    }

    const cedulas = await sql<
      { id: string; national_id_enc: string; key_version: number }[]
    >`select id, national_id_enc, key_version from public.patients
        where national_id_enc is not null limit 3`;

    for (const c of cedulas) {
      try {
        decryptField(
          { ciphertext: c.national_id_enc, keyVersion: c.key_version },
          { table: 'patients', column: 'national_id', rowId: c.id }
        );
      } catch {
        ilegibles++;
      }
    }

    const cifradas = notas.length + cedulas.length;
    if (cifradas === 0) {
      console.log('  – no hay filas cifradas que descifrar (ejecute db:seed-cifrado)');
    } else if (ilegibles === 0) {
      ok(
        `${cifradas} valor(es) cifrado(s) se descifran tras restaurar: notas clínicas y cédulas`
      );
    } else {
      mal(`${ilegibles} de ${cifradas} valores cifrados NO se pudieron descifrar`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log('');
  if (fallos === 0) {
    console.log('ENSAYO SUPERADO. Esta copia se puede restaurar y lo restaurado se lee.');
    console.log('');
    console.log('La base local contiene ahora los datos de la copia. Para volver a los');
    console.log('de desarrollo:  npm run db:reset && npm run db:seed-cifrado');
  } else {
    console.log(`ENSAYO FALLIDO: ${fallos} problema(s).`);
  }
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nEl ensayo falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
