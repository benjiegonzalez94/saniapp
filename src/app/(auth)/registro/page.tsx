import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { FormularioRegistro } from './formulario';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function PaginaRegistro() {
  return (
    <main
      id="contenido"
      className="flex min-h-dvh items-center justify-center bg-(--color-lienzo) px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex">
            <Logo size={36} />
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-(--color-tinta)">Crear cuenta</h1>
          <p className="mt-1.5 text-sm text-(--color-tinta-2)">
            Después podrá crear su institución o aceptar una invitación.
          </p>
        </div>

        <div className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <FormularioRegistro />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-(--color-tinta-3)">
          Su cuenta es personal e intransferible. Compartirla impide saber quién accedió a
          cada historia clínica, que es justo lo que la ley obliga a poder demostrar.
        </p>
      </div>
    </main>
  );
}
