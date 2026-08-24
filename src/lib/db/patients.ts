import 'server-only';

import { randomUUID } from 'node:crypto';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import {
  blindIndex,
  encryptNationalId,
  isValidEcuadorianCedula,
  normalizeForIndex,
} from '@/lib/security/crypto';
import type { SexAtBirth, IdDocument, PatientStatus } from '@/lib/db/types';
import type { Database } from '@/lib/db/database.types';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type PatientInsert = Database['public']['Tables']['patients']['Insert'];

/**
 * Acceso al padrón de pacientes.
 *
 * Nota sobre auditoría: NO se registra cada búsqueda. Teclear en el buscador
 * dispararía un evento por pulsación y ahogaría la bitácora en ruido, dejando
 * inservible justo la consulta que importa: "¿quién abrió el expediente de este
 * paciente?". Se audita el acceso a un expediente concreto, que es el acto que
 * la LOPDP obliga a poder reconstruir.
 */

export type PatientListItem = {
  id: string;
  recordNumber: number;
  givenName: string;
  familyName: string;
  birthDate: string | null;
  sexAtBirth: SexAtBirth;
  phone: string | null;
  nationalIdLast4: string | null;
  status: PatientStatus;
  updatedAt: string;
};

export type PatientDetail = PatientListItem & {
  tenantId: string;
  idDocument: IdDocument;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  createdAt: string;
};

/**
 * En una sola línea y sin concatenar a propósito: TypeScript ensancha a `string`
 * el resultado de `'a' + 'b'`, y entonces supabase-js no puede analizar el
 * `select` para inferir la forma de la fila —devuelve `GenericStringError` y se
 * pierde todo el tipado que da `npm run db:types`.
 */
const CAMPOS_LISTA =
  'id, record_number, given_name, family_name, birth_date, sex_at_birth, phone, national_id_last4, status, updated_at' as const;

const CAMPOS_DETALLE =
  'id, record_number, given_name, family_name, birth_date, sex_at_birth, phone, national_id_last4, status, updated_at, tenant_id, id_document, email, address_line, city, province, blood_type, emergency_contact_name, emergency_contact_phone, notes, created_at' as const;

/** Derivado del esquema real: si cambia una columna, esto deja de compilar. */
type FilaLista = Pick<
  PatientRow,
  | 'id'
  | 'record_number'
  | 'given_name'
  | 'family_name'
  | 'birth_date'
  | 'sex_at_birth'
  | 'phone'
  | 'national_id_last4'
  | 'status'
  | 'updated_at'
>;

function aListItem(f: FilaLista): PatientListItem {
  return {
    id: f.id,
    // La columna es anulable en el esquema para que el trigger
    // patients_assign_record_number pueda rellenarla en BEFORE INSERT, pero la
    // restricción patients_record_number_present garantiza que ninguna fila
    // persistida la tenga vacía. Aquí se afirma esa garantía una sola vez, en
    // lugar de arrastrar un `| null` imposible por toda la interfaz.
    recordNumber: f.record_number!,
    givenName: f.given_name,
    familyName: f.family_name,
    birthDate: f.birth_date,
    sexAtBirth: f.sex_at_birth,
    phone: f.phone,
    nationalIdLast4: f.national_id_last4,
    status: f.status,
    updatedAt: f.updated_at,
  };
}

/**
 * Un único buscador para todo.
 *
 * En un mostrador nadie elige primero "buscar por cédula" y luego escribe. Se
 * teclea lo que se tiene a mano —el número de la cédula, el apellido, el
 * teléfono— y el sistema decide. Si lo escrito parece un documento se resuelve
 * por índice ciego, que es una coincidencia exacta e instantánea; si no, por
 * nombre.
 */
export async function buscarPacientes(
  tenantId: string,
  consulta: string,
  limite = 25
): Promise<PatientListItem[]> {
  const supabase = await createClient();
  const termino = consulta.trim();

  let query = supabase
    .from('patients')
    .select(CAMPOS_LISTA)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limite);

  if (termino.length > 0) {
    const soloDigitos = normalizeForIndex(termino);
    const pareceDocumento = /^\d{6,13}$/.test(soloDigitos);

    if (pareceDocumento) {
      // El índice ciego sólo permite igualdad exacta: no hay forma de buscar
      // "cédulas que empiecen por" sin guardar el documento en claro, y ese es
      // precisamente el compromiso que se aceptó al cifrarlo.
      const bidx = `\\x${blindIndex(soloDigitos).toString('hex')}`;
      query = query.or(`national_id_bidx.eq.${bidx},phone.ilike.%${soloDigitos}%`);
    } else {
      const patron = `%${termino}%`;
      query = query.or(`given_name.ilike.${patron},family_name.ilike.${patron}`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(aListItem);
}

/** Cuántos pacientes tiene la institución (para el tope del plan). */
export async function contarPacientes(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Abre un expediente. Registra el acceso: éste sí es el acto que hay que poder
 * reconstruir ante una auditoría de protección de datos.
 */
export async function obtenerPaciente(
  tenantId: string,
  patientId: string
): Promise<PatientDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('patients')
    .select(CAMPOS_DETALLE)
    .eq('tenant_id', tenantId)
    .eq('id', patientId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const f = data;

  await audit({
    action: 'read',
    resourceType: 'patient',
    resourceId: patientId,
    tenantId,
    patientId,
    summary: `Abrió el expediente de ${f.given_name} ${f.family_name}`,
  });

  return {
    ...aListItem(f),
    tenantId,
    idDocument: f.id_document,
    email: f.email,
    addressLine: f.address_line,
    city: f.city,
    province: f.province,
    bloodType: f.blood_type,
    emergencyContactName: f.emergency_contact_name,
    emergencyContactPhone: f.emergency_contact_phone,
    notes: f.notes,
    createdAt: f.created_at,
  };
}

export type NuevoPaciente = {
  givenName: string;
  familyName: string;
  birthDate?: string | null;
  sexAtBirth?: SexAtBirth;
  idDocument?: IdDocument;
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  bloodType?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
};

export class DocumentoDuplicadoError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento en esta institución');
    this.name = 'DocumentoDuplicadoError';
  }
}

/**
 * Crea un paciente.
 *
 * El identificador se genera aquí y no en la base porque el cifrado del
 * documento va ligado a la fila que va a ocupar (tabla, columna e id). Sin
 * conocer el id de antemano no se puede construir esa ligadura, y sin ella un
 * atacante con escritura podría mover la cédula cifrada de un paciente a otro.
 */
export async function crearPaciente(
  tenantId: string,
  datos: NuevoPaciente
): Promise<string> {
  const supabase = await createClient();
  const patientId = randomUUID();

  const fila: PatientInsert = {
    id: patientId,
    tenant_id: tenantId,
    given_name: datos.givenName.trim(),
    family_name: datos.familyName.trim(),
    birth_date: datos.birthDate || null,
    sex_at_birth: datos.sexAtBirth ?? 'unknown',
    id_document: datos.idDocument ?? 'cedula',
    phone: datos.phone || null,
    email: datos.email || null,
    address_line: datos.addressLine || null,
    city: datos.city || null,
    province: datos.province || null,
    blood_type: datos.bloodType || null,
    emergency_contact_name: datos.emergencyContactName || null,
    emergency_contact_phone: datos.emergencyContactPhone || null,
  };

  if (datos.nationalId?.trim()) {
    const cifrado = encryptNationalId(datos.nationalId, patientId);
    fila.national_id_enc = cifrado.national_id_enc;
    // PostgREST espera bytea en formato hexadecimal escapado.
    fila.national_id_bidx = `\\x${cifrado.national_id_bidx.toString('hex')}`;
    fila.national_id_last4 = cifrado.national_id_last4;
  }

  // record_number no se envía: lo asigna el trigger patients_assign_record_number
  // (migración 0012), que serializa el correlativo por institución.
  const { data: creado, error } = await supabase
    .from('patients')
    .insert(fila)
    .select('record_number')
    .single<{ record_number: number }>();

  if (error) {
    // 23505 = violación de unicidad; aquí sólo puede ser el índice del documento.
    if (error.code === '23505') throw new DocumentoDuplicadoError();
    throw error;
  }

  await audit({
    action: 'create',
    resourceType: 'patient',
    resourceId: patientId,
    tenantId,
    patientId,
    summary: `Registró a ${datos.givenName} ${datos.familyName}`,
    metadata: { record_number: creado.record_number },
  });

  return patientId;
}

/** Valida un documento según su tipo. Devuelve null si es correcto. */
export function validarDocumento(tipo: IdDocument, valor: string): string | null {
  const limpio = normalizeForIndex(valor);
  if (!limpio) return null;

  if (tipo === 'cedula' && !isValidEcuadorianCedula(limpio)) {
    return 'El dígito verificador no corresponde: revise el número.';
  }
  if (tipo === 'ruc' && !/^\d{13}$/.test(limpio)) {
    return 'El RUC debe tener 13 dígitos.';
  }
  if (tipo === 'pasaporte' && limpio.length < 5) {
    return 'El pasaporte parece demasiado corto.';
  }
  return null;
}
