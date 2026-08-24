import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';

import { can, requirePermissionBySlug } from '@/lib/auth/context';
import { listarCitas, listarProveedores } from '@/lib/db/scheduling';
import { cn } from '@/lib/utils';
import {
  desplazarDias,
  esFechaISO,
  hoyEnZona,
  inicioDelDia,
  lunesDeLaSemana,
} from '@/lib/fechas';
import { ESTADOS_INACTIVOS, ESTILO_ESTADO, ETIQUETA_ESTADO } from '../estados';
import { SelectorVista } from '../selector-vista';

export const metadata: Metadata = { title: 'Agenda · semana' };
export const dynamic = 'force-dynamic';

/**
 * Vista semanal.
 *
 * Complementa a la de día, que es la que se usa a diario. Esta responde otra
 * pregunta: «¿cómo viene la semana?», que es la que se hace quien reparte
 * huecos o quiere saber dónde cabe una urgencia.
 *
 * En pantalla estrecha las siete columnas NO caben, y apilarlas convertiría la
 * vista en la de día repetida siete veces —perdiendo justo lo que aporta, ver
 * la carga de un vistazo—. Se desplaza en horizontal DENTRO de su contenedor:
 * el `<body>` nunca hace scroll lateral.
 */
export default async function PaginaSemana({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; medico?: string }>;
}) {
  const { slug } = await params;
  const { desde: desdeParam, medico } = await searchParams;

  const tenant = await requirePermissionBySlug(slug, 'appointments.read');
  const zona = tenant.timezone;

  const hoy = hoyEnZona(zona);
  const lunes = lunesDeLaSemana(esFechaISO(desdeParam) ? desdeParam : hoy);

  const proveedores = await listarProveedores(tenant.tenantId);
  const medicoActivo = medico ?? (proveedores.length === 1 ? proveedores[0].id : null);

  // El fin es el comienzo del lunes siguiente, no `+7×24 h`: en un cambio de
  // horario la semana no dura exactamente 168 horas.
  const inicioSemana = inicioDelDia(lunes, zona);
  const finSemana = inicioDelDia(desplazarDias(lunes, 7), zona);

  const citas = await listarCitas(tenant.tenantId, inicioSemana, finSemana, medicoActivo);

  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });
  const diaCorto = new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    timeZone: zona,
  });
  const diaNumero = new Intl.DateTimeFormat('es-EC', { day: 'numeric', timeZone: zona });
  const rangoLargo = new Intl.DateTimeFormat('es-EC', {
    day: 'numeric',
    month: 'long',
    timeZone: zona,
  });

  const dias = Array.from({ length: 7 }, (_, i) => desplazarDias(lunes, i));

  // Se agrupa por el día LOCAL de la institución, no por el UTC del dato: una
  // cita de las 20:00 en Manta es del día siguiente en UTC y aparecería en la
  // columna equivocada.
  const porDia = new Map<string, typeof citas>();
  for (const c of citas) {
    if (ESTADOS_INACTIVOS.includes(c.status)) continue;
    const clave = new Date(c.startsAt).toLocaleDateString('en-CA', { timeZone: zona });
    porDia.set(clave, [...(porDia.get(clave) ?? []), c]);
  }

  const activas = citas.filter((c) => !ESTADOS_INACTIVOS.includes(c.status));
  const sinConfirmar = activas.filter((c) => c.status === 'solicitada').length;
  const sufijoMedico = medico ? `&medico=${medico}` : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">Agenda</h1>
          <p className="mt-0.5 text-sm text-(--color-tinta-2)">
            Semana del {rangoLargo.format(inicioSemana)} al{' '}
            {rangoLargo.format(inicioDelDia(desplazarDias(lunes, 6), zona))}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SelectorVista
            vista="semana"
            hrefDia={`/i/${slug}/agenda?fecha=${hoy >= lunes && hoy < desplazarDias(lunes, 7) ? hoy : lunes}${sufijoMedico}`}
            hrefSemana={`/i/${slug}/agenda/semana?desde=${lunes}${sufijoMedico}`}
          />
          {can(tenant, 'appointments.write') && (
            <Link
              href={`/i/${slug}/agenda/nueva?fecha=${lunes}${sufijoMedico}`}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              Agendar
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie)">
          <Link
            href={`?desde=${desplazarDias(lunes, -7)}${sufijoMedico}`}
            aria-label="Semana anterior"
            className="grid size-9 place-items-center text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`?desde=${lunesDeLaSemana(hoy)}${sufijoMedico}`}
            className="border-x border-(--color-borde) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            Esta semana
          </Link>
          <Link
            href={`?desde=${desplazarDias(lunes, 7)}${sufijoMedico}`}
            aria-label="Semana siguiente"
            className="grid size-9 place-items-center text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="desde" value={lunes} />
          <label htmlFor="medico" className="sr-only">
            Filtrar por profesional
          </label>
          <select
            id="medico"
            name="medico"
            defaultValue={medicoActivo ?? ''}
            className="h-9 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
          >
            <option value="">Todos los profesionales</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Contenedor propio con desplazamiento: el body no debe moverse. */}
      <div className="overflow-x-auto rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
        <div className="grid min-w-3xl grid-cols-7 divide-x divide-(--color-borde)">
          {dias.map((d) => {
            const delDia = porDia.get(d) ?? [];
            const esHoy = d === hoy;

            return (
              <section key={d} className="min-h-64">
                <Link
                  href={`/i/${slug}/agenda?fecha=${d}${sufijoMedico}`}
                  className={cn(
                    'block border-b border-(--color-borde) px-3 py-2 text-center transition-colors hover:bg-(--color-superficie-2)',
                    esHoy && 'bg-(--color-acento-suave)'
                  )}
                >
                  <span
                    className={cn(
                      'block text-xs capitalize',
                      esHoy ? 'text-(--color-acento-fuerte)' : 'text-(--color-tinta-3)'
                    )}
                  >
                    {diaCorto.format(inicioDelDia(d, zona)).replace('.', '')}
                  </span>
                  <span
                    className={cn(
                      'cifras block text-lg',
                      esHoy
                        ? 'font-semibold text-(--color-acento-fuerte)'
                        : 'text-(--color-tinta)'
                    )}
                  >
                    {diaNumero.format(inicioDelDia(d, zona))}
                  </span>
                </Link>

                {delDia.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-(--color-tinta-3)">—</p>
                ) : (
                  <ul className="space-y-1 p-2">
                    {delDia.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/i/${slug}/pacientes/${c.patient.id}`}
                          title={`${hora.format(new Date(c.startsAt))} · ${c.patient.familyName}, ${c.patient.givenName}${c.reason ? ` · ${c.reason}` : ''} · ${ETIQUETA_ESTADO[c.status]}`}
                          className={cn(
                            'block rounded-(--radius-sm) px-2 py-1.5 transition-opacity hover:opacity-80',
                            ESTILO_ESTADO[c.status]
                          )}
                        >
                          <span className="cifras block text-xs font-medium">
                            {hora.format(new Date(c.startsAt))}
                          </span>
                          <span className="block truncate text-xs">
                            {c.patient.familyName}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-(--color-tinta-3)">
        {activas.length} {activas.length === 1 ? 'cita' : 'citas'} esta semana
        {sinConfirmar > 0 && (
          <>
            {' · '}
            <span className="text-(--color-aviso)">
              {sinConfirmar} sin confirmar
            </span>
          </>
        )}
        . Toque un día para verlo en detalle.
      </p>
    </div>
  );
}
