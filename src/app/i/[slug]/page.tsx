import { redirect } from 'next/navigation';

/**
 * Raíz de una institución (/i/[slug]).
 *
 * Redirige a la vista principal (agenda del día), que es la pantalla de trabajo
 * por defecto para médicos y recepción al ingresar a la clínica.
 */
export default async function PaginaInstitucion({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/i/${slug}/agenda`);
}
