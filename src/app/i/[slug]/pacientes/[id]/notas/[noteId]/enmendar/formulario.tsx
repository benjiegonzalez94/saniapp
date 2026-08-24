'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContenidoNota } from '@/lib/db/clinical';
import { guardarEnmienda, type EstadoEnmienda } from './actions';

const ESTADO_INICIAL: EstadoEnmienda = {};

const APARTADOS = [
  { name: 'subjective', label: 'Subjetivo', filas: 5, required: true },
  { name: 'objective', label: 'Objetivo', filas: 4 },
  { name: 'assessment', label: 'Análisis', filas: 3 },
  { name: 'plan', label: 'Plan', filas: 3 },
] as const;

/**
 * Formulario de enmienda.
 *
 * Arranca con el texto original ya cargado, no en blanco: una enmienda suele
 * corregir una frase, no reescribir la consulta. Obligar a teclearlo todo de
 * nuevo invita a resumir de memoria y perder detalle que ya estaba registrado.
 */
export function FormularioEnmienda({
  slug,
  patientId,
  noteId,
  contenidoActual,
}: {
  slug: string;
  patientId: string;
  noteId: string;
  contenidoActual: ContenidoNota;
}) {
  const [estado, accion, enviando] = useActionState(guardarEnmienda, ESTADO_INICIAL);
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="noteId" value={noteId} />

      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <label htmlFor="motivo" className="block text-sm font-medium text-(--color-tinta)">
          Motivo de la enmienda
          <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="motivo"
          name="motivo"
          rows={2}
          required
          autoFocus
          placeholder="Ej. Se corrige la dosis del tratamiento: se anotó 500 mg y correspondía 250 mg."
          aria-describedby="motivo-ayuda"
          className={cn(
            'w-full resize-y rounded-(--radius-md) border bg-(--color-superficie) px-3 py-2 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)',
            errorDe('motivo') ? 'border-(--color-riesgo)' : 'border-(--color-borde-fuerte)'
          )}
        />
        <p id="motivo-ayuda" className="text-xs">
          {errorDe('motivo') ? (
            <span className="text-(--color-riesgo)">{errorDe('motivo')}</span>
          ) : (
            <span className="text-(--color-tinta-3)">
              Queda registrado junto a la enmienda y en la bitácora de auditoría.
            </span>
          )}
        </p>
      </section>

      <section className="space-y-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">Texto corregido</h2>

        {APARTADOS.map((a) => (
          <div key={a.name} className="space-y-1.5">
            <label htmlFor={a.name} className="block text-sm font-medium text-(--color-tinta)">
              {a.label}
              {'required' in a && a.required && (
                <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            <textarea
              id={a.name}
              name={a.name}
              rows={a.filas}
              defaultValue={contenidoActual[a.name]}
              required={'required' in a ? a.required : undefined}
              aria-invalid={errorDe(a.name) ? true : undefined}
              className={cn(
                'w-full resize-y rounded-(--radius-md) border bg-(--color-superficie) px-3 py-2 text-sm leading-relaxed text-(--color-tinta) outline-none focus:border-(--color-acento)',
                errorDe(a.name) ? 'border-(--color-riesgo)' : 'border-(--color-borde-fuerte)'
              )}
            />
            {errorDe(a.name) && (
              <p role="alert" className="text-xs text-(--color-riesgo)">
                {errorDe(a.name)}
              </p>
            )}
          </div>
        ))}
      </section>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" cargando={enviando}>
          {enviando ? 'Enmendando…' : 'Firmar enmienda'}
        </Button>
      </div>
    </form>
  );
}
