'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { DIAGNOSIS_KINDS, type DiagnosisKind } from '@/lib/db/types';

/**
 * Selector de diagnósticos CIE-10.
 *
 * Busca contra public.buscar_icd10 desde el navegador, sin pasar por el
 * servidor de Next: son consultas de una tabla de referencia sin datos de
 * paciente, y el viaje extra por cada tecla se notaría en el mostrador.
 *
 * El catálogo entiende sinónimos coloquiales —"garganta" encuentra faringitis,
 * "zancudo" encuentra dengue—, porque en consulta se teclea la palabra que se
 * acaba de usar hablando con el paciente, no la rúbrica oficial.
 *
 * Se pueden añadir varios diagnósticos: una consulta de medicina general
 * raramente cierra con uno solo.
 */

export type DiagnosticoElegido = {
  code: string;
  display: string;
  kind: DiagnosisKind;
  isChronic: boolean;
};

type Sugerencia = {
  code: string;
  display: string;
  chapter: string;
  is_common: boolean;
};

const ETIQUETAS: Record<DiagnosisKind, string> = {
  presuntivo: 'Presuntivo',
  definitivo: 'Definitivo',
  descartado: 'Descartado',
};

export function SelectorDiagnostico({ name }: { name: string }) {
  const [elegidos, setElegidos] = useState<DiagnosticoElegido[]>([]);
  const [termino, setTermino] = useState('');
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [buscando, setBuscando] = useState(false);

  const listaId = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  // 180 ms: por debajo se dispara una consulta por pulsación; por encima se
  // nota el retardo al escribir.
  useEffect(() => {
    if (!abierto) return;

    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('buscar_icd10', {
          p_termino: termino,
          p_limite: 12,
        });
        if (!error) {
          setSugerencias((data ?? []) as Sugerencia[]);
          setResaltado(0);
        }
      } finally {
        setBuscando(false);
      }
    }, 180);

    return () => clearTimeout(temporizador);
  }, [termino, abierto]);

  // Cerrar al pulsar fuera: sin esto la lista se queda abierta tapando el
  // formulario cuando el foco se va a otro campo.
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function agregar(s: Sugerencia) {
    if (elegidos.some((d) => d.code === s.code)) return;
    setElegidos((prev) => [
      ...prev,
      { code: s.code, display: s.display, kind: 'presuntivo', isChronic: false },
    ]);
    setTermino('');
    setAbierto(false);
  }

  function quitar(code: string) {
    setElegidos((prev) => prev.filter((d) => d.code !== code));
  }

  function cambiar(code: string, cambios: Partial<DiagnosticoElegido>) {
    setElegidos((prev) => prev.map((d) => (d.code === code ? { ...d, ...cambios } : d)));
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
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
      // Sin esto, Enter envía el formulario entero a mitad de la búsqueda.
      e.preventDefault();
      const elegido = sugerencias[resaltado];
      if (elegido) agregar(elegido);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Los diagnósticos viajan como JSON en un solo campo: la acción del
          servidor los valida en bloque y así no hay índices que mantener. */}
      <input type="hidden" name={name} value={JSON.stringify(elegidos)} />

      {elegidos.length > 0 && (
        <ul className="space-y-2">
          {elegidos.map((d) => (
            <li
              key={d.code}
              className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2) px-3 py-2"
            >
              <span className="cifras shrink-0 text-xs font-medium text-(--color-acento-fuerte)">
                {d.code}
              </span>
              <span className="min-w-0 flex-1 text-sm text-(--color-tinta)">{d.display}</span>

              <select
                value={d.kind}
                onChange={(e) => cambiar(d.code, { kind: e.target.value as DiagnosisKind })}
                aria-label={`Certeza de ${d.display}`}
                className="h-8 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2 text-xs text-(--color-tinta) outline-none focus:border-(--color-acento)"
              >
                {DIAGNOSIS_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ETIQUETAS[k]}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-(--color-tinta-2)">
                <input
                  type="checkbox"
                  checked={d.isChronic}
                  onChange={(e) => cambiar(d.code, { isChronic: e.target.checked })}
                  className="size-3.5 accent-(--color-acento)"
                />
                Crónica
              </label>

              <button
                type="button"
                onClick={() => quitar(d.code)}
                aria-label={`Quitar ${d.display}`}
                className="rounded-(--radius-sm) p-1 text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie) hover:text-(--color-riesgo)"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

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
            aria-label="Buscar diagnóstico"
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={teclas}
            placeholder="Buscar diagnóstico… (p. ej. garganta, presión alta, dengue)"
            className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) pr-4 pl-10 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />
        </div>

        {abierto && (
          <ul
            id={listaId}
            role="listbox"
            aria-label="Diagnósticos sugeridos"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) py-1 shadow-(--shadow-flotante)"
          >
            {sugerencias.length === 0 && !buscando && (
              <li className="px-3 py-2.5 text-sm text-(--color-tinta-3)">
                {termino
                  ? 'Sin coincidencias. Puede describirlo en el análisis.'
                  : 'Escriba para buscar.'}
              </li>
            )}

            {sugerencias.map((s, i) => {
              const ya = elegidos.some((d) => d.code === s.code);
              return (
                <li key={s.code} role="option" aria-selected={i === resaltado}>
                  <button
                    type="button"
                    disabled={ya}
                    onMouseEnter={() => setResaltado(i)}
                    onClick={() => agregar(s)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      i === resaltado && !ya && 'bg-(--color-acento-suave)',
                      ya && 'opacity-50'
                    )}
                  >
                    <span className="cifras w-14 shrink-0 text-xs text-(--color-acento-fuerte)">
                      {s.code}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-(--color-tinta)">
                      {s.display}
                    </span>
                    {ya ? (
                      <Check className="size-4 shrink-0 text-(--color-exito)" aria-hidden="true" />
                    ) : (
                      <Plus
                        className="size-4 shrink-0 text-(--color-tinta-3)"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
