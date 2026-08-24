'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cerrarRevision } from './acciones';

/**
 * Cierre de la revisión de un acceso de emergencia.
 *
 * Pide una nota antes de cerrar. Un circuito de revisión que se despacha con un
 * botón «visto» no es un circuito de revisión: es una casilla. La nota obliga a
 * escribir qué se comprobó, y queda en la propia bitácora junto a quién la
 * escribió — el RPC `revisar_break_glass` la registra como evento.
 */
export function CerrarRevision({ slug, grantId }: { slug: string; grantId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  if (!abierto) {
    return (
      <Button type="button" size="sm" variant="secundario" onClick={() => setAbierto(true)}>
        <Check className="size-3.5" aria-hidden="true" />
        Revisar
      </Button>
    );
  }

  return (
    <div className="mt-2 w-full space-y-2">
      <label htmlFor={`nota-${grantId}`} className="block text-xs text-(--color-tinta-2)">
        ¿Qué comprobó? Quedará registrado con su nombre.
      </label>
      <textarea
        id={`nota-${grantId}`}
        rows={2}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        autoFocus
        placeholder="Hablé con el Dr. Pérez: el paciente llegó inconsciente sin acompañante."
        className="w-full resize-y rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 py-2 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
      />

      {error && (
        <p role="alert" className="text-xs text-(--color-riesgo)">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          cargando={guardando}
          disabled={nota.trim().length < 5}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const r = await cerrarRevision(slug, grantId, nota);
              if (!r.ok) setError(r.error);
              else setAbierto(false);
            });
          }}
        >
          Cerrar revisión
        </Button>
        <Button
          type="button"
          size="sm"
          variant="fantasma"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
