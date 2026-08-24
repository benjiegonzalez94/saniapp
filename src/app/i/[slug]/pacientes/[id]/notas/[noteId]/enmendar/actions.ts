'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import { enmendarNota } from '@/lib/db/clinical';

const esquema = z.object({
  subjective: z.string().trim().min(1, 'El subjetivo no puede quedar vacío').max(20_000),
  objective: z.string().trim().max(20_000).default(''),
  assessment: z.string().trim().max(20_000).default(''),
  plan: z.string().trim().max(20_000).default(''),
  // El motivo es obligatorio y con sustancia: una enmienda sin explicación deja
  // a quien lea el expediente sin saber si fue una errata o un cambio clínico.
  motivo: z
    .string()
    .trim()
    .min(10, 'Explique el motivo de la enmienda en al menos 10 caracteres')
    .max(500),
});

export type EstadoEnmienda = { error?: string; campo?: string };

export async function guardarEnmienda(
  _prev: EstadoEnmienda,
  formData: FormData
): Promise<EstadoEnmienda> {
  const slug = String(formData.get('slug') ?? '');
  const patientId = String(formData.get('patientId') ?? '');
  const noteId = String(formData.get('noteId') ?? '');

  // Enmendar es un acto de firma: sustituye un documento médico-legal.
  const tenant = await requirePermissionBySlug(slug, 'clinical.sign');
  const user = await requireUser();

  const parsed = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]) };
  }

  const { motivo, ...contenido } = parsed.data;

  let nuevaId: string;
  try {
    nuevaId = await enmendarNota(tenant.tenantId, noteId, user.id, contenido, motivo);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo enmendar la nota' };
  }

  redirect(`/i/${slug}/pacientes/${patientId}/notas/${nuevaId}`);
}
