import * as React from 'react';
import { cn } from '@/lib/utils';

export type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Texto de apoyo permanente: formato esperado, por qué se pide el dato. */
  ayuda?: string;
  error?: string;
};

/**
 * Campo de formulario con etiqueta, ayuda y error correctamente asociados.
 *
 * `aria-describedby` apunta a la vez a la ayuda y al error, y `aria-invalid`
 * marca el estado: sin esto, quien usa lector de pantalla oye el campo pero no
 * se entera de por qué se lo están rechazando.
 */
export function Field({
  label,
  ayuda,
  error,
  className,
  id,
  required,
  ...props
}: FieldProps) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const helpId = ayuda ? `${fieldId}-ayuda` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-(--color-tinta)">
        {label}
        {required && (
          <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'w-full rounded-(--radius-md) border bg-(--color-superficie) px-3 py-2 text-sm',
          'text-(--color-tinta) placeholder:text-(--color-tinta-3)',
          'transition-colors outline-none',
          'focus:border-(--color-acento)',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-(--color-riesgo)' : 'border-(--color-borde-fuerte)',
          className
        )}
        {...props}
      />

      {ayuda && !error && (
        <p id={helpId} className="text-xs text-(--color-tinta-3)">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-(--color-riesgo)" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
