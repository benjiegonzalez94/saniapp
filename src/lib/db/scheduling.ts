import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import type {
  AppointmentSource,
  AppointmentStatus,
  EncounterKind,
} from '@/lib/db/types';
import type { Database } from '@/lib/db/database.types';

/**
 * Agenda.
 *
 * Toda hora viaja como `timestamptz` en UTC y se convierte a la zona de la
 * institución sólo al pintarla. La tentación de guardar "09:00" como texto
 * porque el consultorio está en un único huso acaba mal en cuanto haya una sede
 * en otra provincia o cambie el horario de verano en otro país.
 *
 * Los huecos libres los calcula la base (`public.available_slots`), no este
 * módulo: es la misma respuesta para la web, recepción, el portal del paciente
 * y el bot de WhatsApp de la fase 4, y sólo Postgres ve el estado real de la
 * agenda en el instante de la consulta.
 */

export type CitaAgenda = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  kind: EncounterKind;
  reason: string | null;
  privateNote: string | null;
  checkedInAt: string | null;
  encounterId: string | null;
  patient: {
    id: string;
    givenName: string;
    familyName: string;
    phone: string | null;
    recordNumber: number;
  };
  provider: { id: string; fullName: string };
  locationName: string | null;
};

export type Hueco = {
  startsAt: string;
  endsAt: string;
  locationId: string | null;
};

export type Proveedor = {
  id: string;
  fullName: string;
  specialty: string | null;
};

const CAMPOS_CITA =
  'id, starts_at, ends_at, status, source, kind, reason, private_note, checked_in_at, encounter_id, patient:patients!appointments_patient_id_fkey(id, given_name, family_name, phone, record_number), provider:profiles!appointments_provider_id_fkey(id, full_name), location:locations(name)' as const;

type FilaCita = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  kind: EncounterKind;
  reason: string | null;
  private_note: string | null;
  checked_in_at: string | null;
  encounter_id: string | null;
  patient: {
    id: string;
    given_name: string;
    family_name: string;
    phone: string | null;
    record_number: number | null;
  } | null;
  provider: { id: string; full_name: string } | null;
  location: { name: string } | null;
};

function aCita(f: FilaCita): CitaAgenda {
  return {
    id: f.id,
    startsAt: f.starts_at,
    endsAt: f.ends_at,
    status: f.status,
    source: f.source,
    kind: f.kind,
    reason: f.reason,
    privateNote: f.private_note,
    checkedInAt: f.checked_in_at,
    encounterId: f.encounter_id,
    patient: {
      id: f.patient?.id ?? '',
      givenName: f.patient?.given_name ?? '—',
      familyName: f.patient?.family_name ?? '',
      phone: f.patient?.phone ?? null,
      recordNumber: f.patient?.record_number ?? 0,
    },
    provider: {
      id: f.provider?.id ?? '',
      fullName: f.provider?.full_name ?? 'Sin asignar',
    },
    locationName: f.location?.name ?? null,
  };
}

/**
 * Citas en un rango.
 *
 * No se audita: ver la agenda del día no es acceder a una historia clínica, y
 * registrar un evento cada vez que alguien mira el calendario ahogaría la
 * bitácora en ruido. Abrir el expediente de un paciente sí se audita.
 */
export async function listarCitas(
  tenantId: string,
  desde: Date,
  hasta: Date,
  providerId?: string | null
): Promise<CitaAgenda[]> {
  const supabase = await createClient();

  let query = supabase
    .from('appointments')
    .select(CAMPOS_CITA)
    .eq('tenant_id', tenantId)
    .gte('starts_at', desde.toISOString())
    .lt('starts_at', hasta.toISOString())
    .order('starts_at');

  if (providerId) query = query.eq('provider_id', providerId);

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as FilaCita[]).map(aCita);
}

/** Huecos libres, calculados por la base. */
export async function huecosDisponibles(
  tenantId: string,
  providerId: string,
  desde: string,
  hasta: string,
  locationId?: string | null
): Promise<Hueco[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('available_slots', {
    p_tenant_id: tenantId,
    p_provider_id: providerId,
    p_from: desde,
    p_to: hasta,
    p_location_id: locationId ?? undefined,
  });

  if (error) throw error;

  return (data ?? []).map((h) => ({
    startsAt: h.starts_at,
    endsAt: h.ends_at,
    locationId: h.location_id,
  }));
}

/** Profesionales con horario de atención definido en la institución. */
export async function listarProveedores(tenantId: string): Promise<Proveedor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('memberships')
    .select('profile:profiles!inner(id, full_name, specialty)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('role', ['physician', 'nurse']);

  if (error) throw error;

  type Fila = { profile: { id: string; full_name: string; specialty: string | null } | null };

  return (data as unknown as Fila[])
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.profile!.id,
      fullName: m.profile!.full_name,
      specialty: m.profile!.specialty,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

export class HuecoOcupadoError extends Error {
  constructor() {
    super('Ese horario acaba de ocuparse. Elija otro.');
    this.name = 'HuecoOcupadoError';
  }
}

/**
 * Agenda una cita.
 *
 * El solapamiento NO se comprueba aquí: lo impide una restricción de exclusión
 * GiST en la tabla. Comprobar antes con un SELECT y luego insertar dejaría una
 * ventana entre ambas consultas por la que dos recepcionistas —o recepción y el
 * bot de WhatsApp— pueden colar la misma hora. Se intenta insertar y se traduce
 * el error 23P01 a un mensaje legible.
 */
export async function agendarCita(
  tenantId: string,
  datos: {
    patientId: string;
    providerId: string;
    locationId?: string | null;
    startsAt: string;
    endsAt: string;
    kind?: EncounterKind;
    source?: AppointmentSource;
    reason?: string | null;
    privateNote?: string | null;
  },
  creadoPor: string
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      patient_id: datos.patientId,
      provider_id: datos.providerId,
      location_id: datos.locationId || null,
      starts_at: datos.startsAt,
      ends_at: datos.endsAt,
      kind: datos.kind ?? 'consulta',
      source: datos.source ?? 'web',
      status: 'confirmada',
      confirmed_at: new Date().toISOString(),
      reason: datos.reason?.trim() || null,
      private_note: datos.privateNote?.trim() || null,
      created_by: creadoPor,
    })
    .select('id')
    .single();

  if (error) {
    // 23P01 = exclusion_violation: la restricción appointments_no_overlap.
    if (error.code === '23P01') throw new HuecoOcupadoError();
    throw error;
  }

  await audit({
    action: 'create',
    resourceType: 'appointments',
    resourceId: data.id,
    tenantId,
    patientId: datos.patientId,
    summary: `Agendó una cita para el ${new Date(datos.startsAt).toISOString()}`,
    metadata: { origen: datos.source ?? 'web', motivo: datos.reason ?? '' },
  });

  return data.id;
}

/**
 * Cambia el estado de una cita.
 *
 * Cancelar exige motivo: sin él, la agenda se llena de huecos sin explicación y
 * nadie puede distinguir al paciente que avisó del que no apareció, que es
 * justo la diferencia que importa para decidir si se le vuelve a dar hora.
 */
export async function cambiarEstadoCita(
  tenantId: string,
  appointmentId: string,
  nuevoEstado: AppointmentStatus,
  opciones: { motivo?: string; actorId: string }
): Promise<void> {
  const supabase = await createClient();
  const ahora = new Date().toISOString();

  // Tipado desde el esquema real: si mañana se renombra una columna, esto deja
  // de compilar en vez de escribir un campo que la base ignora en silencio.
  const cambios: Database['public']['Tables']['appointments']['Update'] = {
    status: nuevoEstado,
  };

  if (nuevoEstado === 'cancelada') {
    if (!opciones.motivo?.trim()) {
      throw new Error('Indique por qué se cancela la cita.');
    }
    cambios.cancelled_at = ahora;
    cambios.cancelled_by = opciones.actorId;
    cambios.cancel_reason = opciones.motivo.trim();
  }
  if (nuevoEstado === 'confirmada') cambios.confirmed_at = ahora;
  if (nuevoEstado === 'en_sala') cambios.checked_in_at = ahora;

  const { data, error } = await supabase
    .from('appointments')
    .update(cambios)
    .eq('tenant_id', tenantId)
    .eq('id', appointmentId)
    .select('patient_id, starts_at')
    .single();

  if (error) throw error;

  await audit({
    action: 'update',
    resourceType: 'appointments',
    resourceId: appointmentId,
    tenantId,
    patientId: data.patient_id,
    summary: `Cita marcada como «${nuevoEstado}»${opciones.motivo ? `: ${opciones.motivo}` : ''}`,
    metadata: { estado: nuevoEstado },
  });
}

/**
 * Mueve una cita de hora.
 *
 * Cambiar `starts_at` dispara el trigger que replanifica los recordatorios
 * (migración 0016): los del horario viejo se cancelan y se crean los nuevos.
 */
export async function reprogramarCita(
  tenantId: string,
  appointmentId: string,
  nuevoInicio: string,
  nuevoFin: string,
  actorId: string
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('appointments')
    .update({ starts_at: nuevoInicio, ends_at: nuevoFin, status: 'confirmada' })
    .eq('tenant_id', tenantId)
    .eq('id', appointmentId)
    .select('patient_id')
    .single();

  if (error) {
    if (error.code === '23P01') throw new HuecoOcupadoError();
    throw error;
  }

  await audit({
    action: 'update',
    resourceType: 'appointments',
    resourceId: appointmentId,
    tenantId,
    patientId: data.patient_id,
    summary: `Reprogramó la cita al ${new Date(nuevoInicio).toISOString()}`,
    metadata: { nuevo_inicio: nuevoInicio, actor: actorId },
  });
}

/* -------------------------------------------------------------------------- */
/* Horarios y bloqueos                                                         */
/* -------------------------------------------------------------------------- */

export type HorarioAtencion = {
  id: string;
  providerId: string;
  providerName: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
  locationName: string | null;
  validFrom: string;
  validTo: string | null;
};

export const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export async function listarHorarios(
  tenantId: string,
  providerId?: string | null
): Promise<HorarioAtencion[]> {
  const supabase = await createClient();

  let query = supabase
    .from('provider_schedules')
    .select(
      'id, provider_id, weekday, starts_at, ends_at, slot_minutes, valid_from, valid_to, provider:profiles!provider_schedules_provider_id_fkey(full_name), location:locations(name)'
    )
    .eq('tenant_id', tenantId)
    .order('weekday')
    .order('starts_at');

  if (providerId) query = query.eq('provider_id', providerId);

  const { data, error } = await query;
  if (error) throw error;

  type Fila = {
    id: string;
    provider_id: string;
    weekday: number;
    starts_at: string;
    ends_at: string;
    slot_minutes: number;
    valid_from: string;
    valid_to: string | null;
    provider: { full_name: string } | null;
    location: { name: string } | null;
  };

  return (data as unknown as Fila[]).map((h) => ({
    id: h.id,
    providerId: h.provider_id,
    providerName: h.provider?.full_name ?? '—',
    weekday: h.weekday,
    startsAt: h.starts_at,
    endsAt: h.ends_at,
    slotMinutes: h.slot_minutes,
    locationName: h.location?.name ?? null,
    validFrom: h.valid_from,
    validTo: h.valid_to,
  }));
}

/**
 * El permiso `schedule.manage` NO basta para tocar el horario de cualquiera.
 *
 * La política `provider_schedules_write` exige además ser el propio profesional
 * o tener rol owner/admin/recepción. Un médico tiene `schedule.manage` pero no
 * está en esa lista: puede editar su agenda, no la de un colega. Es deliberado
 * —el horario de otro no es asunto suyo— pero la matriz de permisos por sí sola
 * no lo revela, así que sin esta traducción el fallo llega como un 500 mudo.
 */
export class HorarioAjenoError extends Error {
  constructor() {
    super(
      'Sólo puede modificar su propio horario. Para cambiar el de otro profesional ' +
        'se necesita rol de administración o recepción.'
    );
    this.name = 'HorarioAjenoError';
  }
}

/** 42501 = insufficient_privilege: la fila no pasó el WITH CHECK de la política. */
function traducirDenegacion(error: { code?: string } | null): never | void {
  if (error?.code === '42501') throw new HorarioAjenoError();
}

export async function guardarHorario(
  tenantId: string,
  datos: {
    providerId: string;
    locationId?: string | null;
    weekday: number;
    startsAt: string;
    endsAt: string;
    slotMinutes: number;
  }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('provider_schedules').insert({
    tenant_id: tenantId,
    provider_id: datos.providerId,
    location_id: datos.locationId || null,
    weekday: datos.weekday,
    starts_at: datos.startsAt,
    ends_at: datos.endsAt,
    slot_minutes: datos.slotMinutes,
  });

  traducirDenegacion(error);
  if (error) throw error;

  await audit({
    action: 'update',
    resourceType: 'provider_schedules',
    tenantId,
    summary: `Definió atención los ${DIAS[datos.weekday]} de ${datos.startsAt} a ${datos.endsAt}`,
  });
}

export async function eliminarHorario(tenantId: string, horarioId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('provider_schedules')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', horarioId);

  traducirDenegacion(error);
  if (error) throw error;

  await audit({
    action: 'delete',
    resourceType: 'provider_schedules',
    resourceId: horarioId,
    tenantId,
    summary: 'Retiró un horario de atención',
  });
}

export type Bloqueo = {
  id: string;
  providerId: string | null;
  providerName: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export async function listarBloqueos(
  tenantId: string,
  desde: Date,
  hasta: Date
): Promise<Bloqueo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select(
      'id, provider_id, starts_at, ends_at, reason, provider:profiles!schedule_exceptions_provider_id_fkey(full_name)'
    )
    .eq('tenant_id', tenantId)
    .eq('is_available', false)
    .lt('starts_at', hasta.toISOString())
    .gt('ends_at', desde.toISOString())
    .order('starts_at');

  if (error) throw error;

  type Fila = {
    id: string;
    provider_id: string | null;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    provider: { full_name: string } | null;
  };

  return (data as unknown as Fila[]).map((b) => ({
    id: b.id,
    providerId: b.provider_id,
    providerName: b.provider?.full_name ?? null,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    reason: b.reason,
  }));
}

/**
 * Bloqueos vigentes y futuros.
 *
 * El rango se calcula aquí y no en el componente: `Date.now()` durante el
 * render de un Server Component es una llamada impura que React marca como
 * error, y además la ventana de tiempo es una decisión de datos, no de
 * presentación.
 */
export async function listarBloqueosProximos(
  tenantId: string,
  dias = 365
): Promise<Bloqueo[]> {
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
  return listarBloqueos(tenantId, ahora, hasta);
}

export async function crearBloqueo(
  tenantId: string,
  datos: {
    providerId?: string | null;
    startsAt: string;
    endsAt: string;
    reason: string;
  },
  actorId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('schedule_exceptions').insert({
    tenant_id: tenantId,
    // NULL = bloqueo para toda la institución, como un feriado nacional.
    provider_id: datos.providerId || null,
    starts_at: datos.startsAt,
    ends_at: datos.endsAt,
    reason: datos.reason.trim(),
    is_available: false,
    created_by: actorId,
  });

  traducirDenegacion(error);
  if (error) throw error;

  await audit({
    action: 'update',
    resourceType: 'schedule_exceptions',
    tenantId,
    summary: `Bloqueó la agenda: ${datos.reason}`,
    metadata: { desde: datos.startsAt, hasta: datos.endsAt },
  });
}
