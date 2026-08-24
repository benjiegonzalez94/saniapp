-- =============================================================================
-- 0009_messaging.sql  ·  SaniTi
-- Conversaciones de WhatsApp, bandeja de salida de notificaciones y el bot de
-- agendamiento con opción múltiple.
--
-- El consentimiento no se comprueba en el código de envío: lo impone un trigger
-- sobre la bandeja de salida. Así, ningún camino —ni un job, ni un script de
-- migración, ni una llamada directa con la clave de servicio— puede enviarle un
-- mensaje a un paciente que no lo autorizó.
-- =============================================================================

create type app.message_direction as enum ('entrante', 'saliente');

create type app.wa_state as enum (
  'inicio',              -- saludo, sin identificar
  'identificando',       -- pidiendo cédula o fecha de nacimiento
  'menu',                -- menú principal con botones
  'eligiendo_medico',
  'eligiendo_fecha',
  'eligiendo_hora',
  'confirmando',
  'finalizada',
  'escalada_humano'      -- derivada a recepción
);

create type app.outbox_status as enum (
  'programado', 'enviando', 'enviado', 'entregado',
  'fallido', 'cancelado', 'sin_consentimiento'
);

-- -----------------------------------------------------------------------------
-- whatsapp_conversations — una máquina de estados por número de teléfono
-- -----------------------------------------------------------------------------
create table public.whatsapp_conversations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  wa_phone     text not null check (wa_phone ~ '^\+[1-9]\d{7,14}$'),
  patient_id   uuid references public.patients(id) on delete set null,

  state        app.wa_state not null default 'inicio',
  -- Contexto del flujo: médico elegido, fecha tentativa, opciones ofrecidas.
  -- Es efímero y no clínico, por eso va en claro.
  context      jsonb not null default '{}'::jsonb,

  -- Tres intentos fallidos de identificación y la conversación se escala a una
  -- persona: un bot no debe convertirse en oráculo de datos de pacientes.
  failed_identifications smallint not null default 0,

  last_message_at timestamptz not null default now(),
  -- Meta cierra la ventana de atención a las 24 h del último mensaje del usuario.
  window_expires_at timestamptz not null default now() + interval '24 hours',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, wa_phone)
);

create index whatsapp_conversations_active_idx
  on public.whatsapp_conversations (tenant_id, last_message_at desc)
  where state <> 'finalizada';

create table public.whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,

  direction       app.message_direction not null,
  -- Identificador de Meta. Único: es la clave de idempotencia del webhook, que
  -- Meta reintenta ante cualquier error o timeout.
  wa_message_id   text unique,

  message_type    text not null default 'text',
  body            text,
  payload         jsonb not null default '{}'::jsonb,

  status          text,
  error_code      text,
  error_detail    text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- notification_outbox — cola única de salida para WhatsApp, SMS y correo
-- -----------------------------------------------------------------------------
create table public.notification_outbox (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  patient_id    uuid references public.patients(id) on delete set null,

  channel       app.reminder_channel not null,
  recipient     text not null,

  template      text not null,
  variables     jsonb not null default '{}'::jsonb,
  body_preview  text,

  status        app.outbox_status not null default 'programado',
  scheduled_for timestamptz not null default now(),
  attempts      smallint not null default 0,
  next_attempt_at timestamptz,
  sent_at       timestamptz,
  provider_message_id text,
  failed_reason text,

  -- Clave de idempotencia: impide que un reintento del worker duplique el aviso.
  dedupe_key    text not null unique,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index notification_outbox_due_idx
  on public.notification_outbox (scheduled_for)
  where status = 'programado';
create index notification_outbox_retry_idx
  on public.notification_outbox (next_attempt_at)
  where status = 'fallido';

-- -----------------------------------------------------------------------------
-- La puerta del consentimiento
-- -----------------------------------------------------------------------------
create or replace function app.enforce_notification_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purpose app.consent_purpose;
begin
  -- Sin paciente asociado es una notificación al personal, no al titular.
  if new.patient_id is null then
    return new;
  end if;

  v_purpose := case new.channel
    when 'whatsapp' then 'whatsapp'::app.consent_purpose
    when 'sms'      then 'sms'::app.consent_purpose
    when 'email'    then 'email'::app.consent_purpose
  end;

  if not app.has_consent(new.patient_id, v_purpose) then
    -- No se rechaza el INSERT: se marca y se conserva. Así queda constancia de
    -- qué se quiso enviar y por qué no salió, que es justo lo que una auditoría
    -- de protección de datos necesita comprobar.
    new.status        := 'sin_consentimiento';
    new.failed_reason := format(
      'El paciente no ha otorgado consentimiento para el canal %s', new.channel);
  end if;

  return new;
end;
$$;

create trigger notification_outbox_consent
  before insert on public.notification_outbox
  for each row execute function app.enforce_notification_consent();

-- Revocar el consentimiento cancela lo que aún no ha salido.
create or replace function app.cancel_pending_on_consent_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_channel app.reminder_channel;
begin
  if new.granted and new.revoked_at is null then
    return new;
  end if;

  v_channel := case new.purpose
    when 'whatsapp' then 'whatsapp'::app.reminder_channel
    when 'sms'      then 'sms'::app.reminder_channel
    when 'email'    then 'email'::app.reminder_channel
  end;

  if v_channel is null then
    return new;
  end if;

  update public.notification_outbox
     set status = 'cancelado',
         failed_reason = 'Consentimiento revocado por el paciente',
         updated_at = now()
   where patient_id = new.patient_id
     and channel = v_channel
     and status = 'programado';

  return new;
end;
$$;

create trigger patient_consents_cancel_pending
  after insert on public.patient_consents
  for each row execute function app.cancel_pending_on_consent_revoke();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages      enable row level security;
alter table public.notification_outbox    enable row level security;

-- El webhook corre con la clave de servicio, no con una sesión de usuario, así
-- que estas tablas sólo necesitan políticas de LECTURA para el personal.
create policy wa_conversations_select on public.whatsapp_conversations
  for select to authenticated
  using (app.has_permission(tenant_id, 'appointments.read'));

create policy wa_messages_select on public.whatsapp_messages
  for select to authenticated
  using (app.has_permission(tenant_id, 'appointments.read'));

create policy outbox_select on public.notification_outbox
  for select to authenticated
  using (app.has_permission(tenant_id, 'appointments.read'));

-- Recepción puede reintentar o cancelar un aviso concreto.
create policy outbox_update on public.notification_outbox
  for update to authenticated
  using (app.has_permission(tenant_id, 'appointments.write'))
  with check (app.has_permission(tenant_id, 'appointments.write'));

select app.attach_standard_triggers('public.whatsapp_conversations');
select app.attach_standard_triggers('public.whatsapp_messages');
select app.attach_standard_triggers('public.notification_outbox');
