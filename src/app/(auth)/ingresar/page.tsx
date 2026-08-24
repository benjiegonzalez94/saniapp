import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { FormularioIngreso } from './formulario';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function PaginaIngreso({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;

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
          <h1 className="mt-6 text-xl font-semibold text-(--color-tinta)">
            Ingrese a su cuenta
          </h1>
          <p className="mt-1.5 text-sm text-(--color-tinta-2)">
            Acceso al sistema de gestión clínica
          </p>
        </div>

        <div className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <FormularioIngreso siguiente={siguiente} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-(--color-tinta-3)">
          Este sistema contiene datos personales de salud protegidos por la Ley Orgánica de
          Protección de Datos Personales. Todo acceso queda registrado.
        </p>
      </div>
    </main>
  );
}
