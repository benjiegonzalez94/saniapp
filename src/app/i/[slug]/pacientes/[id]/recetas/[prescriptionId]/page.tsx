import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Lock } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { obtenerReceta } from '@/lib/db/prescriptions';
import { obtenerPaciente } from '@/lib/db/patients';
import { calcularEdad } from '@/lib/utils';
import { BotonImprimir } from './boton-imprimir';

export const metadata: Metadata = { title: 'Receta' };
export const dynamic = 'force-dynamic';

const FECHA_LARGA = new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' });

/**
 * Receta emitida.
 *
 * Está pensada para acabar en papel: el paciente sale del consultorio con ella
 * en la mano y la lleva a la farmacia. Por eso la maqueta prioriza la lectura
 * impresa —tipografía grande en la pauta, un renglón por medicamento, sin
 * elementos de interfaz— y la clase `no-imprimir` retira todo lo que sólo
 * sirve en pantalla.
 */
export default async function PaginaReceta({
  params,
}: {
  params: Promise<{ slug: string; id: string; prescriptionId: string }>;
}) {
  const { slug, id, prescriptionId } = await params;
  const tenant = await requirePermissionBySlug(slug, 'clinical.read');

  const receta = await obtenerReceta(tenant.tenantId, prescriptionId);
  // Se comprueba que la receta sea de este paciente: un identificador válido no
  // debe poder leerse desde el expediente equivocado.
  if (!receta || receta.patientId !== id) notFound();

  const paciente = await obtenerPaciente(tenant.tenantId, id);
  if (!paciente) notFound();

  const edad = paciente.birthDate ? calcularEdad(paciente.birthDate) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="no-imprimir flex items-center justify-between gap-3">
        <Link
          href={`/i/${slug}/pacientes/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Expediente
        </Link>
        <BotonImprimir />
      </div>

      <article className="space-y-6 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 sm:p-8">
        {/* Membrete */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-borde) pb-4">
          <div>
            <p className="font-semibold tracking-tight text-(--color-tinta)">
              {tenant.tenantName}
            </p>
            <p className="mt-0.5 text-sm text-(--color-tinta-2)">Receta médica</p>
          </div>
          <div className="text-right">
            <p className="cifras text-sm font-medium text-(--color-tinta)">
              N.º {receta.folio}
            </p>
            <p className="text-xs text-(--color-tinta-3)">
              {FECHA_LARGA.format(new Date(receta.createdAt))}
            </p>
          </div>
        </header>

        {/* Paciente */}
        <section>
          <p className="text-xs tracking-wide text-(--color-tinta-3) uppercase">Paciente</p>
          <p className="mt-1 text-lg text-(--color-tinta)">
            {paciente.givenName} {paciente.familyName}
          </p>
          <p className="text-sm text-(--color-tinta-2)">
            {[
              edad !== null ? `${edad} años` : null,
              paciente.nationalIdLast4 ? `Documento ···${paciente.nationalIdLast4}` : null,
              `HC ${paciente.recordNumber}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>

        {/* Medicamentos */}
        <section>
          <p className="text-xs tracking-wide text-(--color-tinta-3) uppercase">
            Prescripción
          </p>
          <ol className="mt-3 space-y-4">
            {receta.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="cifras shrink-0 text-sm text-(--color-tinta-3)">
                  {i + 1}.
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-(--color-tinta)">
                    {item.medication}
                    {item.presentation && (
                      <span className="font-normal text-(--color-tinta-2)">
                        {' '}
                        — {item.presentation}
                      </span>
                    )}
                  </p>
                  {/* La pauta va destacada: es lo que el paciente lee en casa a
                      las tres de la mañana para saber si le toca otra dosis. */}
                  <p className="mt-0.5 text-(--color-tinta)">
                    {[item.dose, item.frequency, item.duration].filter(Boolean).join(', ')}
                  </p>
                  {item.instructions && (
                    <p className="mt-0.5 text-sm text-(--color-tinta-2)">
                      {item.instructions}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {receta.notes && (
          <section className="border-t border-(--color-borde) pt-4">
            <p className="text-xs tracking-wide text-(--color-tinta-3) uppercase">
              Indicaciones generales
            </p>
            <p className="mt-1.5 leading-relaxed whitespace-pre-wrap text-(--color-tinta)">
              {receta.notes}
            </p>
          </section>
        )}

        {/* Firma */}
        <footer className="border-t border-(--color-borde) pt-5">
          {receta.signedAt ? (
            <>
              <p className="font-medium text-(--color-tinta)">{receta.prescriberName}</p>
              <p className="text-sm text-(--color-tinta-2)">
                {[receta.prescriberSpecialty, receta.prescriberLicense]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-(--color-tinta-3)">
                <Lock className="size-3" aria-hidden="true" />
                Firmada electrónicamente el {FECHA_LARGA.format(new Date(receta.signedAt))}
              </p>
            </>
          ) : (
            <p className="rounded-(--radius-md) bg-(--color-aviso-suave) px-3 py-2 text-sm text-(--color-tinta)">
              <strong className="font-medium">Sin firmar.</strong> Una receta sin firma no es
              válida en farmacia.
            </p>
          )}
        </footer>
      </article>

      <p className="no-imprimir text-xs text-(--color-tinta-3)">
        Este acceso quedó registrado en la bitácora de auditoría.
      </p>
    </div>
  );
}
