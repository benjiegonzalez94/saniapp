'use client';

import { useActionState, useEffect, useState } from 'react';
import { Calendar, Loader2, Search, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ENCOUNTER_KINDS, type EncounterKind } from '@/lib/db/types';
import type { Proveedor } from '@/lib/db/scheduling';
import { crearCita, type EstadoAgendar } from '../actions';

const ESTADO_INICIAL: EstadoAgendar = {};

const ETIQUETAS_ATENCION: Record<EncounterKind, string> = {
  consulta: 'Consulta',
  control: 'Control',
  emergencia: 'Emergencia',
  teleconsulta: 'Teleconsulta',
  procedimiento: 'Procedimiento',
  domiciliaria: 'Domiciliaria',
};

type PacienteBusqueda = {
  id: string;
  given_name: string;
  family_name: string;
  record_number: number;
  phone: string | null;
};

type Hueco = { starts_at: string; ends_at: string; location_id: string | null };

/**
 * Agendar una cita.
 *
 * Tres decisiones en orden: quién, con quién, y cuándo. El "cuándo" se ofrece
 * como huecos concretos calculados por la base, no como un campo de hora libre:
 * teclear "10:15" cuando los turnos son de media hora produce una agenda que ya
 * no cuadra con nada, y el error sólo se descubre el día de la cita.
 */
export function FormularioAgendar({
  slug,
  tenantId,
  proveedores,
  zona,
  fechaInicial,
  medicoInicial,
  pacienteInicial,
}: {
  slug: string;
  tenantId: string;
  proveedores: Proveedor[];
  zona: string;
  fechaInicial: string;
  medicoInicial: string | null;
  pacienteInicial: PacienteBusqueda | null;
}) {
  const [estado, accion, enviando] = useActionState(crearCita, ESTADO_INICIAL);

  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(pacienteInicial);
  const [termino, setTermino] = useState('');
  const [medicoId, setMedicoId] = useState(medicoInicial ?? proveedores[0]?.id ?? '');
  const [fecha, setFecha] = useState(fechaInicial);
  const [hueco, setHueco] = useState<Hueco | null>(null);

  /*
   * Los resultados asíncronos se guardan JUNTO A la clave que los produjo, y
   * lo que se pinta se deriva comparando esa clave con la actual.
   *
   * La alternativa —limpiar el estado dentro del efecto cuando cambian las
   * entradas— provoca renders en cascada y, peor, una ventana en la que se
   * muestran los huecos del médico anterior como si fueran los del nuevo. Con
   * la clave, un resultado que no corresponde a la consulta vigente
   * sencillamente no se pinta.
   */
  const claveBusqueda = paciente ? '' : termino.trim();
  const [datosBusqueda, setDatosBusqueda] = useState<{
    clave: string;
    filas: PacienteBusqueda[];
  }>({ clave: '', filas: [] });

  const claveHuecos = medicoId && fecha ? `${medicoId}|${fecha}` : '';
  const [datosHuecos, setDatosHuecos] = useState<{ clave: string; filas: Hueco[] }>({
    clave: '',
    filas: [],
  });

  // Búsqueda de pacientes con retardo: sin él se dispara una consulta por tecla.
  useEffect(() => {
    if (claveBusqueda.length < 2) return;

    const t = setTimeout(async () => {
      const supabase = createClient();
      const patron = `%${claveBusqueda}%`;
      const { data } = await supabase
        .from('patients')
        .select('id, given_name, family_name, record_number, phone')
        // RLS ya acota por membresía, pero se filtra explícitamente: un usuario
        // que trabaje en dos instituciones no debe ver pacientes de la otra al
        // agendar en ésta.
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .or(`given_name.ilike.${patron},family_name.ilike.${patron}`)
        .limit(8);

      setDatosBusqueda({ clave: claveBusqueda, filas: (data ?? []) as PacienteBusqueda[] });
    }, 220);

    return () => clearTimeout(t);
  }, [claveBusqueda, tenantId]);

  // Huecos del médico y día elegidos.
  useEffect(() => {
    if (!claveHuecos) return;
    let vigente = true;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('available_slots', {
        p_tenant_id: tenantId,
        p_provider_id: medicoId,
        p_from: fecha,
        p_to: fecha,
      });
      if (vigente) setDatosHuecos({ clave: claveHuecos, filas: (data ?? []) as Hueco[] });
    })();

    return () => {
      vigente = false;
    };
  }, [claveHuecos, medicoId, fecha, tenantId]);

  const resultados = datosBusqueda.clave === claveBusqueda ? datosBusqueda.filas : [];
  const buscando = claveBusqueda.length >= 2 && datosBusqueda.clave !== claveBusqueda;

  const cargandoHuecos = Boolean(claveHuecos) && datosHuecos.clave !== claveHuecos;
  const huecos = datosHuecos.clave === claveHuecos ? datosHuecos.filas : [];

  // Al cambiar de médico o de día, el hueco elegido deja de existir. Se deriva
  // en vez de limpiarlo con setState, que es lo que causaba la cascada.
  const huecoElegido =
    hueco && huecos.some((h) => h.starts_at === hueco.starts_at) ? hueco : null;

  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });

  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="patientId" value={paciente?.id ?? ''} />
      <input type="hidden" name="providerId" value={medicoId} />
      <input type="hidden" name="startsAt" value={huecoElegido?.starts_at ?? ''} />
      <input type="hidden" name="endsAt" value={huecoElegido?.ends_at ?? ''} />
      <input type="hidden" name="locationId" value={huecoElegido?.location_id ?? ''} />

      {/* 1. Paciente */}
      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">1 · Paciente</h2>

        {paciente ? (
          <div className="flex items-center justify-between gap-3 rounded-(--radius-md) bg-(--color-superficie-2) px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-medium text-(--color-tinta)">
                {paciente.family_name}, {paciente.given_name}
              </p>
              <p className="cifras text-xs text-(--color-tinta-3)">
                HC {paciente.record_number}
                {paciente.phone ? ` · ${paciente.phone}` : ''}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="fantasma"
              onClick={() => {
                setPaciente(null);
                setTermino('');
              }}
            >
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-tinta-3)"
              aria-hidden="true"
            />
            <input
              type="text"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="Buscar por nombre o apellido"
              aria-label="Buscar paciente"
              autoFocus
              className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) pr-4 pl-10 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
            />

            {buscando && (
              <Loader2
                className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-(--color-tinta-3)"
                aria-hidden="true"
              />
            )}

            {resultados.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-(--radius-md) border border-(--color-borde-fuerte)">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPaciente(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-(--color-superficie-2)"
                    >
                      <UserRound
                        className="size-4 shrink-0 text-(--color-tinta-3)"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-(--color-tinta)">
                          {p.family_name}, {p.given_name}
                        </span>
                        <span className="cifras block text-xs text-(--color-tinta-3)">
                          HC {p.record_number}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {termino.trim().length >= 2 && !buscando && resultados.length === 0 && (
              <p className="mt-2 text-sm text-(--color-tinta-3)">
                Ningún paciente coincide.{' '}
                <a
                  href={`/i/${slug}/pacientes/nuevo`}
                  className="text-(--color-acento) underline-offset-2 hover:underline"
                >
                  Registrar uno nuevo
                </a>
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. Profesional y día */}
      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">2 · Profesional y día</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="medico"
              className="block text-xs font-medium text-(--color-tinta-2)"
            >
              Profesional
            </label>
            <select
              id="medico"
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
              className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            >
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                  {p.specialty ? ` · ${p.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="fecha" className="block text-xs font-medium text-(--color-tinta-2)">
              Día
            </label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
              className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            />
          </div>
        </div>
      </section>

      {/* 3. Hueco */}
      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">3 · Hora</h2>

        {cargandoHuecos ? (
          <p className="flex items-center gap-2 text-sm text-(--color-tinta-3)">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Buscando huecos…
          </p>
        ) : huecos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-(--color-tinta-2)">
            <Calendar className="size-4 text-(--color-tinta-3)" aria-hidden="true" />
            No hay huecos libres ese día. Pruebe otra fecha o revise el horario de atención.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {huecos.map((h) => {
              const elegido = huecoElegido?.starts_at === h.starts_at;
              return (
                <button
                  key={h.starts_at}
                  type="button"
                  onClick={() => setHueco(h)}
                  aria-pressed={elegido}
                  className={cn(
                    'cifras h-9 rounded-(--radius-md) border px-3 text-sm transition-colors',
                    elegido
                      ? 'border-(--color-acento) bg-(--color-acento) text-white'
                      : 'border-(--color-borde-fuerte) bg-(--color-superficie) text-(--color-tinta) hover:bg-(--color-superficie-2)'
                  )}
                >
                  {hora.format(new Date(h.starts_at))}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Motivo */}
      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">4 · Motivo</h2>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="space-y-1">
            <label htmlFor="kind" className="block text-xs font-medium text-(--color-tinta-2)">
              Tipo
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue="consulta"
              className="h-10 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            >
              {ENCOUNTER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETAS_ATENCION[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="reason" className="block text-xs font-medium text-(--color-tinta-2)">
              Motivo de la consulta
            </label>
            <input
              id="reason"
              name="reason"
              placeholder="Control de presión, dolor de garganta…"
              className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="privateNote"
            className="block text-xs font-medium text-(--color-tinta-2)"
          >
            Nota interna
          </label>
          <input
            id="privateNote"
            name="privateNote"
            placeholder="Sólo la ve el equipo; no se envía al paciente"
            className="h-10 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
          />
        </div>
      </section>

      {estado.error && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <p className="text-sm text-(--color-tinta-3)">
          {paciente && huecoElegido
            ? `${paciente.given_name} el ${fecha} a las ${hora.format(new Date(huecoElegido.starts_at))}`
            : 'Elija paciente y hora para continuar.'}
        </p>
        <Button type="submit" size="lg" cargando={enviando} disabled={!paciente || !huecoElegido}>
          Agendar
        </Button>
      </div>

      <p className="text-xs text-(--color-tinta-3)">
        Si el paciente autorizó recordatorios, se programarán automáticamente 24 y 2 horas
        antes de la cita.
      </p>
    </form>
  );
}
