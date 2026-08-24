import 'server-only';

import { randomUUID } from 'node:crypto';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import { decryptField, encryptField } from '@/lib/security/crypto';
import type {
  AllergySeverity,
  DiagnosisKind,
  EncounterKind,
} from '@/lib/db/types';

/**
 * Historia clínica.
 *
 * Qué va cifrado y qué no (ver docs/SECURITY.md §4):
 *
 *   · La NARRATIVA de la nota —subjetivo, objetivo, análisis y plan— viaja
 *     cifrada como un único JSON. Ni el motivo de consulta se guarda en claro:
 *     "control de VIH" en una columna de texto es una filtración con otro
 *     nombre.
 *   · El listado del expediente NO descifra nada. Muestra fecha, tipo de
 *     atención y autor, que basta para navegar una historia cronológica. Se
 *     descifra al abrir una nota concreta, y sólo esa.
 *   · Alergias, diagnósticos y signos vitales van en claro porque alimentan
 *     alertas y gráficas: cifrados, no habría alerta que dar.
 */

export type Alergia = {
  id: string;
  substance: string;
  reaction: string | null;
  severity: AllergySeverity;
};

export type Diagnostico = {
  id: string;
  code: string;
  display: string;
  kind: DiagnosisKind;
  isChronic: boolean;
  onsetDate: string | null;
  createdAt: string;
};

export type SignosVitales = {
  id: string;
  measuredAt: string;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  temperatureC: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  oxygenSaturation: number | null;
  glucoseMgdl: number | null;
};

export type NotaResumen = {
  id: string;
  createdAt: string;
  signedAt: string | null;
  authorName: string;
  encounterKind: EncounterKind | null;
  wordCount: number | null;
  amendedBy: string | null;
  /** Sólo lo llevan las notas que son ELLAS MISMAS una enmienda. */
  amendmentReason: string | null;
};

export type ContenidoNota = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

/**
 * Todo lo que hay que ver antes de tocar al paciente: alergias, condiciones
 * crónicas y los últimos signos vitales. Se carga en una sola pasada porque es
 * lo primero que se pinta y no debe esperar a tres viajes distintos.
 */
export async function obtenerResumenClinico(
  tenantId: string,
  patientId: string
): Promise<{
  alergias: Alergia[];
  cronicos: Diagnostico[];
  ultimosVitales: SignosVitales | null;
}> {
  const supabase = await createClient();

  const [alergias, cronicos, vitales] = await Promise.all([
    supabase
      .from('allergies')
      .select('id, substance, reaction, severity')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .eq('is_active', true)
      // Lo que puede matar va primero: el orden del enum no sirve, hay que
      // ordenar por gravedad real.
      .order('severity', { ascending: false }),

    supabase
      .from('diagnoses')
      .select('id, code, display, kind, is_chronic, onset_date, created_at')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .eq('is_chronic', true)
      .is('resolved_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('vitals')
      .select(
        'id, measured_at, height_cm, weight_kg, bmi, temperature_c, heart_rate, respiratory_rate, systolic_bp, diastolic_bp, oxygen_saturation, glucose_mgdl'
      )
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (alergias.error) throw alergias.error;
  if (cronicos.error) throw cronicos.error;
  if (vitales.error) throw vitales.error;

  const v = vitales.data;

  return {
    alergias: (alergias.data ?? []).map((a) => ({
      id: a.id,
      substance: a.substance,
      reaction: a.reaction,
      severity: a.severity,
    })),
    cronicos: (cronicos.data ?? []).map((d) => ({
      id: d.id,
      code: d.code,
      display: d.display,
      kind: d.kind,
      isChronic: d.is_chronic,
      onsetDate: d.onset_date,
      createdAt: d.created_at,
    })),
    ultimosVitales: v
      ? {
          id: v.id,
          measuredAt: v.measured_at,
          heightCm: v.height_cm,
          weightKg: v.weight_kg,
          bmi: v.bmi,
          temperatureC: v.temperature_c,
          heartRate: v.heart_rate,
          respiratoryRate: v.respiratory_rate,
          systolicBp: v.systolic_bp,
          diastolicBp: v.diastolic_bp,
          oxygenSaturation: v.oxygen_saturation,
          glucoseMgdl: v.glucose_mgdl,
        }
      : null,
  };
}

/** Historial cronológico. No descifra nada. */
export async function listarNotas(
  tenantId: string,
  patientId: string,
  limite = 50
): Promise<NotaResumen[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinical_notes')
    .select(
      'id, created_at, signed_at, word_count, amended_by, amendment_reason, author:profiles!clinical_notes_author_id_fkey(full_name), encounter:encounters(kind)'
    )
    .eq('tenant_id', tenantId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw error;

  type Fila = {
    id: string;
    created_at: string;
    signed_at: string | null;
    word_count: number | null;
    amended_by: string | null;
    amendment_reason: string | null;
    author: { full_name: string } | null;
    encounter: { kind: EncounterKind } | null;
  };

  return (data as unknown as Fila[]).map((n) => ({
    id: n.id,
    createdAt: n.created_at,
    signedAt: n.signed_at,
    authorName: n.author?.full_name ?? 'Desconocido',
    encounterKind: n.encounter?.kind ?? null,
    wordCount: n.word_count,
    amendedBy: n.amended_by,
    amendmentReason: n.amendment_reason,
  }));
}

/**
 * Abre una nota y la descifra. Registra el acceso: leer una nota clínica es el
 * acto que una auditoría de protección de datos pregunta por nombre.
 */
export async function abrirNota(
  tenantId: string,
  noteId: string
): Promise<{ contenido: ContenidoNota; meta: NotaResumen; patientId: string } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinical_notes')
    .select(
      'id, patient_id, content_enc, key_version, created_at, signed_at, word_count, amended_by, amendment_reason, author:profiles!clinical_notes_author_id_fkey(full_name), encounter:encounters(kind)'
    )
    .eq('tenant_id', tenantId)
    .eq('id', noteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type Fila = {
    id: string;
    patient_id: string;
    content_enc: string;
    key_version: number;
    created_at: string;
    signed_at: string | null;
    word_count: number | null;
    amended_by: string | null;
    amendment_reason: string | null;
    author: { full_name: string } | null;
    encounter: { kind: EncounterKind } | null;
  };
  const n = data as unknown as Fila;

  const plano = decryptField(
    { ciphertext: n.content_enc, keyVersion: n.key_version },
    { table: 'clinical_notes', column: 'content', rowId: n.id }
  );

  await audit({
    action: 'read',
    resourceType: 'clinical_notes',
    resourceId: noteId,
    tenantId,
    patientId: n.patient_id,
    summary: 'Abrió una nota clínica',
  });

  return {
    contenido: JSON.parse(plano) as ContenidoNota,
    patientId: n.patient_id,
    meta: {
      id: n.id,
      createdAt: n.created_at,
      signedAt: n.signed_at,
      authorName: n.author?.full_name ?? 'Desconocido',
      encounterKind: n.encounter?.kind ?? null,
      wordCount: n.word_count,
      amendedBy: n.amended_by,
      amendmentReason: n.amendment_reason,
    },
  };
}

export type NuevaConsulta = {
  kind: EncounterKind;
  contenido: ContenidoNota;
  vitales?: Partial<Omit<SignosVitales, 'id' | 'measuredAt' | 'bmi'>>;
  diagnosticos?: Array<{ code: string; display: string; kind: DiagnosisKind; isChronic: boolean }>;
  firmar: boolean;
};

/**
 * Registra una consulta completa: atención, nota cifrada, signos vitales y
 * diagnósticos.
 *
 * No es transaccional entre las cuatro tablas —PostgREST no expone
 * transacciones multi-sentencia— así que el orden importa: primero la atención,
 * que es lo que da contexto a todo lo demás, y si algo falla después queda una
 * atención vacía y visible, no una nota huérfana sin fecha ni autor.
 */
export async function registrarConsulta(
  tenantId: string,
  patientId: string,
  authorId: string,
  datos: NuevaConsulta
): Promise<string> {
  const supabase = await createClient();
  const ahora = new Date().toISOString();

  const { data: encuentro, error: errEnc } = await supabase
    .from('encounters')
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      provider_id: authorId,
      kind: datos.kind,
      status: 'finalizada',
      started_at: ahora,
      ended_at: ahora,
      created_by: authorId,
    })
    .select('id')
    .single();

  if (errEnc) throw errEnc;
  const encounterId = encuentro.id;

  // El identificador se genera aquí porque el cifrado va ligado a la fila que
  // ocupará: sin conocerlo de antemano no se puede construir esa ligadura.
  const noteId = randomUUID();
  const texto = JSON.stringify(datos.contenido);
  const { ciphertext, keyVersion } = encryptField(texto, {
    table: 'clinical_notes',
    column: 'content',
    rowId: noteId,
  });

  const palabras = Object.values(datos.contenido)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  const { error: errNota } = await supabase.from('clinical_notes').insert({
    id: noteId,
    tenant_id: tenantId,
    patient_id: patientId,
    encounter_id: encounterId,
    content_enc: ciphertext,
    key_version: keyVersion,
    word_count: palabras,
    author_id: authorId,
  });
  if (errNota) throw errNota;

  if (datos.vitales && Object.values(datos.vitales).some((v) => v != null)) {
    const { error } = await supabase.from('vitals').insert({
      tenant_id: tenantId,
      patient_id: patientId,
      encounter_id: encounterId,
      recorded_by: authorId,
      measured_at: ahora,
      height_cm: datos.vitales.heightCm ?? null,
      weight_kg: datos.vitales.weightKg ?? null,
      temperature_c: datos.vitales.temperatureC ?? null,
      heart_rate: datos.vitales.heartRate ?? null,
      respiratory_rate: datos.vitales.respiratoryRate ?? null,
      systolic_bp: datos.vitales.systolicBp ?? null,
      diastolic_bp: datos.vitales.diastolicBp ?? null,
      oxygen_saturation: datos.vitales.oxygenSaturation ?? null,
      glucose_mgdl: datos.vitales.glucoseMgdl ?? null,
    });
    if (error) throw error;
  }

  if (datos.diagnosticos?.length) {
    const { error } = await supabase.from('diagnoses').insert(
      datos.diagnosticos.map((d) => ({
        tenant_id: tenantId,
        patient_id: patientId,
        encounter_id: encounterId,
        code: d.code,
        display: d.display,
        kind: d.kind,
        is_chronic: d.isChronic,
        recorded_by: authorId,
      }))
    );
    if (error) throw error;
  }

  if (datos.firmar) {
    // Firmar cierra la nota: a partir de aquí sólo se puede enmendar.
    const { error } = await supabase.rpc('sign_clinical_record', {
      p_table: 'clinical_notes',
      p_id: noteId,
    });
    if (error) throw error;
  }

  await audit({
    action: 'create',
    resourceType: 'encounters',
    resourceId: encounterId,
    tenantId,
    patientId,
    summary: `Registró una ${datos.kind}${datos.firmar ? ' y la firmó' : ''}`,
    metadata: { note_id: noteId, firmada: datos.firmar },
  });

  return encounterId;
}

/**
 * Enmienda una nota firmada.
 *
 * Una nota firmada NO se corrige: se sustituye. Se crea una nota nueva con el
 * texto corregido y el motivo del cambio, y la anterior queda apuntando a ella.
 * Las dos permanecen legibles para siempre.
 *
 * No es burocracia: si un diagnóstico se corrigió tres días después, quien lea
 * el expediente en un juicio necesita ver qué decía antes, cuándo cambió y por
 * qué. Borrar el error borra también la prueba de que se detectó.
 *
 * El trigger app.block_signed_update sólo tolera una modificación en una nota
 * firmada —fijar `amended_by` estando en NULL—, así que este es el único camino
 * que la base permite.
 */
export async function enmendarNota(
  tenantId: string,
  notaOriginalId: string,
  authorId: string,
  contenido: ContenidoNota,
  motivo: string
): Promise<string> {
  const supabase = await createClient();

  const { data: original, error: errBuscar } = await supabase
    .from('clinical_notes')
    .select('id, patient_id, encounter_id, signed_at, amended_by')
    .eq('tenant_id', tenantId)
    .eq('id', notaOriginalId)
    .single();

  if (errBuscar) throw errBuscar;
  if (!original.signed_at) {
    throw new Error('Una nota sin firmar se corrige directamente, no se enmienda.');
  }
  if (original.amended_by) {
    throw new Error('Esa nota ya fue enmendada. Enmiende la versión vigente.');
  }

  const nuevaId = randomUUID();
  const texto = JSON.stringify(contenido);
  const { ciphertext, keyVersion } = encryptField(texto, {
    table: 'clinical_notes',
    column: 'content',
    rowId: nuevaId,
  });

  const palabras = Object.values(contenido).join(' ').split(/\s+/).filter(Boolean).length;

  const { error: errNueva } = await supabase.from('clinical_notes').insert({
    id: nuevaId,
    tenant_id: tenantId,
    patient_id: original.patient_id,
    encounter_id: original.encounter_id,
    content_enc: ciphertext,
    key_version: keyVersion,
    word_count: palabras,
    author_id: authorId,
    amendment_reason: motivo.trim(),
  });
  if (errNueva) throw errNueva;

  // Se enlaza DESPUÉS de crear la nueva: si el enlace fallara primero, la nota
  // original quedaría marcada como enmendada sin que exista la enmienda.
  const { error: errEnlace } = await supabase
    .from('clinical_notes')
    .update({ amended_by: nuevaId })
    .eq('tenant_id', tenantId)
    .eq('id', notaOriginalId);
  if (errEnlace) throw errEnlace;

  await audit({
    action: 'update',
    resourceType: 'clinical_notes',
    resourceId: notaOriginalId,
    tenantId,
    patientId: original.patient_id,
    summary: `Enmendó una nota firmada: ${motivo.trim()}`,
    metadata: { nota_original: notaOriginalId, nota_nueva: nuevaId },
  });

  return nuevaId;
}

/** Añade una alergia al expediente. */
export async function registrarAlergia(
  tenantId: string,
  patientId: string,
  recordedBy: string,
  alergia: { substance: string; reaction?: string; severity: AllergySeverity }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('allergies').insert({
    tenant_id: tenantId,
    patient_id: patientId,
    recorded_by: recordedBy,
    substance: alergia.substance.trim(),
    reaction: alergia.reaction?.trim() || null,
    severity: alergia.severity,
  });

  if (error) throw error;

  await audit({
    action: 'create',
    resourceType: 'allergies',
    tenantId,
    patientId,
    summary: `Registró alergia a ${alergia.substance}`,
  });
}
