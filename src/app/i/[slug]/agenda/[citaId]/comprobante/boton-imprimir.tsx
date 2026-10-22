'use client';

import { Printer } from 'lucide-react';

/**
 * Botón para imprimir el comprobante de cita médica o guardarlo como PDF.
 *
 * Utiliza window.print() que invoca el diálogo de impresión nativo del navegador,
 * permitiendo imprimir en papel térmico/láser o "Guardar como PDF".
 */
export function BotonImprimirCita() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
    >
      <Printer className="size-4" aria-hidden="true" />
      Imprimir / PDF
    </button>
  );
}
