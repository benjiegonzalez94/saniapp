import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2, Plus } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { getMemberships, requireUser } from '@/lib/auth/context';
import { ROLE_LABELS } from '@/lib/db/types';
import { cerrarSesion } from '@/app/(auth)/ingresar/actions';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Mis instituciones' };

// Nada de esta página puede cachearse: refleja permisos vigentes.
export const dynamic = 'force-dynamic';

export default async function PaginaPanel() {
  const user = await requireUser();
  const membresias = await getMemberships();

  return (
    <div className="min-h-dvh bg-(--color-lienzo)">
      <header className="border-b border-(--color-borde) bg-(--color-superficie)">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Logo size={30} />

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-(--color-tinta-2) sm:inline">
              {user.email}
            </span>
            <form action={cerrarSesion}>
              <Button type="submit" variant="fantasma" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-(--color-tinta)">
          Mis instituciones
        </h1>
        <p className="mt-1.5 text-sm text-(--color-tinta-2)">
          Elija dónde quiere trabajar. Cada institución mantiene sus pacientes y su agenda
          por separado.
        </p>

        {membresias.length === 0 ? (
          <div className="mt-10 rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-14 text-center">
            <Building2
              className="mx-auto size-8 text-(--color-tinta-3)"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            <h2 className="mt-4 font-medium text-(--color-tinta)">
              Todavía no pertenece a ninguna institución
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
              Cree la suya para empezar, o pida a un administrador que le envíe una
              invitación por correo.
            </p>
            <Link
              href="/panel/nueva"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
            >
              <Plus className="size-4" aria-hidden="true" />
              Crear institución
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-2">
              {membresias.map((m) => (
                <li key={m.tenantId}>
                  <Link
                    href={`/i/${m.slug}`}
                    className="flex items-center justify-between gap-4 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) px-5 py-4 transition-colors hover:border-(--color-borde-fuerte) hover:bg-(--color-superficie-2)"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-(--color-tinta)">
                        {m.tenantName}
                      </span>
                      <span className="mt-0.5 block text-sm text-(--color-tinta-3)">
                        {ROLE_LABELS[m.role]}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-(--color-tinta-3)"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/panel/nueva"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-4 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
            >
              <Plus className="size-4" aria-hidden="true" />
              Crear otra institución
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
