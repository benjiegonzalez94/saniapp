-- =============================================================================
-- 9999_verify_security.sql  ·  SaniTi
-- Aserciones que se ejecutan al final de CADA despliegue.
--
-- Una regla de seguridad que nadie comprueba es una regla que ya se rompió y
-- todavía no lo sabes. Este archivo convierte tres invariantes en fallos de
-- despliegue, no en hallazgos de una auditoría dentro de dos años:
--
--   1. Toda tabla de `public` tiene RLS activo.
--   2. Toda tabla de `public` tiene al menos una política.
--   3. Toda función SECURITY DEFINER fija `search_path`.
--
-- El punto 3 no es teórico: sin search_path fijo, cualquiera que pueda crear un
-- objeto en un esquema del search_path puede secuestrar una llamada dentro de
-- una función que corre con los privilegios del dueño de la base.
-- =============================================================================

create or replace function app.security_report()
returns table (severity text, object_name text, finding text)
language sql
stable
security definer
set search_path = ''
as $$
  -- 1. Tablas sin RLS (se excluyen las particiones: heredan del padre).
  select 'CRÍTICO', c.relname::text,
         'La tabla no tiene RLS activo y es alcanzable desde la API'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relispartition
    and not c.relrowsecurity

  union all

  -- 2. Tablas con RLS pero sin ninguna política: deniegan todo en silencio.
  --    Suele ser un olvido, no una decisión, y rompe funcionalidad sin avisar.
  select 'ALTO', c.relname::text,
         'RLS activo pero sin políticas: la tabla deniega todo acceso'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relispartition
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    -- Excepciones deliberadas, documentadas en docs/SECURITY.md:
    --   audit_log        → sólo lectura con audit.read (tiene política); aquí no entra
    --   tenant_counters  → uso exclusivamente interno vía app.next_counter()
    --   auth_events      → escrito por el backend, leído sólo por soporte
    --   rate_limits      → contadores internos, sin exposición al cliente
    --   billing_events   → payloads crudos de la pasarela, sólo service_role
    and c.relname not in ('tenant_counters', 'auth_events', 'rate_limits', 'billing_events')

  union all

  -- 3. SECURITY DEFINER sin search_path fijo.
  select 'CRÍTICO', p.proname::text,
         'Función SECURITY DEFINER sin search_path fijo (riesgo de secuestro)'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app')
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
      where cfg like 'search_path=%'
    )

  union all

  -- 4. Tablas con tenant_id cuyas políticas no mencionan ninguna función de
  --    aislamiento. Es heurístico, pero atrapa el error clásico de copiar una
  --    política y dejar `using (true)`.
  select 'ALTO', c.relname::text,
         'Tabla con tenant_id y políticas que no invocan app.can_access_tenant / '
         'app.has_permission / app.can_read_patient'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relispartition
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped
    )
    and exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and not exists (
      select 1 from pg_policy p
      where p.polrelid = c.oid
        and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') ||
             coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
            ~ '(can_access_tenant|has_permission|can_read_patient|can_write_patient)'
    )

  union all

  -- 5. Políticas inalcanzables: la política cubre una operación para la que el
  --    rol no tiene privilegio de tabla.
  --
  --    Postgres comprueba el GRANT ANTES de aplicar RLS, así que una política
  --    sin su privilegio detrás nunca llega a ejecutarse. El síntoma es
  --    engañoso —"permission denied" en vez de un resultado vacío— y da la
  --    falsa impresión de que la seguridad funciona cuando lo que hay es una
  --    aplicación rota. Pasó de verdad: las tablas nacen sin DML porque las
  --    migraciones se aplican como `postgres` y los privilegios por defecto de
  --    `public` están configurados para `supabase_admin`.
  --
  --    Sólo se examinan las políticas de una única operación. Una política
  --    FOR ALL sobre una tabla donde deliberadamente no se concede DELETE es
  --    una decisión, no un error.
  select 'ALTO', c.relname::text || ' · ' || p.polname::text,
         format('La política cubre %s pero el rol %s no tiene ese privilegio: nunca se aplica',
                x.cmd, r.rolname)
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral (
    select case p.polcmd
             when 'r' then 'SELECT' when 'a' then 'INSERT'
             when 'w' then 'UPDATE' when 'd' then 'DELETE'
           end as cmd
  ) x
  join pg_roles r
    on r.rolname in ('authenticated', 'anon')
   and (p.polroles = '{0}'::oid[] or r.oid = any (p.polroles))
  where n.nspname = 'public'
    and x.cmd is not null
    and not has_table_privilege(r.oid, c.oid, x.cmd);
$$;

grant execute on function app.security_report() to authenticated;

-- -----------------------------------------------------------------------------
-- La aserción: aborta la migración si hay algo crítico o alto.
-- -----------------------------------------------------------------------------
do $$
declare
  r        record;
  v_count  int := 0;
  v_detail text := '';
begin
  for r in select * from app.security_report() order by severity, object_name loop
    v_count  := v_count + 1;
    v_detail := v_detail || format(E'\n  [%s] %s — %s', r.severity, r.object_name, r.finding);
  end loop;

  if v_count > 0 then
    raise exception E'Verificación de seguridad fallida: % hallazgo(s)%', v_count, v_detail;
  end if;

  raise notice 'Verificación de seguridad superada: RLS, políticas y search_path correctos.';
end;
$$;

-- -----------------------------------------------------------------------------
-- Endurecimiento final del esquema
-- -----------------------------------------------------------------------------

-- Que nadie cree objetos en `public` por defecto.
revoke create on schema public from public, anon, authenticated;

-- Ninguna tabla futura debe quedar accesible por omisión: los privilegios se
-- conceden tabla por tabla, en la migración que la crea.
alter default privileges in schema public revoke all on tables from anon;

-- El rol anónimo sólo necesita el catálogo de planes para la página de precios.
revoke all on all tables in schema public from anon;
grant select on public.plans to anon;
