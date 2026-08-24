'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { clientIp, consumeRateLimit, userAgent } from '@/lib/security/rate-limit';
import type { Json } from '@/lib/db/database.types';

/**
 * Alta de cuenta.
 *
 * Tres decisiones que conviene no revertir:
 *
 *  1. NO SE DICE SI EL CORREO YA EXISTE. Un formulario de registro que responde
 *     «esa cuenta ya está registrada» es un verificador de qué médicos trabajan
 *     en qué clínica. Ante un correo repetido se responde exactamente igual que
 *     ante uno nuevo, y quien ya tenga cuenta recibirá un aviso por correo.
 *
 *  2. LA CONTRASEÑA MÍNIMA SON 12 CARACTERES, sin exigir composición. Es la
 *     política de supabase/config.toml y sigue la guía NIST 800-63B: la
 *     longitud aporta más entropía real que obligar a meter un símbolo.
 *
 *  3. EL PERFIL LO CREA UN TRIGGER (`on_auth_user_created`, migración 0002), no
 *     esta acción. Así una cuenta creada por cualquier vía —invitación, panel
 *     de Supabase, un script— tiene siempre su perfil.
 */

const esquema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'Escriba su nombre completo')
      .max(160, 'Nombre demasiado largo'),
    email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
    password: z
      .string()
      .min(12, 'La contraseña debe tener al menos 12 caracteres')
      .max(200, 'Contraseña demasiado larga'),
    confirmacion: z.string(),
    aceptaTerminos: z.coerce.boolean(),
  })
  .refine((d) => d.password === d.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  });

export type EstadoRegistro = {
  error?: string;
  campo?: string;
  valores?: Record<string, string>;
  exito?: boolean;
};

export async function registrarCuenta(
  _prev: EstadoRegistro,
  formData: FormData
): Promise<EstadoRegistro> {
  const crudo = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = esquema.safeParse({
    ...crudo,
    aceptaTerminos: crudo.aceptaTerminos === 'on',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return {
      error: issue.message,
      campo: String(issue.path[0]),
      // La contraseña nunca se devuelve al formulario.
      valores: { fullName: crudo.fullName ?? '', email: crudo.email ?? '' },
    };
  }

  const { fullName, email, password, aceptaTerminos } = parsed.data;

  if (!aceptaTerminos) {
    return {
      error: 'Debe aceptar los términos y la política de privacidad para continuar.',
      campo: 'aceptaTerminos',
      valores: { fullName, email },
    };
  }

  const ip = await clientIp();
  const ua = await userAgent();

  // Sin freno, este formulario es una fábrica de cuentas: 3 por IP cada hora.
  const limite = await consumeRateLimit(`registro:ip:${ip}`, 3, 3600);
  if (!limite.allowed) {
    return {
      error: 'Demasiados registros desde esta conexión. Inténtelo más tarde.',
      valores: { fullName, email },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El trigger on_auth_user_created lee full_name de aquí.
      data: { full_name: fullName },
    },
  });

  if (error) {
    await registrarEventoAuth(email, 'login_failed', false, ip, ua, {
      motivo: `registro: ${error.message}`,
    });

    // Un correo ya registrado NO se distingue de otros fallos: ver la nota 1.
    if (/already registered|already exists|user_already_exists/i.test(error.message)) {
      return { exito: true };
    }

    // Los fallos de política de contraseña sí son útiles: el usuario puede
    // corregirlos y no revelan nada sobre quién tiene cuenta.
    if (/password/i.test(error.message)) {
      return {
        error: 'La contraseña no cumple la política mínima de 12 caracteres.',
        campo: 'password',
        valores: { fullName, email },
      };
    }

    return {
      error: 'No se pudo crear la cuenta. Inténtelo de nuevo en unos minutos.',
      valores: { fullName, email },
    };
  }

  await registrarEventoAuth(email, 'login', true, ip, ua, { via: 'registro' });

  // Con confirmación por correo desactivada (desarrollo), signUp deja sesión
  // iniciada y se puede entrar directo. Con ella activada (producción), no hay
  // sesión hasta confirmar y hay que mostrar el aviso.
  if (data.session) {
    redirect('/panel');
  }

  return { exito: true };
}

async function registrarEventoAuth(
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
    console.error('[registro] no se pudo registrar el evento', err);
  }
}
