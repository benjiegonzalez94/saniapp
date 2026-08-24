'use client';

import { useState, useTransition } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { comprobarCadena, type RespuestaCadena } from './acciones';

/**
 * Verificación de la integridad de la bitácora.
 *
 * Cada evento de la bitácora sella el anterior con un hash. Si alguien altera o
 * borra una fila —incluso con acceso directo a la base—, la cadena deja de
 * cuadrar a partir de ahí y esto lo señala.
 *
 * Se ejecuta a petición y no al cargar: recorre la bitácora entera y en una
 * institución con años de historia el coste es real.
 */
export function VerificacionIntegridad({ slug }: { slug: string }) {
  const [resultado, setResultado] = useState<RespuestaCadena | null>(null);
  const [comprobando, iniciar] = useTransition();

  const fecha = new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const roto = resultado?.ok && resultado.estado.rotoEnId !== null;
  const integra = resultado?.ok && resultado.estado.rotoEnId === null;

  return (
    <section
      className={cn(
        'rounded-(--radius-lg) border p-4',
        roto
          ? 'border-(--color-riesgo) bg-(--color-riesgo-suave)'
          : 'border-(--color-borde) bg-(--color-superficie)'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-medium text-(--color-tinta)">
            {roto ? (
              <ShieldAlert className="size-4 text-(--color-riesgo)" aria-hidden="true" />
            ) : integra ? (
              <ShieldCheck className="size-4 text-(--color-exito)" aria-hidden="true" />
            ) : (
              <ShieldQuestion className="size-4 text-(--color-tinta-3)" aria-hidden="true" />
            )}
            Integridad de la bitácora
          </h2>

          <p className="mt-1 text-xs text-(--color-tinta-2)">
            {!resultado &&
              'Cada evento sella el anterior con un hash. Alterar o borrar uno rompe la cadena a partir de ahí.'}

            {resultado?.ok === false && (
              <span role="alert" className="text-(--color-riesgo)">
                {resultado.error}
              </span>
            )}

            {integra && resultado.ok && (
              <span className="text-(--color-exito)">
                Cadena íntegra: {resultado.estado.eventosVerificados.toLocaleString('es-EC')}{' '}
                {resultado.estado.eventosVerificados === 1 ? 'evento verificado' : 'eventos verificados'},
                ninguno alterado.
              </span>
            )}

            {roto && resultado.ok && (
              <span role="alert" className="font-medium text-(--color-riesgo)">
                CADENA ROTA. Se verificaron{' '}
                {resultado.estado.eventosVerificados.toLocaleString('es-EC')} eventos antes de
                encontrar el fallo, en el evento {resultado.estado.rotoEnId}
                {resultado.estado.rotoEn &&
                  ` del ${fecha.format(new Date(resultado.estado.rotoEn))}`}
                . Alguien con acceso directo a la base modificó o eliminó registros de
                auditoría. Investíguelo antes de seguir.
              </span>
            )}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secundario"
          cargando={comprobando}
          onClick={() =>
            iniciar(async () => {
              setResultado(await comprobarCadena(slug));
            })
          }
        >
          {resultado ? 'Verificar de nuevo' : 'Verificar ahora'}
        </Button>
      </div>
    </section>
  );
}
