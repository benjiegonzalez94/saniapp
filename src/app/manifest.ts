import type { MetadataRoute } from 'next';

/**
 * Manifiesto web: permite instalar SaniTi en la pantalla de inicio del móvil.
 *
 * Importa para el caso de uso real: un médico que pasa visita con la tableta en
 * la mano abre la agenda como una aplicación, sin barra de direcciones ni
 * pestañas de por medio.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SaniTi · Gestión clínica',
    short_name: 'SaniTi',
    description:
      'Historia clínica, agenda y resultados para clínicas, hospitales y consultorios.',
    start_url: '/panel',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#189a94',
    lang: 'es-EC',
    dir: 'ltr',
    categories: ['medical', 'health', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // `maskable` deja que Android recorte el icono a la forma del sistema sin
      // comerse el glifo: el cubo ya reserva margen suficiente alrededor.
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
