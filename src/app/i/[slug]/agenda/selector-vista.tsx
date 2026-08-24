import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Alternador entre la vista de día y la de semana.
 *
 * Recibe las dos direcciones ya construidas en vez del par fecha/médico: cada
 * página sabe qué fecha conserva al saltar —la semana vuelve a hoy si hoy cae
 * dentro de ella— y esa decisión no debería duplicarse aquí.
 *
 * Son enlaces, no botones: la vista es estado de la URL, así que tiene que
 * poder compartirse, guardarse y recorrerse con el botón de atrás.
 */
export function SelectorVista({
  vista,
  hrefDia,
  hrefSemana,
}: {
  vista: 'dia' | 'semana';
  hrefDia: string;
  hrefSemana: string;
}) {
  const opciones = [
    { clave: 'dia' as const, etiqueta: 'Día', href: hrefDia },
    { clave: 'semana' as const, etiqueta: 'Semana', href: hrefSemana },
  ];

  return (
    <div className="flex items-center overflow-hidden rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie)">
      {opciones.map((o, i) => (
        <Link
          key={o.clave}
          href={o.href}
          aria-current={vista === o.clave ? 'page' : undefined}
          className={cn(
            'flex h-9 items-center px-3 text-sm transition-colors',
            i > 0 && 'border-l border-(--color-borde)',
            vista === o.clave
              ? 'bg-(--color-acento-suave) font-medium text-(--color-acento-fuerte)'
              : 'text-(--color-tinta-2) hover:text-(--color-tinta)'
          )}
        >
          {o.etiqueta}
        </Link>
      ))}
    </div>
  );
}
