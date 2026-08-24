import * as React from 'react';
import { cn } from '@/lib/utils';
import { MARCA, VERDE_AZULADO } from './geometry';

/**
 * Identidad de SaniTi. La geometría vive en ./geometry.ts, compartida con el
 * generador de iconos, para que la marca de la interfaz y la del favicon no
 * puedan divergir.
 *
 * Dos piezas:
 *   · LogoMark — el cubo de puntas redondeadas con el "iTi" dentro. Icono,
 *     favicon, botón, avatar.
 *   · Logo     — "San" delante del cubo, de modo que el conjunto se lee
 *     "SaniTi" y el cubo hace de sílaba final destacada.
 */

function Glifo({ color }: { color: string }) {
  const m = MARCA;
  const { izquierda: a, centro: c, derecha: d } = m.x;

  return (
    <>
      <g
        stroke={color}
        strokeWidth={m.grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Travesaño de la T, prolongado hasta unir las dos íes */}
        <path d={`M ${a} ${m.barraY} H ${d}`} />
        {/* Astil de la í izquierda */}
        <path d={`M ${a} ${m.barraY} V ${m.baseExterna}`} />
        {/* Astil de la T, más corto: de aquí sale la lectura de M */}
        <path d={`M ${c} ${m.barraY} V ${m.baseCentral}`} />
        {/* Astil de la í derecha */}
        <path d={`M ${d} ${m.barraY} V ${m.baseExterna}`} />
      </g>
      <g fill={color}>
        <circle cx={a} cy={m.punto.y} r={m.punto.radio} />
        <circle cx={d} cy={m.punto.y} r={m.punto.radio} />
      </g>
    </>
  );
}

export type LogoMarkProps = {
  className?: string;
  /** Píxeles del lado. Por debajo de 16 el glifo deja de distinguirse. */
  size?: number;
  /** Sin cubo: el glifo suelto, a una sola tinta. */
  bare?: boolean;
  /** Si se indica, la marca se anuncia a los lectores de pantalla. */
  title?: string;
};

export function LogoMark({ className, size, bare = false, title }: LogoMarkProps) {
  return (
    <svg
      viewBox={`0 0 ${MARCA.lienzo} ${MARCA.lienzo}`}
      width={size}
      height={size}
      className={cn(!size && 'size-8', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {!bare && (
        <rect
          width={MARCA.lienzo}
          height={MARCA.lienzo}
          rx={MARCA.radio}
          fill={`var(--color-acento, ${VERDE_AZULADO})`}
        />
      )}
      <Glifo color={bare ? 'currentColor' : '#fff'} />
    </svg>
  );
}

export type LogoProps = {
  className?: string;
  /** Alto del cubo en píxeles; el texto "San" escala con él. */
  size?: number;
};

/**
 * Logo largo: "San" + el cubo con "iTi".
 *
 * "San" va como texto real —seleccionable y buscable— y no como trazado. El
 * `aria-label` del conjunto hace que un lector de pantalla anuncie "SaniTi"
 * completo en lugar de leer "San" y saltarse la parte que está dentro del cubo.
 */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      role="img"
      aria-label="SaniTi"
    >
      <span
        className="font-semibold tracking-tight text-(--color-tinta)"
        style={{ fontSize: size * 0.78, marginRight: size * 0.09 }}
        aria-hidden="true"
      >
        San
      </span>
      <LogoMark size={size} />
    </span>
  );
}
