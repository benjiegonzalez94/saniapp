import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';

import {
  admin,
  agregarMiembro,
  comoUsuario,
  comoUsuarioPersistente,
  crearInstitucion,
  crearPaciente,
  eliminarUsuarios,
  limpiarInstitucion,
  type Institucion,
} from '@/lib/testing/db';

/**
 * Pruebas de comportamiento de las políticas RLS.
 *
 * Comprueban la barrera real —Postgres— y no la capa de aplicación. Cada caso
 * pregunta lo mismo desde un ángulo distinto: ¿puede este usuario, con este
 * rol, en esta institución, llegar a este dato?
 *
 * Requieren el Postgres local levantado con `npx supabase start`.
 */

let sql: postgres.Sql;

// Dos clínicas independientes, más una tercera con círculo de cuidado activo.
let clinicaA: Institucion;
let clinicaB: Institucion;
let hospital: Institucion;

let medicoA: string;
let recepcionA: string;
let medicoB: string;
let medicoHospital: string;
let medicoAjenoHospital: string;

let pacienteA: string;
let pacienteB: string;
let pacienteHospital: string;

beforeAll(async () => {
  sql = admin();

  clinicaA = await crearInstitucion(sql, 'Clínica Manta');
  clinicaB = await crearInstitucion(sql, 'Clínica Portoviejo');
  hospital = await crearInstitucion(sql, 'Hospital Básico', { accessModel: 'care_team' });

  medicoA = await agregarMiembro(sql, clinicaA.id, 'physician', 'Dra. Andrade');
  recepcionA = await agregarMiembro(sql, clinicaA.id, 'receptionist', 'Sr. Vera');
  medicoB = await agregarMiembro(sql, clinicaB.id, 'physician', 'Dr. Cedeño');
  medicoHospital = await agregarMiembro(sql, hospital.id, 'physician', 'Dr. González');
  medicoAjenoHospital = await agregarMiembro(sql, hospital.id, 'physician', 'Dra. Loor');

  pacienteA = await crearPaciente(sql, clinicaA.id, 'María', 'Zambrano');
  pacienteB = await crearPaciente(sql, clinicaB.id, 'Julio', 'Intriago');
  pacienteHospital = await crearPaciente(sql, hospital.id, 'Rosa', 'Delgado');

  // El paciente del hospital tiene un médico asignado; la otra no.
  await sql`
    insert into public.care_team_members (tenant_id, patient_id, profile_id, relationship)
    values (${hospital.id}, ${pacienteHospital}, ${medicoHospital}, 'tratante')
  `;
});

afterAll(async () => {
  for (const t of [clinicaA, clinicaB, hospital]) {
    if (t) await limpiarInstitucion(sql, t.id);
  }
  await eliminarUsuarios(sql, [
    clinicaA?.owner, clinicaB?.owner, hospital?.owner,
    medicoA, recepcionA, medicoB, medicoHospital, medicoAjenoHospital,
  ].filter(Boolean) as string[]);
  await sql.end();
});

describe('aislamiento entre instituciones', () => {
  it('un médico sólo ve los pacientes de su institución', async () => {
    const filas = await comoUsuario(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      (tx) => tx<{ id: string }[]>`select id from public.patients`
    );

    const ids = filas.map((f) => f.id);
    expect(ids).toContain(pacienteA);
    expect(ids).not.toContain(pacienteB);
  });

  it('consultar directamente el paciente de otra clínica no devuelve nada', async () => {
    // Ni siquiera conociendo el identificador exacto: RLS no lo entrega.
    const filas = await comoUsuario(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      (tx) => tx`select id from public.patients where id = ${pacienteB}`
    );
    expect(filas).toHaveLength(0);
  });

  it('no se puede crear un paciente en una institución ajena', async () => {
    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`
          insert into public.patients (tenant_id, record_number, given_name, family_name)
          values (${clinicaB.id}, 9999, 'Intruso', 'Prueba')
        `
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it('el tenant activo del JWT acota aún más: siendo miembro de dos, sólo ve el activo', async () => {
    // La Dra. Andrade pasa consulta también en Portoviejo.
    await sql`
      insert into public.memberships (tenant_id, profile_id, role, status, accepted_at)
      values (${clinicaB.id}, ${medicoA}, 'physician', 'active', now())
    `;

    try {
      const soloA = await comoUsuario(
        sql,
        { userId: medicoA, tenantId: clinicaA.id },
        (tx) => tx<{ id: string }[]>`select id from public.patients`
      );
      expect(soloA.map((f) => f.id)).toEqual([pacienteA]);

      // Sin tenant activo declarado, ve las dos instituciones de las que es miembro.
      const ambas = await comoUsuario(
        sql,
        { userId: medicoA },
        (tx) => tx<{ id: string }[]>`select id from public.patients`
      );
      expect(ambas.map((f) => f.id).sort()).toEqual([pacienteA, pacienteB].sort());
    } finally {
      await sql`
        delete from public.memberships
        where tenant_id = ${clinicaB.id} and profile_id = ${medicoA}
      `;
    }
  });
});

describe('mínimo necesario por rol', () => {
  it('recepción encuentra al paciente para poder agendarlo', async () => {
    const filas = await comoUsuario(
      sql,
      { userId: recepcionA, tenantId: clinicaA.id },
      (tx) => tx<{ id: string }[]>`select id from public.patients`
    );
    expect(filas.map((f) => f.id)).toContain(pacienteA);
  });

  it('recepción NO puede leer la historia clínica', async () => {
    await comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, async (tx) => {
      await tx`
        insert into public.clinical_notes (tenant_id, patient_id, content_enc, author_id, title)
        values (${clinicaA.id}, ${pacienteA}, 'cifrado-de-prueba', ${medicoA}, 'Consulta')
      `;
    });

    // Nota persistente para poder consultarla desde otra sesión.
    await sql`
      insert into public.clinical_notes (tenant_id, patient_id, content_enc, author_id, title)
      values (${clinicaA.id}, ${pacienteA}, 'cifrado-de-prueba', ${medicoA}, 'Consulta')
    `;

    const comoRecepcion = await comoUsuario(
      sql,
      { userId: recepcionA, tenantId: clinicaA.id },
      (tx) => tx`select id from public.clinical_notes`
    );
    expect(comoRecepcion).toHaveLength(0);

    const comoMedico = await comoUsuario(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      (tx) => tx`select id from public.clinical_notes`
    );
    expect(comoMedico.length).toBeGreaterThan(0);
  });

  it('recepción no puede registrar una nota clínica', async () => {
    await expect(
      comoUsuario(sql, { userId: recepcionA, tenantId: clinicaA.id }, (tx) =>
        tx`
          insert into public.clinical_notes (tenant_id, patient_id, content_enc, author_id)
          values (${clinicaA.id}, ${pacienteA}, 'x', ${recepcionA})
        `
      )
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('círculo de cuidado y acceso de emergencia', () => {
  it('el médico tratante lee la historia de su paciente', async () => {
    const puede = await comoUsuario(
      sql,
      { userId: medicoHospital, tenantId: hospital.id },
      (tx) => tx<{ ok: boolean }[]>`select app.can_read_patient(${pacienteHospital}) as ok`
    );
    expect(puede[0].ok).toBe(true);
  });

  it('un médico ajeno al caso NO la lee, aun siendo de la misma institución', async () => {
    const puede = await comoUsuario(
      sql,
      { userId: medicoAjenoHospital, tenantId: hospital.id },
      (tx) => tx<{ ok: boolean }[]>`select app.can_read_patient(${pacienteHospital}) as ok`
    );
    expect(puede[0].ok).toBe(false);
  });

  it('el acceso de emergencia exige un motivo con sustancia', async () => {
    await expect(
      comoUsuario(sql, { userId: medicoAjenoHospital, tenantId: hospital.id }, (tx) =>
        tx`select public.break_glass(${pacienteHospital}, 'urgente')`
      )
    ).rejects.toThrow(/motivo de al menos 10 caracteres/i);
  });

  it('con motivo, concede acceso y deja el rastro auditado', async () => {
    const sesion = { userId: medicoAjenoHospital, tenantId: hospital.id };

    const antes = await comoUsuario(sql, sesion, (tx) =>
      tx<{ ok: boolean }[]>`select app.can_read_patient(${pacienteHospital}) as ok`
    );
    expect(antes[0].ok).toBe(false);

    await comoUsuarioPersistente(sql, sesion, (tx) =>
      tx`select public.break_glass(
           ${pacienteHospital},
           'Paciente inconsciente en emergencia, sin acompañante que autorice')`
    );

    const despues = await comoUsuario(sql, sesion, (tx) =>
      tx<{ ok: boolean }[]>`select app.can_read_patient(${pacienteHospital}) as ok`
    );
    expect(despues[0].ok).toBe(true);

    // Se comprueba con el superusuario y no con el médico: él NO tiene el
    // permiso audit.read, y ese es justamente el punto del caso siguiente.
    const [evento] = await sql<{ n: string }[]>`
      select count(*) as n from public.audit_log
      where action = 'break_glass' and patient_id = ${pacienteHospital}
        and break_glass_reason is not null`;
    expect(Number(evento.n)).toBeGreaterThan(0);

    // La concesión queda pendiente de revisión por un responsable.
    const [pendiente] = await sql<{ n: string }[]>`
      select count(*) as n from public.break_glass_grants
      where patient_id = ${pacienteHospital} and reviewed_at is null`;
    expect(Number(pendiente.n)).toBe(1);
  });

  it('quien usa el break-glass no puede leer la bitácora que lo delata', async () => {
    // Sin esto, un acceso indebido podría comprobar qué rastro dejó. El médico
    // no tiene audit.read; sólo owner, admin y auditor lo tienen.
    const filas = await comoUsuario(
      sql,
      { userId: medicoAjenoHospital, tenantId: hospital.id },
      (tx) => tx`select id from public.audit_log where action = 'break_glass'`
    );
    expect(filas).toHaveLength(0);

    const comoPropietario = await comoUsuario(
      sql,
      { userId: hospital.owner, tenantId: hospital.id },
      (tx) => tx`select id from public.audit_log where action = 'break_glass'`
    );
    expect(comoPropietario.length).toBeGreaterThan(0);
  });
});

describe('inmutabilidad de lo firmado', () => {
  it('una nota firmada no se puede modificar', async () => {
    const [nota] = await sql<{ id: string }[]>`
      insert into public.clinical_notes
        (tenant_id, patient_id, content_enc, author_id, signed_by, signed_at)
      values (${clinicaA.id}, ${pacienteA}, 'firmada', ${medicoA}, ${medicoA}, now())
      returning id
    `;

    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`update public.clinical_notes set content_enc = 'alterada' where id = ${nota.id}`
      )
    ).rejects.toThrow(/inmutable/i);
  });

  it('permite exactamente una transición: marcarla como enmendada', async () => {
    const [original] = await sql<{ id: string }[]>`
      insert into public.clinical_notes
        (tenant_id, patient_id, content_enc, author_id, signed_by, signed_at)
      values (${clinicaA.id}, ${pacienteA}, 'v1', ${medicoA}, ${medicoA}, now())
      returning id
    `;
    const [enmienda] = await sql<{ id: string }[]>`
      insert into public.clinical_notes
        (tenant_id, patient_id, content_enc, author_id, amendment_reason)
      values (${clinicaA.id}, ${pacienteA}, 'v2', ${medicoA}, 'Se corrige la dosis')
      returning id
    `;

    // La única modificación tolerada en una nota firmada: apuntar a su enmienda.
    await comoUsuarioPersistente(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
      tx`update public.clinical_notes set amended_by = ${enmienda.id}
         where id = ${original.id}`
    );

    const [tras] = await sql<{ amended_by: string }[]>`
      select amended_by from public.clinical_notes where id = ${original.id}`;
    expect(tras.amended_by).toBe(enmienda.id);

    // Y una vez enmendada, se cierra del todo: ni siquiera se puede reapuntar.
    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`update public.clinical_notes set amended_by = null where id = ${original.id}`
      )
    ).rejects.toThrow(/inmutable/i);
  });

  it('los registros clínicos no se pueden borrar', async () => {
    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`delete from public.clinical_notes where patient_id = ${pacienteA}`
      )
    ).rejects.toThrow();
  });
});

describe('bitácora de auditoría', () => {
  it('no se puede escribir directamente en ella', async () => {
    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`
          insert into public.audit_log (tenant_id, action, resource_type, row_hash)
          values (${clinicaA.id}, 'read', 'inventado', '\\x00')
        `
      )
    ).rejects.toThrow();
  });

  it('no se puede alterar ni borrar un evento existente', async () => {
    await comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, async (tx) => {
      await tx`select public.record_audit('read', 'patient', ${pacienteA}, ${clinicaA.id})`;
    });

    await sql`select app.audit('read', 'patient', ${pacienteA}, ${clinicaA.id})`;

    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`update public.audit_log set summary = 'manipulado' where tenant_id = ${clinicaA.id}`
      )
    ).rejects.toThrow();

    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, (tx) =>
        tx`delete from public.audit_log where tenant_id = ${clinicaA.id}`
      )
    ).rejects.toThrow();
  });

  it('la cadena de hash está íntegra', async () => {
    await sql`select app.audit('read', 'patient', ${pacienteA}, ${clinicaA.id})`;
    const [r] = await sql<{ checked: string; broken_at_id: string | null }[]>`
      select * from app.verify_audit_chain(${clinicaA.id})`;

    expect(Number(r.checked)).toBeGreaterThan(0);
    expect(r.broken_at_id).toBeNull();
  });

  it('manipular una fila rompe la cadena y se detecta', async () => {
    await sql`select app.audit('read', 'patient', ${pacienteB}, ${clinicaB.id})`;
    await sql`select app.audit('update', 'patient', ${pacienteB}, ${clinicaB.id})`;

    const [antes] = await sql<{ broken_at_id: string | null }[]>`
      select * from app.verify_audit_chain(${clinicaB.id})`;
    expect(antes.broken_at_id).toBeNull();

    // Sólo el superusuario puede hacer esto; es justo el ataque que la cadena
    // debe delatar aunque quien lo intente tenga privilegios sobre la tabla.
    await sql`
      update public.audit_log set summary = 'evidencia borrada'
      where tenant_id = ${clinicaB.id}
        and id = (select min(id) from public.audit_log where tenant_id = ${clinicaB.id})
    `;

    const [despues] = await sql<{ broken_at_id: string | null }[]>`
      select * from app.verify_audit_chain(${clinicaB.id})`;
    expect(despues.broken_at_id).not.toBeNull();
  });
});

describe('agenda', () => {
  it('rechaza dos citas solapadas del mismo médico', async () => {
    const inicio = new Date(Date.now() + 86_400_000).toISOString();
    const fin = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();

    await expect(
      comoUsuario(sql, { userId: medicoA, tenantId: clinicaA.id }, async (tx) => {
        await tx`
          insert into public.appointments (tenant_id, patient_id, provider_id, starts_at, ends_at)
          values (${clinicaA.id}, ${pacienteA}, ${medicoA}, ${inicio}, ${fin})`;
        // Segunda cita que se solapa: debe fallar por la restricción de exclusión.
        await tx`
          insert into public.appointments (tenant_id, patient_id, provider_id, starts_at, ends_at)
          values (${clinicaA.id}, ${pacienteA}, ${medicoA}, ${inicio}, ${fin})`;
      })
    ).rejects.toThrow(/appointments_no_overlap|conflicting key|exclusion/i);
  });

  it('permite citas consecutivas que sólo se tocan en el extremo', async () => {
    const t0 = new Date(Date.now() + 172_800_000).toISOString();
    const t1 = new Date(Date.now() + 172_800_000 + 1_800_000).toISOString();
    const t2 = new Date(Date.now() + 172_800_000 + 3_600_000).toISOString();

    const n = await comoUsuario(
      sql,
      { userId: medicoA, tenantId: clinicaA.id },
      async (tx) => {
        await tx`
          insert into public.appointments (tenant_id, patient_id, provider_id, starts_at, ends_at)
          values (${clinicaA.id}, ${pacienteA}, ${medicoA}, ${t0}, ${t1})`;
        await tx`
          insert into public.appointments (tenant_id, patient_id, provider_id, starts_at, ends_at)
          values (${clinicaA.id}, ${pacienteA}, ${medicoA}, ${t1}, ${t2})`;
        const r = await tx<{ n: string }[]>`
          select count(*) as n from public.appointments where provider_id = ${medicoA}`;
        return Number(r[0].n);
      }
    );
    expect(n).toBe(2);
  });
});

describe('consentimiento LOPDP', () => {
  it('sin consentimiento, el mensaje no sale de la bandeja', async () => {
    const [fila] = await sql<{ status: string; failed_reason: string }[]>`
      insert into public.notification_outbox
        (tenant_id, patient_id, channel, recipient, template, dedupe_key)
      values (${clinicaA.id}, ${pacienteA}, 'whatsapp', '+593999999999',
              'recordatorio_cita', ${'sin-' + Date.now()})
      returning status, failed_reason
    `;

    expect(fila.status).toBe('sin_consentimiento');
    expect(fila.failed_reason).toMatch(/consentimiento/i);
  });

  it('con consentimiento, queda programado', async () => {
    await sql`
      insert into public.patient_consents
        (tenant_id, patient_id, purpose, granted, policy_version, method)
      values (${clinicaA.id}, ${pacienteA}, 'whatsapp', true, 'v1', 'presencial')
    `;

    const [fila] = await sql<{ status: string }[]>`
      insert into public.notification_outbox
        (tenant_id, patient_id, channel, recipient, template, dedupe_key)
      values (${clinicaA.id}, ${pacienteA}, 'whatsapp', '+593999999999',
              'recordatorio_cita', ${'con-' + Date.now()})
      returning status
    `;
    expect(fila.status).toBe('programado');
  });

  it('revocar el consentimiento cancela lo pendiente', async () => {
    await sql`
      insert into public.patient_consents
        (tenant_id, patient_id, purpose, granted, policy_version, method)
      values (${clinicaA.id}, ${pacienteA}, 'whatsapp', false, 'v1', 'portal')
    `;

    const [fila] = await sql<{ n: string }[]>`
      select count(*) as n from public.notification_outbox
      where patient_id = ${pacienteA} and channel = 'whatsapp' and status = 'programado'
    `;
    expect(Number(fila.n)).toBe(0);
  });
});
