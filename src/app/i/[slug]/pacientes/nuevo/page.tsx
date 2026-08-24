import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { FormularioAlta } from './formulario';

export const metadata: Metadata = { title: 'Nuevo paciente' };
export const dynamic = 'force-dynamic';

export default async function PaginaNuevoPaciente({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePermissionBySlug(slug, 'patients.write');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/i/${slug}/pacientes`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Pacientes
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          Nuevo paciente
        </h1>
        <p className="mt-1.5 text-sm text-(--color-tinta-2)">
          Sólo el nombre y el apellido son obligatorios. Lo demás se puede completar después,
          sin cerrar la consulta.
        </p>
      </div>

      <FormularioAlta slug={slug} />
    </div>
  );
}
