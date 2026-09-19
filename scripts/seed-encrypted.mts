/**
 * Datos de desarrollo que la semilla SQL no puede crear.
 *
 *   npm run db:seed-cifrado
 *
 * `supabase/seed.sql` deja el entorno con pacientes, citas y horarios, pero
 * TODO lo cifrado se queda vacío: las claves viven en el proceso de Node
 * (`SANITI_ENCRYPTION_KEYS`) y Postgres no las conoce ni debe conocerlas. El
 * efecto secundario es que quien arranca el proyecto por primera vez nunca ve
 * una nota clínica ni una cédula guardada, que son justo las dos cosas que más
 * cuidado exigen.
 *
 * Y para el ensayo de restauración importa todavía más: una copia de seguridad
 * de datos sin cifrar no demuestra lo que hay que demostrar. Restaurar bien
 * significa que el texto vuelve a ser LEGIBLE con las claves actuales, no sólo
 * que las filas estén ahí.
 *
 * Es idempotente: vuelve a cifrar los mismos valores sobre las mismas filas.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { config } from 'dotenv';
import postgres from 'postgres';

import { encryptNationalId, encryptField } from '../src/lib/security/crypto';

const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) config({ path: envLocal, quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env.local.');
  process.exit(1);
}

/** Cédulas válidas por el dígito verificador (módulo 10), como exige el alta. */
const CEDULAS = ['1312345678', '1309876543'];

const NOTA = [
  'S: Paciente refiere cefalea opresiva de tres días, predominio vespertino.',
  'Niega fiebre, fotofobia ni déficit neurológico. Duerme cinco horas.',
  '',
  'O: TA 128/84. FC 78. Afebril. Examen neurológico sin focalidad.',
  '',
  'A: Cefalea tensional.',
  '',
  'P: Higiene del sueño, analgesia simple. Control en dos semanas o antes si',
  'aparece déficit, fiebre o el dolor cambia de patrón.',
].join('\n');

async function main() {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });

  try {
    const pacientes = await sql<{ id: string; given_name: string }[]>`
      select id, given_name from public.patients
      where deleted_at is null order by record_number limit 2
    `;

    if (pacientes.length === 0) {
      console.error('No hay pacientes. Ejecute antes: npm run db:reset');
      process.exit(1);
    }

    // --- Cédulas ---------------------------------------------------------
    let conCedula = 0;
    for (const [i, p] of pacientes.entries()) {
      const cedula = CEDULAS[i % CEDULAS.length];
      const c = encryptNationalId(cedula, p.id);

      await sql`
        update public.patients set
          national_id_enc   = ${c.national_id_enc},
          national_id_bidx  = ${sql`decode(${c.national_id_bidx.toString('hex')}, 'hex')`},
          national_id_last4 = ${c.national_id_last4},
          key_version       = ${c.key_version}
        where id = ${p.id}
      `;
      conCedula++;
    }

    // --- Una nota clínica ------------------------------------------------
    const [encuentro] = await sql<
      { id: string; tenant_id: string; patient_id: string; provider_id: string }[]
    >`
      select id, tenant_id, patient_id, provider_id
      from public.encounters order by started_at desc limit 1
    `;

    let notas = 0;
    if (encuentro) {
      const yaHay = await sql<{ id: string }[]>`
        select id from public.clinical_notes where patient_id = ${encuentro.patient_id} limit 1
      `;

      if (yaHay.length === 0) {
        const noteId = randomUUID();
        // El id se genera aquí porque el cifrado va ligado a la fila que va a
        // ocupar: sin conocerlo de antemano no se puede construir esa ligadura.
        const cifrada = encryptField(NOTA, {
          table: 'clinical_notes',
          column: 'content',
          rowId: noteId,
        });

        await sql`
          insert into public.clinical_notes
            (id, tenant_id, patient_id, encounter_id, content_enc, key_version, author_id, word_count)
          values (
            ${noteId}, ${encuentro.tenant_id}, ${encuentro.patient_id}, ${encuentro.id},
            ${cifrada.ciphertext}, ${cifrada.keyVersion}, ${encuentro.provider_id},
            ${NOTA.split(/\s+/).filter(Boolean).length}
          )
        `;
        notas = 1;
      }
    }

    console.log(`Cédulas cifradas: ${conCedula}`);
    console.log(`Notas clínicas:   ${notas === 1 ? '1 creada' : 'ya existían'}`);
    console.log('');
    console.log('Ahora la copia de seguridad tiene algo cifrado que verificar.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('Falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
