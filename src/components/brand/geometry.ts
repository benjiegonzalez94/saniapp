/**
 * Geometría de la marca SaniTi. Fuente única.
 *
 * La consumen el componente React (logo.tsx) y el generador de iconos
 * (scripts/build-icons.ts). Si estuviera duplicada, el favicon y la interfaz
 * acabarían siendo logos distintos sin que nadie se diera cuenta.
 *
 * El glifo es la ligadura de "iTi": el travesaño de la T se prolonga hasta
 * tocar los astiles de las dos íes, y los tres trazos descienden de él. El
 * central es más corto, y esa diferencia es lo que hace que la silueta se lea
 * como una M.
 *
 * Los puntos de las íes van MUY pegados a sus astiles a propósito. Separados y
 * centrados se leen como dos ojos y todo el conjunto se convierte en una cara
 * —comprobado rasterizando las variantes—; pegados leen como lo que son, dos
 * íes flanqueando la T.
 *
 * Se dibuja con trazos y no con texto porque el logo aparece en la pestaña del
 * navegador y en el icono de la aplicación, donde no hay tipografía que cargar.
 */

export const MARCA = {
  lienzo: 64,
  /** Radio del cubo: 28 % del lado, la esquina de los iconos de aplicación. */
  radio: 18,
  grosor: 5.5,
  /** Altura del travesaño de la T. */
  barraY: 26,
  /** Base de los astiles de las íes. */
  baseExterna: 47,
  /** Base del astil de la T, más alta para dar la silueta de M. */
  baseCentral: 37,
  x: { izquierda: 22, centro: 32, derecha: 42 },
  punto: { radio: 2.1, y: 20.5 },
} as const;

export const VERDE_AZULADO = '#189a94';

export type LogoSvgOptions = {
  fondo?: string;
  tinta?: string;
  /** Sin cubo: el glifo suelto, para impresión a una tinta o marcas de agua. */
  cubo?: boolean;
  tamano?: number;
};

/** Devuelve el SVG completo de la marca como cadena. */
export function logoSvg({
  fondo = VERDE_AZULADO,
  tinta = '#ffffff',
  cubo = true,
  tamano = MARCA.lienzo,
}: LogoSvgOptions = {}): string {
  const m = MARCA;
  const { izquierda: a, centro: c, derecha: d } = m.x;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.lienzo} ${m.lienzo}"`,
    ` width="${tamano}" height="${tamano}">`,
    cubo
      ? `<rect width="${m.lienzo}" height="${m.lienzo}" rx="${m.radio}" fill="${fondo}"/>`
      : '',
    `<g stroke="${tinta}" stroke-width="${m.grosor}" stroke-linecap="round" fill="none">`,
    `<path d="M ${a} ${m.barraY} H ${d}"/>`,
    `<path d="M ${a} ${m.barraY} V ${m.baseExterna}"/>`,
    `<path d="M ${c} ${m.barraY} V ${m.baseCentral}"/>`,
    `<path d="M ${d} ${m.barraY} V ${m.baseExterna}"/>`,
    `</g>`,
    `<g fill="${tinta}">`,
    `<circle cx="${a}" cy="${m.punto.y}" r="${m.punto.radio}"/>`,
    `<circle cx="${d}" cy="${m.punto.y}" r="${m.punto.radio}"/>`,
    `</g>`,
    `</svg>`,
  ].join('');
}
