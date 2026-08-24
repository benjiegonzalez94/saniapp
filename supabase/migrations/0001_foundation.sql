-- =============================================================================
-- 0001_foundation.sql  ·  SaniTi
-- Extensiones, esquema privado `app`, helpers de sesión y utilidades comunes.
--
-- REGLA DEL PROYECTO: ninguna tabla en `public` puede existir sin RLS activo y
-- al menos una política. La migración 9999_verify_security.sql lo comprueba y
-- aborta el despliegue si se incumple.
-- =============================================================================

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "citext"    with schema extensions;
create extension if not exists "btree_gist" with schema extensions;

-- Esquema privado: nunca se expone por PostgREST (no está en `search_path` de
-- la API), así que las funciones de seguridad no son invocables desde el cliente.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Contexto de la petición
-- -----------------------------------------------------------------------------

-- Tenant activo de la petición: segunda barrera sobre RLS. Aunque el usuario sea
-- miembro de varias instituciones, cada petición sólo toca la que tiene activa.
--
-- Se lee de dos sitios porque hay dos formas de llegar a la base:
--
--   · Peticiones de usuario (PostgREST): del claim `active_tenant_id` dentro de
--     app_metadata del JWT. NO puede ser una GUC de sesión: PostgREST usa un
--     pool de conexiones, así que un set_config no local se filtraría a la
--     siguiente petición —de otro usuario— sobre esa misma conexión. Sería una
--     fuga de datos entre instituciones, justo lo que esto debe impedir.
--
--   · Workers y migraciones (conexión directa): de la GUC `app.tenant_id`,
--     fijada con set_config(..., true) dentro de su propia transacción, donde
--     sí está acotada y es segura.
--
-- Si no hay ninguna de las dos, devuelve NULL y app.can_access_tenant() se
-- limita a exigir membresía activa. El grado por defecto es seguro.
create or replace function app.active_tenant_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claim text;
  v_guc   text;
begin
  begin
    v_claim := nullif(
      current_setting('request.jwt.claims', true)::jsonb
        -> 'app_metadata' ->> 'active_tenant_id',
      '');
  exception when others then
    -- Claims ausentes o mal formados: no es motivo para tumbar la consulta.
    v_claim := null;
  end;

  if v_claim is not null then
    return v_claim::uuid;
  end if;

  v_guc := nullif(current_setting('app.tenant_id', true), '');
  return v_guc::uuid;
exception when others then
  return null;
end;
$$;

-- Motivo del acceso de emergencia en curso, para que el trigger de auditoría lo
-- selle junto al evento. Sólo aplica a la ruta de conexión directa; en las
-- peticiones de usuario el motivo viaja en la concesión de break-glass
-- (tabla break_glass_grants, migración 0005).
create or replace function app.break_glass_reason()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.break_glass_reason', true), '')
$$;

-- Identidad efectiva. `auth.uid()` en peticiones de usuario; NULL en jobs que
-- corren con service_role (esos quedan identificados por app.actor_label).
create or replace function app.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Etiqueta del actor para el audit log cuando no hay usuario humano
-- (webhooks de WhatsApp, cron de recordatorios, jobs de facturación).
create or replace function app.actor_label()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.actor_label', true), ''),
    case when app.current_user_id() is null then 'system' else 'user' end
  )
$$;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Impide que una fila cambie de tenant. Sin esto, un UPDATE que pase RLS podría
-- mover un registro clínico a otra institución.
create or replace function app.freeze_tenant_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id es inmutable (tabla %)', tg_table_name
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

-- Azúcar para aplicar los triggers estándar a una tabla con tenant_id.
create or replace function app.attach_standard_triggers(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := replace(p_table::text, 'public.', '');
begin
  execute format(
    'create trigger %I before update on %s
       for each row execute function app.touch_updated_at()',
    v_name || '_touch_updated_at', p_table);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_name and column_name = 'tenant_id'
  ) then
    execute format(
      'create trigger %I before update on %s
         for each row execute function app.freeze_tenant_id()',
      v_name || '_freeze_tenant', p_table);
  end if;
end;
$$;

-- Índice ciego: permite buscar por cédula/pasaporte sin almacenar el valor.
-- La clave vive fuera de la base de datos (variable de entorno del servidor),
-- así que un volcado de la BD no permite ni leer ni forzar los identificadores.
create or replace function app.blind_index(p_value text, p_key text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.hmac(lower(trim(p_value)), p_key, 'sha256')
$$;
