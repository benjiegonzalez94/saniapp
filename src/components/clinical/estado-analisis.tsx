import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EstadoAnalisis } from '@/lib/db/documents';

/**
 * Cómo se pinta el veredicto del antivirus.
 *
 * Vive fuera de las dos listas que lo usan —el expediente del paciente y los
 * estudios de la institución— porque es la traducción de una regla de
 * seguridad, no un adorno: si «infectado» dejara de verse rojo en una de las
 * dos pantallas, ahí es donde alguien abriría el archivo equivocado.
 */

/** Orden de peor a mejor noticia; es el orden en que se ofrecen al filtrar. */
export const ESTADOS_ANALISIS = [
  'infectado',
  'error',
  'pendiente',
  'limpio',
] as const satisfies readonly EstadoAnalisis[];

export const ESTADO_ANALISIS: Record<
  EstadoAnalisis,
  {
    icono: typeof ShieldCheck;
    clase: string;
    etiqueta: string;
    /** Por qué el archivo no se abre. `null` cuando sí se abre. */
    motivoRetencion: string | null;
  }
> = {
  limpio: {
    icono: ShieldCheck,
    clase: 'text-(--color-exito)',
    etiqueta: 'Analizado',
    motivoRetencion: null,
  },
  pendiente: {
    icono: ShieldQuestion,
    clase: 'text-(--color-aviso)',
    etiqueta: 'En análisis',
    motivoRetencion:
      'Todavía no ha pasado por el antivirus. Se guarda, pero no se abre hasta que termine.',
  },
  infectado: {
    icono: ShieldAlert,
    clase: 'text-(--color-riesgo)',
    etiqueta: 'Rechazado',
    motivoRetencion: 'El antivirus detectó una amenaza. Este archivo no se descarga nunca.',
  },
  error: {
    icono: ShieldAlert,
    clase: 'text-(--color-tinta-3)',
    etiqueta: 'Sin analizar',
    motivoRetencion:
      'El análisis falló. Un archivo que no se pudo comprobar se trata como no comprobado: no se sirve.',
  },
};

/**
 * Indicador del estado de análisis.
 *
 * El estado se anuncia además con texto para lectores de pantalla: un icono
 * coloreado no dice nada a quien no lo ve, y aquí lo que comunica es si el
 * archivo se puede abrir.
 */
export function IndicadorAnalisis({
  estado,
  className,
}: {
  estado: EstadoAnalisis;
  className?: string;
}) {
  const { icono: Icono, clase, etiqueta } = ESTADO_ANALISIS[estado];

  return (
    <span className={cn('shrink-0', className)} title={etiqueta}>
      <Icono className={cn('size-4', clase)} aria-hidden="true" />
      <span className="sr-only">{etiqueta}.</span>
    </span>
  );
}
