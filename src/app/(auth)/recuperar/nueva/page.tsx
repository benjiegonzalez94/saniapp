import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { FormularioNuevaClave } from './formulario';

export const metadata: Metadata = { title: 'Nueva contraseña' };
export const dynamic = 'force-dynamic';

/**
 * Destino del enlace del correo de recuperación.
 *
 * No exige sesión con requireUser(): el enlace de Supabase establece la sesión
 * de recuperación al abrirse, y la acción comprueba que exista. Poner un
 * guardia aquí redirigiría al login antes de que el enlace pueda hacer su
 * trabajo, dejando la recuperación inservible.
 */
export default function PaginaNuevaClave() {
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
          <h1 className="mt-6 text-xl font-semibold text-(--color-tinta)">Nueva contraseña</h1>
        </div>

        <div className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <FormularioNuevaClave />
        </div>
      </div>
    </main>
  );
}
