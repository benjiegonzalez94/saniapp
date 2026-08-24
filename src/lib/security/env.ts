import { z } from 'zod';

/**
 * Validación de la configuración.
 *
 * Un despliegue con una variable mal puesta debe caerse al arrancar con un
 * mensaje claro, no descubrirse tres semanas después porque los recordatorios
 * no salían o —peor— porque algo se guardó sin cifrar.
 *
 * La comprobación es perezosa a propósito: `next build` evalúa los módulos sin
 * los secretos de producción, y no queremos que la compilación falle por ello.
 */

const base64Key = (bits: number) =>
  z
    .string()
    .refine((v) => {
      try {
        return Buffer.from(v, 'base64').length === bits / 8;
      } catch {
        return false;
      }
    }, `debe ser ${bits} bits en base64 (genere una con: openssl rand -base64 ${bits / 8})`);

const serverSchema = z.object({
  // --- Supabase ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('debe ser una URL completa'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Ignora RLS por completo. Sólo para webhooks y jobs; jamás en código que
  // atienda una petición de usuario.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // --- Criptografía ---
  SANITI_ENCRYPTION_KEYS: z.string().refine((v) => {
    try {
      const parsed = JSON.parse(v) as Record<string, string>;
      const entries = Object.entries(parsed);
      return (
        entries.length > 0 &&
        entries.every(
          ([k, val]) =>
            Number.isInteger(Number(k)) &&
            Number(k) >= 1 &&
            typeof val === 'string' &&
            Buffer.from(val, 'base64').length === 32
        )
      );
    } catch {
      return false;
    }
  }, 'debe ser un JSON {"1":"<clave de 32 bytes en base64>"}'),
  SANITI_ACTIVE_KEY_VERSION: z.coerce.number().int().positive().optional(),
  SANITI_BLIND_INDEX_KEY: base64Key(256),

  // --- WhatsApp Cloud API (Meta) ---
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  // Se compara con el `hub.verify_token` del alta del webhook.
  WHATSAPP_VERIFY_TOKEN: z.string().min(16).optional(),
  // Secreto de la app, para validar la firma X-Hub-Signature-256 de cada evento.
  WHATSAPP_APP_SECRET: z.string().min(16).optional(),

  // --- Entorno ---
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuración inválida. Revise su .env contra .env.example:\n${detail}`
    );
  }

  cached = result.data;
  return cached;
}

/** Limpia la caché. Sólo para pruebas. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Comprueba que WhatsApp esté completamente configurado antes de usarlo.
 * Cada campo es opcional por separado para poder desplegar sin WhatsApp, pero
 * media configuración es peor que ninguna: el webhook aceptaría eventos que no
 * puede verificar.
 */
export function whatsappConfig() {
  const env = serverEnv();
  const missing = (
    [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
    ] as const
  ).filter((k) => !env[k]);

  if (missing.length > 0) {
    return { configured: false as const, missing };
  }

  return {
    configured: true as const,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: env.WHATSAPP_ACCESS_TOKEN!,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN!,
    appSecret: env.WHATSAPP_APP_SECRET!,
  };
}

/** Variables seguras de exponer al navegador. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;
