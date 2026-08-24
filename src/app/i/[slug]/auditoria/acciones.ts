'use server';

import { revalidatePath } from 'next/cache';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { revisarBreakGlass, verificarCadena, type EstadoCadena } from '@/lib/db/audit-log';

export type RespuestaCadena =
  | { ok: true; estado: EstadoCadena }
  | { ok: false; error: string };

/**
 * Verificación de la cadena de hash, a petición.
 *
 * No se ejecuta al cargar la página: recorre la bitácora entera de la
 * institución y en un hospital con años de historia eso se nota. Que sea un
 * acto deliberado también tiene sentido de proceso: comprobar la integridad es
 * algo que se hace y se anota, no un adorno que parpadea en una esquina.
 */
export async function comprobarCadena(slug: string): Promise<RespuestaCadena> {
  const tenant = await requirePermissionBySlug(slug, 'audit.read');

  try {
    return { ok: true, estado: await verificarCadena(tenant.tenantId) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo verificar la cadena',
    };
  }
}

export type Respuesta = { ok: true } | { ok: false; error: string };

export async function cerrarRevision(
  slug: string,
  grantId: string,
  nota: string
): Promise<Respuesta> {
  await requirePermissionBySlug(slug, 'audit.read');

  try {
    await revisarBreakGlass(grantId, nota);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo cerrar la revisión',
    };
  }

  revalidatePath(`/i/${slug}/auditoria`);
  return { ok: true };
}
