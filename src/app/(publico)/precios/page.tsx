import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, ShieldCheck } from 'lucide-react';

import { PorCompletar } from '@/components/publico/documento-legal';
import { listarPlanesPublicos, type PlanPublico } from '@/lib/db/billing';
import { formatMoney } from '@/lib/utils';

export const metadata: Metadata = { title: 'Precios' };
export const dynamic = 'force-dynamic';

const INTERVALO: Record<PlanPublico['billingInterval'], string> = {
  mensual: 'al mes',
  anual: 'al año',
};

const FORMATO_ENTERO = new Intl.NumberFormat('es-EC');

/**
 * Qué incluye cada plan, a partir de `limits`.
 *
 * La clave ausente significa «sin límite» y así se anuncia. El plan hospital
 * tiene el objeto vacío a propósito: dejar ahí una lista en blanco haría pensar
 * que es el plan que menos ofrece, justo lo contrario de lo que es.
 */
function topesDelPlan(plan: PlanPublico): string[] {
  const { patients, storageGb, whatsappMsgs } = plan.limits;

  return [
    patients === null
      ? 'Pacientes sin límite'
      : `Hasta ${FORMATO_ENTERO.format(patients)} pacientes`,
    storageGb === null
      ? 'Almacenamiento sin límite'
      : `${FORMATO_ENTERO.format(storageGb)} GB para estudios y documentos`,
    whatsappMsgs === null
      ? 'Mensajes de WhatsApp sin límite'
      : `${FORMATO_ENTERO.format(whatsappMsgs)} mensajes de WhatsApp al mes`,
  ];
}

function usuariosDelPlan(plan: PlanPublico): string[] {
  const incluidos =
    plan.includedSeats === 1
      ? '1 usuario incluido'
      : `${FORMATO_ENTERO.format(plan.includedSeats)} usuarios incluidos`;

  // Un precio de asiento extra en cero no significa que el asiento sea gratis,
  // sino que el plan no vende asientos sueltos. Anunciarlo como «gratis» sería
  // una promesa que la facturación no cumple.
  if (plan.extraSeatCents === 0) return [incluidos];

  return [
    incluidos,
    `Usuario adicional: ${formatMoney(plan.extraSeatCents, plan.currency)} ${INTERVALO[plan.billingInterval]}`,
  ];
}

export default async function PaginaPrecios() {
  const planes = await listarPlanesPublicos();

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-(--color-tinta) sm:text-4xl">
            Planes y precios
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-(--color-tinta-2)">
            Un precio por institución, no por paciente atendido. Se cobra en dólares y se
            factura desde el Ecuador.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        {planes.length === 0 ? (
          <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-14 text-center">
            <p className="font-medium text-(--color-tinta)">
              El catálogo de planes no está disponible ahora mismo
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
              Escríbanos a <PorCompletar>[correo comercial]</PorCompletar> y le enviamos una
              propuesta para su institución.
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((plan) => (
              <li
                key={plan.code}
                className="flex flex-col rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie) p-6 shadow-(--shadow-tarjeta)"
              >
                <h2 id={`plan-${plan.code}`} className="font-medium text-(--color-tinta)">
                  {plan.name}
                </h2>
                {plan.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-(--color-tinta-2)">
                    {plan.description}
                  </p>
                )}

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="cifras text-3xl font-semibold tracking-tight text-(--color-tinta)">
                    {formatMoney(plan.priceCents, plan.currency)}
                  </span>
                  <span className="text-sm text-(--color-tinta-3)">
                    {INTERVALO[plan.billingInterval]}
                  </span>
                </p>

                {plan.trialDays > 0 && (
                  <p className="mt-1.5 text-xs text-(--color-tinta-3)">
                    {plan.trialDays} días de prueba, sin tarjeta de crédito
                  </p>
                )}

                <ul className="mt-6 space-y-2.5 text-sm text-(--color-tinta-2)">
                  {[...usuariosDelPlan(plan), ...topesDelPlan(plan)].map((linea) => (
                    <li key={linea} className="flex gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-(--color-acento)"
                        aria-hidden="true"
                        strokeWidth={2}
                      />
                      <span>{linea}</span>
                    </li>
                  ))}
                </ul>

                {/* mt-auto empuja la llamada a la acción al pie de la tarjeta: las
                    tres quedan alineadas aunque las descripciones midan distinto.

                    El enlace va a /registro sin arrastrar el plan: el alta no lee
                    ningún parámetro y el plan se escoge al crear la institución.
                    Enviar `?plan=` sugeriría una preselección que no ocurre. El
                    `aria-describedby` da el contexto que falta a quien oye tres
                    enlaces con el mismo texto. */}
                <div className="mt-auto pt-6">
                  <Link
                    href="/registro"
                    aria-describedby={`plan-${plan.code}`}
                    className="inline-flex h-10 w-full items-center justify-center rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
                  >
                    Empezar la prueba
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {planes.length > 0 && (
          <p className="mt-6 text-sm text-(--color-tinta-3)">
            El plan se elige al crear la institución y puede cambiarse después: ningún dato
            registrado se pierde al subir o bajar de plan.
          </p>
        )}
      </section>

      <section className="border-t border-(--color-borde) bg-(--color-superficie)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
                Cómo se cobra
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-(--color-tinta-2)">
                <li>
                  Todos los importes están en{' '}
                  <strong className="font-medium text-(--color-tinta)">
                    dólares de los Estados Unidos (USD)
                  </strong>
                  , la moneda de curso legal en el Ecuador.
                </li>
                <li>
                  El pago con tarjeta se procesa con{' '}
                  <strong className="font-medium text-(--color-tinta)">PayPhone</strong> o{' '}
                  <strong className="font-medium text-(--color-tinta)">Kushki</strong>, que
                  operan localmente; también se acepta transferencia o depósito bancario.
                  SaniTi no almacena números de tarjeta: los custodia la pasarela.
                </li>
                <li>
                  Los precios se muestran sin IVA. La factura lo añade a la tasa vigente en el
                  Ecuador —hoy el 15 %— y conserva la tasa con la que se emitió.
                </li>
                <li>
                  Los asientos se ajustan solos: cada miembro activo del equipo ocupa uno, al
                  alta y a la baja. El rol de{' '}
                  <strong className="font-medium text-(--color-tinta)">
                    auditoría no consume asiento
                  </strong>
                  , porque cobrar por él desincentivaría justo lo que queremos que se use.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
                Si una factura se atrasa
              </h2>
              <p className="mt-5 leading-relaxed text-(--color-tinta-2)">
                Una suscripción vencida{' '}
                <strong className="font-medium text-(--color-tinta)">
                  nunca bloquea la lectura ni la exportación de una historia clínica
                </strong>
                . Pasado el periodo de gracia se restringe la creación de datos nuevos y las
                funciones accesorias, jamás el acceso a lo ya registrado.
              </p>
              <p className="mt-4 leading-relaxed text-(--color-tinta-2)">
                Un impago es un problema comercial nuestro; dejar a un médico sin el
                expediente de su paciente sería un problema de seguridad del paciente.
              </p>

              <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-(--color-acento-suave) px-3 py-1 text-xs font-medium text-(--color-acento-fuerte)">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Conforme a la LOPDP del Ecuador
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
