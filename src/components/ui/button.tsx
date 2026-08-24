import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primario' | 'secundario' | 'fantasma' | 'riesgo';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primario:
    'bg-(--color-acento) text-white hover:bg-(--color-acento-fuerte) ' +
    'disabled:hover:bg-(--color-acento)',
  secundario:
    'bg-(--color-superficie) text-(--color-tinta) border border-(--color-borde-fuerte) ' +
    'hover:bg-(--color-superficie-2)',
  fantasma: 'text-(--color-tinta-2) hover:bg-(--color-superficie-2) hover:text-(--color-tinta)',
  // Para cancelar una cita, revocar un consentimiento o retirar un acceso.
  riesgo: 'bg-(--color-riesgo) text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  // 40 px de alto mínimo: el mostrador de una clínica se opera con prisa y a
  // menudo desde una tableta.
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  cargando?: boolean;
};

export function Button({
  className,
  variant = 'primario',
  size = 'md',
  cargando = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-(--radius-md) font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || cargando}
      // Lo anuncian los lectores de pantalla sin necesidad de una región viva.
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
