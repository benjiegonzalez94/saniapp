import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Cifrado de campo a nivel de aplicación.
 *
 * Por qué aquí y no en la base de datos: si se cifra con pgcrypto, la clave
 * acaba en la propia base (o en sus logs de consultas), así que un volcado o un
 * backup robado lo revela todo. Cifrando en el servidor de aplicación, la clave
 * vive en el gestor de secretos del despliegue y la base sólo custodia texto
 * cifrado que no puede leer.
 *
 * Formato: AES-256-GCM. El valor guardado es
 *     base64( iv(12) || authTag(16) || ciphertext )
 * y la versión de clave va en una columna aparte (`key_version`), para poder
 * rotar sin tener que descifrar y volver a cifrar todo el histórico de golpe.
 *
 * DATOS ASOCIADOS (AAD): cada valor se liga criptográficamente a DÓNDE vive
 * —tabla, columna y fila—. Sin esto, quien pudiera escribir en la base podría
 * copiar la cédula cifrada del paciente A a la fila del paciente B, o mover una
 * nota clínica entre expedientes, sin romper el cifrado. Con AAD, ese
 * movimiento hace que el descifrado falle.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // recomendado para GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

export type EncryptedField = {
  readonly ciphertext: string;
  readonly keyVersion: number;
};

/** Identifica de forma única el hueco que ocupa un valor cifrado. */
export type FieldContext = {
  readonly table: string;
  readonly column: string;
  readonly rowId: string;
};

class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoConfigError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DecryptionError';
  }
}

let cachedKeys: Map<number, Buffer> | null = null;
let cachedActiveVersion: number | null = null;

function parseKeyMaterial(raw: string, label: string): Buffer {
  const trimmed = raw.trim();

  // Buffer.from(..., 'base64') NO lanza ante una entrada inválida: descarta en
  // silencio los caracteres que no reconoce. Sin esta comprobación, una clave
  // con una errata podría decodificar a 32 bytes igualmente válidos y pasar
  // desapercibida, dejando ilegible todo lo que se cifre con ella.
  const key = Buffer.from(trimmed, 'base64');
  if (key.toString('base64').replace(/=+$/, '') !== trimmed.replace(/=+$/, '')) {
    throw new CryptoConfigError(
      `${label} no es base64 válido. Genere una clave con: openssl rand -base64 32`
    );
  }

  if (key.length !== KEY_BYTES) {
    throw new CryptoConfigError(
      `${label} debe tener ${KEY_BYTES} bytes (${KEY_BYTES * 8} bits); tiene ${key.length}. ` +
        'Genere una con: openssl rand -base64 32'
    );
  }
  return key;
}

/**
 * SANITI_ENCRYPTION_KEYS es un JSON {"<version>": "<clave base64>"} para que
 * durante una rotación convivan la clave nueva y las viejas: se cifra con la
 * activa y se sigue pudiendo leer lo cifrado con las anteriores.
 */
function loadKeys(): { keys: Map<number, Buffer>; activeVersion: number } {
  if (cachedKeys && cachedActiveVersion !== null) {
    return { keys: cachedKeys, activeVersion: cachedActiveVersion };
  }

  const raw = process.env.SANITI_ENCRYPTION_KEYS;
  if (!raw) {
    throw new CryptoConfigError(
      'Falta SANITI_ENCRYPTION_KEYS. Sin ella no se puede leer ni escribir ningún ' +
        'dato clínico cifrado. Vea .env.example.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CryptoConfigError(
      'SANITI_ENCRYPTION_KEYS debe ser un JSON del tipo {"1":"<base64>"}'
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CryptoConfigError('SANITI_ENCRYPTION_KEYS debe ser un objeto JSON');
  }

  const keys = new Map<number, Buffer>();
  for (const [version, material] of Object.entries(parsed as Record<string, unknown>)) {
    const numeric = Number(version);
    if (!Number.isInteger(numeric) || numeric < 1) {
      throw new CryptoConfigError(
        `Versión de clave inválida "${version}": debe ser un entero positivo`
      );
    }
    if (typeof material !== 'string') {
      throw new CryptoConfigError(`La clave de versión ${version} debe ser una cadena base64`);
    }
    keys.set(numeric, parseKeyMaterial(material, `SANITI_ENCRYPTION_KEYS[${version}]`));
  }

  if (keys.size === 0) {
    throw new CryptoConfigError('SANITI_ENCRYPTION_KEYS no contiene ninguna clave');
  }

  const declared = process.env.SANITI_ACTIVE_KEY_VERSION;
  const activeVersion = declared ? Number(declared) : Math.max(...keys.keys());

  if (!keys.has(activeVersion)) {
    throw new CryptoConfigError(
      `SANITI_ACTIVE_KEY_VERSION=${activeVersion} no existe en SANITI_ENCRYPTION_KEYS`
    );
  }

  cachedKeys = keys;
  cachedActiveVersion = activeVersion;
  return { keys, activeVersion };
}

/** Limpia la caché de claves. Sólo para pruebas. */
export function resetCryptoCache(): void {
  cachedKeys = null;
  cachedActiveVersion = null;
}

function buildAad(context: FieldContext): Buffer {
  return Buffer.from(`saniti:v1:${context.table}:${context.column}:${context.rowId}`, 'utf8');
}

export function encryptField(plaintext: string, context: FieldContext): EncryptedField {
  const { keys, activeVersion } = loadKeys();
  const key = keys.get(activeVersion)!;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(buildAad(context));

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([iv, tag, encrypted]).toString('base64'),
    keyVersion: activeVersion,
  };
}

export function decryptField(
  field: EncryptedField,
  context: FieldContext
): string {
  const { keys } = loadKeys();
  const key = keys.get(field.keyVersion);

  if (!key) {
    throw new DecryptionError(
      `No hay clave de versión ${field.keyVersion}. Nunca retire una clave antigua de ` +
        'SANITI_ENCRYPTION_KEYS mientras queden filas cifradas con ella.'
    );
  }

  // Un base64 corrupto no lanza aquí: produce menos bytes de los debidos y lo
  // atrapa la comprobación de longitud, o falla la etiqueta de autenticación.
  const raw = Buffer.from(field.ciphertext, 'base64');

  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new DecryptionError('Texto cifrado truncado o corrupto');
  }

  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(buildAad(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch (cause) {
    // Un fallo aquí no es "dato ilegible": significa que el texto cifrado fue
    // alterado, o que procede de otra fila o columna de la que dice ocupar.
    throw new DecryptionError(
      `Fallo de autenticación al descifrar ${context.table}.${context.column} ` +
        `(fila ${context.rowId}). El dato fue manipulado o movido de sitio.`,
      { cause }
    );
  }
}

/** ¿Hay que volver a cifrar este valor con la clave activa? */
export function needsRotation(field: EncryptedField): boolean {
  const { activeVersion } = loadKeys();
  return field.keyVersion !== activeVersion;
}

/* -------------------------------------------------------------------------- */
/* Índice ciego                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Permite `where national_id_bidx = $1` sin guardar la cédula en claro.
 *
 * Es HMAC, no un hash pelado: con SHA-256 a secas, el espacio de cédulas
 * ecuatorianas (10 dígitos) se recorre entero en segundos con una tabla
 * precomputada. La clave secreta convierte ese ataque en imposible sin ella.
 *
 * Va en su propia clave, distinta de las de cifrado: el índice viaja en las
 * consultas y aparece en los planes de ejecución y en los logs de sentencias
 * lentas, así que se le supone más expuesto.
 */
export function blindIndex(value: string): Buffer {
  const raw = process.env.SANITI_BLIND_INDEX_KEY;
  if (!raw) {
    throw new CryptoConfigError(
      'Falta SANITI_BLIND_INDEX_KEY. Sin ella no se puede buscar por documento de identidad.'
    );
  }
  const key = parseKeyMaterial(raw, 'SANITI_BLIND_INDEX_KEY');
  return createHmac('sha256', key).update(normalizeForIndex(value), 'utf8').digest();
}

/**
 * La misma cédula escrita "1712345678", " 1712345678 " o "171-234-567-8" debe
 * producir el mismo índice, o el paciente se duplica en el padrón.
 */
export function normalizeForIndex(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.\-/]/g, '');
}

/** Comparación en tiempo constante de dos índices ciegos. */
export function blindIndexEquals(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Ayudas de dominio                                                           */
/* -------------------------------------------------------------------------- */

export type NationalIdFields = {
  national_id_enc: string;
  national_id_bidx: Buffer;
  national_id_last4: string;
};

export function encryptNationalId(value: string, patientId: string): NationalIdFields {
  const normalized = normalizeForIndex(value);
  if (normalized.length < 4) {
    throw new Error('El documento de identidad es demasiado corto');
  }

  const { ciphertext } = encryptField(normalized, {
    table: 'patients',
    column: 'national_id',
    rowId: patientId,
  });

  return {
    national_id_enc: ciphertext,
    national_id_bidx: blindIndex(normalized),
    // Los últimos 4 permiten cotejar identidad en mostrador sin descifrar nada.
    national_id_last4: normalized.slice(-4),
  };
}

/**
 * Valida el dígito verificador de una cédula ecuatoriana (algoritmo módulo 10).
 * Atrapa la errata de digitación en el mostrador, antes de que cree un paciente
 * duplicado o impida encontrar el expediente correcto.
 */
export function isValidEcuadorianCedula(value: string): boolean {
  const digits = normalizeForIndex(value);
  if (!/^\d{10}$/.test(digits)) return false;

  const province = Number(digits.slice(0, 2));
  if (province < 1 || (province > 24 && province !== 30)) return false;

  const thirdDigit = Number(digits[2]);
  if (thirdDigit > 5) return false; // 6 y 7 no corresponden a personas naturales

  let total = 0;
  for (let i = 0; i < 9; i++) {
    const digit = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = digit * 2;
      total += doubled > 9 ? doubled - 9 : doubled;
    } else {
      total += digit;
    }
  }

  const remainder = total % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;
  return checkDigit === Number(digits[9]);
}
