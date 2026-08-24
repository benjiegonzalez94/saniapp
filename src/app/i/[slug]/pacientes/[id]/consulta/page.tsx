import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

import { can, requirePermissionBySlug } from '@/lib/auth/context';
import { obtenerPaciente } from '@/lib/db/patients';
import { obtenerResumenClinico } from '@/lib/db/clinical';
import { calcularEdad } from '@/lib/utils';
import { ALLERGY_SEVERITY_LABELS } from '@/lib/db/types';
import { FormularioConsulta } from './formulario';

export const metadata: Metadata = { title: 'Nueva consulta' };
export const dynamic = 'force-dynamic';

export default async function PaginaConsulta({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await requirePermissionBySlug(slug, 'clinical.write');

  const paciente = await obtenerPaciente(tenant.tenantId, id);
  if (!paciente) notFound();

  const { alergias } = await obtenerResumenClinico(tenant.tenantId, id);
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
          Nueva consulta
        </h1>
        <p className="mt-1 text-sm text-(--color-tinta-2)">
          {paciente.givenName} {paciente.familyName}
          {edad !== null && ` · ${edad} años`}
          <span className="cifras"> · HC {paciente.recordNumber}</span>
        </p>
      </div>

      {/* Las alergias se repiten aquí, no sólo en el expediente: quien prescribe
          las tiene delante en el momento de escribir el plan, sin volver atrás. */}
      {alergias.length > 0 && (
        <div
          role="note"
          className="flex flex-wrap items-center gap-2 rounded-(--radius-lg) border border-(--color-riesgo) bg-(--color-riesgo-suave) px-4 py-3"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-(--color-riesgo) uppercase">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Alergias
          </span>
          {alergias.map((a) => (
            <span key={a.id} className="text-sm font-medium text-(--color-riesgo)">
              {a.substance}
              <span className="ml-1 text-xs font-normal opacity-80">
                ({ALLERGY_SEVERITY_LABELS[a.severity]})
              </span>
            </span>
          ))}
        </div>
      )}

      <FormularioConsulta
        slug={slug}
        patientId={id}
        puedeFirmar={can(tenant, 'clinical.sign')}
      />
    </div>
  );
}
