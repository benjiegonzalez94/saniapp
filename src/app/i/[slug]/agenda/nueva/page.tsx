import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import { listarProveedores } from '@/lib/db/scheduling';
import { createClient } from '@/lib/supabase/server';
import { FormularioAgendar } from './formulario';

export const metadata: Metadata = { title: 'Agendar cita' };
export const dynamic = 'force-dynamic';

export default async function PaginaAgendar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fecha?: string; medico?: string; paciente?: string }>;
}) {
  const { slug } = await params;
  const { fecha, medico, paciente } = await searchParams;

  const tenant = await requirePermissionBySlug(slug, 'appointments.write');
  const proveedores = await listarProveedores(tenant.tenantId);

  // Si se llega desde el expediente de un paciente, viene preseleccionado y se
  // evita buscarlo otra vez.
  let pacienteInicial = null;
  if (paciente) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('patients')
      .select('id, given_name, family_name, record_number, phone')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', paciente)
      .maybeSingle();
    if (data) {
      pacienteInicial = {
        id: data.id,
        given_name: data.given_name,
        family_name: data.family_name,
        record_number: data.record_number ?? 0,
        phone: data.phone,
      };
    }
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: tenant.timezone });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href={`/i/${slug}/agenda`}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Agenda
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">
          Agendar cita
        </h1>
        <p className="mt-1 text-sm text-(--color-tinta-2)">
          Los huecos disponibles los calcula el sistema a partir del horario de atención.
        </p>
      </div>

      {proveedores.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-10 text-center">
          <p className="font-medium text-(--color-tinta)">
            No hay profesionales con horario definido
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            Antes de agendar hay que decir cuándo se atiende.
          </p>
          <Link
            href={`/i/${slug}/agenda/horarios`}
            className="mt-4 inline-flex h-10 items-center rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
          >
            Definir horarios
          </Link>
        </div>
      ) : (
        <FormularioAgendar
          slug={slug}
          tenantId={tenant.tenantId}
          proveedores={proveedores}
          zona={tenant.timezone}
          fechaInicial={fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy}
          medicoInicial={medico ?? null}
          pacienteInicial={pacienteInicial}
        />
      )}
    </div>
  );
}
