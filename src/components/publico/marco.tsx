import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

/**
 * Cabecera y pie de las páginas abiertas al público: portada, precios y legales.
 *
 * Están aquí y no copiados en cada página porque los enlaces del pie son una
 * obligación, no decoración: si la política de privacidad cambia de ruta y una
 * de las copias se queda atrás, queda una página pública anunciando un aviso
 * legal que ya no existe.
 */

export function CabeceraPublica() {
  return (
    // `no-imprimir` porque las páginas legales se imprimen para archivarlas
    // junto al consentimiento del paciente, y en papel la barra de navegación
    // sólo ocupa el sitio del texto que hay que leer.
    <header className="no-imprimir sticky top-0 z-40 border-b border-(--color-borde) bg-(--color-lienzo)/85 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo size={30} />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/precios"
            className="rounded-(--radius-md) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta)"
          >
            Precios
          </Link>
          <Link
            href="/ingresar"
            className="rounded-(--radius-md) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta)"
          >
            Ingresar
          </Link>
          <Link
            href="/registro"
            className="rounded-(--radius-md) bg-(--color-acento) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
          >
            Empezar
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className="border-t border-(--color-borde) bg-(--color-superficie)">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-(--color-tinta-3) sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} SaniTi</p>
        <div className="flex gap-6">
          <Link href="/legal/privacidad" className="hover:text-(--color-tinta-2)">
            Política de privacidad
          </Link>
          <Link href="/legal/terminos" className="hover:text-(--color-tinta-2)">
            Términos
          </Link>
        </div>
      </div>
    </footer>
  );
}
