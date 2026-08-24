'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENCOUNTER_KINDS } from '@/lib/db/types';
import { SelectorDiagnostico } from '@/components/clinical/selector-diagnostico';
import { guardarConsulta, type EstadoConsulta } from './actions';

const ESTADO_INICIAL: EstadoConsulta = {};

const ETIQUETAS_ATENCION: Record<(typeof ENCOUNTER_KINDS)[number], string> = {
  consulta: 'Consulta',
  control: 'Control',
  emergencia: 'Emergencia',
  teleconsulta: 'Teleconsulta',
  procedimiento: 'Procedimiento',
  domiciliaria: 'Domiciliaria',
};

/** Signos vitales: rótulo, campo, unidad y rango fisiológico admitido. */
const VITALES = [
  { name: 'systolicBp', label: 'Sistólica', unidad: 'mmHg', min: 40, max: 300 },
  { name: 'diastolicBp', label: 'Diastólica', unidad: 'mmHg', min: 20, max: 200 },
  { name: 'heartRate', label: 'F. cardíaca', unidad: 'lpm', min: 10, max: 300 },
  { name: 'respiratoryRate', label: 'F. respiratoria', unidad: 'rpm', min: 3, max: 90 },
  { name: 'temperatureC', label: 'Temperatura', unidad: '°C', min: 25, max: 45, step: 0.1 },
  { name: 'oxygenSaturation', label: 'Sat. O₂', unidad: '%', min: 30, max: 100 },
  { name: 'weightKg', label: 'Peso', unidad: 'kg', min: 0.3, max: 500, step: 0.1 },
  { name: 'heightCm', label: 'Talla', unidad: 'cm', min: 20, max: 260, step: 0.1 },
  { name: 'glucoseMgdl', label: 'Glucosa', unidad: 'mg/dL', min: 10, max: 1200, step: 0.1 },
] as const;

/**
 * Formulario de consulta.
 *
 * El subjetivo abre con el foco puesto y ocupa el espacio que ocuparía a mano:
 * es lo que el médico escribe mientras el paciente habla. Los signos vitales
 * van en una rejilla compacta de campos numéricos para poder tabular entre
 * ellos sin levantar la vista.
 */
export function FormularioConsulta({
  slug,
  patientId,
  puedeFirmar,
}: {
  slug: string;
  patientId: string;
  puedeFirmar: boolean;
}) {
  const [estado, accion, enviando] = useActionState(guardarConsulta, ESTADO_INICIAL);
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="patientId" value={patientId} />

      <div className="space-y-1.5">
        <label htmlFor="kind" className="block text-sm font-medium text-(--color-tinta)">
          Tipo de atención
        </label>
        <select
          id="kind"
          name="kind"
          defaultValue="consulta"
          className="h-10 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
        >
          {ENCOUNTER_KINDS.map((k) => (
            <option key={k} value={k}>
              {ETIQUETAS_ATENCION[k]}
            </option>
          ))}
        </select>
      </div>

      <section className="space-y-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <Bloque
          name="subjective"
          label="Subjetivo"
          ayuda="Motivo de consulta y lo que refiere el paciente."
          filas={5}
          required
          autoFocus
          error={errorDe('subjective')}
        />
        <Bloque
          name="objective"
          label="Objetivo"
          ayuda="Hallazgos de la exploración física."
          filas={4}
        />
        <Bloque
          name="assessment"
          label="Análisis"
          ayuda="Interpretación y diagnóstico diferencial."
          filas={3}
        />
        <Bloque
          name="plan"
          label="Plan"
          ayuda="Tratamiento, exámenes solicitados y seguimiento."
          filas={3}
        />

        <p className="border-t border-(--color-borde) pt-3 text-xs text-(--color-tinta-3)">
          Los cuatro apartados se guardan cifrados. Ni el servidor de base de datos puede
          leerlos.
        </p>
      </section>

      <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">Signos vitales</h2>
        <p className="mt-1 text-xs text-(--color-tinta-3)">
          Opcionales. Deje en blanco lo que no haya medido.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {VITALES.map((v) => (
            <div key={v.name} className="space-y-1">
              <label
                htmlFor={v.name}
                className="block text-xs font-medium text-(--color-tinta-2)"
              >
                {v.label}
                <span className="ml-1 font-normal text-(--color-tinta-3)">{v.unidad}</span>
              </label>
              <input
                id={v.name}
                name={v.name}
                type="number"
                inputMode="decimal"
                min={v.min}
                max={v.max}
                step={'step' in v ? v.step : 1}
                aria-invalid={errorDe(v.name) ? true : undefined}
                className={cn(
                  'cifras h-10 w-full rounded-(--radius-md) border bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)',
                  errorDe(v.name) ? 'border-(--color-riesgo)' : 'border-(--color-borde-fuerte)'
                )}
              />
            </div>
          ))}
        </div>

        {(errorDe('systolicBp') || errorDe('diastolicBp')) && (
          <p role="alert" className="mt-3 text-xs text-(--color-riesgo)">
            {errorDe('systolicBp') ?? errorDe('diastolicBp')}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <div>
          <h2 className="text-sm font-medium text-(--color-tinta)">Diagnósticos</h2>
          <p className="mt-1 text-xs text-(--color-tinta-3)">
            Busque por el término que usaría hablando con el paciente. Marcar una condición
            como crónica la hace aparecer en la banda de alertas de todas las visitas.
          </p>
        </div>

        <SelectorDiagnostico name="diagnosticos" />

        {errorDe('diagnosticos') && (
          <p role="alert" className="text-xs text-(--color-riesgo)">
            {errorDe('diagnosticos')}
          </p>
        )}
      </section>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        {puedeFirmar ? (
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              name="firmar"
              defaultChecked
              className="mt-0.5 size-4 shrink-0 accent-(--color-acento)"
            />
            <span className="text-(--color-tinta-2)">
              Firmar al guardar
              <span className="mt-0.5 block text-xs text-(--color-tinta-3)">
                Una nota firmada es un documento médico-legal: ya no se puede editar, sólo
                enmendar con una nota nueva.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-(--color-tinta-3)">
            Se guardará como borrador. La firma corresponde al personal médico.
          </p>
        )}

        <Button type="submit" size="lg" cargando={enviando}>
          {enviando ? 'Guardando…' : 'Guardar consulta'}
        </Button>
      </div>

      {errorDe('firmar') && (
        <p role="alert" className="text-sm text-(--color-riesgo)">
          {errorDe('firmar')}
        </p>
      )}
    </form>
  );
}

function Bloque({
  name,
  label,
  ayuda,
  filas,
  required,
  autoFocus,
  error,
}: {
  name: string;
  label: string;
  ayuda: string;
  filas: number;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-(--color-tinta)">
        {label}
        {required && (
          <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <textarea
        id={name}
        name={name}
        rows={filas}
        required={required}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${name}-ayuda`}
        className={cn(
          'w-full resize-y rounded-(--radius-md) border bg-(--color-superficie) px-3 py-2 text-sm leading-relaxed text-(--color-tinta) outline-none focus:border-(--color-acento)',
          error ? 'border-(--color-riesgo)' : 'border-(--color-borde-fuerte)'
        )}
      />
      <p id={`${name}-ayuda`} className="text-xs text-(--color-tinta-3)">
        {error ? <span className="text-(--color-riesgo)">{error}</span> : ayuda}
      </p>
    </div>
  );
}
