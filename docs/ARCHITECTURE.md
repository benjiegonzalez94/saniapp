# Arquitectura de SaniTi

Complemento de [SECURITY.md](./SECURITY.md), que cubre el porqué de las
decisiones de seguridad. Aquí está la forma de los datos y cómo circulan.

---

## Modelo de tenencia

Una **institución** (`tenants`) es la unidad de aislamiento: un hospital, una
clínica o el consultorio de un médico independiente. No hay diferencia
estructural entre ellos, sólo de plan y de `access_model`.

Una **persona** (`profiles`, 1:1 con `auth.users`) tiene una sola identidad
global y puede pertenecer a varias instituciones. Un cardiólogo que pasa
consulta en dos clínicas usa una cuenta, no dos.

La arista `memberships` (institución × persona × rol) es de donde cuelga **todo**
el control de acceso.

```
profiles ──< memberships >── tenants
                  │
                  └─ role ──< role_permissions >── permissions
```

Los permisos se resuelven en la base (`app.has_permission`) y se leen desde la
aplicación en tiempo de ejecución. Si la matriz de roles cambia en una
migración, la interfaz la sigue sin redesplegar el frontend: no hay dos fuentes
de verdad que puedan discrepar.

---

## Datos clínicos

```
tenants ──< patients ──< encounters ──< clinical_notes   (cifradas)
                   │             │
                   │             ├──< diagnoses          (CIE-10, en claro)
                   │             ├──< vitals             (series numéricas)
                   │             └──< prescriptions ──< prescription_items
                   │
                   ├──< allergies
                   ├──< documents ──< document_shares
                   ├──< case_consults ──< case_consult_messages  (cifrados)
                   ├──< patient_consents
                   ├──< care_team_members
                   └──< break_glass_grants
```

La numeración de historia clínica (`record_number`) es correlativa **por
institución**, mediante `tenant_counters` y `app.next_counter()`.

### Autorización sobre un paciente

Toda tabla clínica delega su RLS en `app.can_read_patient(patient_id)`, que
resuelve en este orden:

1. ¿Es el propio paciente desde su portal? → sí.
2. ¿Tiene `clinical.read` en la institución del paciente? → si no, no.
3. ¿La institución usa `access_model = 'open'`? → sí.
4. ¿Está en el círculo de cuidado del paciente? → sí.
5. ¿Tiene una concesión de break-glass vigente? → sí, y ya quedó auditada.
6. Si no, no.

`app.can_write_patient()` añade la exigencia de `clinical.write`.

Este es el único punto donde se decide el acceso clínico. Cambiar la política de
mínimo necesario es cambiar esta función, no dieciocho políticas.

---

## Agenda

```
tenants ──< locations
        ──< provider_schedules      (disponibilidad recurrente por día)
        ──< schedule_exceptions     (vacaciones, feriados, cupos extra)
        ──< appointments ──< appointment_reminders
```

La regla "un médico no puede estar en dos citas a la vez" es una **restricción
de exclusión GiST**, no una comprobación en la aplicación:

```sql
constraint appointments_no_overlap exclude using gist (
  provider_id with =,
  slot        with &&
) where (status in ('solicitada', 'confirmada', 'en_sala', 'atendida'))
```

Dos recepcionistas agendando a la vez, o el bot de WhatsApp compitiendo con la
web, no pueden producir un solapamiento: la segunda transacción falla.

La exclusión es por **médico** y no por institución, a propósito: un médico que
atiende en dos clínicas tampoco puede estar en ambas a la misma hora.

`public.available_slots()` calcula los huecos libres en SQL, no en la
aplicación. Es la misma respuesta para la web, el bot de WhatsApp y el portal
del paciente, y sólo la base ve el estado real de la agenda en ese instante.

---

## Mensajería

```
whatsapp_conversations ──< whatsapp_messages
notification_outbox    (cola única: WhatsApp, SMS, correo)
```

`whatsapp_conversations` es una máquina de estados por número de teléfono
(`app.wa_state`): identificación → menú → elegir médico → fecha → hora →
confirmación. Tres fallos de identificación escalan a una persona: un bot no
debe convertirse en oráculo de datos de pacientes.

`whatsapp_messages.wa_message_id` es único, y es la clave de idempotencia del
webhook: Meta reintenta ante cualquier error o timeout.

`notification_outbox.dedupe_key` cumple el mismo papel para las salidas: un
reintento del worker no duplica el aviso al paciente.

El consentimiento se aplica con un trigger sobre la bandeja de salida
(ver [SECURITY.md §9](./SECURITY.md#9-consentimiento-lopdp-aplicado-en-la-base)).

---

## Facturación

```
plans ──< subscriptions ──< invoices
      billing_events   (bitácora cruda de webhooks, idempotente)
```

Los importes son **enteros en centavos**. Nunca punto flotante: `0.1 + 0.2` no
es `0.3` y una factura no perdona.

Los asientos se sincronizan solos al activar o revocar una membresía
(`app.sync_seats`). Si dependiera de que alguien actualice un contador a mano,
la facturación estaría mal el primer mes.

`invoices.tax_rate_bps` se guarda **por factura** (1500 = 15 %, IVA vigente en
Ecuador) porque la tasa cambia y una factura emitida no se recalcula jamás.

Cada institución nueva arranca con prueba del plan `solo` mediante un trigger
sobre `tenants`.

Las pasarelas contempladas son **PayPhone** y **Kushki**, más `manual` para
transferencia y depósito. Stripe queda deliberadamente fuera del enum: no
procesa cobros locales en Ecuador, e incluirlo sólo invitaría a construir un
flujo que después no se puede liquidar.

Para SMS se mantiene el canal en el esquema y la lógica detrás de una interfaz
de proveedor, pendiente de elegir un agregador local; no se integra Twilio.

---

## Flujo de una petición

```
Navegador
   │
   ├─ src/proxy.ts
   │    · refresca la sesión de Supabase
   │    · bloquea el acceso anónimo a zonas privadas
   │    · aplica CSP con nonce y cabeceras de seguridad
   │
   ├─ Server Component / Server Action
   │    · createClient()  → rol `authenticated`, sujeto a RLS
   │    · getTenantContext() → decide QUÉ PINTAR (no autoriza)
   │    · audit() / auditedRead() → registra el acceso
   │
   └─ PostgreSQL
        · RLS decide qué filas existen para este usuario  ← la barrera real
        · triggers imponen inmutabilidad, consentimiento y sellado de auditoría
```

Los webhooks (`/api/webhooks/*`) no llevan sesión: se autentican por firma y
usan `createAdminClient()`, que **ignora RLS**. Cada uno debe fijar su propio
tenant y auditar lo que haga.

---

## Decisiones que se evaluaron y se descartaron

| Alternativa | Por qué no |
|---|---|
| Un esquema de Postgres por institución | Miles de esquemas hacen inviables las migraciones y el pool de conexiones. RLS da el mismo aislamiento con una sola copia del esquema. |
| ORM (Prisma/Drizzle) como fuente de verdad | Ningún ORM expresa políticas RLS, restricciones de exclusión GiST ni triggers. El esquema quedaría partido en dos sitios, y la mitad importante en el peor de ellos. |
| `FORCE ROW LEVEL SECURITY` | Rompe en silencio las funciones `SECURITY DEFINER`. Ver [SECURITY.md §3](./SECURITY.md#3-por-qué-no-se-usa-force-row-level-security). |
| Redis para el limitador de intentos | Un servicio más que asegurar y vigilar. Postgres ya está ahí, es transaccional y el contador sobrevive a los reinicios de las funciones serverless. |
| Cifrar también nombres y fechas de nacimiento | Son la clave de búsqueda de todo el sistema; cifrarlas obliga a descifrar el padrón entero en cada consulta. |
| Tenant activo en una GUC de sesión | PostgREST usa un pool: la variable se filtraría a la petición siguiente, de otro usuario, sobre esa misma conexión. |
