# Contexto del Proyecto · SaniTi (Cheat-Sheet para Agentes / Token-Saver)

> Documento de contexto consolidado de alta densidad. Diseñado para cargar todo el conocimiento crítico del sistema minimizando el consumo de tokens de contexto.

---

## 1. Misión, Usuario y Restricciones de Negocio

- **Producto**: SaaS multi-institución de gestión clínica integral (consultorios independientes, clínicas y hospitales).
- **Usuario de Referencia**: Médico general en Manta, Ecuador (Dr. Elvis Olver González Sacón, Hospital Básico Mendieta). Hoy lleva todo en papel.
  - *Regla Suprema de UX*: Si teclear en SaniTi es más lento que escribir a mano, el producto falla. Menos clics, menos campos obligatorios (solo 2 al registrar paciente, solo 'subjetivo' en notas SOAP).
- **Marco Legal**: LOPDP Ecuador. Datos de salud = categoría especial (requiere consentimiento explícito). Moneda: USD (en centavos enteros). Zona horaria: `America/Guayaquil`.
- **Pasarelas**: PayPhone y Kushki (Stripe NO opera en Ecuador; terminantemente prohibido reintroducirlo).

---

## 2. Stack Tecnológico

| Capa | Tecnología / Versión |
|---|---|
| **Framework Web** | Next.js 16.3.2 (App Router, Server Components + Server Actions) |
| **Biblioteca UI** | React 19.2.8 |
| **Estilos** | Tailwind CSS v4 (`@tailwindcss/postcss`, tokens en `src/app/globals.css`) |
| **Iconos** | Lucide React |
| **Base de Datos** | PostgreSQL 17 (vía Supabase local / CLI 2.115.0) |
| **ORM / Drivers** | Drizzle ORM 0.45.2, `postgres` (para scripts/tests), `@supabase/ssr`, `@supabase/supabase-js` |
| **Validación** | Zod 4.4.3 |
| **Seguridad** | ClamAV (TCP daemon INSTREAM para antivirus de archivos adjuntos) |
| **Testing & Linter** | Vitest 4.1.11, ESLint 9, `pgsql-parser` (validador de SQL/PLpgSQL) |

---

## 3. Reglas Inmutables de Desarrollo (No Romper)

1. **Aislamiento en BD (RLS Obligatorio)**: Toda tabla en `public` tiene RLS activado. El aislamiento entre instituciones vive en PostgreSQL, jamás únicamente en TypeScript.
2. **RLS y `GRANT` son dos capas**: Postgres comprueba privilegios ANTES de las políticas. Toda tabla o función nueva requiere su entrada explícita en `supabase/migrations/0011_grants.sql`.
3. **`SECURITY DEFINER` con `set search_path = ''`**: Obligatorio en toda función PL/pgSQL con privilegios elevados para prevenir secuestro de esquemas.
4. **Nunca `FORCE ROW LEVEL SECURITY`**: Rompe en silencio funciones `SECURITY DEFINER` (afectan a cero filas sin arrojar error).
5. **`createAdminClient()` sólo para background workers/webhooks**: Jamás en endpoints que atiendan solicitudes de usuarios (usar `createClient()` con sesión y RLS).
6. **NO ejecutar Prettier**: Está sin configuración a propósito; formatearía comillas en tipos y rompería `check:schema-drift`.
7. **No `setState` en cuerpo de `useEffect`**: Es error de ESLint. Guardar con clave de invocación y derivar el estado.
8. **No concatenar `select` en Supabase con `+`**: Rompe la inferencia de tipos devolviendo `GenericStringError`. Usar string literal único con `as const`.
9. **IDs de registros con datos cifrados generados en Node**: Usar `crypto.randomUUID()` antes del INSERT, ya que el ciphertext liga `saniti:v1:{tabla}:{columna}:{id}`.
10. **`9999_verify_security.sql` es siempre la última migración**: Sus aserciones abortan despliegues inseguros.

---

## 4. Mapa de Migraciones de Base de Datos (`supabase/migrations/`)

| Archivo | Contenido Clave |
|---|---|
| `0001_foundation.sql` | Extensiones (`pgcrypto`, `btree_gist`), esquema `app`, helpers de contexto y variables de sesión. |
| `0002_tenancy_rbac.sql` | `tenants`, `profiles`, `memberships`, 17 permisos granulares, `app.has_permission()`. |
| `0003_audit.sql` | `audit_events` con hash encadenado (`sha256`), detección de manipulación, `auth_events`. |
| `0004_provisioning.sql` | Alta de institución, invitaciones a miembros, transacciones seguras de onboarding. |
| `0005_patients.sql` | `patients` (cédula cifrada e índice HMAC), consentimientos, círculo de cuidado, break-glass. |
| `0006_clinical.sql` | `encounters` (consultas), `clinical_notes` (cifrado AES-256-GCM), vitales, diagnósticos. |
| `0007_documents.sql` | `documents`, interconsultas, metadatos y compartición con almacenamiento en Supabase Storage. |
| `0008_scheduling.sql` | `locations`, `provider_schedules`, `appointments` con exclusión GiST anti-solapamiento. |
| `0009_messaging.sql` | `whatsapp_conversations` (máquina de estados), `whatsapp_messages`, `notification_outbox`. |
| `0010_billing.sql` | `plans`, `subscriptions`, `invoices`, sincronización de asientos (`app.sync_seats`). |
| `0011_grants.sql` | Privilegios `GRANT` por tabla y rol de base de datos (`anon`, `authenticated`, `service_role`). |
| `0012_patient_numbering.sql` | Correlativo por institución (`record_number`) vía trigger y `tenant_counters`. |
| `0013_icd10.sql` | Catálogo curado CIE-10 para diagnósticos clínicos con búsqueda de sinónimos. |
| `0014_medications.sql` | Vademécum farmacológico y advertencia automática de alergias cruzadas. |
| `0015_document_scanning.sql` | Cola de escaneo y veredictos del antivirus (ClamAV). |
| `0016_appointment_reminders.sql` | Planificación, ventanas de antelación y despacho de recordatorios de citas. |
| `0017_audit_chain_rpc.sql` | RPC pública `verificar_cadena_auditoria()` y función `revisar_break_glass()`. |
| `0018_patient_key_version.sql` | Versión de clave de cifrado (`key_version`) en `patients` para rotación segura. |
| `9999_verify_security.sql` | Suite de aserciones en SQL que valida RLS, grants y search_path en toda la BD. |

---

## 5. Arquitectura de Rutas y Código (`src/`)

```
src/
├── app/
│   ├── (auth)/              # Login, registro, recuperación de contraseña
│   ├── (publico)/           # Landing comercial, términos, privacidad (LOPDP)
│   ├── invitacion/          # Flujo de aceptación de invitaciones
│   ├── panel/               # Selector de institución / dashboard de usuario
│   └── i/[slug]/            # Módulos por institución (/i/hospital-mendieta/...)
│       ├── agenda/          # Vista diaria/semanal, nueva cita, bloqueo de horarios
│       ├── auditoria/       # Verificación de cadena criptográfica y logs de acceso
│       ├── documentos/      # Estudios, subida a Storage, escaneo de malware
│       ├── equipo/          # Gestión de miembros, roles y permisos
│       └── pacientes/       # Padrón, alta rápida, expediente clínico, notas SOAP, recetas
├── components/              # Componentes compartidos de UI accesibles y diseño sobrio
├── lib/
│   ├── audit/               # Registro de eventos de auditoría desde el servidor
│   ├── auth/context.ts      # Contexto de sesión, institución activa y permisos
│   ├── db/                  # Capa de datos tipada por dominio (patients, clinical, scheduling...)
│   └── security/            # Cifrado AES-256-GCM, HMAC blind index, cliente ClamAV TCP
└── proxy.ts                 # Middleware Edge: CSP con nonce, seguridad y sesión
```

---

## 6. Estado del Proyecto y Hoja de Ruta

### Implementado y Verificado (100% Funcional)
- ✅ Cimientos de seguridad, RBAC dinámico con 17 permisos granulares.
- ✅ Padrón de pacientes con cédula protegida por índice ciego HMAC y cifrado AES-256-GCM.
- ✅ Expediente clínico electrónico: notas SOAP cifradas, vitales, recetas, CIE-10, alergias cruzadas.
- ✅ Agenda médica: bloqueo GiST que impide doble cita física a un mismo doctor entre clínicas, disponibilidad en SQL (`available_slots`).
- ✅ Bitácora de auditoría inmutable con cadena hash y verificación RPC.
- ✅ Antivirus ClamAV integrado mediante worker TCP para archivos clínicos.
- ✅ Migraciones 0001 a 0018 verificadas en sintaxis SQL y tipos TypeScript.

### Backlog Activo (Próximos Pasos)
1. **WhatsApp Bot & Cloud API**: Conexión con Meta Graph API (webhook de mensajes entrantes y salida de citas).
2. **Portal del Paciente**: Identidad externa separada, visualización de recetas/estudios propios y consentimiento explícito.
3. **Pasarelas de Pago de Ecuador**: Integración con Kushki y PayPhone en `src/lib/billing/`.
4. **Agenda Visual**: Drag-and-drop en vista semanal para reprogramación rápida de citas.
5. **Rotación Automatizada de Claves**: Worker periódico para migrar registros con `key_version` antigua.
6. **Copias de Seguridad Automatizadas**: Programación periódica a S3 con aviso de fallo y cifrado.

---

## 7. Flujo Git (Git Flow) y Comandos Clave

- **`main`**: Rama de producción protegida.
- **`develop`**: Rama principal de desarrollo e integración activa.
- **`feature/<nombre>`**: Ramas de nuevas funcionalidades (nacen de `develop`, PR a `develop`).
- **`bugfix/<nombre>`**: Ramas de solución de bugs en desarrollo.
- **`release/<version>`**: Estabilización previa a producción (merge a `main` con tag y a `develop`).
- **`hotfix/<nombre>`**: Corrección crítica directa en producción (nace de `main`, merge a `main` y `develop`).

### Comandos de Operación Diaria
```bash
# Desarrollo local
npm run db:start       # Levantar PostgreSQL 17 + Supabase + migraciones locales
npm run dev            # Iniciar Next.js en http://localhost:3000
npm run db:types       # Regenerar tipos de TypeScript tras migración

# Verificación de calidad completa
npm run verify         # Ejecuta: check:sql + typecheck + lint + test + check:drift

# Servicios de soporte
npm run av:start       # Levantar ClamAV en Docker
npm run scan:watch     # Worker de escaneo de documentos
npm run reminders:watch # Worker de recordatorios de citas
```
