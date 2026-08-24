import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuditAction } from '@/lib/db/types';
import type { Json } from '@/lib/db/database.types';

/**
 * Escritura en la bitácora de auditoría.
 *
 * Regla del proyecto: TODA lectura de datos clínicos se audita. No sólo las
 * escrituras. La pregunta que una auditoría de protección de datos hace no es
 * "¿quién modificó esta historia?" sino "¿quién la ABRIÓ?", y esa es justo la
 * que no se puede responder si sólo se registran los cambios.
 */

export type AuditInput = {
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  patientId?: string | null;
  summary?: string | null;
  /** Debe ser serializable: acaba en una columna jsonb. */
  metadata?: Record<string, Json>;
};

/**
 * Un fallo al auditar no debe tumbar la petición: dejar a un médico sin ver a su
 * paciente porque la bitácora falló es peor que la propia laguna en el registro.
 * Pero tampoco puede pasar en silencio, así que se deja ruido en los logs del
 * servidor para que la alerta salte.
 *
 * Para las operaciones donde el rastro es obligatorio antes de conceder acceso
 * —el break-glass— la auditoría ocurre dentro de la misma transacción SQL que
 * la concede (ver public.break_glass), no aquí.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    // Se omiten los ausentes en lugar de enviar null: los parámetros del RPC
    // tienen DEFAULT null, y omitirlos deja que la base aplique su propio valor.
    const { error } = await supabase.rpc('record_audit', {
      p_action: input.action,
      p_resource_type: input.resourceType,
      p_resource_id: input.resourceId ?? undefined,
      p_tenant_id: input.tenantId ?? undefined,
      p_patient_id: input.patientId ?? undefined,
      p_summary: input.summary ?? undefined,
      p_metadata: input.metadata ?? {},
    });

    if (error) {
      console.error('[auditoría] no se pudo registrar el evento', {
        action: input.action,
        resourceType: input.resourceType,
        tenantId: input.tenantId,
        error: error.message,
      });
    }
  } catch (err) {
    console.error('[auditoría] fallo inesperado', err);
  }
}

/**
 * Envuelve la lectura de datos de un paciente para que el registro de acceso
 * ocurra siempre. Se usa así:
 *
 *   const historia = await auditedRead(
 *     { tenantId, patientId, resourceType: 'clinical_notes', summary: 'Abrió la historia' },
 *     () => cargarNotas(patientId)
 *   );
 *
 * Sólo audita si la lectura tuvo éxito: un intento fallido por falta de permiso
 * ya lo registra la propia base con la acción `permission_denied`.
 */
export async function auditedRead<T>(
  context: {
    tenantId: string;
    patientId: string;
    resourceType: string;
    resourceId?: string;
    summary?: string;
  },
  read: () => Promise<T>
): Promise<T> {
  const result = await read();

  await audit({
    action: 'read',
    resourceType: context.resourceType,
    resourceId: context.resourceId ?? null,
    tenantId: context.tenantId,
    patientId: context.patientId,
    summary: context.summary ?? `Consultó ${context.resourceType}`,
  });

  return result;
}
