'use client';

import { useActionState, useState, useTransition } from 'react';
import { Check, Copy, Mail, UserMinus, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from '@/lib/db/types';
import type { Invitacion, Miembro } from '@/lib/db/team';
import {
  actualizarRol,
  anularInvitacion,
  invitar,
  quitarMiembro,
  type EstadoInvitacion,
} from './actions';

const ESTADO_INICIAL: EstadoInvitacion = {};

/** Qué hace cada rol, en una frase. Sin esto nadie elige bien. */
const QUE_HACE: Record<MemberRole, string> = {
  owner: 'Control total. Responsable legal de los datos.',
  admin: 'Gestiona equipo, agenda y facturación. No firma clínicamente.',
  physician: 'Historia clínica completa: registra, firma y receta.',
  nurse: 'Registra signos, notas y estudios. No firma.',
  receptionist: 'Agenda y datos de contacto. NO abre la historia clínica.',
  billing: 'Sólo suscripción y facturas.',
  auditor: 'Sólo lectura de la bitácora de auditoría.',
};

const ROLES_INVITABLES = MEMBER_ROLES.filter((r) => r !== 'owner');

export function PanelEquipo({
  slug,
  miembros,
  invitaciones,
  puedeGestionar,
  miPerfilId,
}: {
  slug: string;
  miembros: Miembro[];
  invitaciones: Invitacion[];
  puedeGestionar: boolean;
  miPerfilId: string;
}) {
  const [estado, accion, invitando] = useActionState(invitar, ESTADO_INICIAL);
  const [formAbierto, setFormAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  async function copiarEnlace(enlace: string) {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles (contexto no seguro, por ejemplo): el
      // enlace sigue visible y seleccionable a mano, así que no es un fallo.
      setError('No se pudo copiar. Seleccione el enlace y cópielo manualmente.');
    }
  }

  const fecha = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' });

  return (
    <div className="space-y-6">
      {/* Enlace recién generado */}
      {estado.enlace && (
        <div className="space-y-2 rounded-(--radius-lg) border border-(--color-acento) bg-(--color-acento-suave) p-4">
          <p className="text-sm font-medium text-(--color-acento-fuerte)">
            Invitación creada para {estado.email}
          </p>
          <p className="text-xs text-(--color-tinta-2)">
            Cópiela y envíesela. <strong>Este enlace no se puede volver a ver</strong>: la base
            sólo guarda su huella, no el enlace. Caduca en 7 días.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={estado.enlace}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Enlace de invitación"
              className="h-9 flex-1 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-xs text-(--color-tinta) outline-none"
            />
            <Button
              type="button"
              size="sm"
              variant={copiado ? 'secundario' : 'primario'}
              onClick={() => void copiarEnlace(estado.enlace!)}
            >
              {copiado ? (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" />
                  Copiar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {error}
        </p>
      )}

      {/* Miembros */}
      <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-borde) px-5 py-3">
          <h2 className="font-medium text-(--color-tinta)">
            Miembros
            <span className="ml-2 font-normal text-(--color-tinta-3)">{miembros.length}</span>
          </h2>
          {puedeGestionar && !formAbierto && (
            <Button type="button" size="sm" onClick={() => setFormAbierto(true)}>
              <UserPlus className="size-4" aria-hidden="true" />
              Invitar
            </Button>
          )}
        </div>

        {formAbierto && (
          <form
            action={accion}
            className="space-y-3 border-b border-(--color-borde) bg-(--color-superficie-2) p-5"
          >
            <input type="hidden" name="slug" value={slug} />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-(--color-tinta-2)"
                >
                  Correo de la persona
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="colega@clinica.ec"
                  className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="role"
                  className="block text-xs font-medium text-(--color-tinta-2)"
                >
                  Rol
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="physician"
                  className="h-9 w-full rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento) sm:w-48"
                >
                  {ROLES_INVITABLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Qué puede hacer cada rol: elegirlo a ciegas es cómo alguien
                acaba viendo historias clínicas que no le corresponden. */}
            <details className="text-xs">
              <summary className="cursor-pointer text-(--color-tinta-2)">
                Qué puede hacer cada rol
              </summary>
              <ul className="mt-2 space-y-1">
                {ROLES_INVITABLES.map((r) => (
                  <li key={r} className="text-(--color-tinta-3)">
                    <strong className="text-(--color-tinta-2)">{ROLE_LABELS[r]}:</strong>{' '}
                    {QUE_HACE[r]}
                  </li>
                ))}
              </ul>
            </details>

            {estado.error && (
              <p role="alert" className="text-sm text-(--color-riesgo)">
                {estado.error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" size="sm" cargando={invitando}>
                Crear invitación
              </Button>
              <Button
                type="button"
                size="sm"
                variant="fantasma"
                onClick={() => setFormAbierto(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-(--color-borde)">
          {miembros.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-(--color-tinta)">
                  {m.fullName}
                  {m.profileId === miPerfilId && (
                    <span className="ml-2 text-xs font-normal text-(--color-tinta-3)">
                      (usted)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-(--color-tinta-3)">
                  {[m.email, m.specialty, m.licenseNumber].filter(Boolean).join(' · ')}
                </p>
              </div>

              {puedeGestionar && m.role !== 'owner' ? (
                <select
                  value={m.role}
                  disabled={pendiente}
                  aria-label={`Rol de ${m.fullName}`}
                  onChange={(e) => {
                    const rol = e.target.value;
                    setError(null);
                    iniciar(async () => {
                      const r = await actualizarRol(slug, m.id, rol);
                      if (!r.ok) setError(r.error);
                    });
                  }}
                  className="h-8 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2 text-xs text-(--color-tinta) outline-none focus:border-(--color-acento)"
                >
                  {ROLES_INVITABLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-(--color-superficie-2) px-2.5 py-1 text-xs text-(--color-tinta-2)">
                  {ROLE_LABELS[m.role]}
                </span>
              )}

              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
                  m.status === 'active'
                    ? 'bg-(--color-exito-suave) text-(--color-exito)'
                    : 'bg-(--color-aviso-suave) text-(--color-tinta-2)'
                )}
              >
                {m.status === 'active' ? 'Activo' : 'Suspendido'}
              </span>

              {puedeGestionar && m.role !== 'owner' && m.profileId !== miPerfilId && (
                <button
                  type="button"
                  disabled={pendiente}
                  aria-label={`Retirar a ${m.fullName}`}
                  onClick={() => {
                    if (!window.confirm(`¿Retirar a ${m.fullName} del equipo?`)) return;
                    setError(null);
                    iniciar(async () => {
                      const r = await quitarMiembro(slug, m.id);
                      if (!r.ok) setError(r.error);
                    });
                  }}
                  className="rounded-(--radius-sm) p-1.5 text-(--color-tinta-3) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-riesgo) disabled:opacity-40"
                >
                  <UserMinus className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Invitaciones pendientes */}
      {invitaciones.length > 0 && (
        <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          <div className="border-b border-(--color-borde) px-5 py-3">
            <h2 className="font-medium text-(--color-tinta)">
              Invitaciones pendientes
              <span className="ml-2 font-normal text-(--color-tinta-3)">
                {invitaciones.length}
              </span>
            </h2>
          </div>

          <ul className="divide-y divide-(--color-borde)">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <Mail className="size-4 shrink-0 text-(--color-tinta-3)" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-(--color-tinta)">{i.email}</p>
                  <p className="text-xs text-(--color-tinta-3)">
                    {ROLE_LABELS[i.role]} · caduca el {fecha.format(new Date(i.expiresAt))}
                    {i.invitedByName ? ` · invitó ${i.invitedByName}` : ''}
                  </p>
                </div>

                {puedeGestionar && (
                  <Button
                    type="button"
                    size="sm"
                    variant="fantasma"
                    disabled={pendiente}
                    onClick={() => {
                      setError(null);
                      iniciar(async () => {
                        await anularInvitacion(slug, i.id);
                      });
                    }}
                  >
                    Anular
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
