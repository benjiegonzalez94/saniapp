import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SaniTi · Gestión clínica',
    template: '%s · SaniTi',
  },
  description:
    'Plataforma de gestión para clínicas, hospitales y consultorios: historia clínica, ' +
    'agenda, resultados y comunicación con pacientes.',
  applicationName: 'SaniTi',
  // Los expedientes clínicos no se indexan. Nunca.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sin límite de zoom: hay quien necesita ampliar para leer una dosis, y
  // bloquearlo es una barrera de accesibilidad, no una decisión de diseño.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1d21' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-EC" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-(--color-superficie) focus:px-4 focus:py-2 focus:shadow-(--shadow-flotante)"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
