import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, FileClock, Lock, PencilLine } from 'lucide-react';

import { can, requirePermissionBySlug } from '@/lib/auth/context';
import { abrirNota } from '@/lib/db/clinical';
import { obtenerPaciente } from '@/lib/db/patients';

export const metadata: Metadata = { title: 'Nota clínica' };
export const dynamic = 'force-dynamic';

const FORMATO = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'long',
  timeStyle: 'short',
});

const APARTADOS = [
  ['subjective', 'Subjetivo'],
  ['objective', 'Objetivo'],
  ['assessment', 'Análisis'],
  ['plan', 'Plan'],
] as const;

export default async function PaginaNota({
  params,
}: {
  params: Promise<{ slug: string; id: string; noteId: string }>;
}) {
  const { slug, id, noteId } = await params;
  const tenant = await requirePermissionBySlug(slug, 'clinical.read');

  const puedeFirmar = can(tenant, 'clinical.sign');

  const nota = await abrirNota(tenant.tenantId, noteId);
  // Se comprueba que la nota pertenezca al paciente de la URL: sin esto, un
  // identificador de nota válido se leería desde el expediente equivocado.
  if (!nota || nota.patientId !== id) notFound();

  const paciente = await obtenerPaciente(tenant.tenantId, id);
  if (!paciente) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/i/${slug}/pacientes/${id}`}
        className="no-imprimir inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Expediente
      </Link>

      <header className="border-b border-(--color-borde) pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          {paciente.givenName} {paciente.familyName}
        </h1>
        <p className="mt-1 text-sm text-(--color-tinta-2)">
          {FORMATO.format(new Date(nota.meta.createdAt))} · {nota.meta.authorName}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {nota.meta.signedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-exito-suave) px-2.5 py-1 text-xs text-(--color-exito)">
              <Lock className="size-3" aria-hidden="true" />
              Firmada el {FORMATO.format(new Date(nota.meta.signedAt))} · inmutable
            </span>
          ) : (
            <span className="rounded-full bg-(--color-aviso-suave) px-2.5 py-1 text-xs text-(--color-tinta-2)">
              Borrador sin firmar
            </span>
          )}

          {/* Una nota superada sigue siendo legible, pero quien la abra debe
              saber que existe una versión posterior antes de actuar sobre ella. */}
          {nota.meta.amendedBy && (
            <Link
              href={`/i/${slug}/pacientes/${id}/notas/${nota.meta.amendedBy}`}
              className="no-imprimir inline-flex items-center gap-1.5 rounded-full bg-(--color-aviso-suave) px-2.5 py-1 text-xs font-medium text-(--color-tinta) hover:underline"
            >
              <FileClock className="size-3" aria-hidden="true" />
              Enmendada · ver versión vigente
            </Link>
          )}
        </div>
      </header>

      {nota.meta.amendmentReason && (
        <p className="rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2) px-3 py-2 text-sm text-(--color-tinta-2)">
          <span className="font-medium text-(--color-tinta)">Motivo de esta enmienda: </span>
          {nota.meta.amendmentReason}
        </p>
      )}

      <div className="space-y-5">
        {APARTADOS.map(([clave, titulo]) => {
          const texto = nota.contenido[clave]?.trim();
          if (!texto) return null;

          return (
            <section key={clave}>
              <h2 className="text-xs font-medium tracking-wide text-(--color-tinta-3) uppercase">
                {titulo}
              </h2>
              {/* whitespace-pre-wrap conserva los saltos de línea que escribió
                  el médico: en una nota clínica la disposición es información. */}
              <p className="mt-1.5 leading-relaxed whitespace-pre-wrap text-(--color-tinta)">
                {texto}
              </p>
            </section>
          );
        })}
      </div>

      <footer className="no-imprimir flex flex-wrap items-center justify-between gap-3 border-t border-(--color-borde) pt-4">
        <p className="text-xs text-(--color-tinta-3)">
          Este acceso quedó registrado en la bitácora de auditoría.
        </p>

        {/* Sólo se enmienda lo firmado y aún vigente, y sólo quien puede firmar. */}
        {nota.meta.signedAt && !nota.meta.amendedBy && puedeFirmar && (
          <Link
            href={`/i/${slug}/pacientes/${id}/notas/${noteId}/enmendar`}
            className="inline-flex h-9 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
          >
            <PencilLine className="size-4" aria-hidden="true" />
            Enmendar
          </Link>
        )}
      </footer>
    </article>
  );
}
