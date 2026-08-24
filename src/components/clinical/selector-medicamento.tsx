'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Pill, Plus, Search, TriangleAlert, X } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ALLERGY_SEVERITY_LABELS, type AllergySeverity } from '@/lib/db/types';

/**
 * Selector de medicamentos con cruce de alergias en vivo.
 *
 * La comprobación se dispara al AÑADIR cada fármaco, no al guardar la receta.
 * Avisar al final, cuando el médico ya cerró la consulta y tiene al paciente
 * levantándose de la silla, llega tarde: o ignora el aviso por inercia o pierde
 * el trabajo hecho. Avisando en el momento, cambiar de fármaco cuesta un clic.
 */

export type RenglonReceta = {
  medicationCode: string | null;
  medication: string;
  presentation: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type Sugerencia = {
  code: string;
  generic_name: string;
  brand_names: string;
  presentations: string[];
  usual_dose: string | null;
  usual_frequency: string | null;
  category: string;
};

type Aviso = {
  medication_code: string;
  medication_name: string;
  allergy_substance: string;
  allergy_severity: AllergySeverity;
  allergy_reaction: string | null;
  match_kind: string;
};

export function SelectorMedicamento({
  name,
  patientId,
  avisosAsumidosName,
}: {
  name: string;
  patientId: string;
  avisosAsumidosName: string;
}) {
  const [renglones, setRenglones] = useState<RenglonReceta[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [asumidos, setAsumidos] = useState<string[]>([]);

  const [termino, setTermino] = useState('');
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const listaId = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('buscar_medicamento', {
        p_termino: termino,
        p_limite: 12,
      });
      if (!error) {
        setSugerencias((data ?? []) as Sugerencia[]);
        setResaltado(0);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [termino, abierto]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  /** Recalcula los avisos con la lista completa de códigos prescritos. */
  async function revisarAlergias(lista: RenglonReceta[]) {
    const codigos = lista
      .map((r) => r.medicationCode)
      .filter((c): c is string => Boolean(c));

    if (codigos.length === 0) {
      setAvisos([]);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc('verificar_alergias', {
      p_patient_id: patientId,
      p_medication_codes: codigos,
    });
    if (!error) setAvisos((data ?? []) as Aviso[]);
  }

  async function agregar(s: Sugerencia) {
    const nuevo: RenglonReceta = {
      medicationCode: s.code,
      medication: s.generic_name,
      presentation: s.presentations[0] ?? '',
      dose: s.usual_dose ?? '',
      frequency: s.usual_frequency ?? '',
      duration: '',
      instructions: '',
    };
    const lista = [...renglones, nuevo];
    setRenglones(lista);
    setTermino('');
    setAbierto(false);
    await revisarAlergias(lista);
  }

  function agregarLibre() {
    if (!termino.trim()) return;
    // Fármaco fuera del catálogo: se admite, pero sin código no hay cruce de
    // alergias posible y la interfaz lo dice sin ambigüedad.
    setRenglones((prev) => [
      ...prev,
      {
        medicationCode: null,
        medication: termino.trim(),
        presentation: '',
        dose: '',
        frequency: '',
        duration: '',
        instructions: '',
      },
    ]);
    setTermino('');
    setAbierto(false);
  }

  async function quitar(indice: number) {
    const lista = renglones.filter((_, i) => i !== indice);
    setRenglones(lista);
    await revisarAlergias(lista);
  }

  function editar(indice: number, cambios: Partial<RenglonReceta>) {
    setRenglones((prev) => prev.map((r, i) => (i === indice ? { ...r, ...cambios } : r)));
  }

  const infranqueable = avisos.some(
    (a) => a.match_kind === 'directa' && a.allergy_severity === 'mortal'
  );

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(renglones)} />
      <input type="hidden" name={avisosAsumidosName} value={JSON.stringify(asumidos)} />

      {/* Avisos de alergia: arriba de todo y sin plegar. */}
      {avisos.length > 0 && (
        <ul
          aria-label="Avisos de alergia"
          className={cn(
            'space-y-2 rounded-(--radius-lg) border p-4',
            infranqueable
              ? 'border-(--color-riesgo) bg-(--color-riesgo-suave)'
              : 'border-(--color-aviso) bg-(--color-aviso-suave)'
          )}
        >
          {avisos.map((a) => {
            const clave = `${a.medication_code}:${a.allergy_substance}`;
            const mortal = a.match_kind === 'directa' && a.allergy_severity === 'mortal';
            const asumido = asumidos.includes(clave);

            return (
              <li key={clave} className="flex flex-wrap items-start gap-2 text-sm">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-(--color-riesgo)"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-(--color-tinta)">
                    <strong className="font-semibold">{a.medication_name}</strong>{' '}
                    {a.match_kind === 'directa' ? (
                      <>
                        es exactamente la sustancia a la que el paciente es alérgico
                        {' '}(<strong>{a.allergy_substance}</strong>,{' '}
                        {ALLERGY_SEVERITY_LABELS[a.allergy_severity].toLowerCase()})
                      </>
                    ) : (
                      <>
                        pertenece a la misma familia que{' '}
                        <strong>{a.allergy_substance}</strong>, alergia registrada como{' '}
                        {ALLERGY_SEVERITY_LABELS[a.allergy_severity].toLowerCase()}. Puede
                        haber reactividad cruzada.
                      </>
                    )}
                  </p>
                  {a.allergy_reaction && (
                    <p className="mt-0.5 text-xs text-(--color-tinta-2)">
                      Reacción registrada: {a.allergy_reaction}
                    </p>
                  )}

                  {mortal ? (
                    <p className="mt-1 text-xs font-medium text-(--color-riesgo)">
                      Alergia de riesgo vital al mismo fármaco: no se puede emitir. Retire el
                      medicamento de la receta.
                    </p>
                  ) : (
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-(--color-tinta-2)">
                      <input
                        type="checkbox"
                        checked={asumido}
                        onChange={(e) =>
                          setAsumidos((prev) =>
                            e.target.checked
                              ? [...prev, clave]
                              : prev.filter((c) => c !== clave)
                          )
                        }
                        className="size-3.5 accent-(--color-riesgo)"
                      />
                      Lo he valorado y asumo el riesgo
                      <span className="text-(--color-tinta-3)">
                        (queda registrado en la bitácora con su nombre)
                      </span>
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Renglones */}
      {renglones.length > 0 && (
        <ul className="space-y-3">
          {renglones.map((r, i) => (
            <li
              key={`${r.medicationCode ?? 'libre'}-${i}`}
              className="space-y-2 rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2) p-3"
            >
              <div className="flex items-start gap-2">
                <Pill
                  className="mt-1 size-4 shrink-0 text-(--color-acento)"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-(--color-tinta)">{r.medication}</p>
                  {!r.medicationCode && (
                    <p className="text-xs text-(--color-aviso)">
                      Fuera del catálogo: no se comprueba contra las alergias.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar ${r.medication}`}
                  className="rounded-(--radius-sm) p-1 text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie) hover:text-(--color-riesgo)"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <CampoRenglon
                  etiqueta="Presentación"
                  valor={r.presentation}
                  onChange={(v) => editar(i, { presentation: v })}
                  placeholder="500 mg tableta"
                />
                <CampoRenglon
                  etiqueta="Dosis"
                  valor={r.dose}
                  onChange={(v) => editar(i, { dose: v })}
                  placeholder="1 tableta"
                  requerido
                />
                <CampoRenglon
                  etiqueta="Frecuencia"
                  valor={r.frequency}
                  onChange={(v) => editar(i, { frequency: v })}
                  placeholder="cada 8 horas"
                  requerido
                />
                <CampoRenglon
                  etiqueta="Duración"
                  valor={r.duration}
                  onChange={(v) => editar(i, { duration: v })}
                  placeholder="por 7 días"
                />
              </div>

              <CampoRenglon
                etiqueta="Indicaciones para el paciente"
                valor={r.instructions}
                onChange={(v) => editar(i, { instructions: v })}
                placeholder="Tomar con alimentos. Suspender si aparece erupción."
              />
            </li>
          ))}
        </ul>
      )}

      {/* Buscador */}
      <div ref={contenedor} className="relative">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-tinta-3)"
            aria-hidden="true"
          />
          <input
            type="text"
            role="combobox"
            aria-expanded={abierto}
            aria-controls={listaId}
            aria-autocomplete="list"
            aria-label="Buscar medicamento"
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={(e) => {
              if (!abierto) {
                if (e.key === 'ArrowDown') setAbierto(true);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setResaltado((i) => Math.min(i + 1, sugerencias.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setResaltado((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const s = sugerencias[resaltado];
                if (s) void agregar(s);
                else agregarLibre();
              } else if (e.key === 'Escape') {
                setAbierto(false);
              }
            }}
            placeholder="Buscar medicamento… (genérico o marca)"
            className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) pr-4 pl-10 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />
        </div>

        {abierto && (
          <ul
            id={listaId}
            role="listbox"
            aria-label="Medicamentos sugeridos"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) py-1 shadow-(--shadow-flotante)"
          >
            {sugerencias.map((s, i) => {
              const ya = renglones.some((r) => r.medicationCode === s.code);
              return (
                <li key={s.code} role="option" aria-selected={i === resaltado}>
                  <button
                    type="button"
                    disabled={ya}
                    onMouseEnter={() => setResaltado(i)}
                    onClick={() => void agregar(s)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
                      i === resaltado && !ya && 'bg-(--color-acento-suave)',
                      ya && 'opacity-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-(--color-tinta)">
                        {s.generic_name}
                        {s.brand_names && (
                          <span className="ml-1.5 text-xs text-(--color-tinta-3)">
                            {s.brand_names}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-(--color-tinta-3)">
                        {[s.category, s.usual_dose, s.usual_frequency]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {ya ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-(--color-exito)" aria-hidden="true" />
                    ) : (
                      <Plus className="mt-0.5 size-4 shrink-0 text-(--color-tinta-3)" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}

            {termino.trim() && (
              <li className="border-t border-(--color-borde)">
                <button
                  type="button"
                  onClick={agregarLibre}
                  className="w-full px-3 py-2 text-left text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2)"
                >
                  Añadir <strong className="text-(--color-tinta)">{termino.trim()}</strong> tal
                  cual
                  <span className="mt-0.5 block text-xs text-(--color-aviso)">
                    Sin cruce de alergias: no está en el catálogo.
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function CampoRenglon({
  etiqueta,
  valor,
  onChange,
  placeholder,
  requerido,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  requerido?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-(--color-tinta-2)">
        {etiqueta}
        {requerido && (
          <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
      />
    </div>
  );
}
