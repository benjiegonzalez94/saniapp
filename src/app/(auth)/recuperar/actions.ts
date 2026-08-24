'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { clientIp, consumeRateLimit } from '@/lib/security/rate-limit';

/**
 * Recuperación de contraseña.
 *
 * La respuesta es SIEMPRE la misma, exista la cuenta o no. Un formulario que
 * distinga «le enviamos el enlace» de «esa cuenta no existe» convierte la
 * recuperación en un verificador de direcciones: basta probar correos para
 * averiguar quién trabaja en la clínica.
 *
 * El límite va por correo y no sólo por IP: quien quiera inundar el buzón de
 * una persona concreta cambiando de red no lo consigue.
 */

const esquema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
});

export type EstadoRecuperacion = { error?: string; enviado?: boolean };

export async function solicitarRecuperacion(
  _prev: EstadoRecuperacion,
  formData: FormData
): Promise<EstadoRecuperacion> {
  const parsed = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const { email } = parsed.data;
  const ip = await clientIp();

  const porCorreo = await consumeRateLimit(`recuperar:email:${email}`, 3, 3600);
  const porIp = await consumeRateLimit(`recuperar:ip:${ip}`, 10, 3600);

  // Incluso al frenar se responde «enviado»: decir «demasiados intentos»
  // confirmaría que la dirección existe.
  if (!porCorreo.allowed || !porIp.allowed) return { enviado: true };

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/recuperar/nueva`,
  });

  if (error) {
    // Se registra para poder diagnosticar, pero no se le cuenta al usuario.
    console.error('[recuperar] fallo al enviar el correo', error.message);
  }

  return { enviado: true };
}

const esquemaNueva = z
  .object({
    password: z
      .string()
      .min(12, 'La contraseña debe tener al menos 12 caracteres')
      .max(200),
    confirmacion: z.string(),
  })
  .refine((d) => d.password === d.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  });

export type EstadoNuevaClave = { error?: string; campo?: string; exito?: boolean };

/**
 * Fija la contraseña nueva.
 *
 * Requiere que el enlace del correo haya establecido ya la sesión de
 * recuperación: `updateUser` actúa sobre el usuario autenticado. Si alguien
 * llega aquí sin esa sesión, no hay a quién cambiarle nada y se dice.
 */
export async function fijarNuevaClave(
  _prev: EstadoNuevaClave,
  formData: FormData
): Promise<EstadoNuevaClave> {
  const parsed = esquemaNueva.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]) };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        'El enlace ha caducado o ya se usó. Solicite uno nuevo desde «¿Olvidó su contraseña?».',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (/password/i.test(error.message)) {
      return {
        error: 'La contraseña no cumple la política mínima de 12 caracteres.',
        campo: 'password',
      };
    }
    return { error: 'No se pudo actualizar la contraseña. Inténtelo de nuevo.' };
  }

  return { exito: true };
}
