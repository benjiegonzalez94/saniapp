import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/db/database.types';

/**
 * Catálogo de planes.
 *
 * `plans` es la única tabla de `public` que se lee sin sesión: la política
 * `plans_select_public` la abre al rol `anon` acotada a `is_active and
 * is_public`. Por eso esta consulta no repite ese filtro — hacerlo daría la
 * impresión de que es el código quien decide qué plan se publica, y el día que
 * alguien retire un plan de la base la página seguiría enseñándolo si el filtro
 * viviera aquí.
 *
 * No se audita: no hay dato personal en un catálogo de precios y registrar cada
 * visita a la página pública sólo llenaría de ruido la bitácora clínica.
 */

type PlanRow = Database['public']['Tables']['plans']['Row'];

/** Derivado del esquema real: si cambia una columna, esto deja de compilar. */
type FilaPlan = Pick<
  PlanRow,
  | 'code'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'currency'
  | 'billing_interval'
  | 'included_seats'
  | 'extra_seat_cents'
  | 'limits'
  | 'trial_days'
>;

export type TopesPlan = {
  patients: number | null;
  storageGb: number | null;
  whatsappMsgs: number | null;
};

export type PlanPublico = {
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: PlanRow['billing_interval'];
  includedSeats: number;
  extraSeatCents: number;
  trialDays: number;
  limits: TopesPlan;
};

/**
 * Un tope ausente en `limits` significa SIN LÍMITE, no cero. Devolver 0 haría
 * que el plan hospital —cuyo `limits` está vacío a propósito— se anunciara con
 * cero pacientes y cero almacenamiento.
 */
function leerTope(limites: Json, clave: string): number | null {
  if (limites === null || typeof limites !== 'object' || Array.isArray(limites)) return null;
  const valor = limites[clave];
  return typeof valor === 'number' ? valor : null;
}

// En una sola línea y sin concatenar: TypeScript ensancha a `string` el
// resultado de 'a' + 'b' y supabase-js pierde la inferencia de la fila.
const CAMPOS_PLAN =
  'code, name, description, price_cents, currency, billing_interval, included_seats, extra_seat_cents, limits, trial_days' as const;

function aPlanPublico(f: FilaPlan): PlanPublico {
  return {
    code: f.code,
    name: f.name,
    description: f.description,
    priceCents: f.price_cents,
    currency: f.currency,
    billingInterval: f.billing_interval,
    includedSeats: f.included_seats,
    extraSeatCents: f.extra_seat_cents,
    trialDays: f.trial_days,
    limits: {
      patients: leerTope(f.limits, 'patients'),
      storageGb: leerTope(f.limits, 'storage_gb'),
      whatsappMsgs: leerTope(f.limits, 'whatsapp_msgs'),
    },
  };
}

/** Planes que se muestran en la página de precios, en el orden del catálogo. */
export async function listarPlanesPublicos(): Promise<PlanPublico[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('plans')
    .select(CAMPOS_PLAN)
    .order('sort_order', { ascending: true });

  // Se propaga en lugar de devolver [] : una página de precios vacía parece un
  // producto sin planes y nadie la reporta, mientras que un error sí se ve.
  if (error) throw error;
  return (data ?? []).map(aPlanPublico);
}
