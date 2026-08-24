# SaniTi

Plataforma de gestión para clínicas, hospitales y consultorios: historia
clínica, agenda por médico, resultados compartidos entre colegas, agendamiento
por WhatsApp y facturación por suscripción.

Software como servicio, multi-institución, con el aislamiento entre clientes
impuesto por la base de datos y no por el código de la aplicación.

---

## Estado

**Fases 1 y 2 completas. Fase 3 (agenda) funcional.**

Las 17 migraciones aplican sin error sobre PostgreSQL 17 y **107 pruebas** corren
contra una base real. El aislamiento no se supone: se comprueba suplantando
usuarios con sus JWT. Un médico de la clínica A no obtiene los pacientes de la B
ni conociendo su identificador, recepción no puede abrir una historia clínica,
una nota firmada no se deja modificar, la bitácora detecta su propia
manipulación y la agenda rechaza dos citas solapadas.

Ya funciona el circuito completo del consultorio: **agendar sobre huecos reales
→ marcar la llegada → buscar o registrar al paciente → abrir su expediente →
escribir la consulta → codificar el diagnóstico → firmarla → emitir la receta →
imprimirla → adjuntar los estudios**. WhatsApp y la facturación siguen
pendientes.

> ¿Vas a trabajar en este repositorio? Empieza por
> [`docs/ONBOARDING-AGENTES.md`](docs/ONBOARDING-AGENTES.md) —escrito a partir de
> los errores que ya se cometieron aquí— y por [`CONTRIBUTING.md`](CONTRIBUTING.md)
> para la convivencia entre varias personas.

---

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Next.js 16 (App Router, React 19) | Un solo despliegue, menos superficie que atacar |
| Base de datos | PostgreSQL vía Supabase | RLS nativo: el aislamiento entre clínicas se impone en el motor |
| Autenticación | Supabase Auth + TOTP | MFA sin implementar criptografía de sesión propia |
| Archivos | Supabase Storage | Bucket privado, políticas por institución, sin URLs públicas |
| Estilos | Tailwind CSS 4 | Configuración en CSS, sin capa de build adicional |
| Mensajería | WhatsApp Cloud API (Meta) | Única vía conforme para WhatsApp comercial |
| Pruebas | Vitest | |

Sin ORM: las migraciones SQL son la fuente de verdad y
[`src/lib/db/types.ts`](src/lib/db/types.ts) las refleja.
`npm run check:drift` comprueba que no se hayan separado.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
```

Genere las claves de cifrado —**sin ellas no se puede leer ni escribir ningún
dato clínico**:

```bash
echo "SANITI_ENCRYPTION_KEYS={\"1\":\"$(openssl rand -base64 32)\"}"
echo "SANITI_BLIND_INDEX_KEY=$(openssl rand -base64 32)"
```

### Desarrollo local

Requiere **Docker Desktop** corriendo. En Windows, Docker usa WSL2: si al
abrirlo dice *«Virtualization support not detected»*, casi siempre falta WSL
—`wsl --install` desde PowerShell como administrador, y reiniciar—, no la
virtualización del BIOS.

```bash
npm run db:start     # levanta PostgreSQL 17 y aplica las 17 migraciones
npm run dev
```

`db:start` imprime las claves locales; cópielas a `.env.local`. Studio queda en
<http://127.0.0.1:54323> y el correo de prueba en <http://127.0.0.1:54324>.

```bash
npm run db:reset     # recrea la base desde cero, reaplica todo y siembra datos
npm run db:types     # regenera los tipos de TypeScript desde el esquema real
npm run db:stop      # detiene los contenedores
```

`db:reset` carga `supabase/seed.sql`, que crea la institución piloto y tres
cuentas para recorrer la aplicación. Contraseña de todas: `saniti-demo-2026`.

| Cuenta | Rol | Qué demuestra |
|---|---|---|
| `elvis.gonzalez@saniti.test` | Médico | Ve la historia clínica y puede firmar |
| `recepcion@saniti.test` | Recepción | Encuentra pacientes pero **no** abre su historia |
| `admin@saniti.test` | Propietario | Gestiona el equipo y lee la bitácora de auditoría |

Entre en `/i/hospital-mendieta`. La paciente María Fernanda Zambrano trae
alergias y condiciones crónicas cargadas, para ver la banda de alertas.

> La semilla no incluye ninguna nota clínica, y eso **es** la demostración del
> cifrado: el texto se cifra en el servidor con una clave que la base no conoce,
> así que desde SQL es imposible fabricar una nota legible. Cree la primera en
> «Nueva consulta».

### Despliegue

```bash
supabase link --project-ref <su-proyecto>
supabase db push
```

La última migración (`9999_verify_security.sql`) aborta el despliegue si alguna
tabla quedó sin RLS, sin políticas, con una función `SECURITY DEFINER` sin
`search_path` o con una **política inalcanzable** —una política cuya operación
no tiene el `GRANT` detrás, y que por tanto nunca llega a ejecutarse—. Si falla,
no lo salte: léala.

> **Guarde las claves de cifrado en un gestor de secretos con respaldo.** Si las
> pierde, las cédulas y las notas clínicas ya guardadas son irrecuperables. No
> hay puerta trasera.

---

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # compilación de producción
npm test             # pruebas unitarias
npm run typecheck    # TypeScript sin emitir
npm run check:sql    # sintaxis de las migraciones (SQL y plpgsql)
npm run check:drift  # esquema real vs. tipos + postura de seguridad + cadena de auditoría
npm run verify       # todo lo anterior; ejecútelo antes de desplegar
npm run icons        # regenera favicon e iconos de app desde la geometría de la marca
npm run graph        # reconstruye el grafo de conocimiento del repositorio
npm run av:start     # levanta ClamAV para el análisis de estudios
npm run scan:watch   # worker que analiza la cola de estudios subidos
npm run reminders:watch  # worker que despacha y envía recordatorios de cita
```

`check:sql` usa el parser real de PostgreSQL (libpg_query) en dos pasadas: el
SQL de nivel superior y, por separado, los cuerpos plpgsql —que para el parser
externo son sólo literales de texto y, sin esa segunda pasada, no se revisarían.

---

## Organización

```
supabase/migrations/     Fuente de verdad del esquema. Numeradas, en orden.
  0001_foundation        Extensiones, esquema privado `app`, helpers de sesión
  0002_tenancy_rbac      Instituciones, identidades, membresías, permisos
  0003_audit             Bitácora encadenada por hash, eventos de auth, rate limit
  0004_provisioning      Alta de institución e invitaciones
  0005_patients          Pacientes, círculo de cuidado, consentimientos, break-glass
  0006_clinical          Atenciones, notas cifradas, CIE-10, vitales, recetas
  0007_documents         Estudios, compartición, interconsultas, políticas de Storage
  0008_scheduling        Sedes, horarios, agenda sin solapamientos, recordatorios
  0009_messaging         WhatsApp y bandeja de salida con consentimiento aplicado
  0010_billing           Planes, suscripciones, asientos, facturas
  0011_grants            Privilegios de tabla, explícitos y alineados con cada política
  0012_patient_numbering Correlativo de historia clínica por institución
  0013_icd10             Catálogo CIE-10 curado con sinónimos de uso corriente
  0014_medications       Vademécum y cruce de alergias por familia farmacológica
  0015_document_scanning Estado del antivirus y cola de análisis de estudios
  0016_appointment_reminders  Plan y despacho de recordatorios de cita
  9999_verify_security   Aserciones que abortan el despliegue si algo quedó abierto

src/
  proxy.ts               Cabeceras de seguridad, CSP con nonce, guardia de sesión
  app/
    i/[slug]/            Todo lo que ocurre dentro de una institución
      pacientes/         Padrón, alta, expediente, consulta, notas y recetas
      agenda/            Día, agendar, horarios y bloqueos
    panel/               Selector de institución
  lib/
    security/crypto.ts   AES-256-GCM ligado al contexto + índice ciego HMAC
    security/env.ts      Validación de configuración con Zod
    security/rate-limit  Limitador respaldado por Postgres
    auth/context.ts      Sesión, membresías y permisos efectivos
    audit/               Registro de accesos
    db/patients.ts       Padrón: búsqueda por índice ciego, alta cifrada
    db/clinical.ts       Historia clínica: notas cifradas, vitales, diagnósticos
    db/prescriptions.ts  Recetas y cruce de alergias antes de prescribir
    db/documents.ts      Estudios: subida firmada, descarga sólo si está limpio
    db/scheduling.ts     Agenda: citas, huecos, horarios y bloqueos
    security/antivirus   Cliente INSTREAM de ClamAV, autoalojado
    db/database.types.ts Tipos generados del esquema real (npm run db:types)
    supabase/            Clientes de navegador, servidor y administración
  components/ui/         Botón, campo de formulario

docs/SECURITY.md         Modelo de seguridad y el porqué de cada decisión
docs/ARCHITECTURE.md     Modelo de datos y flujos principales
docs/ONBOARDING-AGENTES.md  Guía de incorporación para agentes y personas nuevas
```

---

## Modelo de seguridad, en corto

Todo el detalle está en [docs/SECURITY.md](docs/SECURITY.md). Lo esencial:

1. **El aislamiento vive en la base.** RLS en todas las tablas. Si una
   comprobación en TypeScript es lo único que impide un acceso, falta una
   política.
2. **Lo sensible va cifrado con claves que la base no conoce**, y cada valor
   está ligado a su tabla, columna y fila: mover un dato cifrado entre
   expedientes hace que el descifrado falle.
3. **Toda lectura de datos clínicos se audita**, en una bitácora encadenada por
   hash cuya alteración es detectable.
4. **Lo firmado es inmutable.** Se enmienda, no se reescribe.
5. **El consentimiento se impone en la base**, no en el código de envío.
6. **Una factura impaga nunca bloquea el acceso a una historia clínica.**

---

## Hoja de ruta

- [x] **Fase 1 — Cimientos.** Esquema completo, RLS, RBAC, auditoría, cifrado,
      límites de intento, cabeceras, marca e interfaz base. Verificado contra
      PostgreSQL 17 con 53 pruebas (30 de criptografía, 23 de aislamiento).
- [x] **Fase 2 — Núcleo clínico.** Padrón con búsqueda por índice ciego, alta
      con consentimiento LOPDP, expediente con banda de alertas editable,
      catálogo CIE-10 con sinónimos, consulta SOAP cifrada con firma, enmienda
      de notas firmadas, recetas con cruce de alergias por familia
      farmacológica, y subida de estudios con antivirus autoalojado.
- [x] **Fase 3 — Agenda.** Vista de día y de semana, agendamiento sobre huecos
      calculados por la base, horarios y bloqueos, y planificación automática de
      recordatorios. **Falta**: reprogramar arrastrando y portal del paciente.
- [ ] **Fase 4 — WhatsApp.** Webhook con verificación de firma, bot de
      agendamiento con botones, plantillas aprobadas por Meta.
- [ ] **Fase 5 — Facturación.** Pasarela de pago, portal de suscripción,
      control de topes por plan.
