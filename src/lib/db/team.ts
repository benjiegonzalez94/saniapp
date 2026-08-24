import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import type { MemberRole } from '@/lib/db/types';

/**
 * Equipo de la institución: miembros e invitaciones.
 *
 * El alta de personal pasa por RPC transaccionales
 * (`invite_member`, `accept_invitation`) y no por INSERT directos, porque hay un
 * invariante que un INSERT suelto rompería: una invitación aceptada debe crear
 * la membresía en el mismo commit.
 *
 * El token de invitación se devuelve **una sola vez**. La base guarda su
 * SHA-256, no el token: una filtración de la tabla `invitations` no permite
 * aceptar ninguna invitación.
 */

export type Miembro = {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  status: 'invited' | 'active' | 'suspended' | 'revoked';
  specialty: string | null;
  licenseNumber: string | null;
  lastSeenAt: string | null;
  acceptedAt: string | null;
};

export type Invitacion = {
  id: string;
  email: string;
  role: MemberRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
};

export async function listarMiembros(tenantId: string): Promise<Miembro[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, profile_id, role, status, accepted_at, profile:profiles!memberships_profile_id_fkey(full_name, email, specialty, license_number, last_seen_at)'
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'revoked')
    .order('role');

  if (error) throw error;

  type Fila = {
    id: string;
    profile_id: string;
    role: MemberRole;
    status: Miembro['status'];
    accepted_at: string | null;
    profile: {
      full_name: string;
      email: string;
      specialty: string | null;
      license_number: string | null;
      last_seen_at: string | null;
    } | null;
  };

  return (data as unknown as Fila[]).map((m) => ({
    id: m.id,
    profileId: m.profile_id,
    fullName: m.profile?.full_name ?? '—',
    email: m.profile?.email ?? '—',
    role: m.role,
    status: m.status,
    specialty: m.profile?.specialty ?? null,
    licenseNumber: m.profile?.license_number ?? null,
    lastSeenAt: m.profile?.last_seen_at ?? null,
    acceptedAt: m.accepted_at,
  }));
}

export async function listarInvitaciones(tenantId: string): Promise<Invitacion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, email, role, status, expires_at, created_at, inviter:profiles!invitations_invited_by_fkey(full_name)'
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  type Fila = {
    id: string;
    email: string;
    role: MemberRole;
    status: Invitacion['status'];
    expires_at: string;
    created_at: string;
    inviter: { full_name: string } | null;
  };

  return (data as unknown as Fila[]).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
    invitedByName: i.inviter?.full_name ?? null,
  }));
}

export class InvitacionError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'InvitacionError';
  }
}

/**
 * Crea una invitación y devuelve su enlace.
 *
 * El token viaja en la URL y **no se puede recuperar después**: la base sólo
 * guarda su hash. Quien invita tiene que copiarlo ahora o volver a invitar.
 */
export async function invitarMiembro(
  tenantId: string,
  email: string,
  role: MemberRole,
  origen: string
): Promise<{ enlace: string; invitationId: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('invite_member', {
      p_tenant_id: tenantId,
      p_email: email.trim().toLowerCase(),
      p_role: role,
    })
    .single<{ invitation_id: string; token: string }>();

  if (error) {
    if (error.code === '23505') {
      throw new InvitacionError('Esa persona ya pertenece a la institución o ya fue invitada.');
    }
    if (error.code === '42501') {
      throw new InvitacionError('No tiene permiso para invitar miembros.');
    }
    if (error.code === '22023') {
      throw new InvitacionError(error.message);
    }
    throw error;
  }

  return {
    invitationId: data.invitation_id,
    enlace: `${origen}/invitacion/${data.token}`,
  };
}

export async function revocarInvitacion(
  tenantId: string,
  invitationId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', invitationId);

  if (error) throw error;

  await audit({
    action: 'update',
    resourceType: 'invitations',
    resourceId: invitationId,
    tenantId,
    summary: 'Revocó una invitación pendiente',
  });
}

/**
 * Cambia el rol de un miembro.
 *
 * El rol `owner` no se asigna aquí: es una transferencia de titularidad y hay
 * un índice único que impide dos propietarios activos. Dejarlo pasar por este
 * camino produciría un error de base incomprensible.
 */
export async function cambiarRol(
  tenantId: string,
  membershipId: string,
  role: MemberRole
): Promise<void> {
  if (role === 'owner') {
    throw new InvitacionError(
      'La titularidad se transfiere, no se asigna. Contacte con soporte.'
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('tenant_id', tenantId)
    .eq('id', membershipId)
    .neq('role', 'owner')
    .select('profile_id')
    .single();

  if (error) throw error;

  await audit({
    action: 'role_change',
    resourceType: 'memberships',
    resourceId: membershipId,
    tenantId,
    summary: `Cambió el rol de un miembro a «${role}»`,
    metadata: { nuevo_rol: role, profile_id: data.profile_id },
  });
}

/**
 * Retira a alguien del equipo.
 *
 * Se marca `revoked`, no se borra: la bitácora de auditoría referencia a quien
 * hizo cada cosa, y borrar la membresía dejaría eventos huérfanos sin poder
 * reconstruir quién era esa persona.
 */
export async function retirarMiembro(
  tenantId: string,
  membershipId: string
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('memberships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', membershipId)
    .neq('role', 'owner')
    .select('profile_id')
    .single();

  if (error) throw error;

  await audit({
    action: 'role_change',
    resourceType: 'memberships',
    resourceId: membershipId,
    tenantId,
    summary: 'Retiró a un miembro del equipo',
    metadata: { profile_id: data.profile_id },
  });
}

/** Acepta una invitación con su token en claro. Devuelve el slug del destino. */
export async function aceptarInvitacion(token: string): Promise<string> {
  const supabase = await createClient();

  const { data: tenantId, error } = await supabase.rpc('accept_invitation', {
    p_token: token,
  });

  if (error) {
    if (error.code === '42501') {
      throw new InvitacionError(
        'Esta invitación se emitió para otra dirección de correo. Entre con la cuenta a la que se envió.'
      );
    }
    if (error.code === '22023') {
      throw new InvitacionError(error.message);
    }
    if (error.code === '53400') {
      throw new InvitacionError('Demasiados intentos. Espere unos minutos.');
    }
    throw error;
  }

  const { data: tenant, error: errSlug } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId as string)
    .single();

  if (errSlug) throw errSlug;
  return tenant.slug;
}
