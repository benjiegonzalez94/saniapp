import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import type { AllergySeverity } from '@/lib/db/types';

/**
 * Recetas.
 *
 * Se entregan en papel, así que el folio y la firma no son adorno: son lo que
 * hace que una farmacia la acepte y lo que permite rastrearla después. El folio
 * lo asigna la base de forma correlativa por institución (trigger
 * prescriptions_assign_folio) para que dos médicos prescribiendo a la vez no
 * reciban el mismo número.
 *
 * La comprobación de alergias se hace en la base, con public.verificar_alergias,
 * y no aquí: así cualquier camino que prescriba consulta la misma verdad.
 */

export type AvisoAlergia = {
  medicationCode: string;
  medicationName: string;
  allergySubstance: string;
  allergySeverity: AllergySeverity;
  allergyReaction: string | null;
  /** 'directa' = el mismo fármaco. 'familia' = pariente con reactividad cruzada. */
  matchKind: 'directa' | 'familia';
};

export type RenglonReceta = {
  medicationCode: string | null;
  medication: string;
  presentation?: string | null;
  dose: string;
  route?: string | null;
  frequency: string;
  duration?: string | null;
  quantity?: string | null;
  instructions?: string | null;
};

export type RecetaResumen = {
  id: string;
  folio: number;
  createdAt: string;
  signedAt: string | null;
  prescriberName: string;
  itemCount: number;
};

export type RecetaCompleta = {
  id: string;
  folio: number;
  createdAt: string;
  signedAt: string | null;
  notes: string | null;
  prescriberName: string;
  prescriberLicense: string | null;
  prescriberSpecialty: string | null;
  items: RenglonReceta[];
};

/** Cruza lo que se va a prescribir con las alergias activas del paciente. */
export async function verificarAlergias(
  patientId: string,
  codigos: string[]
): Promise<AvisoAlergia[]> {
  if (codigos.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verificar_alergias', {
    p_patient_id: patientId,
    p_medication_codes: codigos,
  });

  if (error) throw error;

  return (data ?? []).map((a) => ({
    medicationCode: a.medication_code,
    medicationName: a.medication_name,
    allergySubstance: a.allergy_substance,
    allergySeverity: a.allergy_severity,
    allergyReaction: a.allergy_reaction,
    matchKind: a.match_kind === 'directa' ? 'directa' : 'familia',
  }));
}

export class AlergiaBloqueanteError extends Error {
  readonly avisos: AvisoAlergia[];
  /** false = muro sin puerta; true = el médico puede asumirlo y reintentar. */
  readonly asumible: boolean;

  constructor(avisos: AvisoAlergia[], asumible: boolean) {
    super('La receta choca con una alergia registrada del paciente');
    this.name = 'AlergiaBloqueanteError';
    this.avisos = avisos;
    this.asumible = asumible;
  }
}

/** Identifica un aviso concreto para poder marcarlo como asumido. */
export function claveAviso(a: AvisoAlergia): string {
  return `${a.medicationCode}:${a.allergySubstance}`;
}

/**
 * Emite una receta.
 *
 * DÓNDE SE PONE LA LÍNEA DEL BLOQUEO
 *
 * Sólo un caso es infranqueable: **el mismo fármaco con alergia de riesgo
 * vital**. Prescribir en consulta externa el medicamento exacto que provocó una
 * anafilaxia no tiene escenario clínico que lo justifique.
 *
 * Todo lo demás —alergias severas por familia, moderadas, leves— avisa y se
 * puede asumir. La razón no es laxitud: el médico sabe cosas que el registro no
 * dice, como que la "alergia a penicilina" anotada en la infancia fue un
 * exantema viral mal atribuido. Bloquear su criterio con un muro produce el peor
 * resultado posible: que abandone el sistema y vuelva a receta de papel, donde
 * no hay aviso ninguno.
 *
 * Asumir un aviso no es gratis: queda en la bitácora quién lo hizo, sobre qué
 * fármaco y contra qué alergia.
 */
export async function emitirReceta(
  tenantId: string,
  patientId: string,
  prescriberId: string,
  datos: {
    items: RenglonReceta[];
    notes?: string | null;
    firmar: boolean;
    /** Avisos que el médico ya vio y decidió asumir. */
    avisosAceptados?: string[];
  }
): Promise<{ id: string; folio: number }> {
  const supabase = await createClient();

  const codigos = datos.items
    .map((i) => i.medicationCode)
    .filter((c): c is string => Boolean(c));

  const avisos = await verificarAlergias(patientId, codigos);

  // Único muro sin puerta: mismo fármaco, riesgo vital.
  const infranqueables = avisos.filter(
    (a) => a.matchKind === 'directa' && a.allergySeverity === 'mortal'
  );
  if (infranqueables.length > 0) {
    throw new AlergiaBloqueanteError(infranqueables, false);
  }

  const pendientes = avisos.filter(
    (a) => !datos.avisosAceptados?.includes(claveAviso(a))
  );
  if (pendientes.length > 0) {
    throw new AlergiaBloqueanteError(pendientes, true);
  }

  const { data: receta, error: errReceta } = await supabase
    .from('prescriptions')
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      prescriber_id: prescriberId,
      notes: datos.notes?.trim() || null,
    })
    .select('id, folio')
    .single();

  if (errReceta) throw errReceta;

  const { error: errItems } = await supabase.from('prescription_items').insert(
    datos.items.map((i) => ({
      tenant_id: tenantId,
      prescription_id: receta.id,
      medication_code: i.medicationCode,
      medication: i.medication.trim(),
      presentation: i.presentation?.trim() || null,
      dose: i.dose.trim(),
      route: i.route?.trim() || null,
      frequency: i.frequency.trim(),
      duration: i.duration?.trim() || null,
      quantity: i.quantity?.trim() || null,
      instructions: i.instructions?.trim() || null,
    }))
  );
  if (errItems) throw errItems;

  if (datos.firmar) {
    const { error } = await supabase.rpc('sign_clinical_record', {
      p_table: 'prescriptions',
      p_id: receta.id,
    });
    if (error) throw error;
  }

  // Si se llegó aquí con avisos, es porque el médico los asumió. Eso va al
  // resumen del evento y no sólo a los metadatos: quien revise la bitácora debe
  // verlo sin abrir el detalle.
  const asumidos = avisos.map((a) => `${a.medicationName} vs ${a.allergySubstance}`);

  await audit({
    action: datos.firmar ? 'sign' : 'create',
    resourceType: 'prescriptions',
    resourceId: receta.id,
    tenantId,
    patientId,
    summary:
      `Emitió la receta N.º ${receta.folio} con ${datos.items.length} medicamento(s)` +
      (asumidos.length > 0
        ? ` — ASUMIÓ ${asumidos.length} aviso(s) de alergia: ${asumidos.join('; ')}`
        : ''),
    metadata: {
      folio: receta.folio!,
      medicamentos: datos.items.map((i) => i.medication),
      avisos_asumidos: asumidos,
    },
  });

  return { id: receta.id, folio: receta.folio! };
}

export async function listarRecetas(
  tenantId: string,
  patientId: string,
  limite = 20
): Promise<RecetaResumen[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prescriptions')
    .select(
      'id, folio, created_at, signed_at, prescriber:profiles!prescriptions_prescriber_id_fkey(full_name), items:prescription_items(id)'
    )
    .eq('tenant_id', tenantId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw error;

  type Fila = {
    id: string;
    folio: number | null;
    created_at: string;
    signed_at: string | null;
    prescriber: { full_name: string } | null;
    items: { id: string }[];
  };

  return (data as unknown as Fila[]).map((r) => ({
    id: r.id,
    folio: r.folio!,
    createdAt: r.created_at,
    signedAt: r.signed_at,
    prescriberName: r.prescriber?.full_name ?? 'Desconocido',
    itemCount: r.items.length,
  }));
}

/** Carga una receta completa para verla o imprimirla. */
export async function obtenerReceta(
  tenantId: string,
  prescriptionId: string
): Promise<(RecetaCompleta & { patientId: string }) | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prescriptions')
    .select(
      'id, folio, patient_id, created_at, signed_at, notes, prescriber:profiles!prescriptions_prescriber_id_fkey(full_name, license_number, specialty), items:prescription_items(medication_code, medication, presentation, dose, route, frequency, duration, quantity, instructions)'
    )
    .eq('tenant_id', tenantId)
    .eq('id', prescriptionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type Fila = {
    id: string;
    folio: number | null;
    patient_id: string;
    created_at: string;
    signed_at: string | null;
    notes: string | null;
    prescriber: {
      full_name: string;
      license_number: string | null;
      specialty: string | null;
    } | null;
    items: Array<{
      medication_code: string | null;
      medication: string;
      presentation: string | null;
      dose: string;
      route: string | null;
      frequency: string;
      duration: string | null;
      quantity: string | null;
      instructions: string | null;
    }>;
  };
  const r = data as unknown as Fila;

  await audit({
    action: 'read',
    resourceType: 'prescriptions',
    resourceId: prescriptionId,
    tenantId,
    patientId: r.patient_id,
    summary: `Abrió la receta N.º ${r.folio}`,
  });

  return {
    id: r.id,
    folio: r.folio!,
    patientId: r.patient_id,
    createdAt: r.created_at,
    signedAt: r.signed_at,
    notes: r.notes,
    prescriberName: r.prescriber?.full_name ?? 'Desconocido',
    prescriberLicense: r.prescriber?.license_number ?? null,
    prescriberSpecialty: r.prescriber?.specialty ?? null,
    items: r.items.map((i) => ({
      medicationCode: i.medication_code,
      medication: i.medication,
      presentation: i.presentation,
      dose: i.dose,
      route: i.route,
      frequency: i.frequency,
      duration: i.duration,
      quantity: i.quantity,
      instructions: i.instructions,
    })),
  };
}
