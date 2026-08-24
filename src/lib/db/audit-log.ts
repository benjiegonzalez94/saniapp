import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { sanearTerminoBusqueda } from '@/lib/utils';
import type { AuditAction, MemberRole } from '@/lib/db/types';

/**
 * Lectura de la bitácora de auditoría.
 *
 * La tabla es de sólo-anexado: `public.audit_log` no tiene políticas de INSERT,
 * UPDATE ni DELETE, y cada fila sella la anterior con un SHA-256 (`prev_hash` →
 * `row_hash`). Este módulo sólo lee; escribir es tarea de `@/lib/audit`, que
 * pasa por el RPC `public.record_audit`.
 *
 * Consultar la bitácora NO se audita, por la misma razón por la que no se
 * audita el buscador de pacientes: un evento por cada cambio de filtro ahogaría
 * en ruido justo la consulta que importa —«¿quién abrió el expediente de este
 * paciente?»—. El acto que sí queda registrado es abrir un expediente concreto.
 */

/* -------------------------------------------------------------------------- */
/* Verificación de la cadena de hash                                           */
/* -------------------------------------------------------------------------- */

export type EstadoCadena = {
  eventosVerificados: number;
  /** null = íntegra. Con valor, el primer evento donde la cadena no cuadra. */
  rotoEnId: number | null;
  rotoEn: string | null;
};

/**
 * Recorre la cadena de hash y devuelve dónde deja de cuadrar.
 *
 * `app.verify_audit_chain()` existe desde la migración 0003 pero vive en el
 * esquema `app`, que PostgREST no publica: era inalcanzable desde la interfaz.
 * La migración 0017 añadió `public.verificar_cadena_auditoria()`, que comprueba
 * el permiso `audit.read` antes de recorrer nada.
 *
 * Es una operación de coste lineal sobre la bitácora entera de la institución.
 * No se llama al pintar la lista de eventos: se pide a propósito, con un botón,
 * porque en una institución con años de historia tardaría lo suyo.
 */
export async function verificarCadena(tenantId: string): Promise<EstadoCadena> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('verificar_cadena_auditoria', { p_tenant_id: tenantId })
    .single();

  if (error) throw error;

  return {
    eventosVerificados: Number(data.eventos_verificados ?? 0),
    rotoEnId: data.roto_en_id === null ? null : Number(data.roto_en_id),
    rotoEn: data.roto_en,
  };
}

/** Cierra la revisión de un acceso de emergencia. Queda en la propia bitácora. */
export async function revisarBreakGlass(grantId: string, nota?: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('revisar_break_glass', {
    p_grant_id: grantId,
    p_nota: nota?.trim() || undefined,
  });

  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Eventos                                                                     */
/* -------------------------------------------------------------------------- */

export type EventoAuditoria = {
  id: number;
  occurredAt: string;
  action: AuditAction;
  actorId: string | null;
  /** Nombre del perfil; si el evento lo escribió un worker, su etiqueta. */
  actorName: string;
  actorLabel: string;
  actorRole: MemberRole | null;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  /** Null si quien consulta no puede leer el padrón (ver `nombresDePacientes`). */
  patientName: string | null;
  patientRecordNumber: number | null;
  summary: string | null;
  breakGlassReason: string | null;
};

export type FiltrosBitacora = {
  accion?: AuditAction | null;
  pacienteId?: string | null;
  actorId?: string | null;
  /**
   * Instantes, no días de calendario, igual que `listarCitas`. Traducir «el
   * martes» de la institución al instante que le corresponde es cosa de la
   * vista, que es la única que conoce la zona; aquí llega ya resuelto.
   */
  desde?: Date | null;
  hasta?: Date | null;
  /** Busca en el resumen, el tipo de recurso y el motivo de break-glass. */
  texto?: string | null;
};

/**
 * El embebido sólo alcanza a `profiles`: `audit_log.actor_id` tiene clave
 * foránea (`audit_log_actor_id_fkey`) y PostgREST puede seguirla. `patient_id`
 * NO la tiene —está desnormalizada a propósito para responder «todo lo de este
 * paciente» sin joins—, así que pedir `patients!…(…)` aquí devolvería PGRST200.
 * Los nombres se resuelven en una segunda consulta.
 *
 * En una sola línea y sin concatenar: `'a' + 'b'` se ensancha a `string` y
 * supabase-js pierde la inferencia de la forma de la fila.
 */
const CAMPOS_EVENTO =
  'id, occurred_at, action, actor_id, actor_label, actor_role, resource_type, resource_id, patient_id, summary, break_glass_reason, actor:profiles!audit_log_actor_id_fkey(id, full_name)' as const;

type FilaEvento = {
  id: number;
  occurred_at: string;
  action: AuditAction;
  actor_id: string | null;
  actor_label: string;
  actor_role: MemberRole | null;
  resource_type: string;
  resource_id: string | null;
  patient_id: string | null;
  summary: string | null;
  break_glass_reason: string | null;
  actor: { id: string; full_name: string } | null;
};

// La limpieza del término de búsqueda vive en @/lib/utils. La comparten esta
// vista y el padrón de pacientes: tenerla duplicada garantizaba que un día se
// arreglara en un sitio y no en el otro, que es justo lo que había pasado —el
// buscador de pacientes devolvía un 400 con cualquier coma.

/**
 * Resuelve los nombres de los pacientes citados en un lote de eventos.
 *
 * Devuelve un mapa incompleto a propósito: el rol `auditor` tiene `audit.read`
 * pero NO `patients.read`, así que la política `patients_select` le deja el
 * padrón vacío. Es el comportamiento correcto —quien revisa la bitácora detecta
 * un patrón de accesos sin necesitar el nombre— y por eso la interfaz tiene que
 * seguir siendo legible sin él en vez de romperse.
 */
async function nombresDePacientes(
  tenantId: string,
  ids: string[]
): Promise<Map<string, { nombre: string; recordNumber: number | null }>> {
  const mapa = new Map<string, { nombre: string; recordNumber: number | null }>();
  if (ids.length === 0) return mapa;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('id, given_name, family_name, record_number')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  if (error) throw error;

  for (const p of data ?? []) {
    mapa.set(p.id, {
      nombre: `${p.family_name}, ${p.given_name}`,
      recordNumber: p.record_number,
    });
  }
  return mapa;
}

/**
 * Eventos de la institución, del más reciente al más antiguo.
 *
 * El desempate por `id` no es cosmético: `audit_log` está particionada por mes
 * y su clave primaria es `(occurred_at, id)`. Dos eventos con la misma marca de
 * tiempo —el sello y la concesión de un break-glass, por ejemplo— saldrían en
 * orden arbitrario entre una recarga y la siguiente, y quien lee la bitácora
 * vería invertida la secuencia que tiene que reconstruir.
 */
export async function listarEventos(
  tenantId: string,
  filtros: FiltrosBitacora = {},
  limite = 100
): Promise<EventoAuditoria[]> {
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select(CAMPOS_EVENTO)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(limite, 1), 500));

  if (filtros.accion) query = query.eq('action', filtros.accion);
  if (filtros.pacienteId) query = query.eq('patient_id', filtros.pacienteId);
  if (filtros.actorId) query = query.eq('actor_id', filtros.actorId);

  // `hasta` es exclusivo, como en `listarCitas`: quien llama pasa el comienzo
  // del día siguiente si quiere incluir el último.
  if (filtros.desde) query = query.gte('occurred_at', filtros.desde.toISOString());
  if (filtros.hasta) query = query.lt('occurred_at', filtros.hasta.toISOString());

  const termino = sanearTerminoBusqueda(filtros.texto ?? '');
  if (termino) {
    const patron = `%${termino}%`;
    query = query.or(
      `summary.ilike.${patron},resource_type.ilike.${patron},break_glass_reason.ilike.${patron}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const filas = data as unknown as FilaEvento[];
  const pacientes = await nombresDePacientes(tenantId, [
    ...new Set(filas.map((f) => f.patient_id).filter((id): id is string => id !== null)),
  ]);

  return filas.map((f) => {
    const paciente = f.patient_id ? pacientes.get(f.patient_id) : undefined;

    return {
      id: f.id,
      occurredAt: f.occurred_at,
      action: f.action,
      actorId: f.actor_id,
      actorName: f.actor?.full_name ?? f.actor_label,
      actorLabel: f.actor_label,
      actorRole: f.actor_role,
      resourceType: f.resource_type,
      resourceId: f.resource_id,
      patientId: f.patient_id,
      patientName: paciente?.nombre ?? null,
      patientRecordNumber: paciente?.recordNumber ?? null,
      summary: f.summary,
      breakGlassReason: f.break_glass_reason,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Accesos de emergencia pendientes de revisar                                 */
/* -------------------------------------------------------------------------- */

export type ConcesionBreakGlass = {
  id: string;
  patientId: string;
  patientName: string | null;
  patientRecordNumber: number | null;
  profileId: string;
  profileName: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  /** Si la ventana de emergencia sigue abierta ahora mismo. */
  vigente: boolean;
};

/**
 * El embebido va SIN `!inner` a propósito.
 *
 * `break_glass_grants` sí tiene claves foráneas a `patients` y `profiles`, pero
 * la política `patients_select` exige `patients.read`, que el rol `auditor` no
 * tiene. Con `!inner`, PostgREST convertiría la fila hija vacía en la
 * desaparición de la concesión entera: el auditor vería cero accesos de
 * emergencia pendientes y concluiría que no hay nada que revisar. Sin él,
 * la concesión aparece y lo único que falta es el nombre.
 */
const CAMPOS_CONCESION =
  'id, patient_id, profile_id, reason, granted_at, expires_at, patient:patients!break_glass_grants_patient_id_fkey(given_name, family_name, record_number), profile:profiles!break_glass_grants_profile_id_fkey(full_name)' as const;

type FilaConcesion = {
  id: string;
  patient_id: string;
  profile_id: string;
  reason: string;
  granted_at: string;
  expires_at: string;
  patient: { given_name: string; family_name: string; record_number: number | null } | null;
  profile: { full_name: string } | null;
};

/**
 * Accesos de emergencia todavía sin revisar.
 *
 * Un break-glass es legítimo —negarle la historia a un paciente inconsciente
 * puede matarlo— pero sólo mientras alguien lo mire después. Una concesión que
 * nadie revisa convierte el mecanismo en una puerta trasera permanente, así que
 * ésta es la lista que la interfaz tiene que enseñar antes que ninguna otra.
 */
export async function resumenBreakGlass(tenantId: string): Promise<ConcesionBreakGlass[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('break_glass_grants')
    .select(CAMPOS_CONCESION)
    .eq('tenant_id', tenantId)
    .is('reviewed_at', null)
    .order('granted_at', { ascending: false });

  if (error) throw error;

  // La vigencia se resuelve aquí y no al pintar: `Date.now()` durante el render
  // de un Server Component es una llamada impura que react-hooks/purity marca
  // como error, y además todas las filas del lote deben compararse contra el
  // mismo instante para que la lista no se contradiga a sí misma.
  const ahora = Date.now();

  return (data as unknown as FilaConcesion[]).map((c) => ({
    id: c.id,
    patientId: c.patient_id,
    patientName: c.patient ? `${c.patient.family_name}, ${c.patient.given_name}` : null,
    patientRecordNumber: c.patient?.record_number ?? null,
    profileId: c.profile_id,
    profileName: c.profile?.full_name ?? 'Perfil eliminado',
    reason: c.reason,
    grantedAt: c.granted_at,
    expiresAt: c.expires_at,
    vigente: new Date(c.expires_at).getTime() > ahora,
  }));
}
