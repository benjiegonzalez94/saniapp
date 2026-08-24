'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarClock, Check, LogIn, MoreHorizontal, Stethoscope, UserX, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/lib/db/types';
import { marcarEstado } from './actions';
import { ReprogramarCita } from './reprogramar';

/**
 * Acciones rápidas sobre una cita.
 *
 * Sólo se ofrecen las transiciones que tienen sentido desde el estado actual:
 * una cita ya atendida no se "confirma", y una cancelada no se marca como que
 * el paciente llegó. Mostrar botones que van a fallar entrena a la gente a
 * ignorar los errores.
 *
 * La acción principal de cada estado va como botón visible; el resto se pliega
 * en un menú, para que la fila de la agenda no se convierta en una botonera.
 */

type Transicion = {
  estado: AppointmentStatus;
  etiqueta: string;
  icono: typeof Check;
  destacada?: boolean;
  pideMotivo?: boolean;
};

const TRANSICIONES: Record<string, Transicion[]> = {
  solicitada: [
    { estado: 'confirmada', etiqueta: 'Confirmar', icono: Check, destacada: true },
    { estado: 'cancelada', etiqueta: 'Cancelar', icono: X, pideMotivo: true },
  ],
  confirmada: [
    { estado: 'en_sala', etiqueta: 'Llegó', icono: LogIn, destacada: true },
    { estado: 'no_asistio', etiqueta: 'No asistió', icono: UserX },
    { estado: 'cancelada', etiqueta: 'Cancelar', icono: X, pideMotivo: true },
  ],
  en_sala: [
    { estado: 'atendida', etiqueta: 'Marcar atendida', icono: Check },
    { estado: 'no_asistio', etiqueta: 'No asistió', icono: UserX },
  ],
  atendida: [],
  no_asistio: [{ estado: 'confirmada', etiqueta: 'Reactivar', icono: Check }],
};

export function AccionesCita({
  slug,
  tenantId,
  citaId,
  estado,
  pacienteId,
  proveedorId,
  zona,
  fecha,
  puedeAtender,
}: {
  slug: string;
  tenantId: string;
  citaId: string;
  estado: AppointmentStatus;
  pacienteId: string;
  proveedorId: string;
  zona: string;
  /** Día de la cita, para abrir el reprogramador en la fecha actual. */
  fecha: string;
  puedeAtender: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = TRANSICIONES[estado] ?? [];
  const principal = disponibles.find((t) => t.destacada);
  const secundarias = disponibles.filter((t) => !t.destacada);

  function aplicar(t: Transicion) {
    setError(null);
    setAbierto(false);

    let motivo: string | undefined;
    if (t.pideMotivo) {
      // Cancelar sin motivo deja la agenda llena de huecos inexplicables y
      // borra la diferencia entre quien avisó y quien no apareció.
      const respuesta = window.prompt('¿Por qué se cancela la cita?');
      if (!respuesta?.trim()) return;
      motivo = respuesta.trim();
    }

    iniciar(async () => {
      const r = await marcarEstado(slug, citaId, t.estado, motivo);
      if (!r.ok) setError(r.error);
    });
  }

  // Con el paciente ya en sala, lo siguiente es abrir la consulta.
  const mostrarAtender = puedeAtender && (estado === 'en_sala' || estado === 'confirmada');

  // Reprogramar sólo tiene sentido antes de que el paciente llegue.
  const puedeMover = estado === 'solicitada' || estado === 'confirmada';

  if (moviendo) {
    return (
      <ReprogramarCita
        slug={slug}
        tenantId={tenantId}
        citaId={citaId}
        proveedorId={proveedorId}
        zona={zona}
        fechaActual={fecha}
        onListo={() => setMoviendo(false)}
      />
    );
  }

  return (
    <div className="relative flex items-center gap-1.5">
      {error && (
        <span role="alert" className="text-xs text-(--color-riesgo)">
          {error}
        </span>
      )}

      {mostrarAtender && (
        <Link
          href={`/i/${slug}/pacientes/${pacienteId}/consulta`}
          title="Iniciar consulta"
          className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-sm) bg-(--color-acento) px-2.5 text-xs font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
        >
          <Stethoscope className="size-3.5" aria-hidden="true" />
          Atender
        </Link>
      )}

      {principal && (
        <button
          type="button"
          onClick={() => aplicar(principal)}
          disabled={pendiente}
          className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-xs font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2) disabled:opacity-50"
        >
          <principal.icono className="size-3.5" aria-hidden="true" />
          {principal.etiqueta}
        </button>
      )}

      {secundarias.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierto((x) => !x)}
            disabled={pendiente}
            aria-expanded={abierto}
            aria-label="Más acciones"
            className="grid size-8 place-items-center rounded-(--radius-sm) text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta) disabled:opacity-50"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>

          {abierto && (
            <>
              {/* Capa que cierra el menú al pulsar fuera, sin listeners globales. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setAbierto(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <ul className="absolute top-9 right-0 z-20 min-w-44 overflow-hidden rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) py-1 shadow-(--shadow-flotante)">
                {puedeMover && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setAbierto(false);
                        setMoviendo(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2)"
                    >
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      Reprogramar
                    </button>
                  </li>
                )}
                {secundarias.map((t) => (
                  <li key={t.estado}>
                    <button
                      type="button"
                      onClick={() => aplicar(t)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-(--color-superficie-2)',
                        t.estado === 'cancelada'
                          ? 'text-(--color-riesgo)'
                          : 'text-(--color-tinta-2)'
                      )}
                    >
                      <t.icono className="size-3.5" aria-hidden="true" />
                      {t.etiqueta}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
