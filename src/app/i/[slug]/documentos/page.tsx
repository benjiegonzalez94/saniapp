import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight, FileText, ShieldAlert } from 'lucide-react';

import { requirePermissionBySlug } from '@/lib/auth/context';
import {
  estadoColaAntivirus,
  listarDocumentosInstitucion,
  type EstadoAnalisis,
} from '@/lib/db/documents';
import {
  ESTADO_ANALISIS,
  ESTADOS_ANALISIS,
  IndicadorAnalisis,
} from '@/components/clinical/estado-analisis';
import { Button } from '@/components/ui/button';
import { cn, formatearTamano } from '@/lib/utils';
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, type DocumentKind } from '@/lib/db/types';
import { BotonDescarga } from './descarga';

export const metadata: Metadata = { title: 'Estudios' };
export const dynamic = 'force-dynamic';

/**
 * Estudios de toda la institución.
 *
 * El expediente del paciente sigue siendo el sitio donde se sube y se consulta
 * un estudio concreto. Esta vista responde a la otra pregunta, la que no tiene
 * paciente todavía: «¿quedó algo atascado en el antivirus?», «¿llegó ya la
 * imagen que pedimos ayer?». Por eso el eje es la fecha de subida y el estado
 * del análisis, no la historia clínica.
 */

const LIMITE = 50;

/**
 * `study_date` es un `date` sin hora: `new Date('2026-05-01')` se interpreta
 * como medianoche UTC, y pintarlo en la zona de Ecuador (UTC-5) restaría un día
 * a la fecha de cada estudio. Se formatea en UTC para leer el día tal cual se
 * guardó. `created_at` sí es un instante y va en la zona de la institución.
 */
const FECHA_ESTUDIO = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function PaginaEstudios({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tipo?: string; estado?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const { tipo: tipoCrudo, estado: estadoCrudo, pagina: paginaCruda } = await searchParams;

  const tenant = await requirePermissionBySlug(slug, 'documents.read');

  // Lo que llega por la URL lo escribe cualquiera: un valor que no pertenezca
  // al enum se descarta en silencio en vez de mandarlo a Postgres, que
  // respondería con un 22P02 ilegible.
  const tipo = DOCUMENT_KINDS.includes(tipoCrudo as DocumentKind)
    ? (tipoCrudo as DocumentKind)
    : null;
  const estado = ESTADOS_ANALISIS.includes(estadoCrudo as EstadoAnalisis)
    ? (estadoCrudo as EstadoAnalisis)
    : null;

  // `Number('3x')` da NaN y `Number('')` da 0; ambos caen a la primera página.
  // El tope evita que `?pagina=99999999` pida a Postgres un desplazamiento
  // absurdo que tarda en devolver cero filas.
  const solicitada = Math.floor(Number(paginaCruda));
  const paginaActual =
    Number.isFinite(solicitada) && solicitada > 1 ? Math.min(solicitada, 200) : 1;
  const desplazamiento = (paginaActual - 1) * LIMITE;

  const [cola, { filas: estudios, hayMas }] = await Promise.all([
    estadoColaAntivirus(tenant.tenantId),
    listarDocumentosInstitucion(
      tenant.tenantId,
      { kind: tipo, scanStatus: estado },
      LIMITE,
      desplazamiento
    ),
  ]);

  const fechaSubida = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tenant.timezone,
  });

  /**
   * Enlaces que conservan el otro filtro en vez de reiniciar la vista.
   *
   * Cambiar de filtro sí vuelve a la página 1 a propósito: quedarse en la 4 de
   * un listado que ahora tiene dos páginas deja al usuario mirando una pantalla
   * vacía sin entender por qué.
   */
  function enlaceFiltro(
    nuevoTipo: DocumentKind | null,
    nuevoEstado: EstadoAnalisis | null
  ): string {
    const busqueda = new URLSearchParams();
    if (nuevoTipo) busqueda.set('tipo', nuevoTipo);
    if (nuevoEstado) busqueda.set('estado', nuevoEstado);
    const cadena = busqueda.toString();
    return cadena ? `/i/${slug}/documentos?${cadena}` : `/i/${slug}/documentos`;
  }

  /** El mismo filtro, otra página. */
  function enlacePagina(n: number): string {
    const busqueda = new URLSearchParams();
    if (tipo) busqueda.set('tipo', tipo);
    if (estado) busqueda.set('estado', estado);
    if (n > 1) busqueda.set('pagina', String(n));
    const cadena = busqueda.toString();
    return cadena ? `/i/${slug}/documentos?${cadena}` : `/i/${slug}/documentos`;
  }

  // Sólo se enseña lo que hay. Tres ceros alineados ocupan el mismo sitio que
  // un aviso real y enseñan a no mirar la banda.
  const contadores = [
    { estado: 'pendiente' as const, valor: cola.pendientes, etiqueta: 'en análisis' },
    { estado: 'infectado' as const, valor: cola.infectados, etiqueta: 'rechazados' },
    { estado: 'error' as const, valor: cola.conError, etiqueta: 'sin analizar' },
  ].filter((c) => c.valor > 0);

  const hayFiltro = tipo !== null || estado !== null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-(--color-tinta)">Estudios</h1>
        <p className="mt-0.5 text-sm text-(--color-tinta-2)">
          Documentos de toda la institución, del más reciente al más antiguo.
        </p>
      </div>

      {/* Banda del antivirus. Un archivo infectado no es un aviso más: es la
          única situación de esta pantalla que exige que alguien haga algo. */}
      <section
        aria-label="Estado del análisis antivirus"
        className={cn(
          'rounded-(--radius-lg) border px-4 py-3',
          cola.infectados > 0
            ? 'border-(--color-riesgo) bg-(--color-riesgo-suave)'
            : cola.pendientes > 0 || cola.conError > 0
              ? 'border-(--color-aviso) bg-(--color-aviso-suave)'
              : 'border-(--color-borde) bg-(--color-superficie)'
        )}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {cola.infectados > 0 && (
            <ShieldAlert className="size-5 text-(--color-riesgo)" aria-hidden="true" />
          )}

          {contadores.map((c) => {
            const est = ESTADO_ANALISIS[c.estado];
            const activo = estado === c.estado;

            return (
              <Link
                key={c.estado}
                href={enlaceFiltro(tipo, activo ? null : c.estado)}
                aria-current={activo ? 'true' : undefined}
                className={cn(
                  'flex items-baseline gap-1.5 rounded-(--radius-sm) px-1 text-sm transition-colors hover:underline',
                  activo && 'font-medium'
                )}
              >
                <span className={cn('cifras text-base font-medium', est.clase)}>{c.valor}</span>
                <span className="text-(--color-tinta-2)">{c.etiqueta}</span>
              </Link>
            );
          })}

          {contadores.length === 0 && (
            <span className="text-sm text-(--color-tinta-2)">
              Todo analizado. Ningún estudio retenido.
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-(--color-tinta-2)">
          Un estudio se guarda al subirlo, pero sólo se abre cuando el antivirus lo da por
          limpio. Mientras esté en cola o si el análisis falló, el archivo queda retenido y no
          hay botón de descarga; lo que el antivirus rechaza no se descarga nunca.
        </p>
      </section>

      {/* Formulario GET: el filtro queda en la URL, así que se puede compartir,
          guardar y volver atrás sin perderlo. */}
      <form method="get" className="no-imprimir flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="tipo" className="block text-xs font-medium text-(--color-tinta-2)">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipo ?? ''}
            className="h-9 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
          >
            <option value="">Todos los tipos</option>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="estado" className="block text-xs font-medium text-(--color-tinta-2)">
            Análisis
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado ?? ''}
            className="h-9 rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-3 text-sm text-(--color-tinta) outline-none focus:border-(--color-acento)"
          >
            <option value="">Cualquier estado</option>
            {ESTADOS_ANALISIS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_ANALISIS[e].etiqueta}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm" variant="secundario">
          Filtrar
        </Button>

        {hayFiltro && (
          <Link
            href={`/i/${slug}/documentos`}
            className="flex h-9 items-center px-2 text-sm text-(--color-tinta-2) transition-colors hover:text-(--color-tinta)"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {estudios.length === 0 ? (
        <div className="rounded-(--radius-lg) border border-dashed border-(--color-borde-fuerte) px-6 py-14 text-center">
          <FileText
            className="mx-auto size-8 text-(--color-tinta-3)"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          {/* Una URL con `?pagina=` más allá del final no es «no hay estudios»:
              decírselo así al usuario le hace pensar que perdió los archivos. */}
          <p className="mt-4 font-medium text-(--color-tinta)">
            {paginaActual > 1
              ? 'No hay más estudios'
              : hayFiltro
                ? 'Ningún estudio coincide'
                : 'Todavía no hay estudios'}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-tinta-2)">
            {paginaActual > 1
              ? 'Ha llegado al final del listado.'
              : hayFiltro
                ? 'Pruebe con otro tipo o quite el filtro de análisis.'
                : 'Los estudios se suben desde el expediente del paciente.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-(--color-borde) overflow-hidden rounded-(--radius-lg) border border-(--color-borde) bg-(--color-superficie)">
          {estudios.map((d) => {
            const est = ESTADO_ANALISIS[d.scanStatus];

            return (
              <li key={d.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
                <IndicadorAnalisis estado={d.scanStatus} className="pt-1" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-(--color-tinta)">{d.title}</p>

                  <p className="mt-0.5 truncate text-sm text-(--color-tinta-2)">
                    <Link
                      href={`/i/${slug}/pacientes/${d.patient.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {d.patient.familyName}, {d.patient.givenName}
                    </Link>
                    <span className="cifras ml-2 text-xs text-(--color-tinta-3)">
                      HC {d.patient.recordNumber}
                    </span>
                  </p>

                  <p className="mt-0.5 truncate text-xs text-(--color-tinta-3)">
                    {[
                      DOCUMENT_KIND_LABELS[d.kind],
                      formatearTamano(d.sizeBytes),
                      d.studyDate
                        ? `Estudio del ${FECHA_ESTUDIO.format(new Date(d.studyDate))}`
                        : null,
                      `Subido el ${fechaSubida.format(new Date(d.createdAt))} por ${d.uploadedByName}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {est.motivoRetencion && (
                    <p className={cn('mt-1 text-xs', est.clase)}>
                      {est.etiqueta}: {est.motivoRetencion}
                      {d.scanDetail && ` (${d.scanDetail})`}
                    </p>
                  )}
                </div>

                {/* Sin botón, no sólo deshabilitado: un control que nunca va a
                    funcionar invita a insistir. El motivo va arriba, en texto. */}
                {d.scanStatus === 'limpio' && (
                  <BotonDescarga slug={slug} documentoId={d.id} titulo={d.title} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginación real. Antes esto decía «filtre para ver otros» cuando la
          lista llegaba a 50: además de no distinguir «justo 50» de «hay más»,
          dejaba los estudios del 51 en adelante sin ninguna forma de abrirlos. */}
      {(estudios.length > 0 || paginaActual > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="cifras text-xs text-(--color-tinta-3)">
            {estudios.length > 0
              ? `Estudios ${desplazamiento + 1}–${desplazamiento + estudios.length}`
              : 'Sin estudios en esta página'}
          </p>

          {(paginaActual > 1 || hayMas) && (
            <nav aria-label="Paginación" className="flex items-center gap-2">
              {paginaActual > 1 ? (
                <Link
                  href={enlacePagina(paginaActual - 1)}
                  rel="prev"
                  className="inline-flex h-8 items-center gap-1 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-xs text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Anteriores
                </Link>
              ) : (
                <span />
              )}

              <span className="cifras text-xs text-(--color-tinta-3)">
                Página {paginaActual}
              </span>

              {hayMas && (
                <Link
                  href={enlacePagina(paginaActual + 1)}
                  rel="next"
                  className="inline-flex h-8 items-center gap-1 rounded-(--radius-sm) border border-(--color-borde-fuerte) bg-(--color-superficie) px-2.5 text-xs text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
                >
                  Siguientes
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
