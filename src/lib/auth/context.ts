import 'server-only';

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { MemberRole, Permission } from '@/lib/db/types';

/**
 * Contexto de autenticación y autorización del servidor.
 *
 * Aclaración importante sobre el modelo de seguridad: NADA de lo que hay aquí
 * es la barrera de verdad. La barrera es RLS, en la base. Estas funciones
 * existen para que la interfaz sepa qué mostrar y para dar errores legibles en
 * vez de un resultado vacío inexplicable.
 *
 * Si alguna vez una comprobación de aquí es lo único que impide un acceso
 * indebido, es que falta una política en la base de datos.
 */

export type TenantContext = {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly slug: string;
  readonly role: MemberRole;
  readonly permissions: ReadonlySet<Permission>;
  readonly accessModel: 'open' | 'care_team';
  readonly timezone: string;
};

export class AuthorizationError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Falta el permiso ${permission}`);
    this.name = 'AuthorizationError';
    this.permission = permission;
  }
}

/**
 * `cache()` de React deduplica dentro de una misma petición: un árbol con
 * quince Server Components que necesiten el usuario hace una sola llamada.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  // getUser() valida el token contra el servidor de autenticación.
  // getSession() sólo lee la cookie y se dejaría engañar por un JWT falsificado.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/ingresar');
  return user;
}

/** Instituciones de las que el usuario es miembro activo. */
export const getMemberships = cache(
  async (): Promise<
    Array<{ tenantId: string; tenantName: string; slug: string; role: MemberRole }>
  > => {
    const user = await getUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('memberships')
      .select('role, tenant:tenants!inner(id, legal_name, commercial_name, slug, deleted_at)')
      .eq('profile_id', user.id)
      .eq('status', 'active');

    if (error) throw error;

    type Row = {
      role: MemberRole;
      tenant: {
        id: string;
        legal_name: string;
        commercial_name: string | null;
        slug: string;
        deleted_at: string | null;
      } | null;
    };

    return ((data ?? []) as unknown as Row[])
      .filter((r) => r.tenant && !r.tenant.deleted_at)
      .map((r) => ({
        tenantId: r.tenant!.id,
        tenantName: r.tenant!.commercial_name ?? r.tenant!.legal_name,
        slug: r.tenant!.slug,
        role: r.role,
      }));
  }
);

/**
 * Resuelve el contexto de una institución comprobando la membresía y cargando
 * los permisos efectivos del rol.
 *
 * Los permisos se leen de la base, no de una tabla en TypeScript: si la matriz
 * de roles cambia en una migración, la interfaz la sigue sin necesidad de
 * redesplegar el frontend, y no hay dos fuentes de verdad que puedan discrepar.
 */
export const getTenantContext = cache(
  async (tenantId: string): Promise<TenantContext | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();

    const { data: membership, error } = await supabase
      .from('memberships')
      .select(
        'role, tenant:tenants!inner(id, legal_name, commercial_name, slug, access_model, timezone, deleted_at)'
      )
      .eq('profile_id', user.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    type Row = {
      role: MemberRole;
      tenant: {
        id: string;
        legal_name: string;
        commercial_name: string | null;
        slug: string;
        access_model: 'open' | 'care_team';
        timezone: string;
        deleted_at: string | null;
      } | null;
    };

    const row = membership as unknown as Row | null;
    if (!row?.tenant || row.tenant.deleted_at) return null;

    const { data: perms, error: permsError } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role', row.role);

    if (permsError) throw permsError;

    return {
      tenantId: row.tenant.id,
      tenantName: row.tenant.commercial_name ?? row.tenant.legal_name,
      slug: row.tenant.slug,
      role: row.role,
      permissions: new Set(
        ((perms ?? []) as Array<{ permission_key: Permission }>).map((p) => p.permission_key)
      ),
      accessModel: row.tenant.access_model,
      timezone: row.tenant.timezone,
    };
  }
);

/**
 * Resuelve una institución por su slug de URL.
 *
 * Las rutas son /i/{slug}/… y no /i/{uuid}/… porque un médico que pasa consulta
 * en dos sitios distingue "clinica-manta" de "hospital-mendieta" de un vistazo;
 * dos UUID, no.
 */
export const getTenantContextBySlug = cache(
  async (slug: string): Promise<TenantContext | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return getTenantContext((data as { id: string }).id);
  }
);

export async function requireTenantBySlug(slug: string): Promise<TenantContext> {
  await requireUser();
  const context = await getTenantContextBySlug(slug);
  // Una institución de la que no se es miembro se trata como inexistente: un
  // 403 confirmaría que ese slug existe y quién lo ocupa.
  if (!context) notFound();
  return context;
}

export async function requireTenant(tenantId: string): Promise<TenantContext> {
  await requireUser();
  const context = await getTenantContext(tenantId);
  // Un tenant del que no se es miembro se trata como inexistente, no como
  // prohibido: responder 403 confirmaría que esa institución existe.
  if (!context) redirect('/panel');
  return context;
}

export async function requirePermissionBySlug(
  slug: string,
  permission: Permission
): Promise<TenantContext> {
  const context = await requireTenantBySlug(slug);
  if (!context.permissions.has(permission)) {
    throw new AuthorizationError(permission);
  }
  return context;
}

export async function requirePermission(
  tenantId: string,
  permission: Permission
): Promise<TenantContext> {
  const context = await requireTenant(tenantId);
  if (!context.permissions.has(permission)) {
    throw new AuthorizationError(permission);
  }
  return context;
}

export function can(context: TenantContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}
