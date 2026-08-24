/**
 * Aritmética de fechas de calendario en la zona de la institución.
 *
 * La base guarda `timestamptz` en UTC, pero una fecha se piensa en el
 * calendario de la institución: «el martes» es el martes en Manta, no en el
 * centro de datos. Traducir entre ambos mundos es la única parte delicada de
 * estas vistas, así que vive en un solo módulo. Lo comparten la agenda y el
 * filtro por fechas de la bitácora; está en `lib/` y no dentro de la carpeta de
 * la agenda justamente porque dejó de ser cosa de una sola vista.
 */

/**
 * Desfase de una zona respecto de UTC, en milisegundos, en un instante dado.
 *
 * Se reconstruye la hora de pared con `formatToParts` en vez del atajo
 * `new Date(fecha.toLocaleString('en-US', { timeZone }))`. Ese atajo vuelve a
 * parsear el texto en la zona del PROCESO, así que sólo acierta cuando el
 * servidor corre en UTC: en producción lo hace y el fallo pasa desapercibido,
 * pero en un portátil configurado en `America/Guayaquil` la ventana del día
 * salía desplazada cinco horas y la agenda mostraba las citas de la tarde
 * anterior como si fueran de hoy.
 */
function desfaseDeZona(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);

  const campo = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((p) => p.type === tipo)?.value ?? '0');

  // Con `hour12: false` la medianoche se formatea como «24» en algunas
  // versiones de ICU; sin el módulo, el día entero se iría veinticuatro horas.
  const comoSiFueraUTC = Date.UTC(
    campo('year'),
    campo('month') - 1,
    campo('day'),
    campo('hour') % 24,
    campo('minute'),
    campo('second')
  );

  return comoSiFueraUTC - instante.getTime();
}

/** Instante exacto en que empieza el día indicado en la zona de la institución. */
export function inicioDelDia(fechaISO: string, zona: string): Date {
  const medianoche = Date.parse(`${fechaISO}T00:00:00Z`);

  // Dos pasadas: la primera usa el desfase vigente a medianoche UTC, que puede
  // ser el del otro lado de un cambio de horario de verano; la segunda lo
  // recalcula ya sobre el instante candidato. Sin ella, la madrugada del cambio
  // de hora la agenda empieza sesenta minutos antes o después de lo debido.
  const aproximado = new Date(medianoche - desfaseDeZona(new Date(medianoche), zona));
  return new Date(medianoche - desfaseDeZona(aproximado, zona));
}

/**
 * Suma (o resta) días a una fecha de calendario.
 *
 * Se ancla al mediodía UTC porque una fecha `YYYY-MM-DD` no lleva zona: desde
 * medianoche, cualquier desfase la empujaría al día anterior.
 */
export function desplazarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Fecha de hoy según el calendario de la institución, no el del servidor. */
export function hoyEnZona(zona: string): string {
  // `en-CA` es la configuración regional que produce YYYY-MM-DD directamente.
  return new Date().toLocaleDateString('en-CA', { timeZone: zona });
}

/**
 * Lunes de la semana que contiene la fecha indicada.
 *
 * No recibe zona a propósito: sobre una fecha ya expresada en el calendario de
 * la institución, el día de la semana es el mismo se mire desde donde se mire.
 * Lo que sí depende de la zona es cuál es «hoy», y eso lo resuelve antes
 * `hoyEnZona`; calcular el lunes desde `new Date().getDay()` del servidor es lo
 * que devuelve la semana equivocada durante las horas en que el calendario del
 * servidor y el de la institución no coinciden.
 */
export function lunesDeLaSemana(fechaISO: string): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  // getUTCDay(): 0 = domingo. El domingo cierra la semana que empezó el lunes
  // anterior, así que retrocede seis días, no salta al día siguiente.
  return desplazarDias(fechaISO, -((d.getUTCDay() + 6) % 7));
}

/**
 * ¿Es una fecha de calendario válida?
 *
 * La comprobación no es sólo de forma: `new Date('2026-02-30T12:00:00Z')` no
 * lanza, devuelve `Invalid Date`, y el `toISOString()` que viene después
 * revienta con un 500 mudo. Se exige que la fecha sepa volver a su propio
 * texto, que descarta también los meses y días fuera de rango.
 */
export function esFechaISO(valor: string | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
