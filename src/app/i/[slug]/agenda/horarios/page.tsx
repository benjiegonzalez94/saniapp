import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import {
  DIAS,
  listarBloqueosProximos,
  listarHorarios,
  listarProveedores,
} from '@/lib/db/scheduling';
import { createClient } from '@/lib/supabase/server';
import { PanelHorarios } from './panel';

export const metadata: Metadata = { title: 'Horarios de atención' };
export const dynamic = 'force-dynamic';

export default async function PaginaHorarios({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requirePermissionBySlug(slug, 'schedule.manage');

  const supabase = await createClient();

  const [horarios, proveedores, bloqueos, sedes] = await Promise.all([
    listarHorarios(tenant.tenantId),
    listarProveedores(tenant.tenantId),
    // Bloqueos vigentes y futuros: los pasados sólo estorban.
    listarBloqueosProximos(tenant.tenantId),
    supabase
      .from('locations')
      .select('id, name')
      .eq('tenant_id', tenant.tenantId)
      .eq('is_active', true)
      .order('name')
      .then((r) => (r.data ?? []) as Array<{ id: string; name: string }>),
  ]);

  // Agrupado por profesional: es como se piensa un horario, no por día suelto.
  const porProfesional = proveedores.map((p) => ({
    ...p,
    horarios: horarios
      .filter((h) => h.providerId === p.id)
      .sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/i/${slug}/agenda`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Agenda
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          Horarios de atención
        </h1>
        <p className="mt-1 text-sm text-(--color-tinta-2)">
          De aquí salen los huecos que se ofrecen al agendar. Sin horario definido, la agenda
          no tiene nada que ofrecer.
        </p>
      </div>

      <PanelHorarios
        slug={slug}
        zona={tenant.timezone}
        profesionales={porProfesional}
        sedes={sedes}
        bloqueos={bloqueos}
        dias={[...DIAS]}
      />
    </div>
  );
}
