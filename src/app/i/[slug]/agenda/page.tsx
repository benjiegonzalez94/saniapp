import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Settings2 } from 'lucide-react';

import { can, requirePermissionBySlug } from '@/lib/auth/context';
import {
  huecosDisponibles,
  listarBloqueos,
  listarCitas,
  listarProveedores,
} from '@/lib/db/scheduling';
import { cn } from '@/lib/utils';
import { AccionesCita } from './acciones';

export const metadata: Metadata = { title: 'Agenda' };
export const dynamic = 'force-dynamic';

/**
 * Agenda del día.
 *
 * La vista por defecto es HOY y en lista, no una cuadrícula semanal. Un médico
 * general con veinte minutos por paciente no navega un calendario: quiere saber
 * quién sigue. La semana se consulta de vez en cuando; el día, todo el rato.
 *
 * Toda hora se convierte a la zona de la institución para pintarla. La base
 * guarda timestamptz en UTC.
 */

/** Devuelve el rango [inicio, fin) del día indicado, en la zona de la institución. */
function rangoDelDia(fechaISO: string, zona: string): { desde: Date; hasta: Date } {
  // Se construye el instante correspondiente a la medianoche local usando el
  // desfase real de esa fecha, para que un cambio de horario de verano no
  // desplace la agenda una hora.
  const medianocheUTC = new Date(`${fechaISO}T00:00:00Z`);
  const enZona = new Date(medianocheUTC.toLocaleString('en-US', { timeZone: zona }));
  const desfase = medianocheUTC.getTime() - enZona.getTime();

  const desde = new Date(medianocheUTC.getTime() + desfase);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  return { desde, hasta };
}

function desplazarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const ESTILO_ESTADO: Record<string, string> = {
  solicitada: 'bg-(--color-aviso-suave) text-(--color-tinta)',
  confirmada: 'bg-(--color-acento-suave) text-(--color-acento-fuerte)',
  en_sala: 'bg-(--color-exito-suave) text-(--color-exito)',
  atendida: 'bg-(--color-superficie-2) text-(--color-tinta-3)',
  cancelada: 'bg-(--color-superficie-2) text-(--color-tinta-3) line-through',
  no_asistio: 'bg-(--color-riesgo-suave) text-(--color-riesgo)',
  reprogramada: 'bg-(--color-superficie-2) text-(--color-tinta-3)',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  solicitada: 'Por confirmar',
  confirmada: 'Confirmada',
  en_sala: 'En sala',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
  reprogramada: 'Reprogramada',
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  telefono: 'Teléfono',
  presencial: 'Presencial',
  portal_paciente: 'Portal',
};

export default async function PaginaAgenda({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fecha?: string; medico?: string }>;
}) {
  const { slug } = await params;
  const { fecha, medico } = await searchParams;

  const tenant = await requirePermissionBySlug(slug, 'appointments.read');
  const zona = tenant.timezone;

  // "Hoy" es hoy en la zona de la institución, no en la del servidor.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: zona });
  const dia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy;

  const proveedores = await listarProveedores(tenant.tenantId);
  const medicoActivo = medico ?? (proveedores.length === 1 ? proveedores[0].id : null);

  const { desde, hasta } = rangoDelDia(dia, zona);

  const [citas, bloqueos, huecos] = await Promise.all([
    listarCitas(tenant.tenantId, desde, hasta, medicoActivo),
    listarBloqueos(tenant.tenantId, desde, hasta),
    medicoActivo
      ? huecosDisponibles(tenant.tenantId, medicoActivo, dia, dia)
      : Promise.resolve([]),
  ]);

  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });
  const fechaLarga = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: zona,
  });

  const activas = citas.filter((c) => !['cancelada', 'reprogramada'].includes(c.status));
  const puedeAgendar = can(tenant, 'appointments.write');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">Agenda</h1>
          <p className="mt-0.5 text-sm text-(--color-tinta-2) first-letter:uppercase">
            {fechaLarga.format(desde)}
            {dia === hoy && <span className="ml-2 text-(--color-acento)">· hoy</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can(tenant, 'schedule.manage') && (
            <Link
              href={`/i/${slug}/agenda/horarios`}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
            >
              <Settings2 className="size-4" aria-hidden="true" />
              Horarios
            </Link>
          )}
          {puedeAgendar && (
            <Link
              href={`/i/${slug}/agenda/nueva?fecha=${dia}${medicoActivo ? `&medico=${medicoActivo}` : ''}`}
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              Agendar
            </Link>
          )}
        </div>
      </div>

      {/* Navegación de fecha y filtro por médico */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie)">
          <Link
            href={`?fecha=${desplazarDias(dia, -1)}${medico ? `&medico=${medico}` : ''}`}
            aria-label="Día anterior"
            className="grid size-9 place-items-center text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`?fecha=${hoy}${medico ? `&medico=${medico}` : ''}`}
            className="border-x border-(--color-borde) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            Hoy
          </Link>
          <Link
            href={`?fecha=${desplazarDias(dia, 1)}${medico ? `&medico=${medico}` : ''}`}
            aria-label="Día siguiente"
            className="grid size-9 place-items-center text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="fecha" value={dia} />
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
                {p.specialty ? ` · ${p.specialty}` : ''}
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

      {bloqueos.length > 0 && (
        <ul className="space-y-1.5">
          {bloqueos.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--color-aviso) bg-(--color-aviso-suave) px-3 py-2 text-sm"
            >
              <Clock className="size-4 text-(--color-aviso)" aria-hidden="true" />
              <span className="font-medium text-(--color-tinta)">
                {b.reason ?? 'Agenda bloqueada'}
              </span>
              <span className="cifras text-(--color-tinta-2)">
                {hora.format(new Date(b.startsAt))}–{hora.format(new Date(b.endsAt))}
              </span>
              <span className="text-(--color-tinta-3)">
                {b.providerName ?? 'Toda la institución'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Lista del día */}
      {activas.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-12 text-center">
          <p className="font-medium text-(--color-tinta)">Sin citas este día</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            {medicoActivo && huecos.length > 0
              ? `Hay ${huecos.length} ${huecos.length === 1 ? 'hueco libre' : 'huecos libres'}.`
              : medicoActivo
                ? 'No hay horario de atención definido para este día.'
                : 'Elija un profesional para ver sus huecos disponibles.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          {activas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-4 px-4 py-3 sm:px-5">
              <span className="cifras w-14 shrink-0 pt-0.5 text-sm font-medium text-(--color-tinta)">
                {hora.format(new Date(c.startsAt))}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-(--color-tinta)">
                  <Link
                    href={`/i/${slug}/pacientes/${c.patient.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {c.patient.familyName}, {c.patient.givenName}
                  </Link>
                </p>
                <p className="mt-0.5 text-sm text-(--color-tinta-2)">
                  {c.reason ?? 'Sin motivo indicado'}
                </p>
                <p className="mt-0.5 text-xs text-(--color-tinta-3)">
                  {[
                    !medicoActivo ? c.provider.fullName : null,
                    c.locationName,
                    ETIQUETA_ORIGEN[c.source],
                    c.patient.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
                    ESTILO_ESTADO[c.status]
                  )}
                >
                  {ETIQUETA_ESTADO[c.status]}
                </span>

                {puedeAgendar && (
                  <AccionesCita
                    slug={slug}
                    citaId={c.id}
                    estado={c.status}
                    pacienteId={c.patient.id}
                    puedeAtender={can(tenant, 'clinical.write')}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {medicoActivo && huecos.length > 0 && activas.length > 0 && (
        <p className="text-xs text-(--color-tinta-3)">
          {huecos.length} {huecos.length === 1 ? 'hueco libre' : 'huecos libres'} este día:{' '}
          <span className="cifras">
            {huecos.slice(0, 8).map((h) => hora.format(new Date(h.startsAt))).join(' · ')}
            {huecos.length > 8 && ` … +${huecos.length - 8}`}
          </span>
        </p>
      )}
    </div>
  );
}
