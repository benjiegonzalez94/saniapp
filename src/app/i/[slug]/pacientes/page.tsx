import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Search, UserRound } from 'lucide-react';

import { requireTenantBySlug, can } from '@/lib/auth/context';
import { buscarPacientes } from '@/lib/db/patients';
import { calcularEdad } from '@/lib/utils';
import { SEX_LABELS } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Pacientes' };
export const dynamic = 'force-dynamic';

export default async function PaginaPacientes({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q = '' } = await searchParams;

  const tenant = await requireTenantBySlug(slug);
  const pacientes = await buscarPacientes(tenant.tenantId, q);
  const puedeCrear = can(tenant, 'patients.write');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">Pacientes</h1>

        {puedeCrear && (
          <Link
            href={`/i/${slug}/pacientes/nuevo`}
            className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) bg-(--color-acento) px-4 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo paciente
          </Link>
        )}
      </div>

      {/* Formulario GET: la búsqueda queda en la URL, así que se puede compartir,
          guardar y volver atrás sin perderla. */}
      <form method="get" role="search" className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-tinta-3)"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Cédula, apellido o teléfono"
          aria-label="Buscar paciente por cédula, apellido o teléfono"
          className="h-11 w-full rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) pr-4 pl-10 text-sm text-(--color-tinta) outline-none placeholder:text-(--color-tinta-3) focus:border-(--color-acento)"
        />
      </form>

      {pacientes.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-14 text-center">
          <UserRound
            className="mx-auto size-8 text-(--color-tinta-3)"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <p className="mt-4 font-medium text-(--color-tinta)">
            {q ? 'Ningún paciente coincide' : 'Todavía no hay pacientes'}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            {q
              ? 'La búsqueda por documento requiere el número completo: al estar cifrado, no se puede buscar por coincidencias parciales.'
              : 'Registre al primero cuando entre a consulta.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          {pacientes.map((p) => {
            const edad = p.birthDate ? calcularEdad(p.birthDate) : null;

            return (
              <li key={p.id}>
                <Link
                  href={`/i/${slug}/pacientes/${p.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-(--color-superficie-2) sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-(--color-tinta)">
                      {p.familyName}, {p.givenName}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-(--color-tinta-3)">
                      {[
                        edad !== null ? `${edad} años` : null,
                        SEX_LABELS[p.sexAtBirth] !== 'Sin registrar'
                          ? SEX_LABELS[p.sexAtBirth]
                          : null,
                        p.nationalIdLast4 ? `···${p.nationalIdLast4}` : null,
                        p.phone,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <span className="cifras shrink-0 text-xs text-(--color-tinta-3)">
                    HC {p.recordNumber}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pacientes.length > 0 && (
        <p className="text-xs text-(--color-tinta-3)">
          {pacientes.length === 25
            ? 'Mostrando los 25 más recientes. Afine la búsqueda para ver otros.'
            : `${pacientes.length} paciente${pacientes.length === 1 ? '' : 's'}.`}
        </p>
      )}
    </div>
  );
}
