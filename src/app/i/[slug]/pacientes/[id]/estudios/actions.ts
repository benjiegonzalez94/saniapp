'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import {
  DocumentoNoServibleError,
  TAMANO_MAXIMO,
  TIPOS_ADMITIDOS,
  reservarSubida,
  urlDescarga,
} from '@/lib/db/documents';
import { DOCUMENT_KINDS } from '@/lib/db/types';

/**
 * Subida y descarga de estudios.
 *
 * La subida son dos pasos: el servidor reserva la fila y devuelve una URL
 * firmada; el navegador envía el archivo directamente a Storage. Así el binario
 * no atraviesa el servidor de Next, que en un despliegue serverless tiene un
 * techo de tamaño de cuerpo bastante por debajo de los 100 MB que admite el
 * bucket.
 */

const esquemaReserva = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  title: z.string().trim().min(2, 'Póngale un título reconocible').max(200),
  description: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().max(500).optional()),
  mimeType: z.enum(TIPOS_ADMITIDOS, {
    message: 'Formato no admitido. Se aceptan PDF, imágenes, DICOM y Word.',
  }),
  sizeBytes: z.coerce.number().int().positive().max(TAMANO_MAXIMO, 'El archivo supera 100 MB'),
  studyDate: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional()),
});

export type RespuestaReserva =
  | { ok: true; documentId: string; path: string; token: string }
  | { ok: false; error: string };

export async function reservarEstudio(
  slug: string,
  patientId: string,
  meta: unknown
): Promise<RespuestaReserva> {
  const tenant = await requirePermissionBySlug(slug, 'documents.upload');
  const user = await requireUser();

  const parsed = esquemaReserva.safeParse(meta);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  try {
    const r = await reservarSubida(tenant.tenantId, patientId, user.id, parsed.data);
    return { ok: true, ...r };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo preparar la subida',
    };
  }
}

/** Se llama cuando la subida al bucket terminó, para refrescar el listado. */
export async function confirmarSubida(slug: string, patientId: string): Promise<void> {
  await requirePermissionBySlug(slug, 'documents.upload');
  revalidatePath(`/i/${slug}/pacientes/${patientId}`);
}

export type RespuestaDescarga = { ok: true; url: string } | { ok: false; error: string };

export async function descargarEstudio(
  slug: string,
  documentId: string
): Promise<RespuestaDescarga> {
  const tenant = await requirePermissionBySlug(slug, 'documents.read');

  try {
    const { url } = await urlDescarga(tenant.tenantId, documentId);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof DocumentoNoServibleError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
