-- =============================================================================
-- 0003_audit.sql  ·  SaniTi
-- Bitácora de auditoría inmutable + eventos de autenticación + rate limiting.
--
-- La LOPDP y la normativa del MSP exigen poder responder "¿quién vio la historia
-- clínica de este paciente, cuándo y por qué?". Este archivo es esa respuesta.
--
-- Tres capas de protección sobre la bitácora:
--   1. Sin política INSERT/UPDATE/DELETE: sólo se escribe vía app.audit().
--   2. GRANT revocado: ni siquiera service_role puede UPDATE/DELETE/TRUNCATE.
--   3. Encadenado por hash: cada fila sella la anterior, así que modificar o
--      eliminar un evento rompe la cadena y app.verify_audit_chain() lo detecta.
-- =============================================================================

create type app.audit_action as enum (
  'read', 'create', 'update', 'delete', 'export', 'print',
  'share', 'unshare', 'sign', 'login', 'logout', 'login_failed',
  'mfa_challenge', 'mfa_failed', 'permission_denied', 'break_glass',
  'invite', 'role_change', 'consent_grant', 'consent_revoke', 'send_message'
);

-- -----------------------------------------------------------------------------
-- audit_log — particionada por mes para poder aplicar retención con DROP
-- PARTITION en lugar de DELETE masivo (que además rompería la cadena de hash).
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id             bigint generated always as identity,
  occurred_at    timestamptz not null default now(),

  tenant_id      uuid references public.tenants(id) on delete restrict,
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_label    text not null default 'user',
  actor_role     app.member_role,
  actor_ip       inet,
  actor_user_agent text,

  action         app.audit_action not null,
  resource_type  text not null,
  resource_id    uuid,

  -- Desnormalizado a propósito: la pregunta que más se hace a esta tabla es
  -- "todo lo que se hizo sobre ESTE paciente", y debe responderse sin joins.
  patient_id     uuid,

  summary        text,
  metadata       jsonb not null default '{}'::jsonb,

  -- Motivo obligatorio cuando se accede fuera del círculo de cuidado.
  break_glass_reason text,
  request_id     uuid,

  -- Sello de integridad (ver app.audit_seal más abajo).
  prev_hash      bytea,
  row_hash       bytea not null,

  primary key (occurred_at, id)
) partition by range (occurred_at);

-- Consulta principal: la trazabilidad de un paciente concreto.
create index audit_log_patient_idx
  on public.audit_log (patient_id, occurred_at desc) where patient_id is not null;
-- Consulta secundaria: la actividad de un usuario dentro de una institución.
create index audit_log_tenant_actor_idx
  on public.audit_log (tenant_id, actor_id, occurred_at desc);
-- Recorrido de la cadena de hash.
create index audit_log_chain_idx
  on public.audit_log (tenant_id, occurred_at desc, id desc);
-- Revisión de accesos de emergencia (se auditan uno por uno).
create index audit_log_break_glass_idx
  on public.audit_log (tenant_id, occurred_at desc) where break_glass_reason is not null;

-- Red de seguridad: si faltara la partición del mes, el evento cae aquí en vez
-- de fallar el INSERT. Una auditoría que bloquea la atención médica es peor que
-- una auditoría en la partición equivocada.
create table public.audit_log_default partition of public.audit_log default;

-- Crea las particiones mensuales que falten, desde el mes actual hacia adelante.
-- Programar con pg_cron: select cron.schedule('audit-partitions', '0 3 1 * *',
--   $$select app.ensure_audit_partitions(6)$$);
create or replace function app.ensure_audit_partitions(p_months_ahead int default 6)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := date_trunc('month', now())::date;
  v_from  date;
  v_to    date;
  v_name  text;
  v_made  int := 0;
begin
  for i in 0 .. greatest(p_months_ahead, 0) loop
    v_from := (v_start + (i || ' months')::interval)::date;
    v_to   := (v_from  + interval '1 month')::date;
    v_name := 'audit_log_' || to_char(v_from, 'YYYY_MM');

    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_name
    ) then
      execute format(
        'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
        v_name, v_from, v_to);
      v_made := v_made + 1;
    end if;
  end loop;
  return v_made;
end;
$$;

select app.ensure_audit_partitions(12);

-- -----------------------------------------------------------------------------
-- Sello de integridad: cadena de hash por institución
-- -----------------------------------------------------------------------------
create or replace function app.audit_seal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev    bytea;
  v_payload text;
begin
  new.occurred_at := coalesce(new.occurred_at, now());

  -- Serializa la cadena dentro de cada institución. Sin este lock, dos eventos
  -- concurrentes leerían el mismo prev_hash y crearían una bifurcación que
  -- verify_audit_chain() reportaría como manipulación.
  perform pg_advisory_xact_lock(
    hashtextextended('saniti.audit:' || coalesce(new.tenant_id::text, '~global'), 0)
  );

  select a.row_hash into v_prev
  from public.audit_log a
  where a.tenant_id is not distinct from new.tenant_id
  order by a.occurred_at desc, a.id desc
  limit 1;

  v_payload := concat_ws('|',
    to_char(new.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
    coalesce(new.tenant_id::text, ''),
    coalesce(new.actor_id::text, ''),
    new.actor_label,
    new.action::text,
    new.resource_type,
    coalesce(new.resource_id::text, ''),
    coalesce(new.patient_id::text, ''),
    coalesce(new.summary, ''),
    new.metadata::text,
    coalesce(new.break_glass_reason, '')
  );

  new.prev_hash := v_prev;
  new.row_hash  := extensions.digest(
    coalesce(v_prev, '\x00'::bytea) || convert_to(v_payload, 'utf8'),
    'sha256'
  );
  return new;
end;
$$;

create trigger audit_log_seal
  before insert on public.audit_log
  for each row execute function app.audit_seal();

-- Recalcula la cadena y devuelve el primer punto donde deja de cuadrar.
-- NULL en `broken_at_id` significa bitácora íntegra.
create or replace function app.verify_audit_chain(p_tenant uuid)
returns table (checked bigint, broken_at_id bigint, broken_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         record;
  v_prev    bytea := null;
  v_payload text;
  v_hash    bytea;
  v_count   bigint := 0;
begin
  for r in
    select * from public.audit_log a
    where a.tenant_id is not distinct from p_tenant
    order by a.occurred_at asc, a.id asc
  loop
    v_payload := concat_ws('|',
      to_char(r.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
      coalesce(r.tenant_id::text, ''),
      coalesce(r.actor_id::text, ''),
      r.actor_label,
      r.action::text,
      r.resource_type,
      coalesce(r.resource_id::text, ''),
      coalesce(r.patient_id::text, ''),
      coalesce(r.summary, ''),
      r.metadata::text,
      coalesce(r.break_glass_reason, '')
    );
    v_hash := extensions.digest(
      coalesce(v_prev, '\x00'::bytea) || convert_to(v_payload, 'utf8'), 'sha256');

    if v_hash is distinct from r.row_hash or r.prev_hash is distinct from v_prev then
      checked := v_count; broken_at_id := r.id; broken_at := r.occurred_at;
      return next;
      return;
    end if;

    v_prev  := r.row_hash;
    v_count := v_count + 1;
  end loop;

  checked := v_count; broken_at_id := null; broken_at := null;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Punto de entrada único de escritura
-- -----------------------------------------------------------------------------
create or replace function app.audit(
  p_action        app.audit_action,
  p_resource_type text,
  p_resource_id   uuid    default null,
  p_tenant_id     uuid    default null,
  p_patient_id    uuid    default null,
  p_summary       text    default null,
  p_metadata      jsonb   default '{}'::jsonb,
  p_actor_ip      inet    default null,
  p_user_agent    text    default null,
  p_request_id    uuid    default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(p_tenant_id, app.active_tenant_id());
  v_id     bigint;
begin
  insert into public.audit_log (
    tenant_id, actor_id, actor_label, actor_role, actor_ip, actor_user_agent,
    action, resource_type, resource_id, patient_id, summary, metadata,
    break_glass_reason, request_id
  ) values (
    v_tenant,
    (select auth.uid()),
    app.actor_label(),
    case when v_tenant is null then null else app.role_in_tenant(v_tenant) end,
    p_actor_ip,
    p_user_agent,
    p_action,
    p_resource_type,
    p_resource_id,
    p_patient_id,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    app.break_glass_reason(),
    p_request_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function app.audit(
  app.audit_action, text, uuid, uuid, uuid, text, jsonb, inet, text, uuid
) to authenticated;
grant execute on function app.verify_audit_chain(uuid) to authenticated;

-- PostgREST sólo publica el esquema `public`, así que app.audit() es inalcanzable
-- desde la aplicación. Este envoltorio es la puerta que sí puede cruzar.
--
-- Recibe la acción como texto y la valida contra el enum en lugar de aceptar el
-- tipo directamente: así, una acción inventada da un error claro en vez del
-- "invalid input value for enum" críptico de PostgREST.
create or replace function public.record_audit(
  p_action        text,
  p_resource_type text,
  p_resource_id   uuid  default null,
  p_tenant_id     uuid  default null,
  p_patient_id    uuid  default null,
  p_summary       text  default null,
  p_metadata      jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_action app.audit_action;
begin
  begin
    v_action := p_action::app.audit_action;
  exception when invalid_text_representation then
    raise exception 'Acción de auditoría desconocida: %', p_action using errcode = '22023';
  end;

  -- Registrar actividad sobre una institución de la que no se es miembro sería
  -- una vía para ensuciar la bitácora ajena.
  if p_tenant_id is not null and not app.can_access_tenant(p_tenant_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return app.audit(
    v_action, p_resource_type, p_resource_id, p_tenant_id,
    p_patient_id, p_summary, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute on function
  public.record_audit(text, text, uuid, uuid, uuid, text, jsonb)
to authenticated;

-- -----------------------------------------------------------------------------
-- auth_events — señales de autenticación, separadas de la bitácora clínica:
-- alto volumen, retención corta y se consultan en el camino crítico del login.
-- -----------------------------------------------------------------------------
create table public.auth_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  email        extensions.citext,
  profile_id   uuid references public.profiles(id) on delete set null,
  action       app.audit_action not null,
  ip           inet,
  user_agent   text,
  succeeded    boolean not null,
  detail       jsonb not null default '{}'::jsonb
);

create index auth_events_email_idx on public.auth_events (email, occurred_at desc);
create index auth_events_ip_idx    on public.auth_events (ip, occurred_at desc);

-- -----------------------------------------------------------------------------
-- rate_limits — limitador de ventana fija respaldado por Postgres.
-- Sin dependencia de Redis: un despliegue menos que asegurar, y el contador
-- sobrevive a los reinicios de las funciones serverless.
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_gc_idx on public.rate_limits (window_start);

-- Devuelve true si la petición SE PERMITE. Atómica: el upsert con incremento
-- evita la condición de carrera del patrón leer-comprobar-escribir.
create or replace function app.rate_limit_hit(
  p_bucket        text,
  p_limit         int,
  p_window_secs   int default 60
)
returns table (allowed boolean, remaining int, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs);
  v_hits int;
begin
  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  allowed   := v_hits <= p_limit;
  remaining := greatest(p_limit - v_hits, 0);
  resets_at := v_window + (p_window_secs || ' seconds')::interval;
  return next;
end;
$$;

create or replace function app.rate_limit_gc()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted int;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- -----------------------------------------------------------------------------
alter table public.audit_log   enable row level security;
alter table public.auth_events enable row level security;
alter table public.rate_limits enable row level security;

-- Única política de la bitácora: leerla con permiso `audit.read`.
-- La ausencia deliberada de políticas de INSERT/UPDATE/DELETE es lo que la
-- hace de sólo-anexado desde la aplicación.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (app.has_permission(tenant_id, 'audit.read'));

-- Y esto la protege incluso de la clave de servicio del backend.
revoke insert, update, delete, truncate on public.audit_log   from authenticated, anon;
revoke        update, delete, truncate on public.audit_log   from service_role;
revoke all on public.auth_events from authenticated, anon;
revoke all on public.rate_limits from authenticated, anon;

grant execute on function app.rate_limit_hit(text, int, int) to authenticated;

-- Envoltorio expuesto a PostgREST para el limitador PREVIO a la autenticación
-- (intentos de ingreso, recuperación de contraseña). En ese momento el usuario
-- todavía es `anon`, así que no puede llegar a app.rate_limit_hit.
--
-- Se concede ÚNICAMENTE a service_role: si `anon` pudiera invocarlo, cualquiera
-- podría agotar el cupo del bucket de otra persona y dejarla fuera del sistema
-- —un ataque de denegación de servicio contra una cuenta concreta.
create or replace function public.consume_rate_limit(
  p_bucket      text,
  p_limit       int,
  p_window_secs int default 60
)
returns table (allowed boolean, remaining int, resets_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select * from app.rate_limit_hit(p_bucket, p_limit, p_window_secs)
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;

-- Igual para el registro de eventos de autenticación: lo escribe el servidor,
-- nunca el navegador.
create or replace function public.record_auth_event(
  p_email     text,
  p_action    text,
  p_succeeded boolean,
  p_ip        text  default null,
  p_user_agent text default null,
  p_detail    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_action app.audit_action;
begin
  begin
    v_action := p_action::app.audit_action;
  exception when invalid_text_representation then
    raise exception 'Acción desconocida: %', p_action using errcode = '22023';
  end;

  insert into public.auth_events (email, profile_id, action, ip, user_agent, succeeded, detail)
  values (
    nullif(lower(trim(p_email)), ''),
    (select id from public.profiles where email = lower(trim(p_email))),
    v_action,
    case when p_ip ~ '^[0-9a-fA-F:.]+$' then p_ip::inet end,
    p_user_agent,
    p_succeeded,
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_auth_event(text, text, boolean, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_auth_event(text, text, boolean, text, text, jsonb)
  to service_role;
