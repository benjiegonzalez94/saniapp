import type { Metadata } from 'next';

import { can, requirePermissionBySlug, requireUser } from '@/lib/auth/context';
import { listarInvitaciones, listarMiembros } from '@/lib/db/team';
import { PanelEquipo } from './panel';

export const metadata: Metadata = { title: 'Equipo' };
export const dynamic = 'force-dynamic';

export default async function PaginaEquipo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Cualquier miembro puede ver quién forma el equipo —saber a quién derivar un
  // caso no es información sensible—, pero sólo `members.manage` lo modifica.
  const tenant = await requirePermissionBySlug(slug, 'patients.read');
  const user = await requireUser();

  const puedeGestionar = can(tenant, 'members.manage');

  const [miembros, invitaciones] = await Promise.all([
    listarMiembros(tenant.tenantId),
    puedeGestionar ? listarInvitaciones(tenant.tenantId) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">Equipo</h1>
        <p className="mt-1.5 text-sm text-(--color-tinta-2)">
          El rol decide qué ve cada persona. Recepción agenda pero no abre historias
          clínicas; enfermería registra pero no firma.
        </p>
      </div>

      <PanelEquipo
        slug={slug}
        miembros={miembros}
        invitaciones={invitaciones}
        puedeGestionar={puedeGestionar}
        miPerfilId={user.id}
      />
    </div>
  );
}
