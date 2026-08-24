'use client';

import { useActionState, useRef, useState } from 'react';
import { Plus, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ALLERGY_SEVERITIES, ALLERGY_SEVERITY_LABELS, type AllergySeverity } from '@/lib/db/types';
import {
  agregarAlergia,
  desactivarAlergia,
  type EstadoAlergia,
} from '@/app/i/[slug]/pacientes/[id]/alergias/actions';
import type { Alergia } from '@/lib/db/clinical';

const ESTADO_INICIAL: EstadoAlergia = {};

/** Sólo lo grave se pinta en rojo. Si todo alarma, nada alarma. */
const ESTILO: Record<AllergySeverity, string> = {
  mortal: 'bg-(--color-riesgo) text-white',
  severa: 'bg-(--color-riesgo-suave) text-(--color-riesgo)',
  moderada: 'bg-(--color-aviso-suave) text-(--color-tinta)',
  leve: 'bg-(--color-superficie-2) text-(--color-tinta-2)',
};

/**
 * Banda de alergias, editable en el sitio.
 *
 * Es lo primero que se lee al abrir un expediente, así que la edición ocurre
 * aquí y no en otra pantalla: quien descubre en consulta que el paciente es
 * alérgico a algo lo anota sin salir de donde está.
 *
 * Retirar una alergia no la borra: la desactiva. Si alguien la quitó por error,
 * el registro sigue existiendo y la bitácora dice quién fue.
 */
export function GestorAlergias({
  slug,
  patientId,
  alergias,
  puedeEditar,
}: {
  slug: string;
  patientId: string;
  alergias: Alergia[];
  puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  // Al guardar con éxito se limpia el formulario y se cierra, para poder
  // encadenar varias alergias seguidas sin borrar campos a mano.
  //
  // Va aquí, envolviendo la acción, y no en un useEffect: llamar a setState
  // desde un efecto provoca un segundo render innecesario y React lo señala
  // como antipatrón. Dentro de la acción estamos en contexto de evento, que es
  // donde corresponde reaccionar al resultado.
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoAlergia, formData: FormData) => {
      const resultado = await agregarAlergia(previo, formData);
      if (resultado.ok) {
        formulario.current?.reset();
        setAbierto(false);
      }
      return resultado;
    },
    ESTADO_INICIAL
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-(--color-riesgo) uppercase">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          Alergias
        </span>

        {alergias.length === 0 && (
          <span className="text-sm text-(--color-tinta-3)">Ninguna registrada</span>
        )}

        {alergias.map((a) => (
          <span
            key={a.id}
            title={a.reaction ?? undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-sm font-medium',
              ESTILO[a.severity]
            )}
          >
            {a.substance}
            <span className="text-xs opacity-80">{ALLERGY_SEVERITY_LABELS[a.severity]}</span>

            {puedeEditar && (
              <form action={desactivarAlergia}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="allergyId" value={a.id} />
                <button
                  type="submit"
                  aria-label={`Retirar la alergia a ${a.substance}`}
                  title="Retirar de las alertas activas"
                  className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </form>
            )}
          </span>
        ))}

        {puedeEditar && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-(--color-borde-fuerte) px-2.5 py-1 text-xs text-(--color-tinta-2) transition-colors hover:border-(--color-acento) hover:text-(--color-acento)"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Añadir
          </button>
        )}
      </div>

      {abierto && (
        <form
          ref={formulario}
          action={accion}
          className="grid gap-3 rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2) p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="patientId" value={patientId} />

          <input
            name="substance"
            required
            autoFocus
            placeholder="Sustancia (p. ej. Penicilina)"
            aria-label="Sustancia"
            className="h-9 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />
          <input
            name="reaction"
            placeholder="Reacción (opcional)"
            aria-label="Reacción"
            className="h-9 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />
          <select
            name="severity"
            defaultValue="moderada"
            aria-label="Gravedad"
            className="h-9 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
          >
            {ALLERGY_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {ALLERGY_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button type="submit" size="sm" cargando={enviando}>
              Guardar
            </Button>
            <Button type="button" size="sm" variant="fantasma" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>

          {estado.error && (
            <p role="alert" className="text-xs text-(--color-riesgo) sm:col-span-4">
              {estado.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
