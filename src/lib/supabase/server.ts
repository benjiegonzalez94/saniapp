import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/db/database.types';

import { publicEnv, serverEnv } from '@/lib/security/env';

/**
 * Cliente de Supabase para el servidor, atado a la sesión del usuario.
 *
 * Usa SIEMPRE éste en cualquier código que atienda una petición: las consultas
 * viajan como rol `authenticated` y quedan sujetas a RLS, que es lo que
 * garantiza el aislamiento entre instituciones. Si una consulta con este cliente
 * devuelve datos de otro tenant, hay un fallo en una política, no en la UI.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. El middleware ya
          // refresca la sesión en cada petición, así que este caso es benigno.
        }
      },
    },
  });
}

/**
 * Cliente con la clave de servicio. IGNORA RLS POR COMPLETO.
 *
 * Sólo para código sin usuario detrás: el webhook de WhatsApp, el worker de
 * recordatorios y los webhooks de facturación. Nunca en una Server Action ni en
 * un Server Component que atienda a una persona: ahí se pierde el aislamiento
 * entre instituciones y con él toda la seguridad del sistema.
 *
 * Cada llamada debe fijar por su cuenta el tenant al que corresponde y auditar
 * lo que haga, porque la base ya no lo hará por ella.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const env = serverEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
