'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { clientIp, consumeRateLimit, userAgent } from '@/lib/security/rate-limit';
import type { Json } from '@/lib/db/database.types';

/**
 * Ingreso al sistema.
 *
 * Tres decisiones que conviene no revertir sin pensarlo:
 *
 *  1. UN SOLO MENSAJE DE ERROR para credenciales incorrectas, cuenta inexistente
 *     y cuenta deshabilitada. Distinguirlos convierte el formulario en un
 *     verificador de qué médicos trabajan en qué clínica.
 *
 *  2. EL LÍMITE VA POR CORREO, no sólo por IP. Un ataque de fuerza bruta serio
 *     rota direcciones; lo que no puede rotar es la cuenta que quiere abrir.
 *
 *  3. EL DESTINO DE REDIRECCIÓN SE VALIDA. `?siguiente=` viene de la URL, y
 *     aceptarlo tal cual permitiría enviar al usuario recién autenticado a un
 *     dominio ajeno que imite SaniTi.
 */

const esquema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
  siguiente: z.string().optional(),
});

export type EstadoIngreso = {
  error?: string;
  requiereMfa?: boolean;
  campo?: 'email' | 'password';
};

const ERROR_GENERICO = 'Correo o contraseña incorrectos.';

/** Sólo rutas internas: descarta `//evil.com`, `https://…` y `/\evil.com`. */
function destinoSeguro(siguiente: string | undefined): string {
  if (!siguiente) return '/panel';
  if (!siguiente.startsWith('/')) return '/panel';
  if (siguiente.startsWith('//') || siguiente.startsWith('/\\')) return '/panel';
  return siguiente;
}

export async function iniciarSesion(
  _prev: EstadoIngreso,
  formData: FormData
): Promise<EstadoIngreso> {
  const parsed = esquema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    siguiente: formData.get('siguiente'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: issue.path[0] as 'email' | 'password' };
  }

  const { email, password, siguiente } = parsed.data;
  const ip = await clientIp();
  const ua = await userAgent();

  // 5 intentos por correo cada 15 minutos, y un techo por IP para frenar el
  // barrido de muchas cuentas desde un mismo origen.
  const porCorreo = await consumeRateLimit(`login:email:${email}`, 5, 900);
  const porIp = await consumeRateLimit(`login:ip:${ip}`, 30, 900);

  if (!porCorreo.allowed || !porIp.allowed) {
    await registrarEvento(email, 'login_failed', false, ip, ua, { motivo: 'rate_limit' });
    return {
      error:
        'Demasiados intentos fallidos. Espere unos minutos antes de volver a intentarlo.',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await registrarEvento(email, 'login_failed', false, ip, ua, {
      motivo: error?.message ?? 'sin_usuario',
    });
    return { error: ERROR_GENERICO, campo: 'password' };
  }

  // Con MFA activo, signInWithPassword deja la sesión en nivel aal1. El acceso
  // a datos clínicos exige aal2, así que aquí se desvía al segundo factor.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
    await registrarEvento(email, 'mfa_challenge', true, ip, ua, {});
    redirect(`/verificar?siguiente=${encodeURIComponent(destinoSeguro(siguiente))}`);
  }

  await registrarEvento(email, 'login', true, ip, ua, {});

  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.user.id);

  redirect(destinoSeguro(siguiente));
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    await registrarEvento(user.email, 'logout', true, await clientIp(), await userAgent(), {});
  }

  await supabase.auth.signOut();
  redirect('/ingresar');
}

/**
 * Los eventos de autenticación se escriben con la clave de servicio: un intento
 * fallido ocurre justamente cuando no hay sesión con la que escribir nada.
 */
async function registrarEvento(
  email: string,
  action: string,
  succeeded: boolean,
  ip: string,
  ua: string,
  detail: Record<string, Json>
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('record_auth_event', {
      p_email: email,
      p_action: action,
      p_succeeded: succeeded,
      p_ip: ip,
      p_user_agent: ua,
      p_detail: detail,
    });
  } catch (err) {
    console.error('[auth] no se pudo registrar el evento', err);
  }
}
