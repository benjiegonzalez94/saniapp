import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { randomBytes } from 'node:crypto';

import {
  admin,
  agregarMiembro,
  comoUsuarioPersistente,
  crearInstitucion,
  eliminarUsuarios,
  limpiarInstitucion,
  type Institucion,
} from '@/lib/testing/db';
import {
  blindIndex,
  decryptField,
  encryptNationalId,
  resetCryptoCache,
} from '@/lib/security/crypto';

/**
 * Invariantes del padrón de pacientes, comprobados contra la base real.
 *
 * Dos importan especialmente:
 *
 *  · El correlativo de historia clínica no puede repetirse dentro de una
 *    institución ni depender de lo que hagan las demás.
 *  · El índice ciego debe impedir dar de alta dos veces al mismo documento en
 *    la misma institución, y a la vez permitirlo en instituciones distintas —el
 *    mismo paciente puede atenderse en dos clínicas y cada una lleva su ficha—.
 *    Si esto falla, se crean expedientes duplicados que nadie vuelve a
 *    encontrar, que es justo el problema del papel que venimos a resolver.
 */

let sql: postgres.Sql;
let clinicaA: Institucion;
let clinicaB: Institucion;
let medicoA: string;

beforeAll(async () => {
  process.env.SANITI_ENCRYPTION_KEYS ??= JSON.stringify({
    '1': randomBytes(32).toString('base64'),
  });
  process.env.SANITI_BLIND_INDEX_KEY ??= randomBytes(32).toString('base64');
  resetCryptoCache();

  sql = admin();
  clinicaA = await crearInstitucion(sql, 'Consultorio Manta');
  clinicaB = await crearInstitucion(sql, 'Consultorio Portoviejo');
  medicoA = await agregarMiembro(sql, clinicaA.id, 'physician', 'Dr. Piloto');
});

afterAll(async () => {
  for (const t of [clinicaA, clinicaB]) if (t) await limpiarInstitucion(sql, t.id);
  await eliminarUsuarios(
    sql,
    [clinicaA?.owner, clinicaB?.owner, medicoA].filter(Boolean) as string[]
  );
  await sql.end();
});

/** Inserta un paciente dejando que el trigger asigne el correlativo. */
async function alta(
  tenantId: string,
  nombre: string,
  apellido: string,
  cedula?: string
): Promise<{ id: string; record_number: number }> {
  const id = crypto.randomUUID();
  const cifrado = cedula ? encryptNationalId(cedula, id) : null;

  const [fila] = await sql<{ id: string; record_number: string }[]>`
    insert into public.patients
      (id, tenant_id, given_name, family_name, national_id_enc, national_id_bidx, national_id_last4)
    values (
      ${id}, ${tenantId}, ${nombre}, ${apellido},
      ${cifrado?.national_id_enc ?? null},
      ${cifrado ? sql`decode(${cifrado.national_id_bidx.toString('hex')}, 'hex')` : null},
      ${cifrado?.national_id_last4 ?? null}
    )
    returning id, record_number
  `;
  // postgres.js devuelve los bigint como cadena para no perder precisión.
  // A través de supabase-js llegan como número JSON, de ahí la diferencia con
  // el resto de la aplicación.
  return { id: fila.id, record_number: Number(fila.record_number) };
}

describe('numeración de historia clínica', () => {
  it('es correlativa dentro de la institución', async () => {
    const p1 = await alta(clinicaA.id, 'Ana', 'Uno');
    const p2 = await alta(clinicaA.id, 'Beto', 'Dos');
    const p3 = await alta(clinicaA.id, 'Carla', 'Tres');

    expect(p2.record_number).toBe(p1.record_number + 1);
    expect(p3.record_number).toBe(p2.record_number + 1);
  });

  it('cada institución lleva su propia serie', async () => {
    const enB = await alta(clinicaB.id, 'Diego', 'Cuatro');
    // La clínica B acaba de abrir: su primer paciente es el número 1, sin
    // importar cuántos lleve la A.
    expect(enB.record_number).toBe(1);
  });

  it('no se puede forzar un número repetido', async () => {
    const existente = await alta(clinicaA.id, 'Elsa', 'Cinco');
    await expect(
      sql`
        insert into public.patients (tenant_id, record_number, given_name, family_name)
        values (${clinicaA.id}, ${existente.record_number}, 'Falso', 'Duplicado')
      `
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('ninguna fila queda sin número', async () => {
    const [r] = await sql<{ n: string }[]>`
      select count(*) as n from public.patients where record_number is null`;
    expect(Number(r.n)).toBe(0);
  });
});

describe('documento de identidad cifrado', () => {
  // Un documento distinto por caso: el índice ciego es único por institución,
  // así que reutilizar el mismo haría chocar unas pruebas con otras.
  const DOC_EN_CLARO = '1712345675';
  const DOC_ROUNDTRIP = '1301234567';

  it('no se guarda en claro en ninguna columna', async () => {
    const p = await alta(clinicaA.id, 'Fabio', 'Seis', DOC_EN_CLARO);

    // `p::text` serializa la fila ENTERA: si el documento apareciera en
    // cualquier columna, incluso en una que se añada en el futuro, salta aquí.
    const [fila] = await sql<{ enc: string; last4: string; fila_completa: string }[]>`
      select p.national_id_enc as enc, p.national_id_last4 as last4, p::text as fila_completa
      from public.patients p where p.id = ${p.id}`;

    expect(fila.fila_completa).not.toContain(DOC_EN_CLARO);
    expect(fila.enc).not.toContain(DOC_EN_CLARO);
    expect(fila.last4).toBe('5675');
  });

  it('se puede descifrar de vuelta con la clave y la fila correctas', async () => {
    const p = await alta(clinicaA.id, 'Gina', 'Siete', DOC_ROUNDTRIP);

    const [fila] = await sql<{ enc: string }[]>`
      select national_id_enc as enc from public.patients where id = ${p.id}`;

    const descifrado = decryptField(
      { ciphertext: fila.enc, keyVersion: 1 },
      { table: 'patients', column: 'national_id', rowId: p.id }
    );
    expect(descifrado).toBe(DOC_ROUNDTRIP);
  });

  it('no se descifra desde la fila de otro paciente', async () => {
    const p = await alta(clinicaA.id, 'Nora', 'Diez', '0102030405');
    const otro = await alta(clinicaA.id, 'Otro', 'Paciente');

    const [fila] = await sql<{ enc: string }[]>`
      select national_id_enc as enc from public.patients where id = ${p.id}`;

    // Copiar el texto cifrado a otra ficha no lo hace legible: va ligado a su
    // fila. Éste es el ataque que la ligadura por contexto (AAD) impide.
    expect(() =>
      decryptField(
        { ciphertext: fila.enc, keyVersion: 1 },
        { table: 'patients', column: 'national_id', rowId: otro.id }
      )
    ).toThrow(/manipulado o movido/i);
  });

  it('permite encontrar al paciente por índice ciego sin descifrar', async () => {
    const p = await alta(clinicaA.id, 'Hugo', 'Ocho', '0912345678');

    const [encontrado] = await sql<{ id: string }[]>`
      select id from public.patients
      where tenant_id = ${clinicaA.id}
        and national_id_bidx = decode(${blindIndex('0912345678').toString('hex')}, 'hex')`;

    expect(encontrado.id).toBe(p.id);
  });

  it('rechaza dar de alta el mismo documento dos veces en la institución', async () => {
    await alta(clinicaA.id, 'Irma', 'Nueve', '1104567890');
    await expect(alta(clinicaA.id, 'Irma', 'Repetida', '1104567890')).rejects.toThrow(
      /duplicate key|unique/i
    );
  });

  it('pero el mismo paciente sí puede existir en otra institución', async () => {
    // Un paciente que se atiende en dos consultorios tiene una ficha en cada
    // uno: son responsables de datos distintos, no un expediente compartido.
    const enB = await alta(clinicaB.id, 'Irma', 'Nueve', '1104567890');
    expect(enB.id).toBeTruthy();
  });
});

describe('acceso desde la sesión del médico', () => {
  it('el médico ve por RLS los pacientes que se crearon con superusuario', async () => {
    const filas = await comoUsuarioPersistente(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      (tx) => tx<{ n: string }[]>`select count(*) as n from public.patients`
    );
    expect(Number(filas[0].n)).toBeGreaterThan(0);
  });

  it('y no ve ninguno de la otra institución', async () => {
    const filas = await comoUsuarioPersistente(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      (tx) => tx<{ n: string }[]>`
        select count(*) as n from public.patients where tenant_id = ${clinicaB.id}`
    );
    expect(Number(filas[0].n)).toBe(0);
  });
});
