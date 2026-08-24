-- =============================================================================
-- 0017_audit_chain_rpc.sql  ·  SaniTi
-- Verificación de la cadena de auditoría desde la aplicación.
--
-- POR QUÉ HACÍA FALTA
--
-- `app.verify_audit_chain()` existe desde la migración 0003, pero vive en el
-- esquema `app`, que PostgREST NO publica. Desde la interfaz era inalcanzable:
-- llamarla habría devuelto PGRST202 en ejecución sin que TypeScript avisara.
--
-- El resultado práctico era que la garantía más fuerte de la bitácora —que
-- alterarla es detectable— sólo podía comprobarse abriendo una consola de
-- Postgres. Una salvaguarda que nadie puede consultar acaba siendo decorativa:
-- la manipulación seguiría siendo detectable en teoría y desapercibida en la
-- práctica.
--
-- Este envoltorio la expone a quien tenga `audit.read`, que son exactamente los
-- roles cuyo trabajo es revisarla.
-- =============================================================================

create or replace function public.verificar_cadena_auditoria(p_tenant_id uuid)
returns table (
  eventos_verificados bigint,
  roto_en_id bigint,
  roto_en timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- La comprobación de permiso va aquí y no en una política porque esto es una
  -- función, no una tabla: sin ella, cualquier usuario autenticado podría
  -- recorrer la bitácora de una institución de la que no es miembro.
  if not app.has_permission(p_tenant_id, 'audit.read') then
    raise exception 'No autorizado para verificar la bitácora' using errcode = '42501';
  end if;

  return query
  select v.checked, v.broken_at_id, v.broken_at
  from app.verify_audit_chain(p_tenant_id) v;
end;
$$;

revoke all on function public.verificar_cadena_auditoria(uuid) from public, anon;
grant execute on function public.verificar_cadena_auditoria(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Revisión de un acceso de emergencia
--
-- `break_glass_grants` ya tenía política de UPDATE para quien tiene `audit.read`,
-- pero nada garantizaba que al cerrar una revisión quedara constancia de quién
-- la cerró ni cuándo. Un circuito de revisión sin rastro no es un circuito de
-- revisión: es una casilla que alguien marca.
-- -----------------------------------------------------------------------------
create or replace function public.revisar_break_glass(
  p_grant_id uuid,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_grant public.break_glass_grants;
begin
  select * into v_grant from public.break_glass_grants where id = p_grant_id;

  if v_grant.id is null then
    raise exception 'Concesión inexistente' using errcode = '22023';
  end if;

  if not app.has_permission(v_grant.tenant_id, 'audit.read') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_grant.reviewed_at is not null then
    raise exception 'Esa concesión ya fue revisada el %', v_grant.reviewed_at
      using errcode = '22023';
  end if;

  update public.break_glass_grants
     set reviewed_at = now(),
         reviewed_by = (select auth.uid()),
         review_note = nullif(trim(coalesce(p_nota, '')), ''),
         updated_at = now()
   where id = p_grant_id;

  -- La revisión entra en la propia bitácora: quién dio por bueno un acceso de
  -- emergencia es tan relevante como quién lo usó.
  perform app.audit(
    'update', 'break_glass_grant', p_grant_id, v_grant.tenant_id, v_grant.patient_id,
    format('Revisó un acceso de emergencia%s',
           case when p_nota is null then '' else ': ' || p_nota end)
  );
end;
$$;

revoke all on function public.revisar_break_glass(uuid, text) from public, anon;
grant execute on function public.revisar_break_glass(uuid, text) to authenticated;
