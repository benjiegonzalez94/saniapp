'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { TENANT_KINDS, type TenantKind } from '@/lib/db/types';
import { crearInstitucion, type EstadoInstitucion } from './actions';

const ESTADO_INICIAL: EstadoInstitucion = {};

const ETIQUETAS_TIPO: Record<TenantKind, string> = {
  consultorio: 'Consultorio individual',
  clinica: 'Clínica',
  hospital: 'Hospital',
  laboratorio: 'Laboratorio',
  centro_diagnostico: 'Centro de diagnóstico',
};

/** Convierte «Hospital Básico Mendieta» en «hospital-basico-mendieta». */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function FormularioInstitucion() {
  const [estado, accion, enviando] = useActionState(crearInstitucion, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  const [nombre, setNombre] = useState(v.legalName ?? '');
  // El slug se propone a partir del nombre pero se puede editar: una vez creado
  // vive en todas las URLs de la institución y cambiarlo rompería los enlaces
  // que la gente ya tenga guardados.
  const [slugTocado, setSlugTocado] = useState(false);
  const [slug, setSlug] = useState(v.slug ?? '');

  return (
    <form action={accion} className="space-y-5" noValidate>
      <section className="space-y-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-5">
        <Field
          label="Razón social"
          name="legalName"
          required
          autoFocus
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            if (!slugTocado) setSlug(aSlug(e.target.value));
          }}
          ayuda="El nombre legal, tal como aparece en el RUC."
          error={errorDe('legalName')}
        />

        <Field
          label="Nombre comercial"
          name="commercialName"
          defaultValue={v.commercialName}
          ayuda="Opcional. Es el que se mostrará en la aplicación si lo indica."
        />

        <div className="space-y-1.5">
          <label htmlFor="slug" className="block text-sm font-medium text-(--color-tinta)">
            Dirección en SaniTi
            <span className="ml-0.5 text-(--color-riesgo)" aria-hidden="true">
              *
            </span>
          </label>
          <div className="flex items-center rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) focus-within:border-(--color-acento)">
            <span className="pl-3 text-sm text-(--color-tinta-3)">/i/</span>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTocado(true);
                setSlug(aSlug(e.target.value));
              }}
              aria-invalid={errorDe('slug') ? true : undefined}
              className="h-[38px] flex-1 bg-transparent pr-3 text-sm text-(--color-tinta) outline-none"
            />
          </div>
          <p className="text-xs text-(--color-tinta-3)">
            {errorDe('slug') ? (
              <span className="text-(--color-riesgo)">{errorDe('slug')}</span>
            ) : (
              'Aparecerá en todas las direcciones de su institución. Elíjala con calma: cambiarla después rompería los enlaces guardados.'
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="kind" className="block text-sm font-medium text-(--color-tinta)">
              Tipo
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={v.kind ?? 'consultorio'}
              className="h-[38px] w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
            >
              {TENANT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETAS_TIPO[k]}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="RUC"
            name="taxId"
            inputMode="numeric"
            className="cifras"
            defaultValue={v.taxId}
            ayuda="Opcional. 13 dígitos."
            error={errorDe('taxId')}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="timezone" className="block text-sm font-medium text-(--color-tinta)">
            Zona horaria
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={v.timezone ?? 'America/Guayaquil'}
            className="h-[38px] w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
          >
            <option value="America/Guayaquil">Ecuador continental (America/Guayaquil)</option>
            <option value="Pacific/Galapagos">Galápagos (Pacific/Galapagos)</option>
            <option value="America/Bogota">Colombia (America/Bogota)</option>
            <option value="America/Lima">Perú (America/Lima)</option>
          </select>
          <p className="text-xs text-(--color-tinta-3)">
            Decide cómo se interpretan los horarios de atención y a qué hora salen los
            recordatorios.
          </p>
        </div>
      </section>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/panel"
          className="text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
        >
          Cancelar
        </Link>
        <Button type="submit" size="lg" cargando={enviando}>
          Crear institución
        </Button>
      </div>

      <p className="text-xs text-(--color-tinta-3)">
        Quedará registrado como propietario, con prueba gratuita de 14 días. Podrá invitar a
        su equipo desde la sección Equipo.
      </p>
    </form>
  );
}
