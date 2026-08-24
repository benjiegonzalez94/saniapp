'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import {
  HorarioAjenoError,
  HuecoOcupadoError,
  agendarCita,
  cambiarEstadoCita,
  crearBloqueo,
  eliminarHorario,
  guardarHorario,
  reprogramarCita,
} from '@/lib/db/scheduling';
import { APPOINTMENT_STATUSES, ENCOUNTER_KINDS } from '@/lib/db/types';

export type Respuesta = { ok: true } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Estado de una cita                                                          */
/* -------------------------------------------------------------------------- */

export async function marcarEstado(
  slug: string,
  citaId: string,
  estado: string,
  motivo?: string
): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'appointments.write');
  const user = await requireUser();

  const parsed = z.enum(APPOINTMENT_STATUSES).safeParse(estado);
  if (!parsed.success) return { ok: false, error: 'Estado de cita desconocido' };

  try {
    await cambiarEstadoCita(tenant.tenantId, citaId, parsed.data, {
      motivo,
      actorId: user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo actualizar' };
  }

  revalidatePath(`/i/${slug}/agenda`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Agendar                                                                     */
/* -------------------------------------------------------------------------- */

const esquemaCita = z.object({
  patientId: z.string().uuid('Elija un paciente'),
  providerId: z.string().uuid('Elija un profesional'),
  locationId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional()
  ),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  kind: z.enum(ENCOUNTER_KINDS).default('consulta'),
  reason: z.string().trim().max(500).default(''),
  privateNote: z.string().trim().max(500).default(''),
});

export type EstadoAgendar = { error?: string; campo?: string };

export async function crearCita(
  _prev: EstadoAgendar,
  formData: FormData
): Promise<EstadoAgendar> {
  const slug = String(formData.get('slug') ?? '');
  const tenant = await requirePermissionBySlug(slug, 'appointments.write');
  const user = await requireUser();

  const parsed = esquemaCita.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]) };
  }

  const d = parsed.data;

  if (new Date(d.startsAt) <= new Date()) {
    return { error: 'No se puede agendar en el pasado.', campo: 'startsAt' };
  }

  try {
    await agendarCita(
      tenant.tenantId,
      {
        patientId: d.patientId,
        providerId: d.providerId,
        locationId: d.locationId,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        kind: d.kind,
        source: 'web',
        reason: d.reason,
        privateNote: d.privateNote,
      },
      user.id
    );
  } catch (err) {
    // El hueco pudo ocuparse entre que se pintó la pantalla y se pulsó el botón:
    // la restricción de exclusión lo detecta y aquí se traduce a un mensaje útil.
    if (err instanceof HuecoOcupadoError) return { error: err.message, campo: 'startsAt' };
    throw err;
  }

  revalidatePath(`/i/${slug}/agenda`);
  // Se vuelve al día de la cita recién creada, no al de hoy: quien agenda para
  // el jueves quiere ver que quedó ahí.
  redirect(`/i/${slug}/agenda?fecha=${d.startsAt.slice(0, 10)}`);
}

export async function moverCita(
  slug: string,
  citaId: string,
  nuevoInicio: string,
  nuevoFin: string
): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'appointments.write');
  const user = await requireUser();

  try {
    await reprogramarCita(tenant.tenantId, citaId, nuevoInicio, nuevoFin, user.id);
  } catch (err) {
    if (err instanceof HuecoOcupadoError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/i/${slug}/agenda`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Horarios y bloqueos                                                         */
/* -------------------------------------------------------------------------- */

const esquemaHorario = z.object({
  providerId: z.string().uuid('Elija un profesional'),
  locationId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional()
  ),
  weekday: z.coerce.number().int().min(0).max(6),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  slotMinutes: z.coerce.number().int().min(5).max(240),
});

export type EstadoHorario = { error?: string };

export async function crearHorario(
  _prev: EstadoHorario,
  formData: FormData
): Promise<EstadoHorario> {
  const slug = String(formData.get('slug') ?? '');
  const tenant = await requirePermissionBySlug(slug, 'schedule.manage');

  const parsed = esquemaHorario.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const d = parsed.data;
  if (d.endsAt <= d.startsAt) {
    return { error: 'La hora de fin debe ser posterior a la de inicio.' };
  }

  try {
    await guardarHorario(tenant.tenantId, d);
  } catch (err) {
    if (err instanceof HorarioAjenoError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/i/${slug}/agenda/horarios`);
  return {};
}

export async function quitarHorario(slug: string, horarioId: string): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'schedule.manage');

  try {
    await eliminarHorario(tenant.tenantId, horarioId);
  } catch (err) {
    if (err instanceof HorarioAjenoError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/i/${slug}/agenda/horarios`);
  return { ok: true };
}

const esquemaBloqueo = z.object({
  providerId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional()
  ),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(3, 'Indique el motivo del bloqueo').max(200),
});

export async function bloquearAgenda(
  _prev: EstadoHorario,
  formData: FormData
): Promise<EstadoHorario> {
  const slug = String(formData.get('slug') ?? '');
  const tenant = await requirePermissionBySlug(slug, 'schedule.manage');
  const user = await requireUser();

  const parsed = esquemaBloqueo.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const d = parsed.data;
  if (new Date(d.endsAt) <= new Date(d.startsAt)) {
    return { error: 'El fin del bloqueo debe ser posterior a su inicio.' };
  }

  try {
    await crearBloqueo(tenant.tenantId, d, user.id);
  } catch (err) {
    if (err instanceof HorarioAjenoError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/i/${slug}/agenda`);
  revalidatePath(`/i/${slug}/agenda/horarios`);
  return {};
}
