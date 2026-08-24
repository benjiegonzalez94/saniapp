'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireTenantBySlug } from '@/lib/auth/context';
import {
  DocumentoDuplicadoError,
  crearPaciente,
  validarDocumento,
} from '@/lib/db/patients';
import { createClient } from '@/lib/supabase/server';
import { ID_DOCUMENTS, SEX_AT_BIRTH, type ConsentPurpose } from '@/lib/db/types';

/**
 * Alta de paciente.
 *
 * Sólo el nombre y el apellido son obligatorios. Todo lo demás puede faltar,
 * incluida la cédula: el paciente que entra a consulta sin documento se atiende
 * igual, y un formulario que lo impida acaba llenándose de cédulas inventadas
 * —que es peor que no tenerlas, porque parecen verdad—.
 */

const opcional = (esquema: z.ZodString) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), esquema.optional());

const esquema = z.object({
  givenName: z.string().trim().min(1, 'Indique el nombre').max(120),
  familyName: z.string().trim().min(1, 'Indique el apellido').max(120),
  birthDate: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')),
  sexAtBirth: z.enum(SEX_AT_BIRTH).default('unknown'),
  idDocument: z.enum(ID_DOCUMENTS).default('cedula'),
  nationalId: opcional(z.string().trim().max(20)),
  phone: opcional(
    z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Use formato internacional, p. ej. +593991234567')
  ),
  email: opcional(z.string().trim().email('Correo inválido')),
  addressLine: opcional(z.string().trim().max(200)),
  city: opcional(z.string().trim().max(80)),
  // Consentimientos: no son casillas decorativas. Ver docs/SECURITY.md §8.
  consentTratamiento: z.coerce.boolean().default(false),
  consentWhatsapp: z.coerce.boolean().default(false),
});

export type EstadoAlta = {
  error?: string;
  campo?: string;
  valores?: Record<string, string>;
};

export async function registrarPaciente(
  _prev: EstadoAlta,
  formData: FormData
): Promise<EstadoAlta> {
  const slug = String(formData.get('slug') ?? '');
  const tenant = await requireTenantBySlug(slug);

  const crudo = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = esquema.safeParse({
    ...crudo,
    consentTratamiento: crudo.consentTratamiento === 'on',
    consentWhatsapp: crudo.consentWhatsapp === 'on',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]), valores: crudo };
  }

  const datos = parsed.data;

  // El dígito verificador se comprueba aquí y no sólo en el navegador: la
  // errata de un dígito crea un paciente duplicado que nadie vuelve a encontrar.
  if (datos.nationalId) {
    const problema = validarDocumento(datos.idDocument, datos.nationalId);
    if (problema) return { error: problema, campo: 'nationalId', valores: crudo };
  }

  if (!datos.consentTratamiento) {
    return {
      error:
        'Los datos de salud son categoría especial: sin consentimiento informado no se puede abrir la historia clínica.',
      campo: 'consentTratamiento',
      valores: crudo,
    };
  }

  let patientId: string;
  try {
    patientId = await crearPaciente(tenant.tenantId, datos);
  } catch (err) {
    if (err instanceof DocumentoDuplicadoError) {
      return { error: err.message, campo: 'nationalId', valores: crudo };
    }
    throw err;
  }

  await registrarConsentimientos(tenant.tenantId, patientId, {
    tratamiento_datos: true,
    atencion_medica: true,
    whatsapp: datos.consentWhatsapp,
  });

  redirect(`/i/${slug}/pacientes/${patientId}`);
}

/**
 * Deja constancia de qué autorizó el paciente y cuándo.
 *
 * Se registran también las negativas: "no autorizó WhatsApp" es un hecho que
 * hay que poder demostrar, no la simple ausencia de un registro.
 */
async function registrarConsentimientos(
  tenantId: string,
  patientId: string,
  otorgados: Partial<Record<ConsentPurpose, boolean>>
): Promise<void> {
  const supabase = await createClient();

  const filas = Object.entries(otorgados).map(([purpose, granted]) => ({
    tenant_id: tenantId,
    patient_id: patientId,
    purpose: purpose as ConsentPurpose,
    granted,
    method: 'presencial',
    policy_version: 'v1',
    evidence: { capturado_en: 'alta_de_paciente' },
  }));

  const { error } = await supabase.from('patient_consents').insert(filas);
  if (error) throw error;
}
