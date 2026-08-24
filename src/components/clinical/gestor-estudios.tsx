'use client';

import { useRef, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { DOCUMENT_KINDS, type DocumentKind } from '@/lib/db/types';
import type { DocumentoResumen, EstadoAnalisis } from '@/lib/db/documents';
import {
  confirmarSubida,
  descargarEstudio,
  reservarEstudio,
} from '@/app/i/[slug]/pacientes/[id]/estudios/actions';

const ETIQUETAS_TIPO: Record<DocumentKind, string> = {
  laboratorio: 'Laboratorio',
  imagen: 'Imagen',
  informe: 'Informe',
  receta: 'Receta',
  consentimiento: 'Consentimiento',
  referencia: 'Referencia',
  certificado: 'Certificado',
  otro: 'Otro',
};

/** El estado del análisis no es decoración: decide si el archivo se puede abrir. */
const ESTADO: Record<
  EstadoAnalisis,
  { icono: typeof ShieldCheck; clase: string; etiqueta: string }
> = {
  limpio: {
    icono: ShieldCheck,
    clase: 'text-(--color-exito)',
    etiqueta: 'Analizado',
  },
  pendiente: {
    icono: ShieldQuestion,
    clase: 'text-(--color-aviso)',
    etiqueta: 'En análisis',
  },
  infectado: {
    icono: ShieldAlert,
    clase: 'text-(--color-riesgo)',
    etiqueta: 'Rechazado',
  },
  error: {
    icono: ShieldAlert,
    clase: 'text-(--color-tinta-3)',
    etiqueta: 'Sin analizar',
  },
};

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FECHA = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function GestorEstudios({
  slug,
  patientId,
  documentos,
  puedeSubir,
  puedeDescargar,
}: {
  slug: string;
  patientId: string;
  documentos: DocumentoResumen[];
  puedeSubir: boolean;
  puedeDescargar: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  async function subir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const datos = new FormData(e.currentTarget);
    const archivo = datos.get('archivo') as File | null;

    if (!archivo || archivo.size === 0) {
      setError('Elija un archivo.');
      return;
    }

    setSubiendo(true);
    setProgreso('Preparando…');

    try {
      // Paso 1: el servidor reserva la fila y firma la URL de subida.
      const reserva = await reservarEstudio(slug, patientId, {
        kind: datos.get('kind'),
        title: datos.get('title'),
        description: datos.get('description'),
        studyDate: datos.get('studyDate'),
        mimeType: archivo.type,
        sizeBytes: archivo.size,
      });

      if (!reserva.ok) {
        setError(reserva.error);
        return;
      }

      // Paso 2: el archivo va directo al bucket, sin atravesar el servidor.
      setProgreso(`Subiendo ${tamano(archivo.size)}…`);
      const supabase = createClient();
      const { error: errSubida } = await supabase.storage
        .from('clinical')
        .uploadToSignedUrl(reserva.path, reserva.token, archivo, {
          contentType: archivo.type,
        });

      if (errSubida) {
        setError(`No se pudo subir el archivo: ${errSubida.message}`);
        return;
      }

      setProgreso('Listo. En cola de análisis antivirus.');
      formulario.current?.reset();
      setAbierto(false);
      await confirmarSubida(slug, patientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo inesperado al subir');
    } finally {
      setSubiendo(false);
      setTimeout(() => setProgreso(null), 4000);
    }
  }

  async function descargar(id: string) {
    setError(null);
    const r = await descargarEstudio(slug, id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // La URL firmada dura 60 segundos: se usa de inmediato y no se guarda.
    // `assign` en lugar de mutar location.href — misma navegación, y como la
    // URL viene con Content-Disposition de descarga, el navegador baja el
    // archivo sin abandonar el expediente.
    window.location.assign(r.url);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-(--color-tinta)">
          Estudios y documentos
          {documentos.length > 0 && (
            <span className="ml-2 font-normal text-(--color-tinta-3)">
              {documentos.length}
            </span>
          )}
        </h2>

        {puedeSubir && !abierto && (
          <Button type="button" size="sm" variant="secundario" onClick={() => setAbierto(true)}>
            <Upload className="size-4" aria-hidden="true" />
            Subir estudio
          </Button>
        )}
      </div>

      {abierto && (
        <form
          ref={formulario}
          onSubmit={subir}
          className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-4"
        >
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1">
              <label htmlFor="kind" className="block text-xs font-medium text-(--color-tinta-2)">
                Tipo
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue="laboratorio"
                className="h-9 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
              >
                {DOCUMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ETIQUETAS_TIPO[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="title" className="block text-xs font-medium text-(--color-tinta-2)">
                Título
              </label>
              <input
                id="title"
                name="title"
                required
                placeholder="Hemograma completo"
                className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="studyDate"
                className="block text-xs font-medium text-(--color-tinta-2)"
              >
                Fecha del estudio
              </label>
              <input
                id="studyDate"
                name="studyDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="archivo"
                className="block text-xs font-medium text-(--color-tinta-2)"
              >
                Archivo
              </label>
              <input
                id="archivo"
                name="archivo"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.dcm,.txt,.docx"
                className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 py-1.5 text-xs text-(--color-tinta) file:mr-2 file:rounded file:border-0 file:bg-(--color-superficie-2) file:px-2 file:py-1 file:text-xs file:text-(--color-tinta) outline-none focus:border-(--color-acento)"
              />
            </div>
          </div>

          <input
            name="description"
            placeholder="Descripción (opcional)"
            aria-label="Descripción"
            className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />

          <p className="text-xs text-(--color-tinta-3)">
            Todo archivo pasa por antivirus antes de poder abrirse. Hasta entonces queda
            guardado pero retenido. Máximo 100 MB.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" cargando={subiendo}>
              Subir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="fantasma"
              onClick={() => setAbierto(false)}
              disabled={subiendo}
            >
              Cancelar
            </Button>
            {progreso && (
              <span className="flex items-center gap-1.5 text-xs text-(--color-tinta-2)">
                {subiendo && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                {progreso}
              </span>
            )}
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {error}
        </p>
      )}

      {documentos.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-8 text-center">
          <FileText
            className="mx-auto size-7 text-(--color-tinta-3)"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm text-(--color-tinta-2)">Sin estudios cargados.</p>
        </div>
      ) : (
        <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          {documentos.map((d) => {
            const est = ESTADO[d.scanStatus];
            const Icono = est.icono;

            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                {/* El estado se anuncia con texto para lectores de pantalla: un
                    icono coloreado no dice nada a quien no lo ve, y aquí lo que
                    comunica es si el archivo se puede abrir. */}
                <span className="shrink-0" title={est.etiqueta}>
                  <Icono className={cn('size-4', est.clase)} aria-hidden="true" />
                  <span className="sr-only">{est.etiqueta}.</span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-tinta)">
                    {d.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-(--color-tinta-3)">
                    {[
                      ETIQUETAS_TIPO[d.kind],
                      d.studyDate ? FECHA.format(new Date(d.studyDate)) : null,
                      tamano(d.sizeBytes),
                      d.uploadedByName,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {d.scanStatus !== 'limpio' && (
                    <p className={cn('mt-0.5 text-xs', est.clase)}>
                      {est.etiqueta}
                      {d.scanDetail && `: ${d.scanDetail}`}
                    </p>
                  )}
                </div>

                {puedeDescargar && (
                  <button
                    type="button"
                    onClick={() => void descargar(d.id)}
                    disabled={d.scanStatus !== 'limpio'}
                    title={
                      d.scanStatus === 'limpio'
                        ? 'Descargar'
                        : 'No se sirve un archivo que no haya pasado el antivirus'
                    }
                    className="shrink-0 rounded-(--radius-sm) p-2 text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta) disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    <span className="sr-only">Descargar {d.title}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
