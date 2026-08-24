/**
 * Comprueba que src/lib/db/types.ts siga reflejando la base de datos real.
 *
 * Las migraciones SQL son la única fuente de verdad, pero TypeScript necesita
 * copias de los enums para poder ayudar. Esas copias se pudren en silencio: se
 * añade un rol en una migración, nadie toca el archivo de tipos y el compilador
 * sigue tan contento mientras la interfaz ignora el rol nuevo.
 *
 * Verifica también algo más importante: que toda tabla de `public` tenga RLS y
 * políticas, y que ninguna función SECURITY DEFINER haya quedado sin
 * search_path fijo. Es la misma comprobación que 9999_verify_security.sql, pero
 * ejecutable desde CI contra un entorno ya desplegado.
 *
 *   DATABASE_URL=postgres://... node scripts/check-schema-drift.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// .env.local no lo carga npm por su cuenta, y es donde vive DATABASE_URL
// cuando se trabaja contra el Supabase local.
const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  const { config } = await import('dotenv');
  config({ path: envLocal, quiet: true });
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log(
    'DATABASE_URL no está definida: se omite la comprobación de deriva.\n' +
      'Para ejecutarla, tome la cadena de conexión del panel de Supabase\n' +
      '(Project Settings → Database → Connection string).'
  );
  process.exit(0);
}

const postgres = (await import('postgres')).default;
const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });

/** Extrae `export const NOMBRE = [...] as const` del archivo de tipos. */
function readTsConst(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
  if (!match) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

const typesSource = readFileSync(join(process.cwd(), 'src', 'lib', 'db', 'types.ts'), 'utf8');

// enum de Postgres → constante de TypeScript.
//
// Sólo se comparan los que aparecen aquí. La lista se quedó corta una vez —ocho
// de quince constantes vigiladas— y seis enums podían derivar en silencio, así
// que abajo hay una comprobación que detecta constantes que parecen espejo de un
// enum y no están registradas.
const ENUM_MAP = {
  member_role: 'MEMBER_ROLES',
  tenant_kind: 'TENANT_KINDS',
  appointment_status: 'APPOINTMENT_STATUSES',
  appointment_source: 'APPOINTMENT_SOURCES',
  encounter_kind: 'ENCOUNTER_KINDS',
  encounter_status: 'ENCOUNTER_STATUSES',
  consent_purpose: 'CONSENT_PURPOSES',
  audit_action: 'AUDIT_ACTIONS',
  document_kind: 'DOCUMENT_KINDS',
  sex_at_birth: 'SEX_AT_BIRTH',
  id_document: 'ID_DOCUMENTS',
  patient_status: 'PATIENT_STATUSES',
  allergy_severity: 'ALLERGY_SEVERITIES',
  diagnosis_kind: 'DIAGNOSIS_KINDS',
};

const problems = [];

try {
  // --- 1. Enums ---
  const enums = await sql`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'app'
    group by t.typname
  `;

  for (const [pgName, tsName] of Object.entries(ENUM_MAP)) {
    const row = enums.find((e) => e.name === pgName);
    if (!row) {
      problems.push(`El enum app.${pgName} no existe en la base de datos`);
      continue;
    }

    const tsValues = readTsConst(typesSource, tsName);
    if (!tsValues) {
      problems.push(`No se encontró ${tsName} en src/lib/db/types.ts`);
      continue;
    }

    const dbValues = [...row.labels].sort();
    const faltanEnTs = dbValues.filter((v) => !tsValues.includes(v));
    const sobranEnTs = tsValues.filter((v) => !dbValues.includes(v));

    if (faltanEnTs.length) {
      problems.push(`${tsName}: faltan en TypeScript → ${faltanEnTs.join(', ')}`);
    }
    if (sobranEnTs.length) {
      problems.push(`${tsName}: ya no existen en la base → ${sobranEnTs.join(', ')}`);
    }
  }

  // --- 1b. Constantes que parecen espejo de un enum y nadie vigila ---
  //
  // Registrar un enum en ENUM_MAP es un paso que se olvida, y olvidarlo no
  // produce ningún síntoma: la comparación simplemente no se hace. Esto detecta
  // toda constante exportada en MAYÚSCULAS cuyo nombre corresponda a un enum de
  // `app` y que no esté en el mapa.
  const yaVigiladas = new Set(Object.values(ENUM_MAP));
  const constantesTs = [...typesSource.matchAll(/export const ([A-Z][A-Z0-9_]*) = \[/g)].map(
    (m) => m[1]
  );

  for (const nombre of constantesTs) {
    if (yaVigiladas.has(nombre) || nombre === 'PERMISSIONS') continue;

    // ALLERGY_SEVERITIES → allergy_severit(y|ies)… la pluralización castellana
    // del inglés no es mecánica, así que se compara por prefijo del singular.
    const base = nombre.toLowerCase().replace(/(ies|es|s)$/, '');
    const candidato = enums.find(
      (e) => e.name === base || e.name.startsWith(base) || base.startsWith(e.name)
    );

    if (candidato) {
      problems.push(
        `${nombre} refleja el enum app.${candidato.name} pero NO está en ENUM_MAP: ` +
          'su deriva no se comprueba. Añádalo a scripts/check-schema-drift.mjs.'
      );
    }
  }

  // --- 2. Permisos ---
  const perms = await sql`select key from public.permissions order by key`;
  const tsPerms = readTsConst(typesSource, 'PERMISSIONS') ?? [];
  const dbPerms = perms.map((p) => p.key).sort();

  const permsFaltan = dbPerms.filter((p) => !tsPerms.includes(p));
  const permsSobran = tsPerms.filter((p) => !dbPerms.includes(p));
  if (permsFaltan.length) problems.push(`PERMISSIONS: faltan → ${permsFaltan.join(', ')}`);
  if (permsSobran.length) problems.push(`PERMISSIONS: sobran → ${permsSobran.join(', ')}`);

  // --- 3. Postura de seguridad en el entorno desplegado ---
  const findings = await sql`select * from app.security_report()`;
  for (const f of findings) {
    problems.push(`[${f.severity}] ${f.object_name}: ${f.finding}`);
  }

  // --- 4. Integridad de la cadena de auditoría, por institución ---
  const tenants = await sql`select id, legal_name from public.tenants where deleted_at is null`;
  for (const t of tenants) {
    const [check] = await sql`select * from app.verify_audit_chain(${t.id})`;
    if (check?.broken_at_id) {
      problems.push(
        `Bitácora de "${t.legal_name}" alterada: la cadena se rompe en el evento ` +
          `${check.broken_at_id} (${check.broken_at}) tras ${check.checked} eventos válidos`
      );
    }
  }
  if (tenants.length) {
    console.log(`Cadena de auditoría verificada en ${tenants.length} institución/es.`);
  }
} catch (err) {
  console.error('No se pudo completar la comprobación:', err.message);
  await sql.end();
  process.exit(1);
}

await sql.end();

if (problems.length) {
  console.error(`\n${problems.length} problema(s):`);
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

console.log('El esquema y los tipos coinciden. Postura de seguridad correcta.');
