'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TENANT_KINDS } from '@/lib/db/types';

/**
 * Alta de institución.
 *
 * Pasa por el RPC `public.create_tenant` y NO por un INSERT directo: el RPC
 * crea la institución y la membresía de propietario en la MISMA transacción.
 * Sin eso, un fallo entre ambas dejaría una institución sin responsable legal
 * de datos —y sin nadie que pueda entrar a arreglarla—. Por eso la tabla
 * `tenants` no tiene política de INSERT.
 */

const esquema = z.object({
  legalName: z
    .string()
    .trim()
    .min(3, 'Escriba la razón social completa')
    .max(200),
  commercialName: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(200).optional()
  ),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/,
      'Use sólo minúsculas, números y guiones (3 a 50 caracteres)'
    ),
  kind: z.enum(TENANT_KINDS),
  taxId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().regex(/^\d{13}$/, 'El RUC ecuatoriano tiene 13 dígitos').optional()
  ),
  timezone: z.string().trim().min(3).max(60).default('America/Guayaquil'),
});

export type EstadoInstitucion = {
  error?: string;
  campo?: string;
  valores?: Record<string, string>;
};

export async function crearInstitucion(
  _prev: EstadoInstitucion,
  formData: FormData
): Promise<EstadoInstitucion> {
  await requireUser();

  const crudo = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = esquema.safeParse(crudo);

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]), valores: crudo };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('create_tenant', {
    p_legal_name: d.legalName,
    p_slug: d.slug,
    p_kind: d.kind,
    p_commercial_name: d.commercialName,
    p_tax_id: d.taxId,
    p_timezone: d.timezone,
  });

  if (error) {
    // 23505 = unicidad; aquí sólo puede ser el slug, que va en la URL.
    if (error.code === '23505' || /slug/i.test(error.message)) {
      return {
        error: 'Esa dirección ya está en uso. Pruebe con otra.',
        campo: 'slug',
        valores: crudo,
      };
    }
    // 53400 = configuration_limit_exceeded: el freno anti-abuso del RPC.
    if (error.code === '53400') {
      return { error: error.message, valores: crudo };
    }
    throw error;
  }

  redirect(`/i/${d.slug}`);
}
