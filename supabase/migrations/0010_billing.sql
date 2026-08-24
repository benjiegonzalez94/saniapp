-- =============================================================================
-- 0010_billing.sql  ·  SaniTi
-- Planes, suscripciones, asientos y facturas.
--
-- POSTURA DEL PRODUCTO, deliberada y no negociable:
-- una suscripción vencida NUNCA bloquea la lectura ni la exportación de una
-- historia clínica. Un impago es un problema comercial; dejar a un médico sin
-- acceso al expediente de su paciente es un problema de seguridad del paciente.
-- La morosidad restringe la CREACIÓN de datos nuevos y las funciones accesorias,
-- jamás el acceso a lo ya registrado. Lo impone app.tenant_write_allowed().
-- =============================================================================

create type app.billing_interval as enum ('mensual', 'anual');
create type app.subscription_status as enum
  ('trial', 'activa', 'vencida', 'suspendida', 'cancelada');
create type app.invoice_status as enum
  ('borrador', 'emitida', 'pagada', 'vencida', 'anulada');
-- Pasarelas que operan en Ecuador. Stripe queda fuera a propósito: no procesa
-- cobros locales aquí, así que incluirlo sólo invitaría a construir un flujo
-- que después no se puede liquidar. `manual` cubre la transferencia bancaria y
-- el depósito, que en el mercado ecuatoriano siguen siendo habituales.
create type app.billing_provider as enum ('payphone', 'kushki', 'manual');

-- -----------------------------------------------------------------------------
-- plans — catálogo público
-- -----------------------------------------------------------------------------
create table public.plans (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]{2,30}$'),
  name            text not null,
  description     text,

  -- Todo importe en la unidad mínima de la moneda (centavos), en entero.
  -- Nunca en punto flotante: 0.1 + 0.2 no es 0.3 y una factura no perdona.
  price_cents     int not null check (price_cents >= 0),
  currency        char(3) not null default 'USD',
  billing_interval app.billing_interval not null default 'mensual',

  included_seats  int not null default 1 check (included_seats >= 1),
  extra_seat_cents int not null default 0 check (extra_seat_cents >= 0),

  -- Topes duros: {"patients": 500, "storage_gb": 5, "whatsapp_msgs": 1000}
  -- NULL o ausente = sin límite.
  limits          jsonb not null default '{}'::jsonb,
  features        jsonb not null default '{}'::jsonb,

  trial_days      int not null default 14 check (trial_days >= 0),
  is_active       boolean not null default true,
  is_public       boolean not null default true,
  sort_order      int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

insert into public.plans
  (code, name, description, price_cents, included_seats, extra_seat_cents, limits, sort_order)
values
  ('solo', 'Médico independiente',
   'Un profesional, su agenda y sus pacientes.',
   1900, 1, 0,
   '{"patients": 500, "storage_gb": 5, "whatsapp_msgs": 300}'::jsonb, 10),
  ('clinica', 'Clínica',
   'Equipo completo, varias sedes y agenda compartida.',
   9900, 5, 1500,
   '{"patients": 5000, "storage_gb": 50, "whatsapp_msgs": 3000}'::jsonb, 20),
  ('hospital', 'Hospital',
   'Sin topes, círculo de cuidado, auditoría avanzada y soporte prioritario.',
   49900, 25, 1200,
   '{}'::jsonb, 30);

-- -----------------------------------------------------------------------------
-- subscriptions — una por institución
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null unique references public.tenants(id) on delete cascade,
  plan_code      text not null references public.plans(code) on delete restrict,

  status         app.subscription_status not null default 'trial',
  seats          int not null default 1 check (seats >= 1),

  trial_ends_at  timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null default now() + interval '1 month',
  cancel_at_period_end boolean not null default false,
  cancelled_at   timestamptz,

  -- Periodo de gracia tras el primer impago, antes de restringir la escritura.
  grace_until    timestamptz,

  provider       app.billing_provider not null default 'manual',
  provider_customer_id     text,
  provider_subscription_id text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint subscriptions_period check (current_period_end > current_period_start)
);

create index subscriptions_renewal_idx
  on public.subscriptions (current_period_end)
  where status in ('trial', 'activa');
create unique index subscriptions_provider_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- -----------------------------------------------------------------------------
-- invoices
-- -----------------------------------------------------------------------------
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,

  number         text not null,
  status         app.invoice_status not null default 'borrador',

  period_start   timestamptz not null,
  period_end     timestamptz not null,

  subtotal_cents int not null check (subtotal_cents >= 0),
  -- Puntos básicos: 1500 = 15 % (IVA vigente en Ecuador). Se guarda por factura
  -- porque la tasa cambia y una factura emitida no se recalcula nunca.
  tax_rate_bps   int not null default 1500 check (tax_rate_bps between 0 and 10000),
  tax_cents      int not null generated always as
                   (round(subtotal_cents * tax_rate_bps / 10000.0)::int) stored,
  total_cents    int not null generated always as
                   (subtotal_cents + round(subtotal_cents * tax_rate_bps / 10000.0)::int) stored,
  currency       char(3) not null default 'USD',

  seats_billed   int,
  line_items     jsonb not null default '[]'::jsonb,

  issued_at      timestamptz,
  due_at         timestamptz,
  paid_at        timestamptz,
  provider_invoice_id text,
  pdf_path       text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (tenant_id, number),
  constraint invoices_period check (period_end > period_start),
  constraint invoices_paid_coherent check ((status = 'pagada') = (paid_at is not null))
);

create index invoices_tenant_idx on public.invoices (tenant_id, created_at desc);
create index invoices_overdue_idx on public.invoices (due_at) where status = 'emitida';

-- -----------------------------------------------------------------------------
-- billing_events — bitácora cruda de webhooks, para conciliar y depurar
-- -----------------------------------------------------------------------------
create table public.billing_events (
  id           uuid primary key default gen_random_uuid(),
  provider     app.billing_provider not null,
  -- Idempotencia: las pasarelas reintentan y no se puede cobrar dos veces.
  provider_event_id text not null,
  event_type   text not null,
  tenant_id    uuid references public.tenants(id) on delete set null,

  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),

  unique (provider, provider_event_id)
);

create index billing_events_unprocessed_idx
  on public.billing_events (created_at) where processed_at is null;

-- -----------------------------------------------------------------------------
-- Asientos, topes y la regla de escritura
-- -----------------------------------------------------------------------------

-- Un asiento por miembro activo. `auditor` no consume: forzar a pagar por el
-- rol de auditoría desincentivaría justo lo que queremos que la gente use.
create or replace function app.billable_seats(p_tenant uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.memberships m
  where m.tenant_id = p_tenant and m.status = 'active' and m.role <> 'auditor'
$$;

create or replace function app.plan_limit(p_tenant uuid, p_key text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (p.limits ->> p_key)::bigint
  from public.subscriptions s
  join public.plans p on p.code = s.plan_code
  where s.tenant_id = p_tenant
$$;

-- ¿Puede esta institución CREAR datos nuevos? La lectura nunca pasa por aquí.
create or replace function app.tenant_write_allowed(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select
       s.status in ('trial', 'activa')
       or (s.status = 'vencida' and coalesce(s.grace_until, now()) > now())
     from public.subscriptions s
     where s.tenant_id = p_tenant),
    -- Sin suscripción registrada todavía (institución recién creada): se permite.
    true)
$$;

grant execute on function
  app.billable_seats(uuid), app.plan_limit(uuid, text), app.tenant_write_allowed(uuid)
to authenticated;

-- Al activar una membresía, el contador de asientos se ajusta solo. Si no, la
-- facturación depende de que alguien se acuerde de actualizarla a mano.
create or replace function app.sync_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  update public.subscriptions
     set seats = greatest(app.billable_seats(v_tenant), 1), updated_at = now()
   where tenant_id = v_tenant;
  return null;
end;
$$;

create trigger memberships_sync_seats
  after insert or update of status, role or delete on public.memberships
  for each row execute function app.sync_seats();

-- Cada institución nueva arranca con prueba gratuita del plan `solo`.
create or replace function app.start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_days int;
begin
  select trial_days into v_days from public.plans where code = 'solo';

  insert into public.subscriptions
    (tenant_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
  values (
    new.id, 'solo', 'trial',
    now() + make_interval(days => coalesce(v_days, 14)),
    now(),
    now() + make_interval(days => coalesce(v_days, 14))
  )
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;

create trigger tenants_start_trial
  after insert on public.tenants
  for each row execute function app.start_trial();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.invoices       enable row level security;
alter table public.billing_events enable row level security;

-- El catálogo de planes es público: la página de precios lo lee sin sesión.
create policy plans_select_public on public.plans
  for select to anon, authenticated
  using (is_active and is_public);

-- La suscripción la ve cualquier miembro (saber cuánto queda de prueba no es
-- información sensible), pero sólo billing.manage la modifica.
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (app.can_access_tenant(tenant_id));

create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (app.has_permission(tenant_id, 'billing.manage'))
  with check (app.has_permission(tenant_id, 'billing.manage'));

create policy invoices_select on public.invoices
  for select to authenticated
  using (app.has_permission(tenant_id, 'billing.manage'));

-- billing_events no tiene política: sólo lo toca el webhook con service_role.
-- Contiene payloads crudos de la pasarela y no debe llegar a ningún cliente.

select app.attach_standard_triggers('public.plans');
select app.attach_standard_triggers('public.subscriptions');
select app.attach_standard_triggers('public.invoices');
