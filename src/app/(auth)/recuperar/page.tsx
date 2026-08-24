import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { FormularioRecuperacion } from './formulario';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function PaginaRecuperar() {
  return (
    <main
      id="contenido"
      className="flex min-h-dvh items-center justify-center bg-(--color-lienzo) px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex">
            <Logo size={32} />
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-(--color-tinta)">
            Recuperar contraseña
          </h1>
          <p className="mt-1.5 text-sm text-(--color-tinta-2)">
            Le enviaremos un enlace para establecer una nueva.
          </p>
        </div>

        <div className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <FormularioRecuperacion />
        </div>
      </div>
    </main>
  );
}
