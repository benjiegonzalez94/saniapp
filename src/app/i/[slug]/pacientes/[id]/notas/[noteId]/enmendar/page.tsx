import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { abrirNota } from '@/lib/db/clinical';
import { FormularioEnmienda } from './formulario';

export const metadata: Metadata = { title: 'Enmendar nota' };
export const dynamic = 'force-dynamic';

const FORMATO = new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short' });

export default async function PaginaEnmienda({
  params,
}: {
  params: Promise<{ slug: string; id: string; noteId: string }>;
}) {
  const { slug, id, noteId } = await params;
  // Enmendar sustituye un documento médico-legal: exige permiso de firma, que
  // enfermería no tiene aunque sí pueda registrar notas.
  const tenant = await requirePermissionBySlug(slug, 'clinical.sign');

  const nota = await abrirNota(tenant.tenantId, noteId);
  if (!nota || nota.patientId !== id) notFound();

  if (!nota.meta.signedAt) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/i/${slug}/pacientes/${id}/notas/${noteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) hover:text-(--color-tinta)"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la nota
        </Link>
        <p className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie-2) px-4 py-3 text-sm text-(--color-tinta-2)">
          Esta nota no está firmada, así que todavía se puede corregir sin enmendarla.
        </p>
      </div>
    );
  }

  if (nota.meta.amendedBy) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/i/${slug}/pacientes/${id}/notas/${nota.meta.amendedBy}`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) hover:text-(--color-tinta)"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Ir a la versión vigente
        </Link>
        <p className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie-2) px-4 py-3 text-sm text-(--color-tinta-2)">
          Esta nota ya fue enmendada. Enmiende la versión vigente, no una anterior.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/i/${slug}/pacientes/${id}/notas/${noteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a la nota
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          Enmendar nota firmada
        </h1>
        <p className="mt-1.5 text-sm text-(--color-tinta-2)">
          Firmada el {FORMATO.format(new Date(nota.meta.signedAt))} por {nota.meta.authorName}.
        </p>
      </div>

      <p className="rounded-(--radius-lg) border border-(--color-aviso) bg-(--color-aviso-suave) px-4 py-3 text-sm text-(--color-tinta)">
        La nota original <strong className="font-medium">no se modifica ni se borra</strong>: se
        crea una versión corregida y la anterior queda apuntando a ella. Las dos permanecen
        legibles. Si un diagnóstico se corrigió tres días después, quien lea el expediente debe
        poder ver qué decía antes y por qué cambió.
      </p>

      <FormularioEnmienda
        slug={slug}
        patientId={id}
        noteId={noteId}
        contenidoActual={nota.contenido}
      />
    </div>
  );
}
