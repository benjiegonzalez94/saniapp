-- =============================================================================
-- 0002_tenancy_rbac.sql  ·  SaniTi
-- Instituciones (tenants), identidades, membresías y el motor de permisos.
-- Todo el aislamiento entre clínicas cuelga de este archivo.
-- =============================================================================

create type app.tenant_kind as enum
  ('hospital', 'clinica', 'consultorio', 'laboratorio', 'centro_diagnostico');

create type app.tenant_status as enum
  ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

create type app.member_role as enum
  ('owner', 'admin', 'physician', 'nurse', 'receptionist', 'billing', 'auditor');

create type app.membership_status as enum
  ('invited', 'active', 'suspended', 'revoked');

-- -----------------------------------------------------------------------------
-- tenants — una institución, o el consultorio de un médico individual
-- -----------------------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            extensions.citext not null unique
                    check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  legal_name      text not null check (length(trim(legal_name)) between 2 and 200),
  commercial_name text,
  kind            app.tenant_kind not null default 'consultorio',
  status          app.tenant_status not null default 'trialing',

  -- Ecuador por defecto: RUC de 13 dígitos, zona horaria continental.
  country         char(2) not null default 'EC',
  tax_id          text check (country <> 'EC' or tax_id is null or tax_id ~ '^\d{13}$'),
  timezone        text not null default 'America/Guayaquil',
  locale          text not null default 'es-EC',

  -- Contacto del responsable de protección de datos (LOPDP, art. 47).
  dpo_email       extensions.citext,
  dpo_phone       text,

  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- profiles — identidad global de una persona del staff (1:1 con auth.users)
-- Un médico puede pertenecer a varias instituciones con un solo perfil.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null check (length(trim(full_name)) between 2 and 160),
  email           extensions.citext not null,
  phone           text check (phone is null or phone ~ '^\+[1-9]\d{7,14}$'),
  avatar_url      text,
  locale          text not null default 'es-EC',

  -- Registro profesional (ACESS en Ecuador). Se valida al invitar a un médico.
  license_number  text,
  license_country char(2),
  specialty       text,

  mfa_enrolled_at timestamptz,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  disabled_at     timestamptz
);

-- -----------------------------------------------------------------------------
-- memberships — la arista que define TODO el control de acceso
-- -----------------------------------------------------------------------------
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  role         app.member_role not null,
  status       app.membership_status not null default 'invited',

  invited_by   uuid references public.profiles(id) on delete set null,
  invited_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  revoked_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, profile_id),
  -- Coherencia de estado: activa ⇒ aceptada; revocada ⇒ con fecha de revocación.
  constraint memberships_status_coherent check (
    (status = 'active'  and accepted_at is not null) or
    (status = 'revoked' and revoked_at  is not null) or
    (status in ('invited', 'suspended'))
  )
);

create index memberships_profile_active_idx
  on public.memberships (profile_id, tenant_id) where status = 'active';
create index memberships_tenant_idx on public.memberships (tenant_id);

-- Un único owner activo por institución: evita ambigüedad sobre quién responde
-- legalmente por los datos y quién puede transferir la titularidad.
create unique index memberships_one_owner_idx
  on public.memberships (tenant_id)
  where role = 'owner' and status = 'active';

-- -----------------------------------------------------------------------------
-- Matriz de permisos
-- -----------------------------------------------------------------------------
create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

create table public.role_permissions (
  role           app.member_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

insert into public.permissions (key, description) values
  ('tenant.manage',      'Editar datos, ajustes y estado de la institución'),
  ('members.manage',     'Invitar, editar rol y revocar miembros del equipo'),
  ('patients.read',      'Ver el padrón de pacientes y sus datos demográficos'),
  ('patients.write',     'Crear y editar pacientes'),
  ('clinical.read',      'Leer historia clínica, diagnósticos y resultados'),
  ('clinical.write',     'Registrar notas, signos vitales y diagnósticos'),
  ('clinical.sign',      'Firmar y cerrar notas clínicas y recetas'),
  ('documents.read',     'Descargar estudios y documentos del paciente'),
  ('documents.upload',   'Subir resultados y documentos'),
  ('documents.share',    'Compartir documentos con otros médicos de la institución'),
  ('appointments.read',  'Ver la agenda de citas'),
  ('appointments.write', 'Crear, mover y cancelar citas'),
  ('schedule.manage',    'Definir horarios de atención y bloqueos'),
  ('billing.manage',     'Gestionar la suscripción y los métodos de pago'),
  ('audit.read',         'Consultar la bitácora de auditoría'),
  ('breakglass.use',     'Acceso de emergencia a un paciente fuera de su círculo de cuidado'),
  ('privacy.manage',     'Atender solicitudes de derechos LOPDP y consentimientos');

insert into public.role_permissions (role, permission_key)
select r.role::app.member_role, p.key
from (values
  -- owner: control total de su institución ('%' = todos los permisos)
  ('owner', '%'),
  -- admin: gestión completa salvo firmar clínicamente y usar break-glass
  ('admin', 'tenant.manage'), ('admin', 'members.manage'),
  ('admin', 'patients.read'), ('admin', 'patients.write'),
  ('admin', 'appointments.read'), ('admin', 'appointments.write'),
  ('admin', 'schedule.manage'), ('admin', 'billing.manage'),
  ('admin', 'audit.read'), ('admin', 'privacy.manage'),
  -- physician: núcleo clínico completo
  ('physician', 'patients.read'), ('physician', 'patients.write'),
  ('physician', 'clinical.read'), ('physician', 'clinical.write'),
  ('physician', 'clinical.sign'), ('physician', 'documents.read'),
  ('physician', 'documents.upload'), ('physician', 'documents.share'),
  ('physician', 'appointments.read'), ('physician', 'appointments.write'),
  ('physician', 'schedule.manage'), ('physician', 'breakglass.use'),
  -- nurse: registra pero no firma
  ('nurse', 'patients.read'), ('nurse', 'patients.write'),
  ('nurse', 'clinical.read'), ('nurse', 'clinical.write'),
  ('nurse', 'documents.read'), ('nurse', 'documents.upload'),
  ('nurse', 'appointments.read'), ('nurse', 'appointments.write'),
  -- receptionist: agenda y demografía. SIN acceso clínico (mínimo necesario).
  ('receptionist', 'patients.read'), ('receptionist', 'patients.write'),
  ('receptionist', 'appointments.read'), ('receptionist', 'appointments.write'),
  ('receptionist', 'schedule.manage'),
  -- billing: sólo lo económico
  ('billing', 'billing.manage'), ('billing', 'appointments.read'),
  -- auditor: sólo lectura de la bitácora
  ('auditor', 'audit.read')
) as r(role, key)
join public.permissions p on r.key = '%' or p.key = r.key;

-- -----------------------------------------------------------------------------
-- Funciones de autorización
--
-- SECURITY DEFINER a propósito: se consultan DESDE las políticas RLS de otras
-- tablas, así que no pueden quedar sujetas a RLS o habría recursión infinita.
-- `search_path = ''` evita el secuestro de resolución de nombres.
-- -----------------------------------------------------------------------------

create or replace function app.current_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.tenant_id), '{}'::uuid[])
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and t.deleted_at is null
    and t.status <> 'cancelled'
$$;

-- Verdad única del aislamiento. Toda política de una tabla con tenant_id la usa.
create or replace function app.can_access_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_tenant is not null
     and p_tenant = any (app.current_tenant_ids())
     -- Segunda barrera: si el servidor fijó un tenant activo, sólo ese.
     and (app.active_tenant_id() is null or p_tenant = app.active_tenant_id())
$$;

create or replace function app.has_permission(p_tenant uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.can_access_tenant(p_tenant)
     and exists (
       select 1
       from public.memberships m
       join public.role_permissions rp on rp.role = m.role
       where m.tenant_id = p_tenant
         and m.profile_id = (select auth.uid())
         and m.status = 'active'
         and rp.permission_key = p_permission
     )
$$;

create or replace function app.role_in_tenant(p_tenant uuid)
returns app.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.tenant_id = p_tenant
    and m.profile_id = (select auth.uid())
    and m.status = 'active'
$$;

grant execute on function
  app.current_tenant_ids(), app.can_access_tenant(uuid),
  app.has_permission(uuid, text), app.role_in_tenant(uuid),
  app.active_tenant_id(), app.break_glass_reason(),
  app.current_user_id(), app.actor_label()
to authenticated;

-- -----------------------------------------------------------------------------
-- Alta automática del perfil al registrarse en auth.users
-- -----------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tenants          enable row level security;
alter table public.profiles         enable row level security;
alter table public.memberships      enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;

-- Nota deliberada: NO se usa `force row level security` en ninguna tabla.
-- FORCE haría que RLS aplicara también al dueño de la tabla, y las funciones
-- SECURITY DEFINER de este proyecto (app.audit, app.next_counter, app.sync_seats,
-- app.rate_limit_hit, create_tenant, accept_invitation…) corren precisamente como
-- el dueño. Con FORCE, sus escrituras no fallarían: afectarían a CERO filas en
-- silencio, que es el peor modo de fallo posible para una bitácora de auditoría.
-- El aislamiento real lo dan las políticas sobre `authenticated`/`anon`, que son
-- los únicos roles con los que se conecta la aplicación, más los REVOKE
-- explícitos sobre las tablas sensibles.

-- tenants: se ve el tenant del que se es miembro; sólo `tenant.manage` edita.
create policy tenants_select on public.tenants
  for select to authenticated
  using (app.can_access_tenant(id));

create policy tenants_update on public.tenants
  for update to authenticated
  using (app.has_permission(id, 'tenant.manage'))
  with check (app.has_permission(id, 'tenant.manage'));

-- El alta de instituciones pasa por el RPC transaccional app.create_tenant()
-- (migración 0003), que crea tenant + membresía de owner en un solo paso.
-- No se permite INSERT directo: produciría tenants huérfanos sin responsable.

-- profiles: el propio perfil, y el de los compañeros de institución.
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_colleagues on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.profile_id = public.profiles.id
      and m.status = 'active'
      and app.can_access_tenant(m.tenant_id)
  ));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships: visibles dentro del tenant; sólo `members.manage` las modifica.
create policy memberships_select on public.memberships
  for select to authenticated
  using (app.can_access_tenant(tenant_id) or profile_id = (select auth.uid()));

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (app.has_permission(tenant_id, 'members.manage'));

create policy memberships_update on public.memberships
  for update to authenticated
  using (app.has_permission(tenant_id, 'members.manage'))
  with check (app.has_permission(tenant_id, 'members.manage'));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (app.has_permission(tenant_id, 'members.manage'));

-- Catálogos de permisos: lectura para cualquier autenticado, escritura sólo
-- por migración (service_role no está sujeto a RLS).
create policy permissions_select on public.permissions
  for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);

select app.attach_standard_triggers('public.tenants');
select app.attach_standard_triggers('public.profiles');
select app.attach_standard_triggers('public.memberships');
