'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { fijarNuevaClave, type EstadoNuevaClave } from '../actions';

const ESTADO_INICIAL: EstadoNuevaClave = {};

export function FormularioNuevaClave() {
  const [estado, accion, enviando] = useActionState(fijarNuevaClave, ESTADO_INICIAL);
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);

  if (estado.exito) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-(--color-exito)"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <h2 className="font-medium text-(--color-tinta)">Contraseña actualizada</h2>
        <Link
          href="/panel"
          className="inline-flex h-10 items-center rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
        >
          Continuar
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4" noValidate>
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        autoFocus
        minLength={12}
        ayuda="Mínimo 12 caracteres."
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

      {estado.error && !estado.campo && (
        <p
          role="alert"
          className="rounded-(--radius-md) bg-(--color-riesgo-suave) px-3 py-2 text-sm text-(--color-riesgo)"
        >
          {estado.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" cargando={enviando}>
        Guardar contraseña
      </Button>
    </form>
  );
}
