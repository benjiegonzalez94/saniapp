import { connect, type Socket } from 'node:net';

/**
 * Análisis antivirus de los archivos que suben los usuarios.
 *
 * Sin `import 'server-only'` a propósito: lo usa el worker
 * scripts/scan-documents.mts, que corre en Node puro, y ese guardián lanza
 * fuera del runtime de Next. Aquí no hay secretos ni acceso a datos —sólo un
 * cliente TCP— así que el guardián costaría más de lo que protege.
 *
 * POR QUÉ AUTOALOJADO
 *
 * Un estudio de laboratorio lleva el nombre del paciente, su cédula y su
 * diagnóstico. Mandarlo a VirusTotal o a cualquier API de análisis en la nube no
 * es "escanear un archivo": es una transferencia internacional de datos de salud
 * a un tercero que los conserva. Bajo la LOPDP eso exige base legal, contrato de
 * encargo y consentimiento — y nada de eso se justifica cuando un ClamAV en un
 * contenedor hace lo mismo sin que el archivo salga de la infraestructura.
 *
 * Se habla el protocolo INSTREAM de clamd directamente por TCP. Las bibliotecas
 * de npm para esto son envoltorios de treinta líneas sobre un protocolo trivial,
 * y en la ruta por la que pasan archivos de pacientes preferimos una dependencia
 * menos que auditar.
 */

export type VeredictoAntivirus =
  | { status: 'limpio'; engine: string; signatureVersion: string | null }
  | { status: 'infectado'; engine: string; signatureVersion: string | null; detail: string }
  // El error también puede traer versión: si clamd respondió pero rehusó
  // analizar —por tamaño, por ejemplo—, saber con qué firmas corría ayuda a
  // diagnosticar. Es justo el caso en que uno quiere más datos, no menos.
  | { status: 'error'; engine: string; signatureVersion: string | null; detail: string };

export interface EscanerAntivirus {
  readonly nombre: string;
  /** Comprueba que el motor responde antes de dar por bueno un despliegue. */
  disponible(): Promise<boolean>;
  escanear(contenido: Buffer): Promise<VeredictoAntivirus>;
}

/* -------------------------------------------------------------------------- */
/* ClamAV sobre TCP (protocolo INSTREAM)                                       */
/* -------------------------------------------------------------------------- */

const TAMANO_TROZO = 64 * 1024;

type OpcionesClamAv = {
  host?: string;
  port?: number;
  timeoutMs?: number;
};

export class ClamAvEscaner implements EscanerAntivirus {
  readonly nombre = 'ClamAV';
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private versionCache: string | null = null;

  constructor(opciones: OpcionesClamAv = {}) {
    this.host = opciones.host ?? process.env.CLAMAV_HOST ?? '127.0.0.1';
    this.port = Number(opciones.port ?? process.env.CLAMAV_PORT ?? 3310);
    // Un archivo de 100 MB con firmas actualizadas puede tardar. 120 s es
    // holgado y sigue siendo un techo: un clamd colgado no bloquea la cola.
    this.timeoutMs = opciones.timeoutMs ?? 120_000;
  }

  private conversacion(escribir: (socket: Socket) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port });
      const trozos: Buffer[] = [];
      let terminado = false;

      const acabar = (fn: () => void) => {
        if (terminado) return;
        terminado = true;
        socket.destroy();
        fn();
      };

      socket.setTimeout(this.timeoutMs);
      socket.on('timeout', () =>
        acabar(() => reject(new Error(`clamd no respondió en ${this.timeoutMs} ms`)))
      );
      socket.on('error', (err) => acabar(() => reject(err)));
      socket.on('data', (d) => trozos.push(d));
      socket.on('end', () =>
        acabar(() => resolve(Buffer.concat(trozos).toString('utf8').trim()))
      );
      socket.on('connect', () => escribir(socket));
    });
  }

  async version(): Promise<string | null> {
    if (this.versionCache) return this.versionCache;
    try {
      // El prefijo 'z' indica comando terminado en NUL, que es el modo
      // recomendado: 'n' (terminado en salto de línea) está en desuso.
      const respuesta = await this.conversacion((s) => s.write('zVERSION\0'));
      this.versionCache = respuesta.replace(/\0/g, '') || null;
      return this.versionCache;
    } catch {
      return null;
    }
  }

  async disponible(): Promise<boolean> {
    try {
      const respuesta = await this.conversacion((s) => s.write('zPING\0'));
      return respuesta.replace(/\0/g, '') === 'PONG';
    } catch {
      return false;
    }
  }

  async escanear(contenido: Buffer): Promise<VeredictoAntivirus> {
    const version = await this.version();

    let respuesta: string;
    try {
      respuesta = await this.conversacion((socket) => {
        socket.write('zINSTREAM\0');

        // INSTREAM: cada trozo va precedido de su tamaño en 4 bytes big-endian,
        // y un tamaño 0 marca el final del flujo.
        for (let offset = 0; offset < contenido.length; offset += TAMANO_TROZO) {
          const trozo = contenido.subarray(offset, offset + TAMANO_TROZO);
          const cabecera = Buffer.alloc(4);
          cabecera.writeUInt32BE(trozo.length, 0);
          socket.write(cabecera);
          socket.write(trozo);
        }

        socket.write(Buffer.from([0, 0, 0, 0]));
      });
    } catch (err) {
      return {
        status: 'error',
        engine: this.nombre,
        signatureVersion: null,
        detail: err instanceof Error ? err.message : 'fallo al comunicar con clamd',
      };
    }

    const limpia = respuesta.replace(/\0/g, '').trim();

    if (limpia.endsWith('OK')) {
      return { status: 'limpio', engine: this.nombre, signatureVersion: version };
    }

    if (limpia.endsWith('FOUND')) {
      // Formato: "stream: Eicar-Signature FOUND"
      const amenaza = limpia.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '');
      return {
        status: 'infectado',
        engine: this.nombre,
        signatureVersion: version,
        detail: amenaza || 'amenaza sin nombre',
      };
    }

    // Incluye el caso "size limit exceeded": clamd rehusó analizarlo. No es
    // limpio ni infectado, y tratarlo como limpio sería el error grave.
    return {
      status: 'error',
      engine: this.nombre,
      signatureVersion: version,
      detail: limpia || 'respuesta desconocida de clamd',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Escáner de desarrollo                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Sustituto para desarrollo sin ClamAV levantado.
 *
 * NO da nada por limpio. Devuelve `error` con un motivo explícito, de modo que
 * el archivo queda subido pero no descargable. Un sustituto que dijera "limpio"
 * convertiría el antivirus en teatro y, peor, se colaría a producción sin que
 * nada fallara.
 *
 * Reconoce la cadena de prueba EICAR para poder ejercitar el camino de
 * detección sin malware real.
 */
export class EscanerDesarrollo implements EscanerAntivirus {
  readonly nombre = 'sin-antivirus (desarrollo)';

  async disponible(): Promise<boolean> {
    return true;
  }

  async escanear(contenido: Buffer): Promise<VeredictoAntivirus> {
    const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    if (contenido.includes(EICAR)) {
      return {
        status: 'infectado',
        engine: this.nombre,
        signatureVersion: null,
        detail: 'Eicar-Test-Signature',
      };
    }

    return {
      status: 'error',
      engine: this.nombre,
      signatureVersion: null,
      detail:
        'No hay antivirus configurado. El archivo queda retenido y no se puede descargar. ' +
        'Levante ClamAV (docker compose -f docker-compose.clamav.yml up -d) y reintente.',
    };
  }
}

/**
 * Devuelve el escáner configurado.
 *
 * En producción exige ClamAV: sin él, el arranque falla en vez de degradarse en
 * silencio a "no analizar nada".
 *
 * Los parámetros existen para poder probar esa decisión sin manipular
 * `process.env`, que en Node no siempre se puede redefinir.
 */
export function crearEscaner(
  opciones: {
    /** `undefined` = tomar del entorno. `null` = declarar que NO hay host. */
    host?: string | null;
    produccion?: boolean;
  } = {}
): EscanerAntivirus {
  // Los dos ausentes no significan lo mismo, y confundirlos hacía que una
  // prueba de "sin antivirus" heredara el CLAMAV_HOST del .env.local y pasara
  // por el camino equivocado.
  const host = opciones.host === null ? undefined : (opciones.host ?? process.env.CLAMAV_HOST);
  const produccion = opciones.produccion ?? process.env.NODE_ENV === 'production';

  if (!host) {
    if (produccion) {
      throw new Error(
        'CLAMAV_HOST no está configurado. SaniTi no sirve archivos sin analizar, ' +
          'así que en producción el antivirus es obligatorio.'
      );
    }
    return new EscanerDesarrollo();
  }

  return new ClamAvEscaner({ host });
}
