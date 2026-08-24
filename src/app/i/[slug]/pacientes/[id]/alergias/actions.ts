'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import { registrarAlergia } from '@/lib/db/clinical';
import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import { ALLERGY_SEVERITIES } from '@/lib/db/types';

/**
 * Alergias del paciente.
 *
 * Se registran y se DESACTIVAN, nunca se borran. Que una alergia dejara de
 * existir sin rastro es peligroso: si alguien la retiró por error, nadie puede
 * saber que estuvo ahí. `is_active = false` mantiene la historia y la saca de
 * la banda de alertas.
 */

const esquemaAlta = z.object({
  substance: z.string().trim().min(2, 'Indique la sustancia').max(160),
  reaction: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().max(300).optional()),
  severity: z.enum(ALLERGY_SEVERITIES),
});

export type EstadoAlergia = { error?: string; ok?: boolean };

export async function agregarAlergia(
  _prev: EstadoAlergia,
  formData: FormData
): Promise<EstadoAlergia> {
  const slug = String(formData.get('slug') ?? '');
  const patientId = String(formData.get('patientId') ?? '');

  const tenant = await requirePermissionBySlug(slug, 'clinical.write');
  const user = await requireUser();

  const parsed = esquemaAlta.safeParse({
    substance: formData.get('substance'),
    reaction: formData.get('reaction'),
    severity: formData.get('severity'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  try {
    await registrarAlergia(tenant.tenantId, patientId, user.id, parsed.data);
  } catch (err) {
    // La tabla tiene unique (patient_id, substance): registrar dos veces la
    // misma sustancia es un intento de duplicado, no un fallo del sistema.
    if (typeof err === 'object' && err && 'code' in err && err.code === '23505') {
      return { error: 'Esa sustancia ya está registrada en el expediente.' };
    }
    throw err;
  }

  revalidatePath(`/i/${slug}/pacientes/${patientId}`);
  return { ok: true };
}

export async function desactivarAlergia(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const patientId = String(formData.get('patientId') ?? '');
  const allergyId = String(formData.get('allergyId') ?? '');

  const tenant = await requirePermissionBySlug(slug, 'clinical.write');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('allergies')
    .update({ is_active: false })
    .eq('tenant_id', tenant.tenantId)
    .eq('id', allergyId)
    .select('substance')
    .single();

  if (error) throw error;

  await audit({
    action: 'update',
    resourceType: 'allergies',
    resourceId: allergyId,
    tenantId: tenant.tenantId,
    patientId,
    summary: `Retiró la alergia a ${data.substance} de las alertas activas`,
  });

  revalidatePath(`/i/${slug}/pacientes/${patientId}`);
}
