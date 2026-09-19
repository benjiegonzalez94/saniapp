-- =============================================================================
-- 0018_patient_key_version.sql  ·  SaniTi
-- La cédula cifrada guarda con qué versión de clave se cifró.
--
-- POR QUÉ HACÍA FALTA
--
-- `encryptField()` devuelve dos cosas: el texto cifrado y la versión de clave
-- que lo produjo. `clinical_notes` guarda ambas y por eso `decryptField()`
-- puede leerla años después, con varias claves conviviendo.
--
-- `encryptNationalId()` se quedaba sólo con el texto y tiraba la versión:
--
--     const { ciphertext } = encryptField(normalized, {...});
--
-- Nadie lo notó porque la cédula se cifra y NUNCA se vuelve a descifrar en la
-- aplicación: para buscar se usa el índice ciego y para cotejar en mostrador
-- los últimos cuatro dígitos. Un dato que sólo se escribe no delata que no se
-- puede leer.
--
-- Pero el dato existe y hay dos caminos que lo necesitan en claro:
--
--   · La LOPDP da al paciente derecho de acceso a sus datos. Una solicitud de
--     `data_subject_requests` tendría que poder devolverle su propia cédula.
--   · El día de la primera rotación de clave, `decryptField()` exigiría una
--     versión que no está guardada en ninguna parte, y `needsRotation()` ni
--     siquiera podría decir qué filas hay que recifrar. La única salida sería
--     probar cada clave contra cada fila a ver cuál autentica.
--
-- Se arregla ahora, con dos pacientes de prueba y ninguna cédula guardada. Con
-- el padrón real del doctor dentro, el mismo arreglo es una migración de datos
-- a ciegas.
--
-- El CHECK es la parte que impide que esto vuelva a pasar: a partir de aquí la
-- base no acepta una cédula cifrada sin su versión, ni una versión suelta sin
-- cédula. Un `insert` que lo intente falla en el acto en vez de guardar algo
-- que se descubrirá ilegible dentro de dos años.
-- =============================================================================

alter table public.patients
  add column if not exists key_version smallint;

-- Las filas que ya existieran con cédula se cifraron necesariamente con la
-- versión 1: es la única que ha existido. Si alguna vez hubiera habido otra,
-- este `update` sería incorrecto — de ahí que se haga hoy y no más tarde.
update public.patients
   set key_version = 1
 where national_id_enc is not null
   and key_version is null;

alter table public.patients
  drop constraint if exists patients_key_version_con_cifrado;

alter table public.patients
  add constraint patients_key_version_con_cifrado
  check ((national_id_enc is null) = (key_version is null));

comment on column public.patients.key_version is
  'Versión de SANITI_ENCRYPTION_KEYS con la que se cifró national_id_enc. '
  'Sin ella el valor es irrecuperable tras una rotación de clave.';
