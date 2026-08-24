/**
 * Tipos que reflejan los enums y catálogos definidos en supabase/migrations/.
 *
 * Las migraciones SQL son la ÚNICA fuente de verdad. Este archivo las refleja
 * para que TypeScript ayude, y scripts/check-schema-drift.mjs comprueba contra
 * la base real que no se hayan separado.
 */

export const MEMBER_ROLES = [
  'owner',
  'admin',
  'physician',
  'nurse',
  'receptionist',
  'billing',
  'auditor',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PERMISSIONS = [
  'tenant.manage',
  'members.manage',
  'patients.read',
  'patients.write',
  'clinical.read',
  'clinical.write',
  'clinical.sign',
  'documents.read',
  'documents.upload',
  'documents.share',
  'appointments.read',
  'appointments.write',
  'schedule.manage',
  'billing.manage',
  'audit.read',
  'breakglass.use',
  'privacy.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const TENANT_KINDS = [
  'hospital',
  'clinica',
  'consultorio',
  'laboratorio',
  'centro_diagnostico',
] as const;
export type TenantKind = (typeof TENANT_KINDS)[number];

export const APPOINTMENT_STATUSES = [
  'solicitada',
  'confirmada',
  'en_sala',
  'atendida',
  'cancelada',
  'no_asistio',
  'reprogramada',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_SOURCES = [
  'web',
  'whatsapp',
  'telefono',
  'presencial',
  'portal_paciente',
] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const ENCOUNTER_KINDS = [
  'consulta',
  'control',
  'emergencia',
  'teleconsulta',
  'procedimiento',
  'domiciliaria',
] as const;
export type EncounterKind = (typeof ENCOUNTER_KINDS)[number];

export const SEX_AT_BIRTH = ['female', 'male', 'intersex', 'unknown'] as const;
export type SexAtBirth = (typeof SEX_AT_BIRTH)[number];

export const ID_DOCUMENTS = ['cedula', 'pasaporte', 'ruc', 'sin_documento'] as const;
export type IdDocument = (typeof ID_DOCUMENTS)[number];

export const PATIENT_STATUSES = ['active', 'inactive', 'deceased', 'merged'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const ALLERGY_SEVERITIES = ['leve', 'moderada', 'severa', 'mortal'] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export const DIAGNOSIS_KINDS = ['presuntivo', 'definitivo', 'descartado'] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];

export const ENCOUNTER_STATUSES = [
  'planificada',
  'en_curso',
  'finalizada',
  'cancelada',
  'no_asistio',
] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const CONSENT_PURPOSES = [
  'tratamiento_datos',
  'atencion_medica',
  'whatsapp',
  'sms',
  'email',
  'compartir_interno',
  'compartir_externo',
  'investigacion',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const AUDIT_ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'export',
  'print',
  'share',
  'unshare',
  'sign',
  'login',
  'logout',
  'login_failed',
  'mfa_challenge',
  'mfa_failed',
  'permission_denied',
  'break_glass',
  'invite',
  'role_change',
  'consent_grant',
  'consent_revoke',
  'send_message',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const DOCUMENT_KINDS = [
  'laboratorio',
  'imagen',
  'informe',
  'receta',
  'consentimiento',
  'referencia',
  'certificado',
  'otro',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Etiquetas para la interfaz, en español de Ecuador. */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  physician: 'Médico',
  nurse: 'Enfermería',
  receptionist: 'Recepción',
  billing: 'Facturación',
  auditor: 'Auditoría',
};

export const SEX_LABELS: Record<SexAtBirth, string> = {
  female: 'Femenino',
  male: 'Masculino',
  intersex: 'Intersexual',
  unknown: 'Sin registrar',
};

export const ID_DOCUMENT_LABELS: Record<IdDocument, string> = {
  cedula: 'Cédula',
  pasaporte: 'Pasaporte',
  ruc: 'RUC',
  sin_documento: 'Sin documento',
};

export const ALLERGY_SEVERITY_LABELS: Record<AllergySeverity, string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  severa: 'Severa',
  mortal: 'Riesgo vital',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  solicitada: 'Solicitada',
  confirmada: 'Confirmada',
  en_sala: 'En sala',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
  reprogramada: 'Reprogramada',
};
