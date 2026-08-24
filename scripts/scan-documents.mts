/**
 * Worker de análisis antivirus.
 *
 *   npm run scan          # una pasada
 *   npm run scan:watch    # en bucle, para desarrollo
 *
 * Toma documentos `pendiente` de la cola, los descarga de Storage, los pasa por
 * el antivirus y registra el veredicto. Varios workers pueden correr en paralelo
 * sin pisarse: `claim_documents_for_scan` usa `for update skip locked`.
 *
 * Usa la clave de servicio porque no hay usuario detrás. Es un uso legítimo —de
 * los cuatro que documenta docs/SECURITY.md— y por eso registra en la bitácora
 * todo lo que hace.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import { crearEscaner } from '../src/lib/security/antivirus';
import { BUCKET } from '../src/lib/db/documents-constants';

const envLocal = join(process.cwd(), '.env.local');
if (existsSync(envLocal)) config({ path: envLocal, quiet: true });



type Pendiente = {
  id: string;
  tenant_id: string;
  patient_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  scan_attempts: number;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Revise .env.local.'
  );
  process.exit(1);
}

const supabase = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const escaner = crearEscaner();

async function unaPasada(): Promise<number> {
  const { data, error } = await supabase.rpc('claim_documents_for_scan', { p_limite: 5 });

  if (error) {
    console.error('[antivirus] no se pudo tomar trabajo de la cola:', error.message);
    return 0;
  }

  const pendientes = (data ?? []) as Pendiente[];
  if (pendientes.length === 0) return 0;

  for (const doc of pendientes) {
    const etiqueta = `${doc.id.slice(0, 8)} (${(doc.size_bytes / 1024).toFixed(0)} kB)`;

    try {
      const { data: archivo, error: errDescarga } = await supabase.storage
        .from(BUCKET)
        .download(doc.storage_path);

      if (errDescarga || !archivo) {
        // El hueco existe pero el archivo no: el cliente reservó y nunca subió.
        // No es infección; es un registro incompleto y así se marca.
        await registrar(doc.id, 'error', escaner.nombre, null,
          'No hay archivo en Storage: la subida no se completó.');
        console.log(`  ${etiqueta} sin archivo → error`);
        continue;
      }

      const contenido = Buffer.from(await archivo.arrayBuffer());
      const veredicto = await escaner.escanear(contenido);

      await registrar(
        doc.id,
        veredicto.status,
        veredicto.engine,
        veredicto.signatureVersion,
        'detail' in veredicto ? veredicto.detail : null
      );

      const marca =
        veredicto.status === 'limpio' ? 'ok  ' : veredicto.status === 'infectado' ? 'ALERTA' : 'error';
      console.log(
        `  ${marca} ${etiqueta}` +
          ('detail' in veredicto && veredicto.detail ? ` — ${veredicto.detail}` : '')
      );
    } catch (err) {
      // El intento ya quedó contado al tomar el trabajo. Tras 3 fallos el
      // documento sale de la cola y queda visible como `error`, no invisible.
      console.error(
        `  fallo ${etiqueta} (intento ${doc.scan_attempts}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return pendientes.length;
}

async function registrar(
  id: string,
  estado: string,
  motor: string,
  firmas: string | null,
  detalle: string | null
) {
  const { error } = await supabase.rpc('record_scan_result', {
    p_document_id: id,
    p_status: estado,
    p_engine: motor,
    p_signature_version: firmas,
    p_detail: detalle,
  });
  if (error) console.error('[antivirus] no se pudo registrar el veredicto:', error.message);
}

const enBucle = process.argv.includes('--watch');

console.log(`Antivirus: ${escaner.nombre}`);
if (!(await escaner.disponible())) {
  console.warn(
    'AVISO: el motor no responde. Los documentos quedarán retenidos sin analizar,\n' +
      '       que es el comportamiento correcto: no se sirve nada sin analizar.'
  );
}

if (enBucle) {
  console.log('En bucle. Ctrl+C para salir.\n');
  for (;;) {
    const n = await unaPasada();
    // Sin trabajo se espera más: la cola de una clínica está vacía casi siempre.
    await new Promise((r) => setTimeout(r, n > 0 ? 500 : 5_000));
  }
} else {
  const n = await unaPasada();
  console.log(n === 0 ? 'Cola vacía.' : `${n} documento(s) procesado(s).`);
  process.exit(0);
}
