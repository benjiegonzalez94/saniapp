import { beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';

import {
  DecryptionError,
  blindIndex,
  blindIndexEquals,
  decryptField,
  encryptField,
  encryptNationalId,
  isValidEcuadorianCedula,
  needsRotation,
  normalizeForIndex,
  resetCryptoCache,
  type FieldContext,
} from './crypto';

const KEY_V1 = randomBytes(32).toString('base64');
const KEY_V2 = randomBytes(32).toString('base64');
const BLIND_KEY = randomBytes(32).toString('base64');

const CTX: FieldContext = {
  table: 'clinical_notes',
  column: 'content',
  rowId: '11111111-1111-4111-8111-111111111111',
};

function configure(keys: Record<string, string>, active?: string) {
  process.env.SANITI_ENCRYPTION_KEYS = JSON.stringify(keys);
  if (active) process.env.SANITI_ACTIVE_KEY_VERSION = active;
  else delete process.env.SANITI_ACTIVE_KEY_VERSION;
  process.env.SANITI_BLIND_INDEX_KEY = BLIND_KEY;
  resetCryptoCache();
}

beforeEach(() => configure({ '1': KEY_V1 }));

describe('cifrado de campos', () => {
  it('devuelve el texto original tras cifrar y descifrar', () => {
    const plaintext = 'Paciente refiere cefalea occipital de 3 días de evolución.';
    const encrypted = encryptField(plaintext, CTX);

    expect(encrypted.ciphertext).not.toContain('cefalea');
    expect(decryptField(encrypted, CTX)).toBe(plaintext);
  });

  it('produce texto cifrado distinto para la misma entrada', () => {
    // El IV es aleatorio: si dos cifrados del mismo texto coincidieran, se
    // podría inferir qué pacientes comparten diagnóstico sin descifrar nada.
    const a = encryptField('hipertensión arterial', CTX);
    const b = encryptField('hipertensión arterial', CTX);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('conserva acentos, ñ y emoji', () => {
    const plaintext = 'Señora Muñoz — evolución favorable ✅ 38.5 °C';
    expect(decryptField(encryptField(plaintext, CTX), CTX)).toBe(plaintext);
  });

  it('cifra la cadena vacía sin perder el ida y vuelta', () => {
    expect(decryptField(encryptField('', CTX), CTX)).toBe('');
  });
});

describe('ligadura al contexto (AAD)', () => {
  it('rechaza el texto cifrado movido a otra fila', () => {
    const encrypted = encryptField('VIH positivo', CTX);
    const otraFila = { ...CTX, rowId: '22222222-2222-4222-8222-222222222222' };

    expect(() => decryptField(encrypted, otraFila)).toThrow(DecryptionError);
  });

  it('rechaza el texto cifrado movido a otra columna', () => {
    const encrypted = encryptField('1712345675', CTX);
    expect(() => decryptField(encrypted, { ...CTX, column: 'phone' })).toThrow(DecryptionError);
  });

  it('rechaza el texto cifrado movido a otra tabla', () => {
    const encrypted = encryptField('dato', CTX);
    expect(() => decryptField(encrypted, { ...CTX, table: 'documents' })).toThrow(DecryptionError);
  });
});

describe('detección de manipulación', () => {
  it('rechaza el texto cifrado alterado', () => {
    const encrypted = encryptField('resultado: negativo', CTX);
    const bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[bytes.length - 1] ^= 0xff; // un bit del cuerpo cifrado

    expect(() =>
      decryptField({ ...encrypted, ciphertext: bytes.toString('base64') }, CTX)
    ).toThrow(DecryptionError);
  });

  it('rechaza la etiqueta de autenticación alterada', () => {
    const encrypted = encryptField('resultado: negativo', CTX);
    const bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[12] ^= 0x01; // primer byte del authTag

    expect(() =>
      decryptField({ ...encrypted, ciphertext: bytes.toString('base64') }, CTX)
    ).toThrow(DecryptionError);
  });

  it('rechaza el texto cifrado truncado', () => {
    expect(() => decryptField({ ciphertext: 'YWJj', keyVersion: 1 }, CTX)).toThrow(
      /truncado o corrupto/
    );
  });
});

describe('rotación de claves', () => {
  it('sigue descifrando lo cifrado con la clave anterior', () => {
    const viejo = encryptField('antecedente quirúrgico', CTX);
    expect(viejo.keyVersion).toBe(1);

    configure({ '1': KEY_V1, '2': KEY_V2 }, '2');

    expect(decryptField(viejo, CTX)).toBe('antecedente quirúrgico');
    expect(needsRotation(viejo)).toBe(true);

    const nuevo = encryptField('antecedente quirúrgico', CTX);
    expect(nuevo.keyVersion).toBe(2);
    expect(needsRotation(nuevo)).toBe(false);
  });

  it('falla de forma explícita si se retiró una clave todavía en uso', () => {
    const viejo = encryptField('dato', CTX);
    configure({ '2': KEY_V2 }, '2');

    expect(() => decryptField(viejo, CTX)).toThrow(/No hay clave de versión 1/);
  });

  it('usa la versión más alta cuando no se declara la activa', () => {
    configure({ '1': KEY_V1, '2': KEY_V2 });
    expect(encryptField('x', CTX).keyVersion).toBe(2);
  });
});

describe('configuración inválida', () => {
  it('rechaza una clave que no mide 256 bits', () => {
    configure({ '1': randomBytes(16).toString('base64') });
    expect(() => encryptField('x', CTX)).toThrow(/32 bytes/);
  });

  it('rechaza una versión activa inexistente', () => {
    configure({ '1': KEY_V1 }, '7');
    expect(() => encryptField('x', CTX)).toThrow(/no existe/);
  });

  it('avisa cuando falta la variable de entorno', () => {
    delete process.env.SANITI_ENCRYPTION_KEYS;
    resetCryptoCache();
    expect(() => encryptField('x', CTX)).toThrow(/Falta SANITI_ENCRYPTION_KEYS/);
  });

  it('rechaza una clave con caracteres no válidos en base64', () => {
    // Buffer.from descarta en silencio lo que no reconoce, así que "!!!" se
    // ignoraría y estos 44 caracteres decodificarían a unos 32 bytes
    // perfectamente válidos... pero equivocados. Debe detectarse.
    const conErrata = KEY_V1.slice(0, -3) + '!!!';
    configure({ '1': conErrata });
    expect(() => encryptField('x', CTX)).toThrow(/no es base64 válido/);
  });

  it('tolera espacios alrededor de la clave', () => {
    // Copiar y pegar desde un gestor de secretos suele arrastrar un salto de
    // línea; no debe impedir arrancar.
    configure({ '1': `  ${KEY_V1}\n` });
    expect(decryptField(encryptField('x', CTX), CTX)).toBe('x');
  });
});

describe('índice ciego', () => {
  it('es determinista', () => {
    expect(blindIndexEquals(blindIndex('1712345675'), blindIndex('1712345675'))).toBe(true);
  });

  it('iguala las variantes de formato del mismo documento', () => {
    const canonico = blindIndex('1712345675');
    for (const variante of [' 1712345675 ', '171-234-5675', '171.234.5675', '171/2345675']) {
      expect(blindIndexEquals(blindIndex(variante), canonico)).toBe(true);
    }
  });

  it('distingue documentos distintos', () => {
    expect(blindIndexEquals(blindIndex('1712345675'), blindIndex('1712345676'))).toBe(false);
  });

  it('no filtra el valor original', () => {
    expect(blindIndex('1712345675').toString('hex')).not.toContain('1712345675');
  });

  it('normaliza separadores y mayúsculas', () => {
    expect(normalizeForIndex('  AB-12.34/56  ')).toBe('ab123456');
  });
});

describe('documento de identidad del paciente', () => {
  it('produce los tres campos coherentes entre sí', () => {
    const patientId = '33333333-3333-4333-8333-333333333333';
    const fields = encryptNationalId('171-234-5675', patientId);

    expect(fields.national_id_last4).toBe('5675');
    expect(blindIndexEquals(fields.national_id_bidx, blindIndex('1712345675'))).toBe(true);

    const descifrado = decryptField(
      { ciphertext: fields.national_id_enc, keyVersion: 1 },
      { table: 'patients', column: 'national_id', rowId: patientId }
    );
    expect(descifrado).toBe('1712345675');
  });

  it('rechaza un documento demasiado corto', () => {
    expect(() => encryptNationalId('12', 'x')).toThrow(/demasiado corto/);
  });
});

describe('cédula ecuatoriana', () => {
  it('acepta cédulas con dígito verificador correcto', () => {
    expect(isValidEcuadorianCedula('1712345675')).toBe(true);
    expect(isValidEcuadorianCedula('171-234-5675')).toBe(true);
  });

  it('rechaza un dígito verificador incorrecto', () => {
    expect(isValidEcuadorianCedula('1712345678')).toBe(false);
  });

  it('rechaza longitudes y provincias inválidas', () => {
    expect(isValidEcuadorianCedula('17123456')).toBe(false);
    expect(isValidEcuadorianCedula('9912345675')).toBe(false);
    expect(isValidEcuadorianCedula('0012345675')).toBe(false);
  });

  it('rechaza el tercer dígito fuera de rango para persona natural', () => {
    expect(isValidEcuadorianCedula('1762345675')).toBe(false);
  });

  it('rechaza texto no numérico', () => {
    expect(isValidEcuadorianCedula('abcdefghij')).toBe(false);
  });
});
