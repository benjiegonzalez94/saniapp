-- =============================================================================
-- 0005_patients.sql  ·  SaniTi
-- Pacientes, círculo de cuidado, consentimientos y derechos LOPDP.
--
-- Decisión de cifrado (ver docs/SECURITY.md):
--   · La cédula/pasaporte se guarda cifrada a nivel de aplicación (AES-256-GCM)
--     con la clave FUERA de la base de datos. Un volcado del disco o un backup
--     robado no revela identificadores. Para poder buscar sin descifrar se
--     guarda además un índice ciego HMAC-SHA256.
--   · Nombre y fecha de nacimiento quedan en claro: son la clave de búsqueda de
--     todo el sistema y cifrarlos obligaría a descifrar el padrón entero en cada
--     consulta. Los protege RLS, el cifrado en reposo del disco y la auditoría.
-- =============================================================================

create type app.sex_at_birth  as enum ('female', 'male', 'intersex', 'unknown');
create type app.id_document   as enum ('cedula', 'pasaporte', 'ruc', 'sin_documento');
create type app.patient_status as enum ('active', 'inactive', 'deceased', 'merged');

-- Modelo de acceso a la historia clínica dentro de una institución.
--   open      → cualquier clínico de la institución (consultorios pequeños)
--   care_team → sólo el equipo asignado; el resto necesita break-glass con
--               motivo, que se audita y se revisa (hospitales)
create type app.access_model as enum ('open', 'care_team');

alter table public.tenants
  add column access_model app.access_model not null default 'open';

-- -----------------------------------------------------------------------------
-- Numeración de historia clínica, correlativa por institución
-- -----------------------------------------------------------------------------
create table public.tenant_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  counter   text not null,
  value     bigint not null default 0,
  primary key (tenant_id, counter)
);

alter table public.tenant_counters enable row level security;
revoke all on public.tenant_counters from authenticated, anon;

create or replace function app.next_counter(p_tenant uuid, p_counter text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_value bigint;
begin
  insert into public.tenant_counters (tenant_id, counter, value)
  values (p_tenant, p_counter, 1)
  on conflict (tenant_id, counter)
    do update set value = public.tenant_counters.value + 1
  returning value into v_value;
  return v_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- patients
-- -----------------------------------------------------------------------------
create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete restrict,
  record_number  bigint not null,

  given_name     text not null check (length(trim(given_name)) between 1 and 120),
  family_name    text not null check (length(trim(family_name)) between 1 and 120),
  birth_date     date check (birth_date <= current_date
                             and birth_date > current_date - interval '130 years'),
  sex_at_birth   app.sex_at_birth not null default 'unknown',
  gender_identity text,

  -- Identificador oficial: cifrado + índice ciego + últimos 4 para cotejo visual.
  id_document      app.id_document not null default 'cedula',
  national_id_enc  text,
  national_id_bidx bytea,
  national_id_last4 text check (national_id_last4 is null or national_id_last4 ~ '^\d{1,4}$'),

  phone          text check (phone is null or phone ~ '^\+[1-9]\d{7,14}$'),
  email          extensions.citext,
  address_line   text,
  city           text,
  province       text,
  country        char(2) not null default 'EC',

  blood_type     text check (blood_type is null or blood_type ~ '^(A|B|AB|O)[+-]$'),

  emergency_contact_name  text,
  emergency_contact_phone text
    check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+[1-9]\d{7,14}$'),

  -- Cuenta del portal del paciente, si la activó.
  profile_id     uuid references public.profiles(id) on delete set null,

  status         app.patient_status not null default 'active',
  merged_into    uuid references public.patients(id) on delete set null,
  deceased_at    date,

  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  unique (tenant_id, record_number),
  constraint patients_merged_coherent
    check ((status = 'merged') = (merged_into is not null)),
  constraint patients_deceased_coherent
    check (status <> 'deceased' or deceased_at is not null)
);

-- Búsqueda por nombre dentro de la institución.
create index patients_tenant_name_idx
  on public.patients (tenant_id, family_name, given_name) where deleted_at is null;
-- Búsqueda exacta por documento, sin descifrar nada.
create unique index patients_tenant_bidx_idx
  on public.patients (tenant_id, national_id_bidx)
  where national_id_bidx is not null and deleted_at is null;
create index patients_tenant_phone_idx
  on public.patients (tenant_id, phone) where phone is not null and deleted_at is null;
create index patients_profile_idx
  on public.patients (profile_id) where profile_id is not null;

-- -----------------------------------------------------------------------------
-- Círculo de cuidado
-- -----------------------------------------------------------------------------
create table public.care_team_members (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default 'tratante',
  added_by     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  ended_at     timestamptz,

  unique (patient_id, profile_id)
);

create index care_team_lookup_idx
  on public.care_team_members (profile_id, patient_id) where ended_at is null;

-- -----------------------------------------------------------------------------
-- break_glass_grants — acceso de emergencia, explícito y con caducidad
--
-- Un médico de guardia que recibe a un paciente inconsciente que no es suyo
-- necesita su historia AHORA. Negársela puede matarlo; dársela en silencio
-- destruye la confidencialidad. La salida es darla, acotada y con nombre y
-- apellido: motivo obligatorio, caducidad corta y un evento de auditoría que
-- alguien revisará.
--
-- Es una TABLA y no una variable de sesión porque PostgREST usa un pool: una
-- GUC no local sobreviviría a la petición y quedaría activa para el siguiente
-- usuario que reutilizara esa conexión.
-- -----------------------------------------------------------------------------
create table public.break_glass_grants (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,

  reason      text not null check (length(trim(reason)) between 10 and 1000),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '4 hours',

  -- Circuito de revisión: toda concesión debe acabar mirada por un responsable.
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint break_glass_window check (expires_at > granted_at)
);

create index break_glass_active_idx
  on public.break_glass_grants (profile_id, patient_id, expires_at);
create index break_glass_review_idx
  on public.break_glass_grants (tenant_id, granted_at desc) where reviewed_at is null;

create or replace function app.has_break_glass(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.break_glass_grants g
    where g.patient_id = p_patient
      and g.profile_id = (select auth.uid())
      and g.expires_at > now()
  )
$$;

-- Único camino para abrir un acceso de emergencia: exige motivo, comprueba el
-- permiso y deja el rastro antes de conceder nada.
create or replace function public.break_glass(p_patient_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid;
  v_expires timestamptz;
begin
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Debe indicar un motivo de al menos 10 caracteres'
      using errcode = '22023';
  end if;

  select tenant_id into v_tenant
  from public.patients where id = p_patient_id and deleted_at is null;

  if v_tenant is null then
    raise exception 'Paciente inexistente' using errcode = '22023';
  end if;

  if not app.has_permission(v_tenant, 'breakglass.use') then
    perform app.audit('permission_denied', 'break_glass_grant', null, v_tenant, p_patient_id,
                      'Intento de acceso de emergencia sin permiso breakglass.use');
    raise exception 'No autorizado para el acceso de emergencia' using errcode = '42501';
  end if;

  insert into public.break_glass_grants (tenant_id, patient_id, profile_id, reason)
  values (v_tenant, p_patient_id, (select auth.uid()), trim(p_reason))
  returning expires_at into v_expires;

  -- Se audita ANTES de que se lea nada, para que el rastro exista aunque la
  -- sesión se corte a mitad de la consulta.
  insert into public.audit_log (
    tenant_id, actor_id, actor_label, actor_role, action, resource_type,
    resource_id, patient_id, summary, break_glass_reason
  ) values (
    v_tenant, (select auth.uid()), 'user', app.role_in_tenant(v_tenant),
    'break_glass', 'patient', p_patient_id, p_patient_id,
    'Acceso de emergencia concedido hasta ' || v_expires::text, trim(p_reason)
  );

  return v_expires;
end;
$$;

grant execute on function
  app.has_break_glass(uuid), public.break_glass(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Autorización de acceso a un paciente
--
-- Éste es el control de "mínimo necesario". Toda tabla clínica lo usa en su RLS.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_patient(p_patient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_model  app.access_model;
  v_owner  uuid;
begin
  select p.tenant_id, t.access_model, p.profile_id
    into v_tenant, v_model, v_owner
  from public.patients p
  join public.tenants t on t.id = p.tenant_id
  where p.id = p_patient and p.deleted_at is null;

  if v_tenant is null then
    return false;
  end if;

  -- El propio paciente, desde el portal.
  if v_owner is not null and v_owner = (select auth.uid()) then
    return true;
  end if;

  if not app.has_permission(v_tenant, 'clinical.read') then
    return false;
  end if;

  if v_model = 'open' then
    return true;
  end if;

  -- Modelo care_team: hay que formar parte del equipo del paciente...
  if exists (
    select 1 from public.care_team_members c
    where c.patient_id = p_patient
      and c.profile_id = (select auth.uid())
      and c.ended_at is null
  ) then
    return true;
  end if;

  -- ...o tener abierta una concesión de emergencia vigente para este paciente,
  -- que ya exigió motivo y quedó auditada al crearse.
  if app.has_break_glass(p_patient) then
    return true;
  end if;

  -- La ruta de conexión directa (workers, migraciones de datos) sí puede fijar
  -- la GUC dentro de su transacción, donde no hay pool que la filtre.
  if app.break_glass_reason() is not null
     and app.has_permission(v_tenant, 'breakglass.use') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function app.can_write_patient(p_patient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant
  from public.patients where id = p_patient and deleted_at is null;

  return v_tenant is not null
     and app.has_permission(v_tenant, 'clinical.write')
     and app.can_read_patient(p_patient);
end;
$$;

grant execute on function
  app.can_read_patient(uuid), app.can_write_patient(uuid), app.next_counter(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Consentimientos (LOPDP art. 7 y 9: los datos de salud son categoría especial
-- y exigen consentimiento explícito, informado y revocable)
-- -----------------------------------------------------------------------------
create type app.consent_purpose as enum (
  'tratamiento_datos',   -- base legal general del tratamiento
  'atencion_medica',     -- acto médico
  'whatsapp',            -- agendamiento y recordatorios por WhatsApp
  'sms',                 -- recordatorios por SMS
  'email',
  'compartir_interno',   -- compartir con otros médicos de la institución
  'compartir_externo',   -- derivación a otra institución
  'investigacion'        -- uso secundario anonimizado
);

create table public.patient_consents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  patient_id    uuid not null references public.patients(id) on delete cascade,
  purpose       app.consent_purpose not null,

  granted       boolean not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,

  -- Evidencia del consentimiento: cómo se capturó y sobre qué texto.
  method        text not null default 'portal'
                  check (method in ('portal', 'presencial', 'whatsapp', 'telefono', 'papel')),
  policy_version text not null,
  evidence      jsonb not null default '{}'::jsonb,

  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index patient_consents_lookup_idx
  on public.patient_consents (patient_id, purpose, granted_at desc);

-- Estado vigente de un consentimiento: la última declaración gana.
create or replace function app.has_consent(p_patient uuid, p_purpose app.consent_purpose)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.granted and c.revoked_at is null
     from public.patient_consents c
     where c.patient_id = p_patient and c.purpose = p_purpose
     order by c.granted_at desc
     limit 1),
    false)
$$;

grant execute on function app.has_consent(uuid, app.consent_purpose) to authenticated;

-- -----------------------------------------------------------------------------
-- Derechos del titular (LOPDP art. 12-16). Plazo legal de respuesta: 15 días.
-- -----------------------------------------------------------------------------
create type app.dsr_kind as enum
  ('acceso', 'rectificacion', 'eliminacion', 'portabilidad', 'oposicion', 'limitacion');
create type app.dsr_status as enum
  ('recibida', 'en_proceso', 'completada', 'rechazada');

create table public.data_subject_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  patient_id   uuid references public.patients(id) on delete set null,
  requester_email extensions.citext not null,

  kind         app.dsr_kind not null,
  status       app.dsr_status not null default 'recibida',
  detail       text,
  resolution   text,

  received_at  timestamptz not null default now(),
  -- El plazo legal NO puede ser una columna generada: `timestamptz + interval`
  -- es STABLE y no IMMUTABLE (sumar días depende de la zona horaria de sesión
  -- por el horario de verano), y Postgres rechaza la tabla entera. Lo calcula
  -- el trigger dsr_set_due_at, que además lo recalcula si se corrige la fecha
  -- de recepción —una solicitud entregada en papel se registra con su fecha
  -- real, y el plazo debe contar desde ella, no desde que alguien la tecleó.
  due_at       timestamptz not null,
  resolved_at  timestamptz,
  handled_by   uuid references public.profiles(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index dsr_pending_idx
  on public.data_subject_requests (tenant_id, due_at)
  where status in ('recibida', 'en_proceso');

-- Plazo de respuesta de la LOPDP: 15 días desde la recepción.
create or replace function app.dsr_set_due_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.due_at := new.received_at + interval '15 days';
  return new;
end;
$$;

create trigger data_subject_requests_due_at
  before insert or update of received_at on public.data_subject_requests
  for each row execute function app.dsr_set_due_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.patients              enable row level security;
alter table public.care_team_members     enable row level security;
alter table public.patient_consents      enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.break_glass_grants    enable row level security;

-- El padrón (datos demográficos) lo ve todo el personal con patients.read:
-- recepción necesita encontrar al paciente para agendarlo, pero NO tiene
-- clinical.read, así que no verá nada de la historia clínica (0006).
create policy patients_select on public.patients
  for select to authenticated
  using (
    deleted_at is null
    and (
      app.has_permission(tenant_id, 'patients.read')
      or profile_id = (select auth.uid())
    )
  );

create policy patients_insert on public.patients
  for insert to authenticated
  with check (app.has_permission(tenant_id, 'patients.write'));

create policy patients_update on public.patients
  for update to authenticated
  using (app.has_permission(tenant_id, 'patients.write') and deleted_at is null)
  with check (app.has_permission(tenant_id, 'patients.write'));

-- Sin política DELETE: los pacientes se archivan con deleted_at. Borrar una
-- historia clínica destruiría evidencia que la ley obliga a conservar; la
-- eliminación real sólo ocurre por el flujo de derechos LOPDP.

create policy care_team_select on public.care_team_members
  for select to authenticated
  using (app.can_access_tenant(tenant_id));

create policy care_team_write on public.care_team_members
  for all to authenticated
  using (app.has_permission(tenant_id, 'clinical.write'))
  with check (app.has_permission(tenant_id, 'clinical.write'));

create policy consents_select on public.patient_consents
  for select to authenticated
  using (
    app.has_permission(tenant_id, 'patients.read')
    or exists (select 1 from public.patients p
               where p.id = patient_id and p.profile_id = (select auth.uid()))
  );

create policy consents_insert on public.patient_consents
  for insert to authenticated
  with check (
    app.has_permission(tenant_id, 'patients.write')
    or exists (select 1 from public.patients p
               where p.id = patient_id and p.profile_id = (select auth.uid()))
  );

-- Los consentimientos no se editan ni se borran: revocar es insertar una nueva
-- declaración. Así queda el historial completo de qué autorizó el paciente y cuándo.

create policy dsr_select on public.data_subject_requests
  for select to authenticated
  using (app.has_permission(tenant_id, 'privacy.manage'));

create policy dsr_write on public.data_subject_requests
  for all to authenticated
  using (app.has_permission(tenant_id, 'privacy.manage'))
  with check (app.has_permission(tenant_id, 'privacy.manage'));

-- Las concesiones de emergencia las ve quien las usó y quien las audita. No hay
-- política de INSERT: la única vía de creación es public.break_glass(), que
-- obliga a dar motivo y deja el rastro.
create policy break_glass_select on public.break_glass_grants
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or app.has_permission(tenant_id, 'audit.read')
  );

-- Cerrar la revisión de una concesión es tarea de quien audita.
create policy break_glass_review on public.break_glass_grants
  for update to authenticated
  using (app.has_permission(tenant_id, 'audit.read'))
  with check (app.has_permission(tenant_id, 'audit.read'));

select app.attach_standard_triggers('public.patients');
select app.attach_standard_triggers('public.break_glass_grants');
select app.attach_standard_triggers('public.care_team_members');
select app.attach_standard_triggers('public.patient_consents');
select app.attach_standard_triggers('public.data_subject_requests');
