import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Calendar, Clock, MapPin, Stethoscope, User } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { obtenerCita } from '@/lib/db/scheduling';
import { calcularEdad } from '@/lib/utils';
import { BotonImprimirCita } from './boton-imprimir';

export const metadata: Metadata = { title: 'Comprobante de Cita' };
export const dynamic = 'force-dynamic';

const ETIQUETAS_TIPO: Record<string, string> = {
  consulta: 'Consulta Médica',
  control: 'Control Médico',
  emergencia: 'Atención de Emergencia',
  teleconsulta: 'Teleconsulta',
  procedimiento: 'Procedimiento',
  domiciliaria: 'Atención Domiciliaria',
};

/**
 * Comprobante formal de cita médica.
 *
 * Diseñado específicamente para entregar impreso al paciente o guardarlo en PDF
 * y enviárselo por mensajería (WhatsApp / Correo).
 *
 * Utiliza la clase `no-imprimir` para retirar elementos de navegación durante
 * la impresión física, y prioriza la legibilidad tipográfica y claridad de los
 * datos clave: día, hora exacta, profesional y consultorio.
 */
export default async function PaginaComprobanteCita({
  params,
}: {
  params: Promise<{ slug: string; citaId: string }>;
}) {
  const { slug, citaId } = await params;
  const tenant = await requirePermissionBySlug(slug, 'appointments.read');

  const cita = await obtenerCita(tenant.tenantId, citaId);
  if (!cita) notFound();

  const zona = tenant.timezone;
  const fechaInicio = new Date(cita.startsAt);
  const fechaFin = new Date(cita.endsAt);

  const formatoFechaLarga = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: zona,
  });

  const formatoHora = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: zona,
  });

  const formatoEmision = new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: zona,
  });

  const edad = cita.patient.birthDate ? calcularEdad(cita.patient.birthDate) : null;
  const diaCitaTexto = formatoFechaLarga.format(fechaInicio);
  const horaInicioTexto = formatoHora.format(fechaInicio);
  const horaFinTexto = formatoHora.format(fechaFin);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Botones de acción en pantalla (ocultos al imprimir) */}
      <div className="no-imprimir flex items-center justify-between gap-3">
        <Link
          href={`/i/${slug}/agenda`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la agenda
        </Link>
        <BotonImprimirCita />
      </div>

      {/* Tarjeta / Hoja de Comprobante */}
      <article className="space-y-6 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 sm:p-8 shadow-(--shadow-tarjeta)">
        {/* Encabezado / Membrete */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-borde) pb-4">
          <div>
            <p className="text-xl font-bold tracking-tight text-(--color-tinta)">
              {tenant.tenantName}
            </p>
            <p className="mt-0.5 text-sm font-medium text-(--color-tinta-2)">
              Comprobante de Turno / Cita Médica
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full bg-(--color-acento-suave) px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-(--color-acento-fuerte)">
              {ETIQUETAS_TIPO[cita.kind] ?? 'Cita Médica'}
            </span>
            <p className="mt-1 text-xs text-(--color-tinta-3)">
              Emisión: {formatoEmision.format(new Date())}
            </p>
          </div>
        </header>

        {/* Bloque Destacado de Fecha y Hora */}
        <section className="rounded-(--radius-md) border border-(--color-acento-suave) bg-(--color-acento-suave)/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="size-5 text-(--color-acento-fuerte)" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-(--color-tinta-3)">
                  Fecha de la Cita
                </p>
                <p className="text-base font-semibold text-(--color-tinta) capitalize">
                  {diaCitaTexto}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-t border-(--color-acento-suave) pt-2 sm:border-t-0 sm:pt-0">
              <Clock className="size-5 text-(--color-acento-fuerte)" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-(--color-tinta-3)">
                  Horario de Atención
                </p>
                <p className="cifras text-base font-semibold text-(--color-tinta)">
                  {horaInicioTexto} – {horaFinTexto}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Datos del Paciente */}
        <section className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--color-tinta-3)">
            <User className="size-3.5" aria-hidden="true" />
            <span>Datos del Paciente</span>
          </div>
          <p className="text-lg font-medium text-(--color-tinta)">
            {cita.patient.givenName} {cita.patient.familyName}
          </p>
          <p className="text-sm text-(--color-tinta-2)">
            {[
              `HC: ${cita.patient.recordNumber}`,
              edad !== null ? `${edad} años` : null,
              cita.patient.nationalIdLast4 ? `Doc: ···${cita.patient.nationalIdLast4}` : null,
              cita.patient.phone ? `Telf: ${cita.patient.phone}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>

        {/* Profesional y Consultorio */}
        <section className="grid grid-cols-1 gap-4 border-t border-(--color-borde) pt-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--color-tinta-3)">
              <Stethoscope className="size-3.5" aria-hidden="true" />
              <span>Profesional Asignado</span>
            </div>
            <p className="mt-1 font-medium text-(--color-tinta)">
              {cita.provider.fullName}
            </p>
            <p className="text-sm text-(--color-tinta-2)">
              {[cita.provider.specialty, cita.provider.licenseNumber]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--color-tinta-3)">
              <MapPin className="size-3.5" aria-hidden="true" />
              <span>Lugar de Atención</span>
            </div>
            <p className="mt-1 font-medium text-(--color-tinta)">
              {cita.location?.name ?? 'Consultorio Principal'}
            </p>
            <p className="text-sm text-(--color-tinta-2)">
              {[cita.location?.addressLine, cita.location?.city]
                .filter(Boolean)
                .join(', ')}
            </p>
            {cita.location?.phone && (
              <p className="text-xs text-(--color-tinta-3)">
                Contacto: {cita.location.phone}
              </p>
            )}
          </div>
        </section>

        {/* Motivo de Consulta (si existe) */}
        {cita.reason && (
          <section className="border-t border-(--color-borde) pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--color-tinta-3)">
              Motivo Registrado
            </p>
            <p className="mt-1 text-sm text-(--color-tinta)">
              {cita.reason}
            </p>
          </section>
        )}

        {/* Instrucciones y Recomendaciones al Paciente */}
        <section className="rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie-2)/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-(--color-tinta-2)">
            Instrucciones para su cita
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-(--color-tinta-2)">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-(--color-acento)">•</span>
              <span>Por favor presentarse con <strong>10 a 15 minutos de anticipación</strong> a la hora fijada.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-(--color-acento)">•</span>
              <span>Llevar su <strong>documento de identidad original</strong> (cédula o pasaporte).</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-(--color-acento)">•</span>
              <span>Si dispone de exámenes de laboratorio, imágenes o recetas anteriores, tráigalos a la consulta.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-(--color-acento)">•</span>
              <span>En caso de requerir cancelación o cambio de turno, comuníquese con la institución con suficiente antelación.</span>
            </li>
          </ul>
        </section>

        {/* Pie de Página */}
        <footer className="border-t border-(--color-borde) pt-4 text-center text-xs text-(--color-tinta-3)">
          <p>
            {tenant.tenantName} · Sistema de Gestión Clínica SaniTi
          </p>
          <p className="mt-0.5">
            Documento informativo generado para el paciente. No sustituye una receta médica ni un informe pericial.
          </p>
        </footer>
      </article>
    </div>
  );
}
