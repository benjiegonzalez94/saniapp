import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { obtenerPaciente } from '@/lib/db/patients';
import { calcularEdad } from '@/lib/utils';
import { FormularioReceta } from './formulario';

export const metadata: Metadata = { title: 'Nueva receta' };
export const dynamic = 'force-dynamic';

export default async function PaginaNuevaReceta({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  // Prescribir es un acto de firma: sólo el personal médico.
  const tenant = await requirePermissionBySlug(slug, 'clinical.sign');

  const paciente = await obtenerPaciente(tenant.tenantId, id);
  if (!paciente) notFound();

  const edad = paciente.birthDate ? calcularEdad(paciente.birthDate) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/i/${slug}/pacientes/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Expediente
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          Nueva receta
        </h1>
        <p className="mt-1 text-sm text-(--color-tinta-2)">
          {paciente.givenName} {paciente.familyName}
          {edad !== null && ` · ${edad} años`}
          <span className="cifras"> · HC {paciente.recordNumber}</span>
        </p>
      </div>

      <FormularioReceta slug={slug} patientId={id} />
    </div>
  );
}
