'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

import { requirePermissionBySlug } from '@/lib/auth/context';
import {
  InvitacionError,
  cambiarRol,
  invitarMiembro,
  retirarMiembro,
  revocarInvitacion,
} from '@/lib/db/team';
import { MEMBER_ROLES } from '@/lib/db/types';

export type EstadoInvitacion = {
  error?: string;
  enlace?: string;
  email?: string;
};

const esquemaInvitacion = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  // `owner` se excluye: la titularidad se transfiere, no se invita, y el RPC
  // lo rechaza igualmente.
  role: z.enum(MEMBER_ROLES.filter((r) => r !== 'owner') as [string, ...string[]]),
});

export async function invitar(
  _prev: EstadoInvitacion,
  formData: FormData
): Promise<EstadoInvitacion> {
  const slug = String(formData.get('slug') ?? '');
  const tenant = await requirePermissionBySlug(slug, 'members.manage');

  const parsed = esquemaInvitacion.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  // El enlace debe apuntar al host desde el que se está usando la aplicación,
  // no a una constante: en desarrollo es localhost y en producción el dominio
  // real, y un enlace con el host equivocado no lo puede abrir nadie.
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const origen = `${proto}://${host}`;

  try {
    const { enlace } = await invitarMiembro(
      tenant.tenantId,
      parsed.data.email,
      parsed.data.role as (typeof MEMBER_ROLES)[number],
      origen
    );

    revalidatePath(`/i/${slug}/equipo`);
    return { enlace, email: parsed.data.email };
  } catch (err) {
    if (err instanceof InvitacionError) return { error: err.message };
    throw err;
  }
}

export type Respuesta = { ok: true } | { ok: false; error: string };

export async function anularInvitacion(
  slug: string,
  invitationId: string
): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'members.manage');
  await revocarInvitacion(tenant.tenantId, invitationId);
  revalidatePath(`/i/${slug}/equipo`);
  return { ok: true };
}

export async function actualizarRol(
  slug: string,
  membershipId: string,
  role: string
): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'members.manage');

  const parsed = z.enum(MEMBER_ROLES).safeParse(role);
  if (!parsed.success) return { ok: false, error: 'Rol desconocido' };

  try {
    await cambiarRol(tenant.tenantId, membershipId, parsed.data);
  } catch (err) {
    if (err instanceof InvitacionError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/i/${slug}/equipo`);
  return { ok: true };
}

export async function quitarMiembro(slug: string, membershipId: string): Promise<Respuesta> {
  const tenant = await requirePermissionBySlug(slug, 'members.manage');

  try {
    await retirarMiembro(tenant.tenantId, membershipId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo retirar al miembro',
    };
  }

  revalidatePath(`/i/${slug}/equipo`);
  return { ok: true };
}
