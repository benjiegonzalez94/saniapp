import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Proxy de seguridad. Se ejecuta antes que cualquier página o ruta de API y
 * hace tres cosas, en este orden:
 *
 *   1. Refresca la sesión de Supabase (el token caduca y sin esto el usuario
 *      sería expulsado a mitad de una consulta médica).
 *   2. Bloquea el acceso anónimo a las zonas privadas.
 *   3. Aplica las cabeceras de seguridad, incluida una CSP con nonce.
 */

const PUBLIC_PATHS = [
  '/',
  '/precios',
  '/ingresar',
  '/registro',
  '/recuperar',
  '/legal/privacidad',
  '/legal/terminos',
];

/** Rutas de API que se autentican por firma, no por cookie de sesión. */
const WEBHOOK_PREFIXES = ['/api/webhooks/'];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    WEBHOOK_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/auth/callback')
  );
}

function securityHeaders(response: NextResponse, nonce: string, isPrivate: boolean): NextResponse {
  const h = response.headers;

  // `strict-dynamic` con nonce: los scripts que Next inyecta cargan porque
  // llevan el nonce, y cualquier script inyectado por un atacante no.
  // `unsafe-inline` queda como respaldo para navegadores sin soporte de
  // strict-dynamic, que lo ignoran cuando sí lo soportan.
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    // Tailwind inyecta estilos en línea; no hay forma de aplicarles nonce.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // Supabase: API REST, tiempo real (wss) y almacenamiento.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Ninguna página de SaniTi debe poder embeberse: evita el clickjacking
    // sobre botones que firman recetas o revocan consentimientos.
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  h.set('Content-Security-Policy', csp);
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  // Las URLs de SaniTi llevan identificadores de paciente. `no-referrer` impide
  // que se filtren a cualquier sitio externo que se abra desde la aplicación.
  h.set('Referrer-Policy', 'no-referrer');
  h.set('X-DNS-Prefetch-Control', 'off');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  h.set(
    'Permissions-Policy',
    // La cámara queda habilitada en el propio origen: se usa para fotografiar
    // documentos y resultados en papel desde el móvil.
    'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  if (isPrivate) {
    // Las clínicas comparten computadoras entre turnos. Sin esto, el botón
    // "atrás" del navegador muestra la historia clínica del paciente anterior
    // a quien se siente después.
    h.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    h.set('Pragma', 'no-cache');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() y no getSession(): getSession lee la cookie sin validarla contra
  // el servidor de autenticación, así que un JWT manipulado la engañaría.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicRoute = isPublic(pathname);

  if (!user && !publicRoute) {
    const login = request.nextUrl.clone();
    login.pathname = '/ingresar';
    // Se conserva el destino para volver tras autenticarse, pero sólo la ruta
    // relativa: aceptar una URL absoluta abriría un redirect abierto.
    login.search = `?siguiente=${encodeURIComponent(pathname)}`;
    return securityHeaders(NextResponse.redirect(login), nonce, false);
  }

  if (user && (pathname === '/ingresar' || pathname === '/registro')) {
    const home = request.nextUrl.clone();
    home.pathname = '/panel';
    home.search = '';
    return securityHeaders(NextResponse.redirect(home), nonce, true);
  }

  return securityHeaders(response, nonce, !publicRoute);
}

export const config = {
  matcher: [
    /*
     * Todo salvo los estáticos de Next y los archivos de imagen, que no llevan
     * datos de pacientes y no necesitan pasar por la comprobación de sesión.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
