import 'server-only';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Limitador de intentos, respaldado por Postgres.
 *
 * Se usa la clave de servicio porque estos límites protegen operaciones PREVIAS
 * a la autenticación —ingreso, recuperación de contraseña—, donde el usuario
 * todavía es anónimo. El RPC está concedido sólo a service_role justamente para
 * que nadie pueda quemar el cupo de otra cuenta desde el navegador.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetsAt: Date | null;
};

export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_secs: windowSeconds,
    })
    .single<{ allowed: boolean; remaining: number; resets_at: string }>();

  if (error || !data) {
    // Si el limitador no responde, se deja pasar. La alternativa —denegar—
    // convertiría una incidencia de la base en un apagón total del ingreso,
    // y dejar sin acceso a una clínica entera es peor que un rato sin freno.
    console.error('[límite] no se pudo consultar el contador', error?.message);
    return { allowed: true, remaining: limit, resetsAt: null };
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining,
    resetsAt: new Date(data.resets_at),
  };
}

/**
 * IP del cliente a partir de las cabeceras del proxy.
 *
 * Sólo es de fiar si el despliegue está detrás de un proxy que las reescribe
 * (Vercel, Cloudflare). Expuesto directamente a internet, `x-forwarded-for` lo
 * pone quien quiera, así que el límite por IP sería trivial de evadir. Por eso
 * los límites importantes van SIEMPRE por identificador —el correo—, y la IP se
 * usa sólo como señal adicional.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    // El primer valor es el cliente original; el resto son los proxies.
    return forwarded.split(',')[0]!.trim();
  }
  return h.get('x-real-ip') ?? '0.0.0.0';
}

export async function userAgent(): Promise<string> {
  const h = await headers();
  return (h.get('user-agent') ?? 'desconocido').slice(0, 500);
}
