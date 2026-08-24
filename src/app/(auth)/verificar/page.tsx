import Link from 'next/link';
import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth/context';
import { Logo } from '@/components/brand/logo';
import { FormularioVerificacion } from './formulario';

export const metadata: Metadata = { title: 'Verificación en dos pasos' };
export const dynamic = 'force-dynamic';

/** Sólo rutas internas: aceptar una URL absoluta abriría un redirect abierto. */
function destinoSeguro(siguiente: string | undefined): string {
  if (!siguiente || !siguiente.startsWith('/')) return '/panel';
  // '//evil.com' y '/\evil.com' son rutas relativas para startsWith('/') pero
  // el navegador las resuelve como host externo.
  if (siguiente.startsWith('//') || siguiente.startsWith('/\\')) return '/panel';
  return siguiente;
}

export default async function PaginaVerificar({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  await requireUser();
  const { siguiente } = await searchParams;

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
            Verificación en dos pasos
          </h1>
          <p className="mt-1.5 text-sm text-(--color-tinta-2)">
            El acceso a datos clínicos exige un segundo factor.
          </p>
        </div>

        <div className="rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <FormularioVerificacion siguiente={destinoSeguro(siguiente)} />
        </div>
      </div>
    </main>
  );
}
