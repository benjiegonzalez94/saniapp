import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, FilePlus2, Pill } from 'lucide-react';

import { can, requireTenantBySlug } from '@/lib/auth/context';
import { obtenerPaciente } from '@/lib/db/patients';
import { listarNotas, obtenerResumenClinico } from '@/lib/db/clinical';
import { listarRecetas } from '@/lib/db/prescriptions';
import { listarDocumentos } from '@/lib/db/documents';
import { GestorAlergias } from '@/components/clinical/gestor-alergias';
import { GestorEstudios } from '@/components/clinical/gestor-estudios';
import { calcularEdad, cn } from '@/lib/utils';
import { ID_DOCUMENT_LABELS, SEX_LABELS } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Expediente' };
export const dynamic = 'force-dynamic';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const FORMATO_HORA = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function PaginaExpediente({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await requireTenantBySlug(slug);

  const paciente = await obtenerPaciente(tenant.tenantId, id);
  if (!paciente) notFound();

  const puedeVerClinico = can(tenant, 'clinical.read');

  // Recepción llega hasta aquí para agendar, pero no ve nada clínico. RLS ya lo
  // impediría; esto evita además pedir datos que van a volver vacíos.
  const [resumen, notas, recetas, estudios] = puedeVerClinico
    ? await Promise.all([
        obtenerResumenClinico(tenant.tenantId, id),
        listarNotas(tenant.tenantId, id),
        listarRecetas(tenant.tenantId, id),
        listarDocumentos(tenant.tenantId, id),
      ])
    : [null, [], [], []];

  const edad = paciente.birthDate ? calcularEdad(paciente.birthDate) : null;

  return (
    <div className="space-y-6">
      <Link
        href={`/i/${slug}/pacientes`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Pacientes
      </Link>

      {/* Identificación */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-(--color-tinta)">
            {paciente.givenName} {paciente.familyName}
          </h1>
          <p className="mt-1 text-sm text-(--color-tinta-2)">
            {[
              edad !== null ? `${edad} años` : 'Edad sin registrar',
              SEX_LABELS[paciente.sexAtBirth],
              paciente.nationalIdLast4
                ? `${ID_DOCUMENT_LABELS[paciente.idDocument]} ···${paciente.nationalIdLast4}`
                : 'Sin documento',
            ].join(' · ')}
          </p>
          <p className="cifras mt-1 text-xs text-(--color-tinta-3)">
            Historia clínica N.º {paciente.recordNumber}
            {paciente.birthDate && ` · Nacido el ${FORMATO_FECHA.format(new Date(paciente.birthDate))}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {can(tenant, 'clinical.sign') && (
            <Link
              href={`/i/${slug}/pacientes/${id}/recetas/nueva`}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-4 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
            >
              <Pill className="size-4" aria-hidden="true" />
              Receta
            </Link>
          )}

          {can(tenant, 'clinical.write') && (
            <Link
              href={`/i/${slug}/pacientes/${id}/consulta`}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Nueva consulta
            </Link>
          )}
        </div>
      </header>

      {puedeVerClinico && resumen && (
        <>
          {/* Banda de seguridad: alergias y crónicos. Nunca plegada. Las
              alergias se editan aquí mismo, sin salir del expediente. */}
          <section
            aria-label="Alertas clínicas"
            className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-4"
          >
            <GestorAlergias
              slug={slug}
              patientId={id}
              alergias={resumen.alergias}
              puedeEditar={can(tenant, 'clinical.write')}
            />

            {resumen.cronicos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-(--color-borde) pt-3">
                <span className="text-xs font-medium tracking-wide text-(--color-tinta-3) uppercase">
                  Condiciones crónicas
                </span>
                {resumen.cronicos.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-full bg-(--color-superficie-2) px-2.5 py-1 text-sm text-(--color-tinta)"
                  >
                    {d.display}
                    <span className="cifras ml-1.5 text-xs text-(--color-tinta-3)">{d.code}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Últimos signos vitales */}
          {resumen.ultimosVitales && (
            <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-4">
              <h2 className="text-xs font-medium tracking-wide text-(--color-tinta-3) uppercase">
                Últimos signos vitales ·{' '}
                {FORMATO_FECHA.format(new Date(resumen.ultimosVitales.measuredAt))}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
                <Vital etiqueta="Presión" valor={
                  resumen.ultimosVitales.systolicBp && resumen.ultimosVitales.diastolicBp
                    ? `${resumen.ultimosVitales.systolicBp}/${resumen.ultimosVitales.diastolicBp}`
                    : null
                } unidad="mmHg" />
                <Vital etiqueta="F. cardíaca" valor={resumen.ultimosVitales.heartRate} unidad="lpm" />
                <Vital etiqueta="Temperatura" valor={resumen.ultimosVitales.temperatureC} unidad="°C" />
                <Vital etiqueta="Sat. O₂" valor={resumen.ultimosVitales.oxygenSaturation} unidad="%" />
                <Vital etiqueta="Peso" valor={resumen.ultimosVitales.weightKg} unidad="kg" />
                <Vital etiqueta="IMC" valor={resumen.ultimosVitales.bmi} unidad="" />
              </dl>
            </section>
          )}

          {/* Recetas emitidas */}
          {recetas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-(--color-tinta)">
                Recetas
                <span className="ml-2 font-normal text-(--color-tinta-3)">
                  {recetas.length}
                </span>
              </h2>
              <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
                {recetas.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/i/${slug}/pacientes/${id}/recetas/${r.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-(--color-superficie-2)"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-(--color-tinta)">
                          <span className="cifras">N.º {r.folio}</span>
                          <span className="text-(--color-tinta-3)">
                            {' '}
                            · {FORMATO_FECHA.format(new Date(r.createdAt))}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-(--color-tinta-3)">
                          {r.prescriberName} · {r.itemCount}{' '}
                          {r.itemCount === 1 ? 'medicamento' : 'medicamentos'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs',
                          r.signedAt
                            ? 'bg-(--color-exito-suave) text-(--color-exito)'
                            : 'bg-(--color-aviso-suave) text-(--color-tinta-2)'
                        )}
                      >
                        {r.signedAt ? 'Firmada' : 'Sin firmar'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <GestorEstudios
            slug={slug}
            patientId={id}
            documentos={estudios}
            puedeSubir={can(tenant, 'documents.upload')}
            puedeDescargar={can(tenant, 'documents.read')}
          />

          {/* Historial */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-(--color-tinta)">
              Historia clínica
              {notas.length > 0 && (
                <span className="ml-2 font-normal text-(--color-tinta-3)">
                  {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
                </span>
              )}
            </h2>

            {notas.length === 0 ? (
              <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-10 text-center">
                <p className="text-sm text-(--color-tinta-2)">
                  Sin consultas registradas todavía.
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs text-(--color-tinta-3)">
                  Si el paciente tiene historia en papel, no hace falta transcribirla entera:
                  registre las alergias y las condiciones crónicas, que es lo que se consulta
                  en cada visita.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
                {notas.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/i/${slug}/pacientes/${id}/notas/${n.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-(--color-superficie-2)"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-(--color-tinta)">
                          {FORMATO_HORA.format(new Date(n.createdAt))}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-(--color-tinta-3)">
                          {n.authorName}
                          {n.wordCount ? ` · ${n.wordCount} palabras` : ''}
                        </p>
                      </div>

                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs',
                          // Una nota enmendada ya no es la versión vigente: se
                          // marca como tal para que nadie actúe sobre ella
                          // creyendo que es la última.
                          n.amendedBy
                            ? 'bg-(--color-superficie-2) text-(--color-tinta-3) line-through'
                            : n.signedAt
                              ? 'bg-(--color-exito-suave) text-(--color-exito)'
                              : 'bg-(--color-aviso-suave) text-(--color-tinta-2)'
                        )}
                      >
                        {n.amendedBy ? 'Enmendada' : n.signedAt ? 'Firmada' : 'Borrador'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!puedeVerClinico && (
        <p className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie-2) px-4 py-3 text-sm text-(--color-tinta-2)">
          Su rol permite gestionar la agenda y los datos de contacto, pero no acceder a la
          historia clínica.
        </p>
      )}
    </div>
  );
}

function Vital({
  etiqueta,
  valor,
  unidad,
}: {
  etiqueta: string;
  valor: number | string | null;
  unidad: string;
}) {
  return (
    <div>
      <dt className="text-xs text-(--color-tinta-3)">{etiqueta}</dt>
      <dd className="cifras mt-0.5 text-sm text-(--color-tinta)">
        {valor ?? '—'}
        {valor != null && unidad && (
          <span className="ml-1 text-xs text-(--color-tinta-3)">{unidad}</span>
        )}
      </dd>
    </div>
  );
}
