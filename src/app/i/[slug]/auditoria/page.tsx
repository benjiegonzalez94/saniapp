import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { listarEventos, resumenBreakGlass } from '@/lib/db/audit-log';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AUDIT_ACTIONS, ROLE_LABELS, type AuditAction } from '@/lib/db/types';
import { cn } from '@/lib/utils';
// Traducir un día del calendario de la institución al instante que le
// corresponde es la parte delicada de cualquier filtro por fechas, y ya está
// resuelta —con su trampa del desfase del proceso documentada— en un módulo
// compartido. Duplicarla aquí sería duplicar también el próximo error que se le
// encuentre.
import { desplazarDias, esFechaISO, inicioDelDia } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Auditoría' };
export const dynamic = 'force-dynamic';

const ETIQUETA_ACCION: Record<AuditAction, string> = {
  read: 'Consulta',
  create: 'Alta',
  update: 'Modificación',
  delete: 'Eliminación',
  export: 'Exportación',
  print: 'Impresión',
  share: 'Compartió',
  unshare: 'Dejó de compartir',
  sign: 'Firma',
  login: 'Ingreso',
  logout: 'Salida',
  login_failed: 'Ingreso fallido',
  mfa_challenge: 'Reto MFA',
  mfa_failed: 'MFA fallido',
  permission_denied: 'Permiso denegado',
  break_glass: 'Acceso de emergencia',
  invite: 'Invitación',
  role_change: 'Cambio de rol',
  consent_grant: 'Consentimiento otorgado',
  consent_revoke: 'Consentimiento revocado',
  send_message: 'Mensaje enviado',
};

/**
 * Las cuatro acciones que un auditor busca a simple vista: sacar datos fuera
 * (`export`), destruirlos (`delete`), saltarse el círculo de cuidado
 * (`break_glass`) y los intentos que la base rechazó (`permission_denied`),
 * que es donde se ve a alguien probando puertas.
 */
const ACCIONES_SENSIBLES = new Set<AuditAction>([
  'break_glass',
  'permission_denied',
  'export',
  'delete',
]);

const TOPE_POR_DEFECTO = 100;
const TOPE_MAXIMO = 500;

export default async function PaginaAuditoria({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    accion?: string;
    q?: string;
    desde?: string;
    hasta?: string;
    limite?: string;
    paciente?: string;
    actor?: string;
  }>;
}) {
  const { slug } = await params;
  const {
    accion,
    q = '',
    desde = '',
    hasta = '',
    limite,
    paciente = '',
    actor = '',
  } = await searchParams;

  const tenant = await requirePermissionBySlug(slug, 'audit.read');
  const zona = tenant.timezone;

  // Una acción inventada en la URL se descarta en silencio: enviarla a la base
  // daría un «invalid input value for enum» que no dice nada a quien audita.
  const accionActiva =
    accion && (AUDIT_ACTIONS as readonly string[]).includes(accion)
      ? (accion as AuditAction)
      : null;

  const tope = Math.min(
    Math.max(Number.parseInt(limite ?? '', 10) || TOPE_POR_DEFECTO, 25),
    TOPE_MAXIMO
  );

  // Una fecha imposible (`2026-02-30`) no lanza al construirla: se convierte en
  // `Invalid Date` y revienta más tarde, en el `toISOString()` de la consulta,
  // con un 500 que no explica nada. Se descarta antes y el filtro se ignora.
  const desdeInstante = esFechaISO(desde) ? inicioDelDia(desde, zona) : null;
  // El rango de la consulta es semiabierto, pero «hasta el 24» debe incluir el
  // 24 entero: el corte es el comienzo del 25.
  const hastaInstante = esFechaISO(hasta)
    ? inicioDelDia(desplazarDias(hasta, 1), zona)
    : null;

  const [pendientes, eventos] = await Promise.all([
    resumenBreakGlass(tenant.tenantId),
    listarEventos(
      tenant.tenantId,
      {
        accion: accionActiva,
        texto: q,
        desde: desdeInstante,
        hasta: hastaInstante,
        pacienteId: paciente,
        actorId: actor,
      },
      tope
    ),
  ]);

  const fechaHora = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: zona,
  });
  const fechaCorta = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });

  // Se conserva el estado del filtro al pedir más filas y al drill-down por
  // actor o paciente, que no tienen control propio en el formulario.
  const filtros = new URLSearchParams();
  if (accionActiva) filtros.set('accion', accionActiva);
  if (q) filtros.set('q', q);
  if (desde) filtros.set('desde', desde);
  if (hasta) filtros.set('hasta', hasta);
  if (paciente) filtros.set('paciente', paciente);
  if (actor) filtros.set('actor', actor);

  const hayFiltro = [...filtros.keys()].length > 0;
  const masFiltros = new URLSearchParams(filtros);
  masFiltros.set('limite', String(Math.min(tope * 2, TOPE_MAXIMO)));

  const enlaceCon = (clave: 'paciente' | 'actor', valor: string) => {
    const p = new URLSearchParams(filtros);
    p.set(clave, valor);
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-(--color-tinta)">
          <ShieldCheck className="size-5 text-(--color-tinta-3)" aria-hidden="true" />
          Bitácora de auditoría
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-(--color-tinta-2)">
          Registro de quién accedió a qué y cuándo: es inmutable —ni siquiera la clave de
          servicio puede modificarlo o borrarlo— y cada evento va encadenado por hash al
          anterior, de modo que alterar uno solo rompe la cadena y queda a la vista.
        </p>
      </header>

      {/* Lo primero que un auditor debe ver: los accesos de emergencia que
          nadie ha mirado todavía. Un break-glass sin revisar deja de ser una
          excepción justificada y pasa a ser una puerta trasera. */}
      {pendientes.length > 0 && (
        <section
          aria-labelledby="titulo-break-glass"
          className="rounded-(--radius-lg) border border-(--color-riesgo) bg-(--color-riesgo-suave) p-4"
        >
          <h2
            id="titulo-break-glass"
            className="flex items-center gap-2 text-sm font-semibold text-(--color-riesgo)"
          >
            <ShieldAlert className="size-4" aria-hidden="true" />
            {pendientes.length === 1
              ? 'Un acceso de emergencia sin revisar'
              : `${pendientes.length} accesos de emergencia sin revisar`}
          </h2>
          <p className="mt-1 text-sm text-(--color-tinta-2)">
            Alguien abrió una historia clínica fuera de su círculo de cuidado. Cada concesión
            debe quedar revisada por un responsable.
          </p>

          <ul className="mt-3 space-y-2">
            {pendientes.map((c) => (
              <li
                key={c.id}
                className="rounded-(--radius-md) border border-(--color-borde) bg-(--color-superficie) px-3 py-2.5"
              >
                <p className="text-sm text-(--color-tinta)">
                  <span className="font-medium">{c.profileName}</span>
                  {' abrió el expediente de '}
                  <span className="font-medium">
                    {/* Sin nombre cuando quien audita no tiene `patients.read`
                        (el rol `auditor` sólo tiene `audit.read`): el número de
                        historia basta para correlacionar y pedir la revisión. */}
                    {c.patientName ??
                      (c.patientRecordNumber !== null
                        ? `Historia N.º ${c.patientRecordNumber}`
                        : 'un paciente del padrón')}
                  </span>
                </p>
                <p className="mt-1 text-sm text-(--color-tinta-2) italic">«{c.reason}»</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-tinta-3)">
                  <span className="cifras">{fechaCorta.format(new Date(c.grantedAt))}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5',
                      c.vigente
                        ? 'bg-(--color-riesgo-suave) text-(--color-riesgo)'
                        : 'bg-(--color-superficie-2) text-(--color-tinta-3)'
                    )}
                  >
                    {c.vigente
                      ? `Vigente hasta las ${fechaCorta.format(new Date(c.expiresAt))}`
                      : 'Caducado'}
                  </span>
                  <Link
                    href={enlaceCon('paciente', c.patientId)}
                    className="text-(--color-acento) underline-offset-2 hover:underline"
                  >
                    Ver todo lo ocurrido con este paciente
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulario GET: el filtro queda en la URL, así que un hallazgo se
          comparte pegando el enlace y el botón «atrás» funciona. */}
      <form
        method="get"
        className="no-imprimir grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_auto] lg:items-end"
      >
        {paciente && <input type="hidden" name="paciente" value={paciente} />}
        {actor && <input type="hidden" name="actor" value={actor} />}

        <Field
          label="Buscar"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Resumen, recurso o motivo"
          ayuda="Texto libre sobre el resumen del evento."
        />

        <div className="space-y-1.5">
          <label htmlFor="accion" className="block text-sm font-medium text-(--color-tinta)">
            Acción
          </label>
          <select
            id="accion"
            name="accion"
            defaultValue={accionActiva ?? ''}
            className="w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 py-2 text-sm text-(--color-tinta) transition-colors outline-none focus:border-(--color-acento)"
          >
            <option value="">Todas</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ETIQUETA_ACCION[a]}
              </option>
            ))}
          </select>
        </div>

        <Field label="Desde" type="date" name="desde" defaultValue={desde} />
        <Field label="Hasta" type="date" name="hasta" defaultValue={hasta} />

        <div className="flex items-center gap-2">
          <Button type="submit" variant="secundario">
            Filtrar
          </Button>
          {hayFiltro && (
            <Link
              href={`/i/${slug}/auditoria`}
              className="text-sm text-(--color-tinta-2) underline-offset-2 hover:text-(--color-tinta) hover:underline"
            >
              Quitar
            </Link>
          )}
        </div>
      </form>

      {eventos.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-14 text-center">
          <ShieldCheck
            className="mx-auto size-8 text-(--color-tinta-3)"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <p className="mt-4 font-medium text-(--color-tinta)">
            {hayFiltro ? 'Ningún evento coincide' : 'La bitácora está vacía'}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-(--color-tinta-2)">
            {hayFiltro
              ? 'Pruebe a ampliar el rango de fechas o a quitar el filtro de acción.'
              : 'Se registrará el primer evento en cuanto alguien abra un expediente.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          {/* `border-collapse` no es cosmético: en el modelo de bordes separados
              —el de por defecto— el navegador IGNORA los bordes declarados sobre
              `tr`, y las filas saldrían pegadas sin línea que las separe. */}
          <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Eventos de la bitácora, del más reciente al más antiguo
            </caption>
            <thead>
              <tr className="border-b border-(--color-borde) bg-(--color-superficie-2) text-xs tracking-wide text-(--color-tinta-3) uppercase">
                <th scope="col" className="px-3 py-2 font-medium">
                  Fecha y hora
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Actor
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Acción
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Recurso
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Paciente
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Resumen
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-(--color-borde)">
              {eventos.map((e) => {
                const sensible = ACCIONES_SENSIBLES.has(e.action);

                return (
                  <tr key={e.id} className={cn(sensible && 'bg-(--color-riesgo-suave)')}>
                    <td className="cifras px-3 py-2.5 align-top whitespace-nowrap text-(--color-tinta-2)">
                      <time dateTime={e.occurredAt}>
                        {fechaHora.format(new Date(e.occurredAt))}
                      </time>
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      {e.actorId ? (
                        <Link
                          href={enlaceCon('actor', e.actorId)}
                          className="font-medium text-(--color-tinta) underline-offset-2 hover:underline"
                        >
                          {e.actorName}
                        </Link>
                      ) : (
                        // Sin `actor_id` el evento lo escribió un worker
                        // (recordatorios, antivirus, facturación), no una persona.
                        <span className="font-medium text-(--color-tinta-2)">
                          {e.actorLabel === 'system' ? 'Sistema' : e.actorLabel}
                        </span>
                      )}
                      {e.actorRole && (
                        <span className="mt-0.5 block text-xs text-(--color-tinta-3)">
                          {ROLE_LABELS[e.actorRole]}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
                          sensible
                            ? 'bg-(--color-riesgo) font-medium text-white'
                            : 'bg-(--color-superficie-2) text-(--color-tinta-2)'
                        )}
                      >
                        {ETIQUETA_ACCION[e.action]}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 align-top text-(--color-tinta-2)">
                      {e.resourceType}
                      {e.resourceId && (
                        <span className="cifras mt-0.5 block text-xs text-(--color-tinta-3)">
                          ···{e.resourceId.slice(-8)}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      {e.patientId ? (
                        // El enlace filtra la bitácora, no abre el expediente:
                        // el rol `auditor` no tiene `patients.read` y llegaría a
                        // una página vacía. La trazabilidad completa de un
                        // paciente es justo lo que se le pide a esta vista.
                        <Link
                          href={enlaceCon('paciente', e.patientId)}
                          className="text-(--color-tinta) underline-offset-2 hover:underline"
                        >
                          {e.patientName ?? (
                            <span className="cifras text-(--color-tinta-2)">
                              ···{e.patientId.slice(-8)}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-(--color-tinta-3)">—</span>
                      )}
                      {e.patientRecordNumber !== null && (
                        <span className="cifras mt-0.5 block text-xs text-(--color-tinta-3)">
                          HC {e.patientRecordNumber}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-top text-(--color-tinta-2)">
                      {e.summary ?? <span className="text-(--color-tinta-3)">Sin resumen</span>}
                      {e.breakGlassReason && (
                        <span className="mt-0.5 block text-xs text-(--color-riesgo) italic">
                          Motivo de emergencia: «{e.breakGlassReason}»
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {eventos.length > 0 && (
        <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-(--color-tinta-3)">
            <span className="cifras">{eventos.length}</span>{' '}
            {eventos.length === 1 ? 'evento' : 'eventos'}
            {eventos.length === tope && ', los más recientes primero'}.
          </p>

          {/* Paginación deliberadamente tonta: subir el tope en la URL. Un
              cursor sobre (occurred_at, id) sería más eficiente, pero esta
              vista se recorre de arriba abajo unas pocas veces al mes. */}
          {eventos.length === tope && tope < TOPE_MAXIMO && (
            <Link
              href={`?${masFiltros.toString()}`}
              className="inline-flex h-9 items-center rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
            >
              Cargar más
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
