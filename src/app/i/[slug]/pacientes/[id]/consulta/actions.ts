'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { requireUser } from '@/lib/auth/context';
import { registrarConsulta } from '@/lib/db/clinical';
import { ENCOUNTER_KINDS, DIAGNOSIS_KINDS } from '@/lib/db/types';

/**
 * Registro de una consulta.
 *
 * El único campo que se exige es el subjetivo —lo que cuenta el paciente—,
 * porque es lo primero que se escribe y a veces lo único que da tiempo a
 * escribir. Obligar a rellenar los cuatro apartados SOAP en cada visita
 * garantiza que tres se llenen de "sin particularidades", que es ruido con
 * apariencia de dato.
 */

const numeroOpcional = (min: number, max: number, etiqueta: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().min(min, `${etiqueta} fuera de rango`).max(max, `${etiqueta} fuera de rango`).optional()
  );

const esquema = z.object({
  kind: z.enum(ENCOUNTER_KINDS).default('consulta'),
  subjective: z.string().trim().min(1, 'Escriba al menos el motivo de consulta').max(20_000),
  objective: z.string().trim().max(20_000).default(''),
  assessment: z.string().trim().max(20_000).default(''),
  plan: z.string().trim().max(20_000).default(''),

  // Los rangos replican los CHECK de la tabla vitals para dar el error aquí,
  // con nombre de campo, en vez de un fallo opaco de la base.
  systolicBp: numeroOpcional(40, 300, 'Presión sistólica'),
  diastolicBp: numeroOpcional(20, 200, 'Presión diastólica'),
  heartRate: numeroOpcional(10, 300, 'Frecuencia cardíaca'),
  respiratoryRate: numeroOpcional(3, 90, 'Frecuencia respiratoria'),
  temperatureC: numeroOpcional(25, 45, 'Temperatura'),
  oxygenSaturation: numeroOpcional(30, 100, 'Saturación'),
  weightKg: numeroOpcional(0.3, 500, 'Peso'),
  heightCm: numeroOpcional(20, 260, 'Talla'),
  glucoseMgdl: numeroOpcional(10, 1200, 'Glucosa'),

  // Los diagnósticos llegan como JSON desde el selector CIE-10. Se validan uno
  // a uno: es entrada del cliente, y un código inventado acabaría en la
  // historia clínica como si fuera codificación oficial.
  diagnosticos: z
    .string()
    .default('[]')
    .transform((s, ctx) => {
      let crudo: unknown;
      try {
        crudo = JSON.parse(s);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Diagnósticos con formato inválido' });
        return z.NEVER;
      }
      const resultado = z
        .array(
          z.object({
            code: z.string().trim().regex(/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/, 'Código CIE-10 inválido'),
            display: z.string().trim().min(1).max(300),
            kind: z.enum(DIAGNOSIS_KINDS),
            isChronic: z.boolean(),
          })
        )
        .max(10, 'Demasiados diagnósticos para una sola consulta')
        .safeParse(crudo);

      if (!resultado.success) {
        ctx.addIssue({ code: 'custom', message: resultado.error.issues[0]!.message });
        return z.NEVER;
      }
      return resultado.data;
    }),

  firmar: z.coerce.boolean().default(false),
});

export type EstadoConsulta = { error?: string; campo?: string };

export async function guardarConsulta(
  _prev: EstadoConsulta,
  formData: FormData
): Promise<EstadoConsulta> {
  const slug = String(formData.get('slug') ?? '');
  const patientId = String(formData.get('patientId') ?? '');

  const tenant = await requirePermissionBySlug(slug, 'clinical.write');
  const user = await requireUser();

  const crudo = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = esquema.safeParse({
    ...crudo,
    firmar: crudo.firmar === 'on',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: issue.message, campo: String(issue.path[0]) };
  }

  const d = parsed.data;

  // La presión se registra de a pares o no se registra: un sistólico suelto no
  // es un dato clínico, y la tabla lo rechazaría con un error poco legible.
  if ((d.systolicBp == null) !== (d.diastolicBp == null)) {
    return { error: 'Registre la presión completa: sistólica y diastólica.', campo: 'systolicBp' };
  }
  if (d.systolicBp != null && d.diastolicBp != null && d.systolicBp <= d.diastolicBp) {
    return { error: 'La sistólica debe ser mayor que la diastólica.', campo: 'systolicBp' };
  }

  // Firmar exige el permiso clinical.sign, que enfermería no tiene. La base lo
  // impone igualmente; aquí se da el mensaje legible.
  if (d.firmar && !tenant.permissions.has('clinical.sign')) {
    return {
      error: 'Sólo el personal médico puede firmar. Guarde como borrador y pida la firma.',
      campo: 'firmar',
    };
  }

  await registrarConsulta(tenant.tenantId, patientId, user.id, {
    kind: d.kind,
    contenido: {
      subjective: d.subjective,
      objective: d.objective,
      assessment: d.assessment,
      plan: d.plan,
    },
    vitales: {
      systolicBp: d.systolicBp ?? null,
      diastolicBp: d.diastolicBp ?? null,
      heartRate: d.heartRate ?? null,
      respiratoryRate: d.respiratoryRate ?? null,
      temperatureC: d.temperatureC ?? null,
      oxygenSaturation: d.oxygenSaturation ?? null,
      weightKg: d.weightKg ?? null,
      heightCm: d.heightCm ?? null,
      glucoseMgdl: d.glucoseMgdl ?? null,
    },
    diagnosticos: d.diagnosticos,
    firmar: d.firmar,
  });

  redirect(`/i/${slug}/pacientes/${patientId}`);
}
