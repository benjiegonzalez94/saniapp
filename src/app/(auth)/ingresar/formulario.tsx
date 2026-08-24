'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { iniciarSesion, type EstadoIngreso } from './actions';

const ESTADO_INICIAL: EstadoIngreso = {};

export function FormularioIngreso({ siguiente }: { siguiente?: string }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="siguiente" value={siguiente ?? ''} />

      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="nombre@clinica.ec"
        required
        autoFocus
        error={estado.campo === 'email' ? estado.error : undefined}
      />

      <div className="space-y-1.5">
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={estado.campo === 'password' ? estado.error : undefined}
        />
        <div className="flex justify-end">
          <Link
            href="/recuperar"
            className="text-xs text-(--color-tinta-2) underline-offset-2 hover:text-(--color-acento) hover:underline"
          >
            ¿Olvidó su contraseña?
          </Link>
        </div>
      </div>

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" cargando={enviando}>
        {enviando ? 'Verificando…' : 'Ingresar'}
      </Button>

      <p className="pt-1 text-center text-sm text-(--color-tinta-2)">
        ¿Su institución aún no usa SaniTi?{' '}
        <Link
          href="/registro"
          className="font-medium text-(--color-acento) underline-offset-2 hover:underline"
        >
          Cree una cuenta
        </Link>
      </p>
    </form>
  );
}
