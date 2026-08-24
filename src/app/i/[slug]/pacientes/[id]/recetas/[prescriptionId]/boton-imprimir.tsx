'use client';

import { Printer } from 'lucide-react';

/**
 * Imprimir la receta.
 *
 * Es un componente de cliente mínimo porque window.print() sólo existe en el
 * navegador; el resto de la página es servidor y se renderiza sin JavaScript.
 * Si el JavaScript no carga, la receta sigue siendo legible e imprimible con
 * el menú del navegador: no se pierde nada esencial.
 */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
    >
      <Printer className="size-4" aria-hidden="true" />
      Imprimir
    </button>
  );
}
