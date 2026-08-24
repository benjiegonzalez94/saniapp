import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requireUser } from '@/lib/auth/context';
import { FormularioInstitucion } from './formulario';

export const metadata: Metadata = { title: 'Nueva institución' };
export const dynamic = 'force-dynamic';

export default async function PaginaNuevaInstitucion() {
  await requireUser();

  return (
    <div className="min-h-dvh bg-(--color-lienzo)">
      <main id="contenido" className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/panel"
          className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Mis instituciones
        </Link>

        <div className="mt-5 mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
            Nueva institución
          </h1>
          <p className="mt-1.5 text-sm text-(--color-tinta-2)">
            Un consultorio individual y un hospital se crean igual: sólo cambian el tipo y el
            plan.
          </p>
        </div>

        <FormularioInstitucion />
      </main>
    </div>
  );
}
