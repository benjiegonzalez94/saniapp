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
 * Invariantes de la agenda, comprobados contra la base real.
 *
 * Los dos que más importan:
 *
 *  · Un médico no puede estar en dos sitios a la vez. Lo impide una restricción
 *    de exclusión GiST, no una comprobación de la aplicación, así que ni dos
 *    recepcionistas simultáneos ni un bot compitiendo con la web pueden colar
 *    un solapamiento.
 *  · Un recordatorio nunca se planifica sin consentimiento. La comprobación
 *    vive en el trigger, de modo que cualquier camino que agende la respeta.
 */

let sql: postgres.Sql;
let clinica: Institucion;
let medico: string;
let otroMedico: string;
let conConsentimiento: string;
let sinConsentimiento: string;

/**
 * Ancla fija: la próxima hora en punto. Los desplazamientos se calculan desde
 * aquí para que sean EXACTOS y no dependan del minuto en que corran las
 * pruebas. Redondear cada instante por separado convertía enHoras(72.5) y
 * enHoras(73) en el mismo valor, y un caso de solapamiento parcial pasaba a ser
 * uno de citas adyacentes —que la base acepta con razón—.
 */
const ANCLA = (() => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.getTime() + 3_600_000;
})();

/** Instante a N horas del ancla. Admite fracciones: 72.5 son 72 h y 30 min. */
function enHoras(h: number): string {
  return new Date(ANCLA + h * 3_600_000).toISOString();
}

async function agendar(
  paciente: string,
  proveedor: string,
  inicio: string,
  fin: string,
  estado = 'confirmada'
): Promise<string> {
  const [fila] = await sql<{ id: string }[]>`
    insert into public.appointments
      (tenant_id, patient_id, provider_id, starts_at, ends_at, status)
    values (${clinica.id}, ${paciente}, ${proveedor}, ${inicio}, ${fin},
            ${sql.unsafe(`'${estado}'::app.appointment_status`)})
    returning id`;
  return fila.id;
}

beforeAll(async () => {
  sql = admin();
  clinica = await crearInstitucion(sql, 'Consultorio Agenda');
  medico = await agregarMiembro(sql, clinica.id, 'physician', 'Dra. Agenda');
  otroMedico = await agregarMiembro(sql, clinica.id, 'physician', 'Dr. Suplente');

  conConsentimiento = await crearPaciente(sql, clinica.id, 'Con', 'Consentimiento');
  sinConsentimiento = await crearPaciente(sql, clinica.id, 'Sin', 'Consentimiento');

  await sql`
    update public.patients set phone = '+593990000001' where id = ${conConsentimiento}`;
  await sql`
    insert into public.patient_consents
      (tenant_id, patient_id, purpose, granted, method, policy_version)
    values (${clinica.id}, ${conConsentimiento}, 'whatsapp', true, 'presencial', 'v1')`;
});

afterAll(async () => {
  if (clinica) await limpiarInstitucion(sql, clinica.id);
  await eliminarUsuarios(
    sql,
    [clinica?.owner, medico, otroMedico].filter(Boolean) as string[]
  );
  await sql.end();
});

describe('no hay dos citas a la vez', () => {
  it('rechaza el solapamiento exacto', async () => {
    const inicio = enHoras(48);
    const fin = enHoras(48.5);
    await agendar(conConsentimiento, medico, inicio, fin);

    await expect(agendar(sinConsentimiento, medico, inicio, fin)).rejects.toThrow(
      /appointments_no_overlap|conflicting key|exclusion/i
    );
  });

  it('rechaza el solapamiento parcial', async () => {
    // La segunda empieza a mitad de la primera: sigue siendo imposible.
    await agendar(conConsentimiento, medico, enHoras(72), enHoras(73));
    await expect(
      agendar(sinConsentimiento, medico, enHoras(72.5), enHoras(73.5))
    ).rejects.toThrow(/appointments_no_overlap|conflicting key|exclusion/i);
  });

  it('permite citas consecutivas que sólo se tocan en el extremo', async () => {
    // El rango es '[)': el fin de una puede ser el inicio de la siguiente.
    await agendar(conConsentimiento, medico, enHoras(96), enHoras(97));
    const segunda = await agendar(sinConsentimiento, medico, enHoras(97), enHoras(98));
    expect(segunda).toBeTruthy();
  });

  it('la restricción es por médico, no por institución', async () => {
    // Dos profesionales sí pueden atender a la misma hora.
    const inicio = enHoras(120);
    const fin = enHoras(121);
    await agendar(conConsentimiento, medico, inicio, fin);
    const otra = await agendar(sinConsentimiento, otroMedico, inicio, fin);
    expect(otra).toBeTruthy();
  });

  it('una cita cancelada libera su hueco', async () => {
    const inicio = enHoras(144);
    const fin = enHoras(145);
    const id = await agendar(conConsentimiento, medico, inicio, fin);

    await sql`
      update public.appointments
         set status = 'cancelada', cancelled_at = now(), cancel_reason = 'prueba'
       where id = ${id}`;

    // La restricción sólo aplica a estados vivos, así que la hora vuelve a estar
    // disponible. Sin esto, cancelar dejaría el hueco inutilizable para siempre.
    const reemplazo = await agendar(sinConsentimiento, medico, inicio, fin);
    expect(reemplazo).toBeTruthy();
  });
});

describe('planificación de recordatorios', () => {
  it('planifica dos avisos para un paciente que consintió', async () => {
    const id = await agendar(conConsentimiento, otroMedico, enHoras(200), enHoras(201));

    const filas = await sql<{ channel: string; status: string }[]>`
      select channel, status from public.appointment_reminders
      where appointment_id = ${id} order by scheduled_for`;

    // 24 h y 2 h antes, ambos en el futuro para una cita a 200 h vista.
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.channel === 'whatsapp')).toBe(true);
  });

  it('no planifica nada sin consentimiento', async () => {
    const id = await agendar(sinConsentimiento, otroMedico, enHoras(224), enHoras(225));

    const filas = await sql`
      select 1 from public.appointment_reminders where appointment_id = ${id}`;
    expect(filas).toHaveLength(0);
  });

  it('no planifica el aviso de 24 h para una cita inminente', async () => {
    // Una cita dentro de una hora no puede recibir un aviso "de ayer".
    const id = await agendar(conConsentimiento, otroMedico, enHoras(1), enHoras(1.5));

    const filas = await sql`
      select 1 from public.appointment_reminders where appointment_id = ${id}`;
    expect(filas).toHaveLength(0);
  });

  it('cancelar la cita cancela sus recordatorios pendientes', async () => {
    const id = await agendar(conConsentimiento, otroMedico, enHoras(300), enHoras(301));

    await sql`
      update public.appointments
         set status = 'cancelada', cancelled_at = now(), cancel_reason = 'prueba'
       where id = ${id}`;

    const [r] = await sql<{ n: string }[]>`
      select count(*) as n from public.appointment_reminders
      where appointment_id = ${id} and status = 'programado'`;
    // Nada peor que recordarle a un paciente una cita que ya no existe.
    expect(Number(r.n)).toBe(0);
  });

  it('mover la cita de hora replanifica los avisos', async () => {
    const id = await agendar(conConsentimiento, otroMedico, enHoras(400), enHoras(401));

    const antes = await sql<{ scheduled_for: string }[]>`
      select scheduled_for from public.appointment_reminders
      where appointment_id = ${id} and status = 'programado' order by scheduled_for`;
    expect(antes.length).toBeGreaterThan(0);

    await sql`
      update public.appointments
         set starts_at = ${enHoras(500)}, ends_at = ${enHoras(501)}
       where id = ${id}`;

    const viejos = await sql<{ n: string }[]>`
      select count(*) as n from public.appointment_reminders
      where appointment_id = ${id} and status = 'cancelado'`;
    const nuevos = await sql<{ scheduled_for: string }[]>`
      select scheduled_for from public.appointment_reminders
      where appointment_id = ${id} and status = 'programado'`;

    expect(Number(viejos[0].n)).toBeGreaterThan(0);
    expect(nuevos.length).toBeGreaterThan(0);
    // Los nuevos cuelgan de la hora nueva, no de la vieja.
    expect(nuevos[0].scheduled_for).not.toBe(antes[0].scheduled_for);
  });

  it('respeta la antelación configurada por la institución', async () => {
    await sql`
      update public.tenants
         set settings = jsonb_set(settings, '{reminder_hours}', '[72]'::jsonb)
       where id = ${clinica.id}`;

    try {
      const id = await agendar(conConsentimiento, otroMedico, enHoras(600), enHoras(601));
      const filas = await sql`
        select 1 from public.appointment_reminders where appointment_id = ${id}`;
      expect(filas).toHaveLength(1);
    } finally {
      await sql`
        update public.tenants set settings = settings - 'reminder_hours'
         where id = ${clinica.id}`;
    }
  });
});

describe('huecos disponibles', () => {
  beforeAll(async () => {
    // Atención todos los días de la semana, para que la prueba no dependa de
    // qué día se ejecute.
    await sql`
      insert into public.provider_schedules
        (tenant_id, provider_id, weekday, starts_at, ends_at, slot_minutes, valid_from)
      select ${clinica.id}, ${medico}, d, '08:00', '10:00', 30, current_date - 1
      from generate_series(0, 6) as d`;
  });

  it('genera un hueco por turno de la franja', async () => {
    // 08:00–10:00 en turnos de 30 min = 4 huecos por día.
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const huecos = await sql`
      select * from public.available_slots(${clinica.id}, ${medico}, ${manana}, ${manana})`;
    expect(huecos).toHaveLength(4);
  });

  it('un bloqueo retira los huecos que cubre', async () => {
    const pasado = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

    await sql`
      insert into public.schedule_exceptions
        (tenant_id, provider_id, starts_at, ends_at, reason, is_available)
      values (${clinica.id}, ${medico},
              ${`${pasado} 00:00`}::timestamp at time zone 'America/Guayaquil',
              ${`${pasado} 23:59`}::timestamp at time zone 'America/Guayaquil',
              'Prueba', false)`;

    const huecos = await sql`
      select * from public.available_slots(${clinica.id}, ${medico}, ${pasado}, ${pasado})`;
    expect(huecos).toHaveLength(0);
  });

  it('nunca ofrece huecos en el pasado', async () => {
    const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const huecos = await sql`
      select * from public.available_slots(${clinica.id}, ${medico}, ${ayer}, ${ayer})`;
    expect(huecos).toHaveLength(0);
  });
});
