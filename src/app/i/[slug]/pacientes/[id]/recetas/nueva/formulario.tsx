'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { SelectorMedicamento } from '@/components/clinical/selector-medicamento';
import { guardarReceta, type EstadoReceta } from './actions';

const ESTADO_INICIAL: EstadoReceta = {};

export function FormularioReceta({
  slug,
  patientId,
}: {
  slug: string;
  patientId: string;
}) {
  const [estado, accion, enviando] = useActionState(guardarReceta, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="patientId" value={patientId} />

      <section className="space-y-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <div>
          <h2 className="text-sm font-medium text-(--color-tinta)">Medicamentos</h2>
          <p className="mt-1 text-xs text-(--color-tinta-3)">
            Elegir del catálogo rellena la presentación y la pauta habituales, y activa el
            cruce con las alergias del paciente.
          </p>
        </div>

        <SelectorMedicamento
          name="items"
          avisosAsumidosName="avisosAsumidos"
          patientId={patientId}
        />
      </section>

      <section className="space-y-2 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <label htmlFor="notes" className="block text-sm font-medium text-(--color-tinta)">
          Indicaciones generales
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Reposo relativo. Abundantes líquidos. Volver si la fiebre persiste más de 48 horas."
          className="w-full resize-y rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 py-2 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
        />
        <p className="text-xs text-(--color-tinta-3)">
          Se imprimen al pie de la receta, donde el paciente las va a leer en casa.
        </p>
      </section>

      {estado.error && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            name="firmar"
            defaultChecked
            className="mt-0.5 size-4 shrink-0 accent-(--color-acento)"
          />
          <span className="text-(--color-tinta-2)">
            Firmar al emitir
            <span className="mt-0.5 block text-xs text-(--color-tinta-3)">
              Una receta firmada ya no se modifica. Sin firma no sirve en farmacia.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" cargando={enviando}>
          {enviando ? 'Emitiendo…' : 'Emitir receta'}
        </Button>
      </div>
    </form>
  );
}
