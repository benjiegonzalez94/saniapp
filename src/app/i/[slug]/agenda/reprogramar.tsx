'use client';

import { useEffect, useState, useTransition } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { hoyEnZona } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { moverCita } from './actions';

type Hueco = { starts_at: string; ends_at: string; location_id: string | null };

/**
 * Reprogramar una cita.
 *
 * Se ofrecen los huecos reales del médico, calculados por la base, en vez de un
 * campo de fecha y hora libres: mover una cita a las 10:15 cuando los turnos son
 * de media hora produce una agenda que ya no cuadra, y el error sólo se
 * descubre el día de la consulta.
 *
 * El hueco elegido puede ocuparse entre que se pinta y se pulsa. No se intenta
 * evitarlo con comprobaciones previas —dejarían una ventana igual—: la
 * restricción de exclusión de la base lo rechaza y aquí se traduce el error.
 */
export function ReprogramarCita({
  slug,
  tenantId,
  citaId,
  proveedorId,
  zona,
  fechaActual,
  onListo,
}: {
  slug: string;
  tenantId: string;
  citaId: string;
  proveedorId: string;
  zona: string;
  fechaActual: string;
  onListo?: () => void;
}) {
  const [fecha, setFecha] = useState(fechaActual);
  const [elegido, setElegido] = useState<Hueco | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, iniciar] = useTransition();

  // Mismo patrón que el resto del proyecto: el resultado asíncrono se guarda
  // junto a la clave que lo produjo y lo que se pinta se deriva. Limpiar estado
  // dentro del efecto provoca renders en cascada y una ventana en la que se ven
  // los huecos del día anterior como si fueran los del nuevo.
  const clave = `${proveedorId}|${fecha}`;
  const [datos, setDatos] = useState<{ clave: string; filas: Hueco[] }>({
    clave: '',
    filas: [],
  });

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('available_slots', {
        p_tenant_id: tenantId,
        p_provider_id: proveedorId,
        p_from: fecha,
        p_to: fecha,
      });
      if (vigente) setDatos({ clave, filas: (data ?? []) as Hueco[] });
    })();

    return () => {
      vigente = false;
    };
  }, [clave, tenantId, proveedorId, fecha]);

  const cargando = datos.clave !== clave;
  const huecos = datos.clave === clave ? datos.filas : [];
  const huecoValido =
    elegido && huecos.some((h) => h.starts_at === elegido.starts_at) ? elegido : null;

  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });

  return (
    <div className="mt-3 w-full space-y-3 rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2) p-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-(--color-tinta-3)" aria-hidden="true" />
        <label htmlFor={`fecha-${citaId}`} className="text-xs text-(--color-tinta-2)">
          Mover al día
        </label>
        <input
          id={`fecha-${citaId}`}
          type="date"
          value={fecha}
          // No `toISOString()`: da la fecha en UTC y a partir de las 19:00 de
          // Manta bloquearía el resto del día de hoy.
          min={hoyEnZona(zona)}
          onChange={(e) => setFecha(e.target.value)}
          className="h-8 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
        />
      </div>

      {cargando ? (
        <p className="flex items-center gap-2 text-xs text-(--color-tinta-3)">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Buscando huecos…
        </p>
      ) : huecos.length === 0 ? (
        <p className="text-xs text-(--color-tinta-2)">
          Sin huecos libres ese día. Pruebe otra fecha.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {huecos.map((h) => (
            <button
              key={h.starts_at}
              type="button"
              onClick={() => setElegido(h)}
              aria-pressed={huecoValido?.starts_at === h.starts_at}
              className={cn(
                'cifras h-8 rounded-(--radius-sm) border px-2.5 text-xs transition-colors',
                huecoValido?.starts_at === h.starts_at
                  ? 'border-(--color-acento) bg-(--color-acento) text-white'
                  : 'border-(--color-borde-fuerte) bg-(--color-superficie) text-(--color-tinta) hover:bg-(--color-superficie-2)'
              )}
            >
              {hora.format(new Date(h.starts_at))}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-(--color-riesgo)">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!huecoValido}
          cargando={moviendo}
          onClick={() => {
            if (!huecoValido) return;
            setError(null);
            iniciar(async () => {
              const r = await moverCita(
                slug,
                citaId,
                huecoValido.starts_at,
                huecoValido.ends_at
              );
              if (!r.ok) setError(r.error);
              else onListo?.();
            });
          }}
        >
          Mover cita
        </Button>
        <Button type="button" size="sm" variant="fantasma" onClick={() => onListo?.()}>
          Cancelar
        </Button>
      </div>

      <p className="text-xs text-(--color-tinta-3)">
        Los recordatorios se replanifican solos: los del horario viejo se cancelan.
      </p>
    </div>
  );
}
