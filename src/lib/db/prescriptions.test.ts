import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';

import {
  admin,
  agregarMiembro,
  crearInstitucion,
  crearPaciente,
  eliminarUsuarios,
  limpiarInstitucion,
  type Institucion,
} from '@/lib/testing/db';

/**
 * El cruce de alergias con la prescripción.
 *
 * Es la comprobación con más consecuencias de todo el sistema: un falso
 * negativo aquí es una reacción alérgica evitable. Se prueba contra la base
 * porque la lógica vive en public.verificar_alergias, para que cualquier camino
 * que prescriba —la consulta, una receta suelta, un futuro flujo por WhatsApp—
 * consulte la misma verdad.
 */

let sql: postgres.Sql;
let clinica: Institucion;
let medico: string;
let paciente: string;

type Aviso = {
  medication_name: string;
  allergy_substance: string;
  match_kind: string;
};

async function verificar(codigos: string[]): Promise<Aviso[]> {
  return sql<Aviso[]>`
    select medication_name, allergy_substance, match_kind
    from public.verificar_alergias(${paciente}, ${sql.array(codigos)}::text[])`;
}

beforeAll(async () => {
  sql = admin();
  clinica = await crearInstitucion(sql, 'Consultorio de prueba');
  medico = await agregarMiembro(sql, clinica.id, 'physician', 'Dr. Prueba');
  paciente = await crearPaciente(sql, clinica.id, 'Alérgico', 'Prueba');

  await sql`
    insert into public.allergies (tenant_id, patient_id, substance, severity, recorded_by)
    values
      (${clinica.id}, ${paciente}, 'Penicilina', 'severa',   ${medico}),
      (${clinica.id}, ${paciente}, 'Ibuprofeno', 'leve',     ${medico}),
      (${clinica.id}, ${paciente}, 'Sulfas',     'mortal',   ${medico})
  `;
});

afterAll(async () => {
  if (clinica) await limpiarInstitucion(sql, clinica.id);
  await eliminarUsuarios(sql, [clinica?.owner, medico].filter(Boolean) as string[]);
  await sql.end();
});

describe('coincidencia directa', () => {
  it('avisa del mismo fármaco anotado en la alergia', async () => {
    const avisos = await verificar(['ibuprofeno']);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].match_kind).toBe('directa');
    expect(avisos[0].allergy_substance).toBe('Ibuprofeno');
  });
});

describe('coincidencia por familia', () => {
  it('amoxicilina avisa con una alergia a penicilina', async () => {
    // El caso clásico: los nombres no se parecen, la familia sí.
    const avisos = await verificar(['amoxicilina']);
    expect(avisos.some((a) => a.allergy_substance === 'Penicilina')).toBe(true);
    expect(avisos[0].match_kind).toBe('familia');
  });

  it('naproxeno avisa con una alergia a ibuprofeno', async () => {
    // Reactividad cruzada entre AINE. La alergia está anotada como fármaco
    // concreto, así que el aviso sólo aparece si la alergia se resuelve antes a
    // su propia familia.
    const avisos = await verificar(['naproxeno']);
    expect(avisos.some((a) => a.allergy_substance === 'Ibuprofeno')).toBe(true);
  });

  it('cefalexina avisa con una alergia a penicilina', async () => {
    // Cefalosporina frente a penicilina: 1-3 % de reactividad cruzada. Avisar
    // es la postura segura y la que toman los sistemas de prescripción.
    const avisos = await verificar(['cefalexina']);
    expect(avisos.some((a) => a.allergy_substance === 'Penicilina')).toBe(true);
  });

  it('trimetoprima-sulfametoxazol avisa con una alergia a sulfas', async () => {
    const avisos = await verificar(['trimetoprima_sulfametoxazol']);
    expect(avisos.some((a) => a.allergy_substance === 'Sulfas')).toBe(true);
  });

  it('la hidroclorotiazida también, porque es una sulfonamida', async () => {
    // Menos evidente que el antibiótico y por eso más valioso: un diurético
    // tiazídico comparte el grupo sulfa.
    const avisos = await verificar(['hidroclorotiazida']);
    expect(avisos.some((a) => a.allergy_substance === 'Sulfas')).toBe(true);
  });
});

describe('sin falsos positivos', () => {
  it('no avisa de fármacos sin relación', async () => {
    const avisos = await verificar([
      'paracetamol',
      'azitromicina',
      'omeprazol',
      'losartan',
      'metformina',
      'loratadina',
    ]);
    expect(avisos).toHaveLength(0);
  });

  it('no avisa en un paciente sin alergias registradas', async () => {
    const otro = await crearPaciente(sql, clinica.id, 'Sin', 'Alergias');
    const avisos = await sql`
      select 1 from public.verificar_alergias(${otro}, array['amoxicilina','ibuprofeno'])`;
    expect(avisos).toHaveLength(0);
  });

  it('una alergia retirada deja de avisar', async () => {
    const [ibu] = await sql<{ id: string }[]>`
      select id from public.allergies
      where patient_id = ${paciente} and substance = 'Ibuprofeno'`;

    await sql`update public.allergies set is_active = false where id = ${ibu.id}`;
    try {
      const avisos = await verificar(['ibuprofeno']);
      expect(avisos).toHaveLength(0);
    } finally {
      await sql`update public.allergies set is_active = true where id = ${ibu.id}`;
    }
  });
});

describe('orden de los avisos', () => {
  it('lo que puede matar aparece primero', async () => {
    // Riesgo vital (sulfas) antes que severa (penicilina) antes que leve.
    const avisos = await verificar([
      'ibuprofeno',
      'amoxicilina',
      'trimetoprima_sulfametoxazol',
    ]);
    expect(avisos[0].allergy_substance).toBe('Sulfas');
  });
});

describe('folio de receta', () => {
  it('es correlativo por institución', async () => {
    const emitir = async () => {
      const [r] = await sql<{ folio: string }[]>`
        insert into public.prescriptions (tenant_id, patient_id, prescriber_id)
        values (${clinica.id}, ${paciente}, ${medico})
        returning folio`;
      return Number(r.folio);
    };

    const a = await emitir();
    const b = await emitir();
    expect(b).toBe(a + 1);
  });

  it('ninguna receta queda sin folio', async () => {
    const [r] = await sql<{ n: string }[]>`
      select count(*) as n from public.prescriptions where folio is null`;
    expect(Number(r.n)).toBe(0);
  });
});
