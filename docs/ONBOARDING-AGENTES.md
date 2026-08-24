# SaniTi · guía para agentes

Si vas a tocar este repositorio y no tienes contexto previo, **lee esto entero
antes de escribir una línea**. Está escrito a partir de errores que ya se
cometieron aquí, no de buenas intenciones.

---

## 0. Qué es esto y para quién

Plataforma SaaS multi-institución de gestión clínica. Historia clínica, agenda,
recetas, estudios y (pendiente) agendamiento por WhatsApp.

**El primer usuario real es un médico general que hoy lleva todo en papel**:
Dr. Elvis Olver González Sacón, Hospital Básico Mendieta, Manta, Ecuador. Eso no
es un dato de color, es la restricción de diseño principal:

> Si teclear en SaniTi es más lento que escribir a mano, vuelve al papel en una
> semana y el producto ha fracasado.

De ahí salen decisiones que de otro modo parecen arbitrarias: un solo buscador
en vez de filtros, sólo dos campos obligatorios al registrar un paciente, sólo
el «subjetivo» obligatorio en una consulta.

Marco legal: **LOPDP de Ecuador**. Los datos de salud son categoría especial y
exigen consentimiento explícito. Moneda USD, zona horaria
`America/Guayaquil`, pasarelas **PayPhone y Kushki** (Stripe NO opera en
Ecuador, no lo reintroduzcas).

---

## 1. Las cinco reglas que no se rompen

### 1.1 El aislamiento vive en la base, no en el código

Toda tabla de `public` tiene RLS y políticas que exigen membresía activa.

> **Si una comprobación en TypeScript es lo único que impide un acceso indebido,
> falta una política.**

`requirePermissionBySlug()` y compañía existen para decidir qué pintar y dar
errores legibles — **no autorizan**. Lo dice el propio JSDoc de
[`src/lib/auth/context.ts`](../src/lib/auth/context.ts).

### 1.2 RLS y `GRANT` son dos capas, y el orden importa

Postgres comprueba el privilegio de tabla **antes** de aplicar la política. Sin
`GRANT`, la política nunca se ejecuta y la consulta muere con `permission
denied`. Este proyecto tuvo 63 políticas sobre tablas que nadie podía leer.

Toda tabla nueva necesita su entrada explícita al estilo de
[`0011_grants.sql`](../supabase/migrations/0011_grants.sql), con exactamente las
operaciones que tienen política.

### 1.3 `SECURITY DEFINER` siempre con `set search_path = ''`

Sin ello, cualquiera que pueda crear un objeto en el `search_path` secuestra la
función. `9999_verify_security.sql` aborta el despliegue si falta.

### 1.4 Nunca `FORCE ROW LEVEL SECURITY`

Extendería RLS al dueño de la tabla, y las funciones `SECURITY DEFINER` del
proyecto corren como ese dueño. Con `FORCE`, sus escrituras **no fallan:
afectan a cero filas en silencio**. Para una bitácora de auditoría es el peor
modo de fallo posible.

### 1.5 `createAdminClient()` sólo sin usuario detrás

Ignora RLS por completo. Es exclusivo de webhooks y workers
(`scripts/scan-documents.mts`, `scripts/send-reminders.mts`). En cualquier ruta
que atienda a una persona va `createClient()` de
[`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts).

---

## 2. Errores que vas a cometer si no lees esto

Cada uno ocurrió de verdad o fue detectado auditando el repositorio.

### 2.1 Numerar mal una migración

Mira `ls supabase/migrations/` **y** `git status --short` antes de crear una. El
README puede ir por detrás. `9999_verify_security.sql` debe seguir siendo
siempre el último por orden alfabético.

### 2.2 Ejecutar Prettier «para dejarlo bonito»

Está instalado pero **sin `.prettierrc` y sin script**, a propósito. Con la
configuración por defecto pasaría `src/lib/db/types.ts` a comillas dobles, y
`readTsConst()` de `scripts/check-schema-drift.mjs` sólo reconoce comillas
simples: `check:drift` empezaría a reportar que faltan en TypeScript todos los
valores de los enums vigilados. **No lo ejecutes.**

### 2.3 `setState` en el cuerpo de un `useEffect`

`react-hooks/set-state-in-effect` es **error**, no aviso, en esta configuración.
El patrón del proyecto es guardar el resultado asíncrono junto a la clave que lo
produjo y **derivar** lo que se pinta:

```ts
const clave = `${medicoId}|${fecha}`;
const [datos, setDatos] = useState({ clave: '', filas: [] });
// ...dentro del efecto, sólo en el callback asíncrono:
setDatos({ clave, filas });
// ...y en el render:
const filas = datos.clave === clave ? datos.filas : [];
const cargando = datos.clave !== clave;
```

Modelo a copiar:
[`agenda/nueva/formulario.tsx`](../src/app/i/[slug]/agenda/nueva/formulario.tsx).

### 2.4 `Date.now()` en el render de un Server Component

`react-hooks/purity` lo marca como error. Mueve el cálculo a la capa de datos
(ver `listarBloqueosProximos` en `src/lib/db/scheduling.ts`).

### 2.5 Concatenar el `select` de Supabase con `+`

TypeScript ensancha `'a' + 'b'` a `string`, y entonces supabase-js **no puede
inferir la forma de la fila**: devuelve `GenericStringError` y se pierde todo el
tipado. Escribe el `select` como un único literal con `as const`.

### 2.6 Suponer que `schedule.manage` basta para editar cualquier horario

La política `provider_schedules_write` exige además ser el propio profesional
**o** tener rol `owner`/`admin`/`receptionist`. Un `physician` tiene el permiso
pero **no** está en esa lista: sólo toca su propia agenda. **Lee la política
completa, no sólo la matriz de permisos.**

### 2.7 Enviar `record_number`, `folio` o dejar que la base genere un `id` cifrado

Los correlativos los ponen triggers. El `id` de una fila con columna cifrada se
genera con `randomUUID()` en Node **antes** de cifrar, porque el dato asociado
(`saniti:v1:{tabla}:{columna}:{id}`) lo liga a esa fila concreta. Modelos:
`patients.ts::crearPaciente`, `clinical.ts::registrarConsulta`.

### 2.8 Añadir un enum sin registrarlo en el verificador de deriva

`check:drift` sólo compara los enums del objeto `ENUM_MAP` de
`scripts/check-schema-drift.mjs`. Si el tuyo importa, añádelo ahí o la deriva
será silenciosa.

### 2.9 Tocar el bloque de `AGENTS.md`

Lo reescribe `next dev` en cada arranque. Quitarlo sólo genera una modificación
que reaparece. Las convenciones de SaniTi van en **este** archivo.

### 2.10 Confiar en que los tests cubren el camino del navegador

`npm test` habla con Postgres **directamente**, suplantando JWT. Nunca ejercita
el camino navegador→Supabase. Un fallo de CSP, de RPC desde cliente o de subida
a Storage pasa los 107 tests y falla en producción. Abre la consola del
navegador.

### 2.11 Escribir una prueba que se omite sola (y no se omite)

`it.runIf(x)` y `describe.skipIf(x)` reciben un **valor**, no un predicado, y lo
leen al **recolectar** las pruebas — antes de que se ejecute ningún `beforeAll`.
Las dos mitades de esa frase son trampas distintas y este repositorio cayó en
ambas a la vez:

```ts
// MAL, y de dos formas.
let disponible = false;
beforeAll(async () => { disponible = await escaner.disponible(); });
it.runIf(() => disponible)('…', async () => { /* se ejecuta SIEMPRE */ });
```

Una función siempre es cierta, así que `runIf` nunca omitió nada; en el portátil
pasaba porque el contenedor de ClamAV estaba levantado, y en CI —donde no lo
está— fallaron seis pruebas. Quitar el `() =>` no arregla nada: la bandera se
lee antes del `beforeAll` y valdría `false` siempre, con lo que las pruebas se
omitirían **todas**, para siempre, en verde y sin que nadie lo notara.

La forma correcta es sondear al cargar el módulo, con `await` de nivel superior,
y decidir sobre un booleano ya resuelto:

```ts
const hayClamav = await escaner.disponible();
describe.skipIf(!hayClamav)('ClamAV por TCP', () => { … });
```

Y lo más importante: **lo que no necesita el servicio no se omite**. La prueba
de que un antivirus inalcanzable devuelve `error` y no `limpio` vive fuera de
ese bloque, porque es justo la que tiene que correr donde no hay ClamAV.

---

## 3. Cómo levantar el entorno

Requiere **Docker Desktop**. En Windows usa WSL2: si dice *«Virtualization
support not detected»*, casi siempre falta WSL (`wsl --install` como
administrador y reiniciar), no la virtualización del BIOS.

```bash
npm install
cp .env.example .env.local           # y genera las claves de cifrado
npm run db:start                     # PostgreSQL 17 + las 17 migraciones + seed
npm run dev
```

Servicios opcionales:

```bash
npm run av:start        # ClamAV (obligatorio para descargar estudios)
npm run scan:watch      # worker de antivirus
npm run reminders:watch # worker de recordatorios
```

Cuentas de desarrollo (contraseña `saniti-demo-2026`), institución
`/i/hospital-mendieta`:

| Cuenta | Rol | Qué demuestra |
|---|---|---|
| `elvis.gonzalez@saniti.test` | Médico | Ve la historia y firma |
| `recepcion@saniti.test` | Recepción | Agenda pero **no** abre la historia |
| `admin@saniti.test` | Propietario | Lee la bitácora de auditoría |

---

## 4. Antes de dar nada por terminado

```bash
npm run verify   # check:sql + typecheck + lint + test + check:drift
```

**Mide el estado base antes de empezar.** Si `verify` ya estaba rojo, no lo has
roto tú; averigua qué había antes de arreglar trabajo ajeno.

`check:sql` usa el parser real de PostgreSQL en dos pasadas: el SQL de nivel
superior y, aparte, los cuerpos plpgsql —que para el parser externo son sólo
literales de texto—. Un aviso conocido y benigno: los tipos definidos por el
usuario en un `SELECT INTO` disparan un falso positivo porque el parser no tiene
catálogo.

---

## 5. Mapa del código

```
supabase/migrations/   FUENTE DE VERDAD del esquema. Numeradas, en orden.
  0001 foundation      Extensiones, esquema `app`, helpers de contexto
  0002 tenancy_rbac    Instituciones, perfiles, membresías, 17 permisos
  0003 audit           Bitácora encadenada por hash, auth_events, rate limit
  0004 provisioning    Alta de institución e invitaciones (RPC transaccionales)
  0005 patients        Pacientes, círculo de cuidado, consentimientos, break-glass
  0006 clinical        Atenciones, notas cifradas, CIE-10, vitales, recetas
  0007 documents       Estudios, compartición, interconsultas, Storage
  0008 scheduling      Sedes, horarios, agenda sin solapamientos, recordatorios
  0009 messaging       WhatsApp y bandeja de salida con consentimiento aplicado
  0010 billing         Planes, suscripciones, asientos, facturas
  0011 grants          Privilegios de tabla, alineados con cada política
  0012 patient_numbering  Correlativo de historia clínica
  0013 icd10           Catálogo CIE-10 curado con sinónimos
  0014 medications     Vademécum y cruce de alergias por familia
  0015 document_scanning  Cola y veredictos del antivirus
  0016 appointment_reminders  Plan y despacho de recordatorios
  9999 verify_security ASERCIONES que abortan el despliegue

src/
  proxy.ts             CSP con nonce, cabeceras, guardia de sesión
  app/i/[slug]/        Todo lo que ocurre dentro de una institución
    pacientes/         Padrón, alta, expediente, consulta, notas, recetas
    agenda/            Día, agendar, horarios y bloqueos
  lib/
    security/crypto    AES-256-GCM ligado al contexto + índice ciego HMAC
    security/antivirus Cliente INSTREAM de ClamAV
    auth/context       Sesión, membresías, permisos efectivos (NO autoriza)
    audit/             Registro de accesos
    db/                Una capa por dominio + database.types.ts (generado)
scripts/               Validadores y workers
docs/                  SECURITY.md, ARCHITECTURE.md y este archivo
```

---

## 6. Convenciones

- **Identificadores y comentarios en español.** Los nombres de columnas y
  tablas, en inglés (`patients`, `starts_at`); las funciones y variables de
  TypeScript, en español (`crearPaciente`, `huecosDisponibles`).
- **Los comentarios explican el PORQUÉ, no el qué.** Si un bloque de código
  tiene una decisión no obvia detrás, va documentada con su modo de fallo.
- **El SQL es la fuente de verdad.** `src/lib/db/types.ts` lo refleja y
  `database.types.ts` se genera con `npm run db:types` — **regenéralo tras cada
  migración**.
- **Importes en centavos, enteros.** Nunca punto flotante para dinero.
- **Toda hora en `timestamptz`**, convertida a la zona de la institución sólo al
  pintarla.
- **Los errores de Postgres se traducen a mensajes útiles**: `23P01` (hueco
  ocupado), `23505` (documento duplicado), `42501` (horario ajeno).

---

## 7. Estado actual

| Fase | Estado |
|---|---|
| 1 · Cimientos de seguridad y esquema | Completa y verificada |
| 2 · Núcleo clínico | Completa |
| 3 · Agenda | Completa. Día, semana, horarios, bloqueos, agendar y reprogramar |
| 4 · WhatsApp | Pendiente (faltan credenciales de Meta) |
| 5 · Facturación | Sólo esquema |

**Pendientes conocidos** — mantén esta lista honesta:

- SMS y correo sin proveedor: el worker imprime y **no** marca como enviado.
- WhatsApp sin credenciales de Meta.
- Rotación efectiva de claves de cifrado (esquema y código listos, falta el job).
- Copias de seguridad verificadas y ensayo de restauración.
- **Portal del paciente**: es la pieza grande que falta. No es una pantalla más:
  introduce un tipo de usuario nuevo, con su propia autenticación, su propio
  conjunto de permisos y un modelo de consentimiento distinto del de la plantilla
  de una institución. Se aparta a propósito en vez de improvisarla.
- Vista semanal: reprogramar arrastrando una cita a otro día. El formulario de
  reprogramación ya existe, desde el menú de cada cita; lo que falta es el gesto.
- Los textos legales (`/legal/privacidad`, `/legal/terminos`) llevan marcadores
  `<PorCompletar>` a propósito: razón social, RUC, domicilio y contacto del
  responsable de datos. **No los rellenes inventando**; los tiene que dar el
  titular, y en un aviso LOPDP un dato inventado es peor que un hueco visible.
- Protección de la rama `main`: hay que activarla a mano en la configuración de
  GitHub. El workflow `verificar` ya corre en cada push y en cada PR, pero nada
  impide todavía fusionar con el CI en rojo.

---

## 8. Dónde seguir leyendo

- [`docs/SECURITY.md`](./SECURITY.md) — el porqué de cada decisión de seguridad,
  con sus modos de fallo. **Léelo antes de tocar RLS, cifrado o auditoría.**
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — modelo de datos, flujos y las
  alternativas que se evaluaron y descartaron.
- [`README.md`](../README.md) — puesta en marcha y comandos.
