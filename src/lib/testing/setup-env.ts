/**
 * Carga .env.local antes de las pruebas.
 *
 * Las pruebas de RLS necesitan DATABASE_URL para hablar con el Postgres local
 * (`npx supabase start`), y las de criptografía necesitan las claves. Vitest no
 * lee .env.local por su cuenta.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const archivo = resolve(process.cwd(), '.env.local');
if (existsSync(archivo)) {
  config({ path: archivo, quiet: true });
}
