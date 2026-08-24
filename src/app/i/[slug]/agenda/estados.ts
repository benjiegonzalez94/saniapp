import type { AppointmentStatus } from '@/lib/db/types';

/**
 * Código de color y etiqueta del estado de una cita.
 *
 * Compartido por la vista de día y la de semana. Dos tablas de colores para lo
 * mismo divergen a la primera modificación, y entonces «por confirmar» es ámbar
 * en una pantalla y gris en la siguiente: un código de color que cambia de
 * significado entre vistas es peor que no tenerlo.
 */
export const ESTILO_ESTADO: Record<AppointmentStatus, string> = {
  solicitada: 'bg-(--color-aviso-suave) text-(--color-tinta)',
  confirmada: 'bg-(--color-acento-suave) text-(--color-acento-fuerte)',
  en_sala: 'bg-(--color-exito-suave) text-(--color-exito)',
  atendida: 'bg-(--color-superficie-2) text-(--color-tinta-3)',
  cancelada: 'bg-(--color-superficie-2) text-(--color-tinta-3) line-through',
  no_asistio: 'bg-(--color-riesgo-suave) text-(--color-riesgo)',
  reprogramada: 'bg-(--color-superficie-2) text-(--color-tinta-3)',
};

/**
 * No se reutiliza `APPOINTMENT_STATUS_LABELS`: en el mostrador `solicitada` se
 * lee como «Por confirmar» porque lo que importa no es de dónde salió la cita,
 * sino que todavía hay que llamar al paciente. Aquel mapa nombra el enum de la
 * base; éste nombra la tarea pendiente.
 */
export const ETIQUETA_ESTADO: Record<AppointmentStatus, string> = {
  solicitada: 'Por confirmar',
  confirmada: 'Confirmada',
  en_sala: 'En sala',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
  reprogramada: 'Reprogramada',
};

/**
 * Estados que no ocupan sitio en la agenda.
 *
 * Una cita cancelada o movida ya no es un compromiso: cuenta como hueco libre y
 * no debe inflar los totales de la semana ni empujar hacia abajo las citas
 * reales del día.
 */
export const ESTADOS_INACTIVOS: readonly AppointmentStatus[] = ['cancelada', 'reprogramada'];
