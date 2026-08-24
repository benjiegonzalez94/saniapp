'use client';

import { useActionState, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { ID_DOCUMENT_LABELS, ID_DOCUMENTS, SEX_AT_BIRTH, SEX_LABELS } from '@/lib/db/types';
import { registrarPaciente, type EstadoAlta } from './actions';

const ESTADO_INICIAL: EstadoAlta = {};

/**
 * Alta de paciente en un solo tramo.
 *
 * Los campos que se piden siempre están arriba y sin plegar; el resto vive tras
 * un desplegable cerrado. Un médico general que viene del papel escribe cuatro
 * datos y sigue: si el formulario le pide dieciocho, deja de registrar
 * pacientes y vuelve al cuaderno.
 */
export function FormularioAlta({ slug }: { slug: string }) {
  const [estado, accion, enviando] = useActionState(registrarPaciente, ESTADO_INICIAL);
  const [ampliado, setAmpliado] = useState(false);
  const v = estado.valores ?? {};
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="slug" value={slug} />

      <section className="space-y-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombres"
            name="givenName"
            required
            autoFocus
            autoComplete="off"
            defaultValue={v.givenName}
            error={errorDe('givenName')}
          />
          <Field
            label="Apellidos"
            name="familyName"
            required
            autoComplete="off"
            defaultValue={v.familyName}
            error={errorDe('familyName')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="space-y-1.5">
            <label
              htmlFor="idDocument"
              className="block text-sm font-medium text-(--color-tinta)"
            >
              Documento
            </label>
            <select
              id="idDocument"
              name="idDocument"
              defaultValue={v.idDocument ?? 'cedula'}
              className="h-[38px] w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            >
              {ID_DOCUMENTS.map((d) => (
                <option key={d} value={d}>
                  {ID_DOCUMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Número"
            name="nationalId"
            inputMode="numeric"
            autoComplete="off"
            className="cifras"
            defaultValue={v.nationalId}
            ayuda="Se guarda cifrado. Se comprueba el dígito verificador."
            error={errorDe('nationalId')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fecha de nacimiento"
            name="birthDate"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={v.birthDate}
            error={errorDe('birthDate')}
          />

          <div className="space-y-1.5">
            <label
              htmlFor="sexAtBirth"
              className="block text-sm font-medium text-(--color-tinta)"
            >
              Sexo al nacer
            </label>
            <select
              id="sexAtBirth"
              name="sexAtBirth"
              defaultValue={v.sexAtBirth ?? 'unknown'}
              className="h-[38px] w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            >
              {SEX_AT_BIRTH.map((s) => (
                <option key={s} value={s}>
                  {SEX_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="+593991234567"
          defaultValue={v.phone}
          ayuda="Con código de país. Es por donde llegarán los recordatorios."
          error={errorDe('phone')}
        />
      </section>

      <section className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
        <button
          type="button"
          onClick={() => setAmpliado((x) => !x)}
          aria-expanded={ampliado}
          className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-(--color-tinta)"
        >
          Datos adicionales
          <ChevronDown
            className={cn('size-4 transition-transform', ampliado && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {ampliado && (
          <div className="space-y-4 border-t border-(--color-borde) p-5">
            <Field label="Correo electrónico" name="email" type="email"
                   defaultValue={v.email} error={errorDe('email')} />
            <Field label="Dirección" name="addressLine" defaultValue={v.addressLine} />
            <Field label="Ciudad" name="city" defaultValue={v.city ?? 'Manta'} />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <h2 className="text-sm font-medium text-(--color-tinta)">Consentimiento informado</h2>

        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            name="consentTratamiento"
            defaultChecked={v.consentTratamiento === 'on'}
            className="mt-0.5 size-4 shrink-0 accent-(--color-acento)"
          />
          <span className="text-(--color-tinta-2)">
            El paciente autoriza el tratamiento de sus datos de salud para su atención médica.
            <span className="mt-0.5 block text-xs text-(--color-tinta-3)">
              Obligatorio. Los datos de salud son categoría especial bajo la LOPDP y requieren
              consentimiento explícito.
            </span>
          </span>
        </label>

        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            name="consentWhatsapp"
            defaultChecked={v.consentWhatsapp === 'on'}
            className="mt-0.5 size-4 shrink-0 accent-(--color-acento)"
          />
          <span className="text-(--color-tinta-2)">
            Autoriza recibir recordatorios de cita por WhatsApp.
            <span className="mt-0.5 block text-xs text-(--color-tinta-3)">
              Opcional y revocable. Sin esta casilla no se le enviará ningún mensaje.
            </span>
          </span>
        </label>

        {estado.campo === 'consentTratamiento' && estado.error && (
          <p
            role="alert"
            className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
          >
            {estado.error}
          </p>
        )}
      </section>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="submit" size="lg" cargando={enviando}>
          {enviando ? 'Registrando…' : 'Registrar paciente'}
        </Button>
      </div>
    </form>
  );
}
