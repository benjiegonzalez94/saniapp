'use client';

import { useState, useTransition } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { descargarEstudio } from '@/app/i/[slug]/pacientes/[id]/estudios/actions';

/**
 * Descarga de un estudio desde el listado de la institución.
 *
 * Es cliente por una sola razón: la URL firmada vive 60 segundos y hay que
 * seguirla en el instante en que llega. Pintarla en el servidor la dejaría
 * caducada antes de que nadie la pulse, y firmar por adelantado una por fila
 * repartiría permisos al portador de archivos que probablemente nadie abra.
 */
export function BotonDescarga({
  slug,
  documentoId,
  titulo,
}: {
  slug: string;
  documentoId: string;
  titulo: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function descargar() {
    setError(null);
    iniciar(async () => {
      const r = await descargarEstudio(slug, documentoId);
      if (!r.ok) {
        // El servidor vuelve a mirar el veredicto del antivirus antes de firmar.
        // Si cambió entre el pintado de la lista y el clic —el worker acaba de
        // marcar el archivo como infectado—, este botón mentía: aquí se dice
        // por qué, en vez de dejar una descarga que no ocurre.
        setError(r.error);
        return;
      }
      // `assign` en lugar de mutar location.href: misma navegación, y como la
      // URL trae Content-Disposition de descarga, el navegador baja el archivo
      // sin abandonar el listado.
      window.location.assign(r.url);
    });
  }

  return (
    <div className="no-imprimir flex shrink-0 items-center gap-2">
      {error && (
        <span role="alert" className="max-w-64 text-xs text-(--color-riesgo)">
          {error}
        </span>
      )}

      <Button
        type="button"
        size="sm"
        variant="secundario"
        cargando={pendiente}
        onClick={descargar}
        aria-label={`Descargar ${titulo}`}
      >
        {!pendiente && <Download className="size-4" aria-hidden="true" />}
        Descargar
      </Button>
    </div>
  );
}
