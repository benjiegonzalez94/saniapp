import { beforeAll, describe, expect, it } from 'vitest';

import { ClamAvEscaner, EscanerDesarrollo, crearEscaner } from './antivirus';

/**
 * Pruebas del antivirus.
 *
 * Las de ClamAV se omiten solas si el contenedor no está levantado, para que
 * `npm test` siga siendo ejecutable sin él. Cuando sí está, se ejercita el
 * protocolo INSTREAM completo contra un clamd con firmas reales:
 *
 *   npm run av:start
 */

/**
 * Cadena EICAR: el archivo de prueba estándar de la industria. Todo antivirus
 * la reconoce y no es malware — existe justo para poder probar el camino de
 * detección sin manejar nada peligroso.
 *
 * Va partida en trozos a propósito: escrita entera como literal, el antivirus
 * del equipo de desarrollo pondría en cuarentena este archivo fuente.
 */
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-', 'TEST-FILE!$H+H*'].join('');

describe('escáner de desarrollo', () => {
  const escaner = new EscanerDesarrollo();

  it('NUNCA da un archivo por limpio', async () => {
    // Lo importante de este sustituto: no miente. Un stub que dijera "limpio"
    // convertiría el antivirus en teatro y se colaría a producción sin que
    // nada fallara.
    const veredicto = await escaner.escanear(Buffer.from('contenido inocuo'));
    expect(veredicto.status).toBe('error');
    expect(veredicto.status === 'error' && veredicto.detail).toMatch(/No hay antivirus/);
  });

  it('sí reconoce EICAR, para poder ejercitar la detección', async () => {
    const veredicto = await escaner.escanear(Buffer.from(EICAR));
    expect(veredicto.status).toBe('infectado');
  });
});

describe('selección del escáner', () => {
  // host: null declara explícitamente que no hay antivirus. Con undefined se
  // tomaría del entorno, y en desarrollo eso significa el ClamAV local.
  it('exige ClamAV en producción y no se degrada en silencio', () => {
    expect(() => crearEscaner({ host: null, produccion: true })).toThrow(
      /el antivirus es obligatorio/
    );
  });

  it('en desarrollo cae al sustituto, que retiene todo', () => {
    const escaner = crearEscaner({ host: null, produccion: false });
    expect(escaner).toBeInstanceOf(EscanerDesarrollo);
  });

  it('con host configurado usa ClamAV', () => {
    expect(crearEscaner({ host: '10.0.0.5' })).toBeInstanceOf(ClamAvEscaner);
  });
});

describe('ClamAV por TCP', () => {
  const escaner = new ClamAvEscaner({ host: '127.0.0.1', port: 3310, timeoutMs: 30_000 });
  let disponible = false;

  beforeAll(async () => {
    disponible = await escaner.disponible();
    if (!disponible) {
      console.log('  (ClamAV no responde en 127.0.0.1:3310 — se omiten estas pruebas)');
    }
  });

  it.runIf(() => disponible)('responde al PING', async () => {
    expect(await escaner.disponible()).toBe(true);
  });

  it.runIf(() => disponible)('informa de su versión de firmas', async () => {
    const version = await escaner.version();
    expect(version).toMatch(/ClamAV/);
  });

  it.runIf(() => disponible)('da por limpio un PDF inocuo', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n');
    const veredicto = await escaner.escanear(pdf);
    expect(veredicto.status).toBe('limpio');
  });

  it.runIf(() => disponible)('detecta EICAR y nombra la amenaza', async () => {
    const veredicto = await escaner.escanear(Buffer.from(EICAR));
    expect(veredicto.status).toBe('infectado');
    expect(veredicto.status === 'infectado' && veredicto.detail).toMatch(/Eicar/i);
  });

  it.runIf(() => disponible)('detecta EICAR con espacios al final', async () => {
    // La especificación EICAR admite espacios de relleno hasta 128 bytes y
    // sigue siendo detectable. Rodearla de contenido arbitrario NO lo es —y
    // eso es correcto: la firma identifica el archivo de prueba completo, no
    // una cadena suelta dentro de otro archivo.
    const veredicto = await escaner.escanear(Buffer.from(EICAR + ' '.repeat(50)));
    expect(veredicto.status).toBe('infectado');
  });

  it.runIf(() => disponible)('analiza un archivo grande sin romperse', async () => {
    // Ejercita el troceado del protocolo INSTREAM: 300 kB obligan a varios
    // envíos de 64 kB con su cabecera de longitud cada uno.
    const grande = Buffer.alloc(300 * 1024, 0x41);
    const veredicto = await escaner.escanear(grande);
    expect(veredicto.status).toBe('limpio');
  });

  it('da error, no "limpio", si no hay clamd escuchando', async () => {
    // El modo de fallo importa: un antivirus inalcanzable debe retener el
    // archivo, nunca aprobarlo. Se apunta a un puerto donde no hay nada.
    const roto = new ClamAvEscaner({ host: '127.0.0.1', port: 1, timeoutMs: 2_000 });
    const veredicto = await roto.escanear(Buffer.from('cualquier cosa'));
    expect(veredicto.status).toBe('error');
  });
});
