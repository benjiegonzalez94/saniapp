'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/db/database.types';

import { publicEnv } from '@/lib/security/env';

let client: SupabaseClient<Database> | undefined;

/**
 * Cliente de Supabase para el navegador.
 *
 * Sólo lleva la clave anónima, que es pública por diseño: quien la tenga no
 * puede leer nada porque toda tabla está protegida por RLS y sin una sesión
 * válida no hay membresía que autorice acceso alguno.
 *
 * Se reutiliza la misma instancia entre renders para no abrir una conexión
 * de tiempo real nueva en cada uno.
 */
export function createClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
