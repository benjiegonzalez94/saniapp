import 'server-only';

import { randomUUID } from 'node:crypto';

import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import type { DocumentKind } from '@/lib/db/types';

/**
 * Estudios y documentos del paciente.
 *
 * El archivo vive en Supabase Storage, bucket `clinical`, con la ruta
 *     {tenant_id}/{patient_id}/{document_id}
 * y las políticas de storage.objects derivan la institución del primer segmento,
 * así que el aislamiento entre clínicas también aplica al bucket.
 *
 * NUNCA se sirve una URL pública. La descarga pasa por una URL firmada de corta
 * vida que este módulo emite sólo si el antivirus ya dio el archivo por limpio.
 */

export { BUCKET, TIPOS_ADMITIDOS, TAMANO_MAXIMO } from './documents-constants';
import { TIPOS_ADMITIDOS, TAMANO_MAXIMO, BUCKET } from './documents-constants';

export type EstadoAnalisis = 'pendiente' | 'limpio' | 'infectado' | 'error';

export type DocumentoResumen = {
  id: string;
  kind: DocumentKind;
  title: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  scanStatus: EstadoAnalisis;
  scanDetail: string | null;
  studyDate: string | null;
  createdAt: string;
  uploadedByName: string;
};

/**
 * Un estudio visto desde la institución, no desde el expediente: aquí el
 * paciente deja de ser el contexto implícito y pasa a ser un dato más de la
 * fila, porque sin él la lista no se puede leer.
 */
export type DocumentoInstitucion = DocumentoResumen & {
  patient: {
    id: string;
    givenName: string;
    familyName: string;
    recordNumber: number;
  };
};

export type FiltrosDocumentos = {
  kind?: DocumentKind | null;
  scanStatus?: EstadoAnalisis | null;
};

/**
 * Los dos `select` van repetidos y en una sola línea a propósito: concatenar
 * con `+` ensancha el literal a `string` y supabase-js pierde la inferencia de
 * la fila. Cambiar uno obliga a mirar el otro.
 */
const CAMPOS_PACIENTE =
  'id, kind, title, description, mime_type, size_bytes, scan_status, scan_detail, study_date, created_at, uploader:profiles!documents_uploaded_by_fkey(full_name)' as const;

const CAMPOS_INSTITUCION =
  'id, kind, title, description, mime_type, size_bytes, scan_status, scan_detail, study_date, created_at, uploader:profiles!documents_uploaded_by_fkey(full_name), patient:patients!documents_patient_id_fkey(id, given_name, family_name, record_number)' as const;

/** Forma cruda compartida por los dos listados. */
type FilaDocumento = {
  id: string;
  kind: DocumentKind;
  title: string;
  description: string | null;
  mime_type: string;
  size_bytes: number;
  scan_status: EstadoAnalisis;
  scan_detail: string | null;
  study_date: string | null;
  created_at: string;
  uploader: { full_name: string } | null;
};

function aResumen(f: FilaDocumento): DocumentoResumen {
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    description: f.description,
    mimeType: f.mime_type,
    // `size_bytes` es `bigint` en Postgres y supabase-js lo entrega como número
    // sólo mientras quepa; el `Number()` deja explícito que aquí se asume que
    // cabe, cosa que el tope de 100 MB de la tabla garantiza.
    sizeBytes: Number(f.size_bytes),
    scanStatus: f.scan_status,
    scanDetail: f.scan_detail,
    studyDate: f.study_date,
    createdAt: f.created_at,
    uploadedByName: f.uploader?.full_name ?? 'Desconocido',
  };
}

/**
 * Reserva el hueco de un documento y devuelve una URL de subida firmada.
 *
 * Dos pasos y no uno porque el identificador tiene que existir antes de que
 * exista el archivo: la ruta en Storage lo lleva dentro. Si el cliente nunca
 * sube nada, queda una fila `pendiente` sin archivo — detectable y limpiable,
 * que es preferible a un archivo huérfano sin fila que lo describa.
 */
export async function reservarSubida(
  tenantId: string,
  patientId: string,
  uploadedBy: string,
  meta: {
    kind: DocumentKind;
    title: string;
    description?: string | null;
    mimeType: string;
    sizeBytes: number;
    studyDate?: string | null;
  }
): Promise<{ documentId: string; path: string; token: string }> {
  if (!TIPOS_ADMITIDOS.includes(meta.mimeType as (typeof TIPOS_ADMITIDOS)[number])) {
    throw new Error(`Tipo de archivo no admitido: ${meta.mimeType}`);
  }
  if (meta.sizeBytes <= 0 || meta.sizeBytes > TAMANO_MAXIMO) {
    throw new Error('El archivo excede el máximo de 100 MB');
  }

  const supabase = await createClient();
  const documentId = randomUUID();
  const path = `${tenantId}/${patientId}/${documentId}`;

  // La fila nace `pendiente` por defecto y la política de INSERT lo exige: el
  // cliente no puede declarar limpio su propio archivo.
  const { error } = await supabase.from('documents').insert({
    id: documentId,
    tenant_id: tenantId,
    patient_id: patientId,
    kind: meta.kind,
    title: meta.title.trim(),
    description: meta.description?.trim() || null,
    storage_path: path,
    mime_type: meta.mimeType,
    size_bytes: meta.sizeBytes,
    study_date: meta.studyDate || null,
    uploaded_by: uploadedBy,
  });
  if (error) throw error;

  const { data, error: errUrl } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (errUrl) throw errUrl;

  await audit({
    action: 'create',
    resourceType: 'documents',
    resourceId: documentId,
    tenantId,
    patientId,
    summary: `Subió el estudio «${meta.title}» (pendiente de análisis)`,
    metadata: { kind: meta.kind, mime: meta.mimeType, bytes: meta.sizeBytes },
  });

  return { documentId, path, token: data.token };
}

export async function listarDocumentos(
  tenantId: string,
  patientId: string
): Promise<DocumentoResumen[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documents')
    .select(CAMPOS_PACIENTE)
    .eq('tenant_id', tenantId)
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((d) => aResumen(d));
}

/**
 * Estudios de TODA la institución.
 *
 * Existe porque quien atiende la cola del antivirus o busca «el eco de ayer»
 * no sabe todavía de qué paciente es: entrar por el expediente exige conocer la
 * respuesta antes de preguntar.
 *
 * No amplía lo que se ve. `documents_select` sigue exigiendo
 * `app.can_read_patient()` fila a fila, así que en una institución con modelo
 * `care_team` esta lista sale recortada a los pacientes del propio equipo, y
 * eso es lo correcto: la vista de institución es una comodidad de navegación,
 * no una llave maestra.
 *
 * Tampoco se audita, por lo mismo que no se auditan las búsquedas de pacientes:
 * un evento por listado ahogaría la bitácora justo donde importa. Lo que se
 * audita es abrir el archivo, y de eso se encarga `urlDescarga`.
 */
export type PaginaDocumentos = {
  filas: DocumentoInstitucion[];
  /** Si hay al menos una fila más allá de esta página. */
  hayMas: boolean;
};

export async function listarDocumentosInstitucion(
  tenantId: string,
  filtros: FiltrosDocumentos = {},
  limite = 50,
  desplazamiento = 0
): Promise<PaginaDocumentos> {
  const supabase = await createClient();

  // Se pide una fila de más en vez de un `count: 'exact'`. Saber si existe la
  // página siguiente es todo lo que necesita la interfaz, y contar todas las
  // filas obliga a Postgres a recorrer el índice entero en cada carga; con un
  // solo hospital da igual, con doscientos no.
  let consulta = supabase
    .from('documents')
    .select(CAMPOS_INSTITUCION)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    // El orden por fecha empata cuando se suben varios estudios en el mismo
    // lote; sin un desempate estable la misma fila puede salir en dos páginas
    // y otra en ninguna.
    .order('id', { ascending: false })
    .range(desplazamiento, desplazamiento + limite);

  if (filtros.kind) consulta = consulta.eq('kind', filtros.kind);
  if (filtros.scanStatus) consulta = consulta.eq('scan_status', filtros.scanStatus);

  const { data, error } = await consulta;
  if (error) throw error;

  const hayMas = data.length > limite;

  // Sin cruzar por `unknown`: el `select` de arriba sí infiere, y dejar que
  // TypeScript compruebe la forma real es lo que hace que una columna renombrada
  // en una migración rompa aquí y no en producción.
  const filas = data.slice(0, limite).map((d) => ({
    ...aResumen(d),
    patient: {
      // El `left join` es imposible en la práctica —`patient_id` es NOT NULL y
      // RLS ya filtró por él— pero supabase-js tipa la relación como anulable y
      // fingir lo contrario con un `!` escondería una fila rota en vez de
      // pintarla.
      id: d.patient?.id ?? '',
      givenName: d.patient?.given_name ?? '—',
      familyName: d.patient?.family_name ?? '',
      recordNumber: d.patient?.record_number ?? 0,
    },
  }));

  return { filas, hayMas };
}

export class DocumentoNoServibleError extends Error {
  readonly estado: EstadoAnalisis;
  constructor(estado: EstadoAnalisis, detalle: string) {
    super(detalle);
    this.name = 'DocumentoNoServibleError';
    this.estado = estado;
  }
}

/**
 * Emite una URL de descarga firmada, válida 60 segundos.
 *
 * Aquí está la puerta: **sólo un archivo `limpio` se sirve**. Un `pendiente` no
 * se ha analizado todavía y un `infectado` o `error` no se sirve nunca. La
 * comprobación va antes de firmar nada, no después.
 *
 * 60 segundos porque una URL firmada es un permiso al portador: quien la tenga
 * descarga el archivo sin sesión. El tiempo justo para que el navegador la siga.
 */
export async function urlDescarga(
  tenantId: string,
  documentId: string
): Promise<{ url: string; title: string; mimeType: string }> {
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, patient_id, title, storage_path, mime_type, scan_status, scan_detail')
    .eq('tenant_id', tenantId)
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;

  if (doc.scan_status !== 'limpio') {
    // Se audita el intento: alguien quiso abrir un archivo retenido, y si está
    // marcado como infectado eso conviene saberlo.
    await audit({
      action: 'permission_denied',
      resourceType: 'documents',
      resourceId: documentId,
      tenantId,
      patientId: doc.patient_id,
      summary: `Intento de descarga de un estudio en estado «${doc.scan_status}»`,
    });

    throw new DocumentoNoServibleError(
      doc.scan_status as EstadoAnalisis,
      doc.scan_status === 'pendiente'
        ? 'El archivo está en cola de análisis antivirus. Vuelva a intentarlo en unos minutos.'
        : doc.scan_status === 'infectado'
          ? `El antivirus rechazó este archivo (${doc.scan_detail ?? 'amenaza detectada'}). No se puede descargar.`
          : `El archivo no pudo analizarse (${doc.scan_detail ?? 'error desconocido'}). No se sirve sin análisis.`
    );
  }

  const { data, error: errUrl } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.title });

  if (errUrl) throw errUrl;

  await audit({
    action: 'export',
    resourceType: 'documents',
    resourceId: documentId,
    tenantId,
    patientId: doc.patient_id,
    summary: `Descargó el estudio «${doc.title}»`,
  });

  return { url: data.signedUrl, title: doc.title, mimeType: doc.mime_type };
}

/** Estado de la cola de análisis, para avisar en la interfaz. */
export async function estadoColaAntivirus(tenantId: string): Promise<{
  pendientes: number;
  infectados: number;
  conError: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('estado_cola_antivirus', { p_tenant_id: tenantId })
    .single();

  if (error) throw error;

  return {
    pendientes: Number(data.pendientes ?? 0),
    infectados: Number(data.infectados ?? 0),
    conError: Number(data.con_error ?? 0),
  };
}
