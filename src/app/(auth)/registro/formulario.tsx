'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { registrarCuenta, type EstadoRegistro } from './actions';

const ESTADO_INICIAL: EstadoRegistro = {};

export function FormularioRegistro() {
  const [estado, accion, enviando] = useActionState(registrarCuenta, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  if (estado.exito) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-(--color-exito)"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <div>
          <h2 className="font-medium text-(--color-tinta)">Revise su correo</h2>
          {/* Redacción deliberadamente ambigua: no confirma ni desmiente que la
              dirección ya tuviera cuenta. Ver la nota 1 de actions.ts. */}
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            Si la dirección es válida, le hemos enviado un enlace para confirmar la cuenta.
            Ábralo desde este mismo dispositivo.
          </p>
        </div>
        <Link
          href="/ingresar"
          className="inline-block text-sm text-(--color-acento) underline-offset-2 hover:underline"
        >
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4" noValidate>
      <Field
        label="Nombre completo"
        name="fullName"
        autoComplete="name"
        required
        autoFocus
        defaultValue={v.fullName}
        ayuda="Como debe aparecer en las notas clínicas que firme."
        error={errorDe('fullName')}
      />

      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="nombre@clinica.ec"
        required
        defaultValue={v.email}
        error={errorDe('email')}
      />

      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        ayuda="Mínimo 12 caracteres. Una frase que recuerde es mejor que una palabra con símbolos."
        error={errorDe('password')}
      />

      <Field
        label="Repita la contraseña"
        name="confirmacion"
        type="password"
        autoComplete="new-password"
        required
        error={errorDe('confirmacion')}
      />

      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          name="aceptaTerminos"
          className="mt-0.5 size-4 shrink-0 accent-(--color-acento)"
        />
        <span className="text-(--color-tinta-2)">
          Acepto los{' '}
          <Link
            href="/legal/terminos"
            className="text-(--color-acento) underline-offset-2 hover:underline"
          >
            términos de servicio
          </Link>{' '}
          y la{' '}
          <Link
            href="/legal/privacidad"
            className="text-(--color-acento) underline-offset-2 hover:underline"
          >
            política de privacidad
          </Link>
          .
        </span>
      </label>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}
      {errorDe('aceptaTerminos') && (
        <p role="alert" className="text-sm text-(--color-riesgo)">
          {errorDe('aceptaTerminos')}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" cargando={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>

      <p className="pt-1 text-center text-sm text-(--color-tinta-2)">
        ¿Ya tiene cuenta?{' '}
        <Link
          href="/ingresar"
          className="font-medium text-(--color-acento) underline-offset-2 hover:underline"
        >
          Ingrese
        </Link>
      </p>
    </form>
  );
}
