'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import {
  AlergiaBloqueanteError,
  emitirReceta,
  type AvisoAlergia,
} from '@/lib/db/prescriptions';

/**
 * Emisión de receta.
 *
 * Los renglones llegan como JSON desde el selector y se validan uno a uno: es
 * entrada del cliente, y un renglón sin dosis ni frecuencia no es una receta,
 * es un papel que la farmacia va a rechazar.
 */

const renglon = z.object({
  medicationCode: z.string().nullable(),
  medication: z.string().trim().min(2, 'Falta el nombre del medicamento').max(200),
  presentation: z.string().trim().max(120).default(''),
  dose: z.string().trim().min(1, 'Indique la dosis de cada medicamento').max(120),
  frequency: z.string().trim().min(1, 'Indique la frecuencia de cada medicamento').max(120),
  duration: z.string().trim().max(120).default(''),
  instructions: z.string().trim().max(500).default(''),
});

const esquema = z.object({
  items: z
    .string()
    .transform((s, ctx) => {
      let crudo: unknown;
      try {
        crudo = JSON.parse(s);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Medicamentos con formato inválido' });
        return z.NEVER;
      }
      const r = z.array(renglon).min(1, 'Añada al menos un medicamento').max(20).safeParse(crudo);
      if (!r.success) {
        ctx.addIssue({ code: 'custom', message: r.error.issues[0]!.message });
        return z.NEVER;
      }
      return r.data;
    }),
  avisosAsumidos: z
    .string()
    .default('[]')
    .transform((s) => {
      try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
      } catch {
        return [];
      }
    }),
  notes: z.string().trim().max(1000).default(''),
  firmar: z.coerce.boolean().default(false),
});

export type EstadoReceta = {
  error?: string;
  avisos?: AvisoAlergia[];
  asumible?: boolean;
};

export async function guardarReceta(
  _prev: EstadoReceta,
  formData: FormData
): Promise<EstadoReceta> {
  const slug = String(formData.get('slug') ?? '');
  const patientId = String(formData.get('patientId') ?? '');

  // Prescribir es firmar: exige clinical.sign, que enfermería no tiene.
  const tenant = await requirePermissionBySlug(slug, 'clinical.sign');
  const user = await requireUser();

  const crudo = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = esquema.safeParse({ ...crudo, firmar: crudo.firmar === 'on' });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  const d = parsed.data;

  try {
    await emitirReceta(tenant.tenantId, patientId, user.id, {
      items: d.items,
      notes: d.notes,
      firmar: d.firmar,
      avisosAceptados: d.avisosAsumidos,
    });
  } catch (err) {
    if (err instanceof AlergiaBloqueanteError) {
      return {
        error: err.asumible
          ? 'Revise los avisos de alergia y márquelos como valorados para continuar.'
          : 'No se puede emitir: alergia de riesgo vital al mismo fármaco.',
        avisos: err.avisos,
        asumible: err.asumible,
      };
    }
    throw err;
  }

  redirect(`/i/${slug}/pacientes/${patientId}`);
}
