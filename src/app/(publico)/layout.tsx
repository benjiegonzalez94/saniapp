import { CabeceraPublica, PiePublico } from '@/components/publico/marco';

/**
 * Marco de las páginas públicas. El `id` del contenido es el destino del enlace
 * «Saltar al contenido» del layout raíz: sin él, quien navega con teclado tiene
 * que recorrer la cabecera entera en cada página.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--color-lienzo)">
      <CabeceraPublica />
      <main id="contenido">{children}</main>
      <PiePublico />
    </div>
  );
}
