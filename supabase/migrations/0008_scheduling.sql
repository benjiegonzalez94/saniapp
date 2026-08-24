-- =============================================================================
-- 0008_scheduling.sql  ·  SaniTi
-- Sedes, horarios de atención, agenda y recordatorios.
--
-- La regla de "un médico no puede estar en dos citas a la vez" se impone con una
-- restricción de exclusión GiST, no con una comprobación en la aplicación. Dos
-- recepcionistas agendando al mismo tiempo, o el bot de WhatsApp compitiendo con
-- la web, no pueden producir un solapamiento: la segunda transacción falla.
--
-- La exclusión es por médico y NO por institución, a propósito: un médico que
-- atiende en dos clínicas tampoco puede estar en ambas a la misma hora.
-- =============================================================================

create type app.appointment_status as enum (
  'solicitada', 'confirmada', 'en_sala', 'atendida',
  'cancelada', 'no_asistio', 'reprogramada'
);

create type app.appointment_source as enum
  ('web', 'whatsapp', 'telefono', 'presencial', 'portal_paciente');

create type app.reminder_channel as enum ('whatsapp', 'sms', 'email');

create type app.reminder_status as enum
  ('programado', 'enviando', 'enviado', 'fallido', 'cancelado', 'sin_consentimiento');

-- -----------------------------------------------------------------------------
-- locations — sedes o consultorios físicos de la institución
-- -----------------------------------------------------------------------------
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 120),
  address_line text,
  city         text,
  phone        text check (phone is null or phone ~ '^\+[1-9]\d{7,14}$'),
  timezone     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, name)
);

-- -----------------------------------------------------------------------------
-- provider_schedules — disponibilidad recurrente por día de la semana
-- -----------------------------------------------------------------------------
create table public.provider_schedules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  provider_id  uuid not null references public.profiles(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,

  weekday      smallint not null check (weekday between 0 and 6), -- 0 = domingo
  starts_at    time not null,
  ends_at      time not null,
  slot_minutes smallint not null default 30 check (slot_minutes between 5 and 240),

  valid_from   date not null default current_date,
  valid_to     date,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint provider_schedules_interval check (ends_at > starts_at),
  constraint provider_schedules_validity check (valid_to is null or valid_to >= valid_from)
);

create index provider_schedules_lookup_idx
  on public.provider_schedules (provider_id, weekday, valid_from);

-- -----------------------------------------------------------------------------
-- schedule_exceptions — vacaciones, feriados, bloqueos puntuales
-- -----------------------------------------------------------------------------
create table public.schedule_exceptions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  -- NULL = aplica a toda la institución (p. ej. un feriado nacional).
  provider_id uuid references public.profiles(id) on delete cascade,

  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  -- Un bloqueo puede también ABRIR disponibilidad extraordinaria.
  is_available boolean not null default false,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint schedule_exceptions_interval check (ends_at > starts_at)
);

create index schedule_exceptions_lookup_idx
  on public.schedule_exceptions (tenant_id, provider_id, starts_at, ends_at);

-- -----------------------------------------------------------------------------
-- appointments
-- -----------------------------------------------------------------------------
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  provider_id  uuid not null references public.profiles(id) on delete restrict,
  location_id  uuid references public.locations(id) on delete set null,

  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  -- Columna generada para la restricción de exclusión. '[)' = el fin de una
  -- cita puede coincidir con el inicio de la siguiente sin considerarse choque.
  slot         tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  kind         app.encounter_kind not null default 'consulta',
  status       app.appointment_status not null default 'solicitada',
  source       app.appointment_source not null default 'web',

  reason       text,
  private_note text,

  encounter_id uuid references public.encounters(id) on delete set null,
  rescheduled_from uuid references public.appointments(id) on delete set null,

  confirmed_at  timestamptz,
  cancelled_at  timestamptz,
  cancelled_by  uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  checked_in_at timestamptz,

  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint appointments_interval check (ends_at > starts_at),
  constraint appointments_duration check (ends_at - starts_at <= interval '8 hours'),
  constraint appointments_cancel_coherent
    check ((status = 'cancelada') = (cancelled_at is not null)),

  -- El invariante que hace confiable la agenda.
  constraint appointments_no_overlap exclude using gist (
    provider_id with =,
    slot with &&
  ) where (status in ('solicitada', 'confirmada', 'en_sala', 'atendida'))
);

create index appointments_provider_day_idx
  on public.appointments (provider_id, starts_at);
create index appointments_tenant_day_idx
  on public.appointments (tenant_id, starts_at);
create index appointments_patient_idx
  on public.appointments (patient_id, starts_at desc);
create index appointments_upcoming_idx
  on public.appointments (starts_at)
  where status in ('solicitada', 'confirmada');

-- -----------------------------------------------------------------------------
-- appointment_reminders — cola de recordatorios
-- -----------------------------------------------------------------------------
create table public.appointment_reminders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,

  channel        app.reminder_channel not null,
  scheduled_for  timestamptz not null,
  status         app.reminder_status not null default 'programado',

  attempts       smallint not null default 0 check (attempts <= 5),
  sent_at        timestamptz,
  failed_reason  text,
  provider_message_id text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (appointment_id, channel, scheduled_for)
);

-- Índice que consume el worker de envíos.
create index appointment_reminders_due_idx
  on public.appointment_reminders (scheduled_for)
  where status = 'programado';

-- Cancelar la cita cancela sus recordatorios pendientes: nada peor que
-- recordarle a un paciente una cita que ya no existe.
create or replace function app.cancel_reminders_on_appointment_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('cancelada', 'reprogramada')
     and old.status not in ('cancelada', 'reprogramada') then
    update public.appointment_reminders
       set status = 'cancelado', updated_at = now()
     where appointment_id = new.id and status = 'programado';
  end if;
  return new;
end;
$$;

create trigger appointments_cancel_reminders
  after update of status on public.appointments
  for each row execute function app.cancel_reminders_on_appointment_cancel();

-- -----------------------------------------------------------------------------
-- Huecos disponibles
--
-- Se resuelve en SQL, no en la aplicación: es la misma respuesta para la web,
-- el bot de WhatsApp y el portal del paciente, y sólo la base ve el estado real
-- de la agenda en el instante de la consulta.
-- -----------------------------------------------------------------------------
create or replace function public.available_slots(
  p_tenant_id   uuid,
  p_provider_id uuid,
  p_from        date,
  p_to          date,
  p_location_id uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz, location_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    -- Tope de 60 días por consulta: acota el coste y es más de lo que cualquier
    -- pantalla de agenda muestra de una vez.
    select d::date as day
    from generate_series(
      p_from::timestamp,
      least(p_to, p_from + 60)::timestamp,
      interval '1 day'
    ) as d
  ),
  windows as (
    select
      d.day,
      s.starts_at   as window_start,
      s.ends_at     as window_end,
      s.slot_minutes,
      s.location_id,
      coalesce(t.timezone, 'UTC') as tz
    from days d
    join public.provider_schedules s
      on s.provider_id = p_provider_id
     and s.tenant_id   = p_tenant_id
     and s.weekday     = extract(dow from d.day)
     and s.valid_from <= d.day
     and (s.valid_to is null or s.valid_to >= d.day)
    join public.tenants t on t.id = s.tenant_id
    where p_location_id is null or s.location_id = p_location_id
  ),
  expanded as (
    select
      ((w.day + w.window_start + make_interval(mins => w.slot_minutes * g.i))
        at time zone w.tz) as slot_start,
      ((w.day + w.window_start + make_interval(mins => w.slot_minutes * (g.i + 1)))
        at time zone w.tz) as slot_end,
      w.location_id
    from windows w
    cross join lateral generate_series(
      0,
      greatest(
        (extract(epoch from (w.window_end - w.window_start)) / 60 / w.slot_minutes)::int - 1,
        0)
    ) as g(i)
  )
  select e.slot_start, e.slot_end, e.location_id
  from expanded e
  where e.slot_start > now()
    -- Sin cita que lo ocupe...
    and not exists (
      select 1 from public.appointments a
      where a.provider_id = p_provider_id
        and a.status in ('solicitada', 'confirmada', 'en_sala', 'atendida')
        and a.slot && tstzrange(e.slot_start, e.slot_end, '[)')
    )
    -- ...y sin bloqueo de agenda que lo tape.
    and not exists (
      select 1 from public.schedule_exceptions x
      where x.tenant_id = p_tenant_id
        and (x.provider_id = p_provider_id or x.provider_id is null)
        and x.is_available = false
        and tstzrange(x.starts_at, x.ends_at, '[)') && tstzrange(e.slot_start, e.slot_end, '[)')
    )
  order by e.slot_start;
$$;

grant execute on function public.available_slots(uuid, uuid, date, date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.locations             enable row level security;
alter table public.provider_schedules    enable row level security;
alter table public.schedule_exceptions   enable row level security;
alter table public.appointments          enable row level security;
alter table public.appointment_reminders enable row level security;

create policy locations_select on public.locations
  for select to authenticated using (app.can_access_tenant(tenant_id));
create policy locations_write on public.locations
  for all to authenticated
  using (app.has_permission(tenant_id, 'tenant.manage'))
  with check (app.has_permission(tenant_id, 'tenant.manage'));

-- La disponibilidad la ve todo el equipo (hay que poder agendar), pero un
-- médico sólo edita la suya salvo que tenga schedule.manage sobre terceros.
create policy provider_schedules_select on public.provider_schedules
  for select to authenticated using (app.can_access_tenant(tenant_id));
create policy provider_schedules_write on public.provider_schedules
  for all to authenticated
  using (
    app.has_permission(tenant_id, 'schedule.manage')
    and (provider_id = (select auth.uid())
         or app.role_in_tenant(tenant_id) in ('owner', 'admin', 'receptionist'))
  )
  with check (
    app.has_permission(tenant_id, 'schedule.manage')
    and (provider_id = (select auth.uid())
         or app.role_in_tenant(tenant_id) in ('owner', 'admin', 'receptionist'))
  );

create policy schedule_exceptions_select on public.schedule_exceptions
  for select to authenticated using (app.can_access_tenant(tenant_id));
create policy schedule_exceptions_write on public.schedule_exceptions
  for all to authenticated
  using (
    app.has_permission(tenant_id, 'schedule.manage')
    and (provider_id = (select auth.uid()) or provider_id is null
         or app.role_in_tenant(tenant_id) in ('owner', 'admin'))
  )
  with check (
    app.has_permission(tenant_id, 'schedule.manage')
    and (provider_id = (select auth.uid()) or provider_id is null
         or app.role_in_tenant(tenant_id) in ('owner', 'admin'))
  );

-- Citas: las ve el equipo con appointments.read y el propio paciente en su
-- portal. `private_note` es del equipo, no del paciente — se filtra en la capa
-- de consulta (ver src/lib/db/appointments.ts).
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    app.has_permission(tenant_id, 'appointments.read')
    or exists (select 1 from public.patients p
               where p.id = patient_id and p.profile_id = (select auth.uid()))
  );

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (app.has_permission(tenant_id, 'appointments.write'));

create policy appointments_update on public.appointments
  for update to authenticated
  using (app.has_permission(tenant_id, 'appointments.write'))
  with check (app.has_permission(tenant_id, 'appointments.write'));

create policy reminders_select on public.appointment_reminders
  for select to authenticated
  using (app.has_permission(tenant_id, 'appointments.read'));
create policy reminders_write on public.appointment_reminders
  for all to authenticated
  using (app.has_permission(tenant_id, 'appointments.write'))
  with check (app.has_permission(tenant_id, 'appointments.write'));

select app.attach_standard_triggers('public.locations');
select app.attach_standard_triggers('public.provider_schedules');
select app.attach_standard_triggers('public.schedule_exceptions');
select app.attach_standard_triggers('public.appointments');
select app.attach_standard_triggers('public.appointment_reminders');
