'use client';

import { useActionState, useState, useTransition } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Bloqueo, HorarioAtencion, Proveedor } from '@/lib/db/scheduling';
import { bloquearAgenda, crearHorario, quitarHorario } from '../actions';

type Profesional = Proveedor & { horarios: HorarioAtencion[] };

const ESTADO_INICIAL = {};

/**
 * Gestión de horarios y bloqueos.
 *
 * Un horario se define por día de la semana y se repite; los bloqueos son
 * excepciones puntuales. Esa distinción es la del mundo real: "atiendo los
 * martes de 8 a 12" es la regla, "el martes que viene tengo capacitación" es la
 * excepción. Modelarlo al revés obliga a declarar cada día del año.
 */
export function PanelHorarios({
  slug,
  zona,
  profesionales,
  sedes,
  bloqueos,
  dias,
}: {
  slug: string;
  zona: string;
  profesionales: Profesional[];
  sedes: Array<{ id: string; name: string }>;
  bloqueos: Bloqueo[];
  dias: string[];
}) {
  const [estadoHorario, accionHorario, guardandoHorario] = useActionState(
    crearHorario,
    ESTADO_INICIAL as { error?: string }
  );
  const [estadoBloqueo, accionBloqueo, guardandoBloqueo] = useActionState(
    bloquearAgenda,
    ESTADO_INICIAL as { error?: string }
  );

  const [nuevoPara, setNuevoPara] = useState<string | null>(null);
  const [formBloqueo, setFormBloqueo] = useState(false);
  const [borrando, iniciarBorrado] = useTransition();

  const fechaHora = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });

  return (
    <div className="space-y-6">
      {/* Horarios por profesional */}
      <div className="space-y-4">
        {profesionales.map((p) => (
          <section
            key={p.id}
            className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-borde) px-5 py-3">
              <div>
                <h2 className="font-medium text-(--color-tinta)">{p.fullName}</h2>
                {p.specialty && (
                  <p className="text-xs text-(--color-tinta-3)">{p.specialty}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secundario"
                onClick={() => setNuevoPara(nuevoPara === p.id ? null : p.id)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Añadir franja
              </Button>
            </div>

            {p.horarios.length === 0 ? (
              <p className="px-5 py-4 text-sm text-(--color-tinta-3)">
                Sin horario definido. No aparecerán huecos para este profesional.
              </p>
            ) : (
              <ul className="divide-y divide-(--color-borde)">
                {p.horarios.map((h) => (
                  <li key={h.id} className="flex items-center gap-4 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-sm text-(--color-tinta)">
                      {dias[h.weekday]}
                    </span>
                    <span className="cifras flex-1 text-sm text-(--color-tinta-2)">
                      {h.startsAt.slice(0, 5)}–{h.endsAt.slice(0, 5)}
                      <span className="ml-2 text-xs text-(--color-tinta-3)">
                        turnos de {h.slotMinutes} min
                        {h.locationName ? ` · ${h.locationName}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={borrando}
                      onClick={() =>
                        iniciarBorrado(async () => {
                          await quitarHorario(slug, h.id);
                        })
                      }
                      aria-label={`Quitar la franja del ${dias[h.weekday]}`}
                      className="rounded-(--radius-sm) p-1.5 text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-riesgo) disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {nuevoPara === p.id && (
              <form
                action={accionHorario}
                className="space-y-3 border-t border-(--color-borde) bg-(--color-superficie-2) p-5"
              >
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="providerId" value={p.id} />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Campo etiqueta="Día">
                    <select name="weekday" defaultValue="1" className={CLASE_CONTROL}>
                      {dias.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Desde">
                    <input
                      name="startsAt"
                      type="time"
                      defaultValue="08:00"
                      required
                      className={CLASE_CONTROL}
                    />
                  </Campo>
                  <Campo etiqueta="Hasta">
                    <input
                      name="endsAt"
                      type="time"
                      defaultValue="12:00"
                      required
                      className={CLASE_CONTROL}
                    />
                  </Campo>
                  <Campo etiqueta="Turno (min)">
                    <input
                      name="slotMinutes"
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      defaultValue={30}
                      required
                      className={`cifras ${CLASE_CONTROL}`}
                    />
                  </Campo>
                </div>

                {sedes.length > 0 && (
                  <Campo etiqueta="Sede">
                    <select name="locationId" defaultValue="" className={CLASE_CONTROL}>
                      <option value="">Sin especificar</option>
                      {sedes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Campo>
                )}

                {estadoHorario.error && (
                  <p role="alert" className="text-sm text-(--color-riesgo)">
                    {estadoHorario.error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" size="sm" cargando={guardandoHorario}>
                    Guardar franja
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="fantasma"
                    onClick={() => setNuevoPara(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </section>
        ))}
      </div>

      {/* Bloqueos */}
      <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-borde) px-5 py-3">
          <div>
            <h2 className="font-medium text-(--color-tinta)">Bloqueos</h2>
            <p className="text-xs text-(--color-tinta-3)">
              Vacaciones, feriados o ausencias puntuales. Retiran los huecos de ese rango.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secundario"
            onClick={() => setFormBloqueo((x) => !x)}
          >
            <CalendarOff className="size-4" aria-hidden="true" />
            Bloquear
          </Button>
        </div>

        {bloqueos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-(--color-tinta-3)">Sin bloqueos próximos.</p>
        ) : (
          <ul className="divide-y divide-(--color-borde)">
            {bloqueos.map((b) => (
              <li key={b.id} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                <span className="cifras shrink-0 text-(--color-tinta-2)">
                  {fechaHora.format(new Date(b.startsAt))} → {fechaHora.format(new Date(b.endsAt))}
                </span>
                <span className="min-w-0 flex-1 truncate text-(--color-tinta)">
                  {b.reason ?? 'Sin motivo'}
                </span>
                <span className="shrink-0 text-xs text-(--color-tinta-3)">
                  {b.providerName ?? 'Toda la institución'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {formBloqueo && (
          <form
            action={accionBloqueo}
            className="space-y-3 border-t border-(--color-borde) bg-(--color-superficie-2) p-5"
          >
            <input type="hidden" name="slug" value={slug} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Desde">
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  className={CLASE_CONTROL}
                />
              </Campo>
              <Campo etiqueta="Hasta">
                <input name="endsAt" type="datetime-local" required className={CLASE_CONTROL} />
              </Campo>
            </div>

            <Campo etiqueta="Profesional">
              <select name="providerId" defaultValue="" className={CLASE_CONTROL}>
                <option value="">Toda la institución (feriado)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Motivo">
              <input
                name="reason"
                required
                placeholder="Capacitación, feriado, vacaciones…"
                className={CLASE_CONTROL}
              />
            </Campo>

            {estadoBloqueo.error && (
              <p role="alert" className="text-sm text-(--color-riesgo)">
                {estadoBloqueo.error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" size="sm" cargando={guardandoBloqueo}>
                Bloquear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="fantasma"
                onClick={() => setFormBloqueo(false)}
              >
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-(--color-tinta-3)">
              Las horas se interpretan en la zona horaria de la institución ({zona}).
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

const CLASE_CONTROL =
  'h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)';

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-(--color-tinta-2)">{etiqueta}</span>
      {children}
    </label>
  );
}
