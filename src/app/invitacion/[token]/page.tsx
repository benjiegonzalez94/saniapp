import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { UserCheck } from 'lucide-react';

import { getUser } from '@/lib/auth/context';
import { InvitacionError, aceptarInvitacion } from '@/lib/db/team';
import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = { title: 'Invitación' };
export const dynamic = 'force-dynamic';

/**
 * Aceptación de una invitación.
 *
 * El token viaja en la URL y se canjea en el servidor. La comprobación de que
 * el correo de la sesión coincide con el de la invitación la hace el RPC
 * `accept_invitation`, no esta página: reenviar el correo a un tercero no debe
 * darle acceso a la institución.
 *
 * Sin sesión se redirige a ingresar conservando el destino, para volver aquí
 * automáticamente después.
 */
export default async function PaginaInvitacion({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getUser();

  if (!user) {
    const destino = encodeURIComponent(`/invitacion/${token}`);
    redirect(`/ingresar?siguiente=${destino}`);
  }

  let slug: string | null = null;
  let error: string | null = null;

  try {
    slug = await aceptarInvitacion(token);
  } catch (err) {
    error =
      err instanceof InvitacionError
        ? err.message
        : 'No se pudo procesar la invitación. Pida que se la envíen de nuevo.';
  }

  if (slug) redirect(`/i/${slug}`);

  return (
    <main
      id="contenido"
      className="flex min-h-dvh items-center justify-center bg-(--color-lienzo) px-4 py-12"
    >
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="inline-flex">
          <Logo size={32} />
        </Link>

        <div className="mt-8 rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)">
          <UserCheck
            className="mx-auto size-8 text-(--color-tinta-3)"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <h1 className="mt-4 font-medium text-(--color-tinta)">
            No se pudo aceptar la invitación
          </h1>
          <p role="alert" className="mt-2 text-sm text-(--color-tinta-2)">
            {error}
          </p>

          <p className="mt-4 text-xs text-(--color-tinta-3)">
            Está usando la cuenta <strong>{user.email}</strong>. Si la invitación se envió a
            otra dirección, cierre sesión y entre con esa.
          </p>

          <Link
            href="/panel"
            className="mt-5 inline-block text-sm text-(--color-acento) underline-offset-2 hover:underline"
          >
            Ir a mis instituciones
          </Link>
        </div>
      </div>
    </main>
  );
}
