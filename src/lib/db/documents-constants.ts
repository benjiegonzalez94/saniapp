/**
 * Constantes de los estudios clínicos.
 *
 * Deliberadamente SIN `import 'server-only'`: las comparte el worker de
 * antivirus (scripts/scan-documents.mts), que corre en Node puro y no en el
 * runtime de Next, donde ese guardián lanza al importarse. Aquí no hay secretos
 * ni acceso a datos, sólo límites que el cliente y el servidor deben compartir.
 */

/** Bucket privado de Supabase Storage. Nunca se sirve una URL pública. */
export const BUCKET = 'clinical';

/** Replica allowed_mime_types del bucket (migración 0007). */
export const TIPOS_ADMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/dicom',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const TAMANO_MAXIMO = 100 * 1024 * 1024; // 100 MB
