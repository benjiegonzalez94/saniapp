import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales resolviendo los conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formatea un importe en centavos como moneda, sin errores de punto flotante. */
export function formatMoney(cents: number, currency = 'USD', locale = 'es-EC'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Limpia un término antes de meterlo en un filtro `.or()` de PostgREST.
 *
 * PostgREST parsea el argumento de `or=(...)` partiendo por comas y paréntesis,
 * así que un texto crudo del usuario ROMPE la consulta entera: buscar
 * «Pérez, Juan» no acota el resultado, devuelve un 400. Los comodines `%` y `*`
 * y las comillas tienen el mismo efecto sobre el patrón `ilike`.
 *
 * Se sustituyen por espacios en vez de eliminarse: «Pérez,Juan» debe quedar en
 * dos palabras, no en una sola inexistente.
 */
export function sanearTerminoBusqueda(texto: string): string {
  return texto
    .replace(/[,()*%\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Edad en años cumplidos a partir de la fecha de nacimiento. */
export function calcularEdad(birthDate: string | Date, at: Date = new Date()): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Tamaño de archivo legible.
 *
 * Se redondea a kB enteros y a una decimal en MB: en un listado de estudios lo
 * que se decide con este dato es si el archivo cabe en la conexión del
 * consultorio, no su tamaño exacto.
 */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
