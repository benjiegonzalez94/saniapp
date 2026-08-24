import Link from 'next/link';

import { requireTenantBySlug } from '@/lib/auth/context';
import { ROLE_LABELS } from '@/lib/db/types';
import { Logo, LogoMark } from '@/components/brand/logo';
import { cerrarSesion } from '@/app/(auth)/ingresar/actions';
import { Button } from '@/components/ui/button';
import { NavegacionInstitucion } from './navegacion';

export const dynamic = 'force-dynamic';

export default async function LayoutInstitucion({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await requireTenantBySlug(slug);

  return (
    <div className="min-h-dvh bg-(--color-lienzo)">
      <header className="sticky top-0 z-40 border-b border-(--color-borde) bg-(--color-superficie)">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link href="/panel" className="flex shrink-0 items-center" title="Mis instituciones">
            <span className="hidden sm:block">
              <Logo size={26} />
            </span>
            <span className="sm:hidden">
              <LogoMark size={26} />
            </span>
          </Link>

          <span aria-hidden="true" className="text-(--color-borde-fuerte)">
            /
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-(--color-tinta)">
              {tenant.tenantName}
            </p>
            <p className="truncate text-xs text-(--color-tinta-3)">
              {ROLE_LABELS[tenant.role]}
            </p>
          </div>

          <form action={cerrarSesion} className="shrink-0">
            <Button type="submit" variant="fantasma" size="sm">
              Salir
            </Button>
          </form>
        </div>

        <NavegacionInstitucion slug={slug} permisos={[...tenant.permissions]} />
      </header>

      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
