/**
 * Worker de recordatorios de cita.
 *
 *   npm run reminders          # una pasada
 *   npm run reminders:watch    # en bucle, para desarrollo
 *
 * Hace dos cosas, en este orden:
 *
 *   1. DESPACHAR — pasa los recordatorios cuya hora llegó del plan
 *      (appointment_reminders) a la cola de envío (notification_outbox), donde
 *      el trigger de consentimiento decide si pueden salir.
 *   2. ENVIAR — toma lo que hay en la cola y lo entrega al proveedor del canal.
 *
 * Sobre el envío: WhatsApp Cloud API todavía no está configurado (faltan las
 * credenciales de Meta, ver .env.example). Mientras tanto el proveedor de
 * consola imprime lo que enviaría y NO marca el mensaje como entregado. Es
 * deliberado: un stub que marcara "enviado" haría creer que los pacientes están
 * recibiendo avisos que nadie ha mandado, y eso sólo se descubre cuando un
 * paciente no aparece a su cita.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) config({ path: envLocal, quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Pendiente = {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipient: string;
  template: string;
  variables: Record<string, string>;
  body_preview: string | null;
  attempts: number;
};

type Resultado =
  | { estado: 'enviado'; idProveedor: string }
  | { estado: 'fallido'; motivo: string };

/* -------------------------------------------------------------------------- */
/* Proveedores de canal                                                        */
/* -------------------------------------------------------------------------- */

interface ProveedorMensajeria {
  readonly nombre: string;
  readonly configurado: boolean;
  enviar(m: Pendiente): Promise<Resultado>;
}

/**
 * WhatsApp Cloud API de Meta.
 *
 * Los mensajes fuera de la ventana de 24 h exigen una PLANTILLA aprobada por
 * Meta; no se puede mandar texto libre. Un recordatorio de cita siempre cae
 * fuera de esa ventana —el paciente no escribió primero—, así que va como
 * plantilla con parámetros.
 */
class WhatsAppCloud implements ProveedorMensajeria {
  readonly nombre = 'WhatsApp Cloud API';
  readonly configurado: boolean;

  constructor(
    private readonly phoneNumberId: string | undefined,
    private readonly accessToken: string | undefined
  ) {
    this.configurado = Boolean(phoneNumberId && accessToken);
  }

  async enviar(m: Pendiente): Promise<Resultado> {
    if (!this.configurado) {
      return { estado: 'fallido', motivo: 'WhatsApp Cloud API sin configurar' };
    }

    const respuesta = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: m.recipient.replace('+', ''),
          type: 'template',
          template: {
            name: m.template,
            language: { code: 'es' },
            components: [
              {
                type: 'body',
                parameters: ['paciente', 'medico', 'fecha', 'hora'].map((k) => ({
                  type: 'text',
                  text: m.variables[k] ?? '',
                })),
              },
            ],
          },
        }),
      }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      return { estado: 'fallido', motivo: `Meta devolvió ${respuesta.status}: ${detalle.slice(0, 200)}` };
    }

    const cuerpo = (await respuesta.json()) as { messages?: Array<{ id: string }> };
    return { estado: 'enviado', idProveedor: cuerpo.messages?.[0]?.id ?? 'sin-id' };
  }
}

/** Imprime en consola y falla a propósito. Ver la nota de cabecera. */
class ConsolaNoEntrega implements ProveedorMensajeria {
  readonly nombre = 'consola (sin proveedor real)';
  readonly configurado = true;

  async enviar(m: Pendiente): Promise<Resultado> {
    console.log(`    [${m.channel} → ${m.recipient}] ${m.body_preview ?? m.template}`);
    return {
      estado: 'fallido',
      motivo:
        'Sin proveedor de mensajería configurado. El mensaje NO se entregó; ' +
        'queda en la cola para reintento.',
    };
  }
}

function proveedorPara(canal: Pendiente['channel']): ProveedorMensajeria {
  if (canal === 'whatsapp') {
    const wa = new WhatsAppCloud(
      process.env.WHATSAPP_PHONE_NUMBER_ID,
      process.env.WHATSAPP_ACCESS_TOKEN
    );
    if (wa.configurado) return wa;
  }
  // SMS y correo siguen pendientes de proveedor (agregador local, ver
  // docs/ARCHITECTURE.md). Hasta entonces, nada se da por entregado.
  return new ConsolaNoEntrega();
}

/* -------------------------------------------------------------------------- */
/* Pasadas                                                                     */
/* -------------------------------------------------------------------------- */

async function despachar(): Promise<number> {
  const { data, error } = await supabase.rpc('despachar_recordatorios', { p_limite: 50 });

  if (error) {
    console.error('[recordatorios] no se pudo despachar:', error.message);
    return 0;
  }

  const filas = (data ?? []) as Array<{ reminder_id: string; outbox_status: string }>;
  const sinConsentimiento = filas.filter((f) => f.outbox_status === 'sin_consentimiento').length;

  if (filas.length > 0) {
    console.log(
      `  despachados ${filas.length}` +
        (sinConsentimiento > 0 ? ` (${sinConsentimiento} sin consentimiento)` : '')
    );
  }
  return filas.length;
}

async function enviar(): Promise<number> {
  const { data, error } = await supabase
    .from('notification_outbox')
    .select('id, channel, recipient, template, variables, body_preview, attempts')
    .eq('status', 'programado')
    .lte('scheduled_for', new Date().toISOString())
    .lt('attempts', 5)
    .order('scheduled_for')
    .limit(20);

  if (error) {
    console.error('[recordatorios] no se pudo leer la cola:', error.message);
    return 0;
  }

  const pendientes = (data ?? []) as Pendiente[];
  if (pendientes.length === 0) return 0;

  for (const m of pendientes) {
    const proveedor = proveedorPara(m.channel);
    const resultado = await proveedor.enviar(m);

    if (resultado.estado === 'enviado') {
      await supabase
        .from('notification_outbox')
        .update({
          status: 'enviado',
          sent_at: new Date().toISOString(),
          provider_message_id: resultado.idProveedor,
          attempts: m.attempts + 1,
        })
        .eq('id', m.id);

      console.log(`  ok    ${m.channel} → ${m.recipient}`);
    } else {
      // Reintento con espera creciente: 1, 2, 4, 8… minutos. Un proveedor caído
      // no debe convertirse en un martilleo.
      const esperaMin = Math.min(2 ** m.attempts, 60);
      const siguiente = new Date(Date.now() + esperaMin * 60_000).toISOString();

      await supabase
        .from('notification_outbox')
        .update({
          status: m.attempts + 1 >= 5 ? 'fallido' : 'programado',
          attempts: m.attempts + 1,
          next_attempt_at: siguiente,
          scheduled_for: siguiente,
          failed_reason: resultado.motivo,
        })
        .eq('id', m.id);

      console.log(
        `  fallo ${m.channel} → ${m.recipient}: ${resultado.motivo.slice(0, 90)}` +
          (m.attempts + 1 >= 5 ? ' [agotado]' : ` [reintenta en ${esperaMin} min]`)
      );
    }
  }

  return pendientes.length;
}

async function unaPasada(): Promise<number> {
  const despachados = await despachar();
  const enviados = await enviar();
  return despachados + enviados;
}

const enBucle = process.argv.includes('--watch');
const wa = new WhatsAppCloud(
  process.env.WHATSAPP_PHONE_NUMBER_ID,
  process.env.WHATSAPP_ACCESS_TOKEN
);

console.log(`Recordatorios · WhatsApp: ${wa.configurado ? 'configurado' : 'SIN CONFIGURAR'}`);
if (!wa.configurado) {
  console.warn(
    'AVISO: sin credenciales de Meta no se entrega nada. Los mensajes se imprimen\n' +
      '       y quedan en cola; NUNCA se marcan como enviados.'
  );
}

if (enBucle) {
  console.log('En bucle. Ctrl+C para salir.\n');
  for (;;) {
    const n = await unaPasada();
    await new Promise((r) => setTimeout(r, n > 0 ? 1_000 : 30_000));
  }
} else {
  const n = await unaPasada();
  console.log(n === 0 ? 'Nada pendiente.' : `${n} operación(es).`);
  // Sin process.exit(): en Windows, forzar la salida con conexiones HTTP aún
  // abiertas dispara una aserción de libuv ("!(handle->flags & UV_HANDLE_CLOSING)").
  // Al terminar el trabajo el bucle de eventos se vacía solo y el proceso sale
  // con código 0.
}
