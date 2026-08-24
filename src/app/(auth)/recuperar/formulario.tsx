'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { solicitarRecuperacion, type EstadoRecuperacion } from './actions';

const ESTADO_INICIAL: EstadoRecuperacion = {};

export function FormularioRecuperacion() {
  const [estado, accion, enviando] = useActionState(solicitarRecuperacion, ESTADO_INICIAL);

  if (estado.enviado) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck
          className="mx-auto size-10 text-(--color-exito)"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <div>
          <h2 className="font-medium text-(--color-tinta)">Revise su correo</h2>
          {/* Redacción condicional a propósito: no confirma que la dirección
              tenga cuenta. Ver la nota de actions.ts. */}
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            Si esa dirección tiene una cuenta en SaniTi, le hemos enviado un enlace para
            establecer una contraseña nueva. Caduca en una hora.
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
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="nombre@clinica.ec"
        required
        autoFocus
        error={estado.error}
      />

      <Button type="submit" className="w-full" size="lg" cargando={enviando}>
        Enviar enlace
      </Button>

      <p className="pt-1 text-center text-sm text-(--color-tinta-2)">
        <Link
          href="/ingresar"
          className="text-(--color-acento) underline-offset-2 hover:underline"
        >
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}
