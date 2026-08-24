-- =============================================================================
-- 0004_provisioning.sql  ·  SaniTi
-- Alta de instituciones e invitación de personal.
--
-- Ambos flujos son RPC transaccionales en lugar de INSERT directos, porque
-- ambos tienen un invariante que un INSERT suelto rompería:
--   · una institución sin owner activo queda sin responsable legal de datos;
--   · una invitación aceptada debe crear la membresía en el mismo commit.
-- =============================================================================

create type app.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        extensions.citext not null,
  role         app.member_role not null check (role <> 'owner'),
  status       app.invitation_status not null default 'pending',

  -- Sólo el hash. El token en claro viaja una vez por correo y no se guarda:
  -- una filtración de esta tabla no permite aceptar ninguna invitación.
  token_hash   bytea not null unique,

  invited_by   uuid references public.profiles(id) on delete set null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index invitations_tenant_idx on public.invitations (tenant_id, status);
-- Una sola invitación viva por correo e institución.
create unique index invitations_unique_pending_idx
  on public.invitations (tenant_id, email) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Alta de institución
-- -----------------------------------------------------------------------------
create or replace function public.create_tenant(
  p_legal_name      text,
  p_slug            text,
  p_kind            app.tenant_kind default 'consultorio',
  p_commercial_name text default null,
  p_tax_id          text default null,
  p_timezone        text default 'America/Guayaquil'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_tenant uuid;
  v_rl     record;
begin
  if v_user is null then
    raise exception 'Se requiere autenticación' using errcode = '42501';
  end if;

  -- Freno anti-abuso: 5 instituciones por usuario y hora.
  select * into v_rl from app.rate_limit_hit('create_tenant:' || v_user::text, 5, 3600);
  if not v_rl.allowed then
    raise exception 'Demasiadas instituciones creadas. Reintente después de %', v_rl.resets_at
      using errcode = '53400';
  end if;

  insert into public.tenants (legal_name, slug, kind, commercial_name, tax_id, timezone)
  values (trim(p_legal_name), lower(trim(p_slug)), p_kind,
          nullif(trim(p_commercial_name), ''), nullif(trim(p_tax_id), ''), p_timezone)
  returning id into v_tenant;

  insert into public.memberships (tenant_id, profile_id, role, status, accepted_at)
  values (v_tenant, v_user, 'owner', 'active', now());

  perform app.audit('create', 'tenant', v_tenant, v_tenant, null,
                    format('Institución creada: %s', p_legal_name),
                    jsonb_build_object('slug', lower(trim(p_slug)), 'kind', p_kind));

  return v_tenant;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitación de personal
--
-- Devuelve el token en claro UNA sola vez. Quien llama debe enviarlo por correo
-- y descartarlo; no hay forma de recuperarlo después.
-- -----------------------------------------------------------------------------
create or replace function public.invite_member(
  p_tenant_id uuid,
  p_email     text,
  p_role      app.member_role
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id    uuid;
begin
  if not app.has_permission(p_tenant_id, 'members.manage') then
    perform app.audit('permission_denied', 'invitation', null, p_tenant_id, null,
                      'Intento de invitar sin permiso members.manage');
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'El rol owner se transfiere, no se invita' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.memberships m
    join public.profiles pr on pr.id = m.profile_id
    where m.tenant_id = p_tenant_id
      and pr.email = lower(trim(p_email))
      and m.status in ('active', 'invited')
  ) then
    raise exception 'Esa persona ya pertenece a la institución' using errcode = '23505';
  end if;

  -- 256 bits de entropía, codificados en base64url para viajar en una URL.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.invitations (tenant_id, email, role, token_hash, invited_by)
  values (p_tenant_id, lower(trim(p_email)), p_role,
          extensions.digest(v_token, 'sha256'), (select auth.uid()))
  returning id into v_id;

  perform app.audit('invite', 'invitation', v_id, p_tenant_id, null,
                    format('Invitación enviada a %s como %s', p_email, p_role),
                    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role));

  invitation_id := v_id;
  token := v_token;
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aceptación de invitación
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_email  extensions.citext;
  v_inv    public.invitations;
  v_rl     record;
begin
  if v_user is null then
    raise exception 'Se requiere autenticación' using errcode = '42501';
  end if;

  -- Sin este freno, el token de 256 bits seguiría siendo inadivinable, pero la
  -- tabla quedaría expuesta a sondeo masivo desde una cuenta válida.
  select * into v_rl from app.rate_limit_hit('accept_invitation:' || v_user::text, 10, 3600);
  if not v_rl.allowed then
    raise exception 'Demasiados intentos' using errcode = '53400';
  end if;

  select email into v_email from public.profiles where id = v_user;

  select * into v_inv
  from public.invitations
  where token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if v_inv.id is null then
    raise exception 'Invitación inválida' using errcode = '22023';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'La invitación ya no está vigente' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired', updated_at = now() where id = v_inv.id;
    raise exception 'La invitación expiró' using errcode = '22023';
  end if;
  -- El token sólo sirve a la persona a la que se envió: si no, reenviar el
  -- correo a un tercero le daría acceso a la institución.
  if v_inv.email <> v_email then
    perform app.audit('permission_denied', 'invitation', v_inv.id, v_inv.tenant_id, null,
                      'Token de invitación usado por un correo distinto al invitado');
    raise exception 'Esta invitación fue emitida para otra dirección de correo'
      using errcode = '42501';
  end if;

  insert into public.memberships (tenant_id, profile_id, role, status, invited_by, accepted_at)
  values (v_inv.tenant_id, v_user, v_inv.role, 'active', v_inv.invited_by, now())
  on conflict (tenant_id, profile_id) do update
    set role = excluded.role, status = 'active', accepted_at = now(),
        revoked_at = null, updated_at = now();

  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_user, updated_at = now()
   where id = v_inv.id;

  perform app.audit('role_change', 'membership', v_inv.id, v_inv.tenant_id, null,
                    format('Invitación aceptada con rol %s', v_inv.role),
                    jsonb_build_object('role', v_inv.role));

  return v_inv.tenant_id;
end;
$$;

grant execute on function
  public.create_tenant(text, text, app.tenant_kind, text, text, text),
  public.invite_member(uuid, text, app.member_role),
  public.accept_invitation(text)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.invitations enable row level security;

-- Se listan las invitaciones de la institución si se pueden gestionar miembros.
-- El token_hash nunca se expone al cliente porque no hay política que permita
-- leerlo fuera de este ámbito, y las escrituras pasan sólo por los RPC.
create policy invitations_select on public.invitations
  for select to authenticated
  using (app.has_permission(tenant_id, 'members.manage'));

create policy invitations_update on public.invitations
  for update to authenticated
  using (app.has_permission(tenant_id, 'members.manage'))
  with check (app.has_permission(tenant_id, 'members.manage'));

select app.attach_standard_triggers('public.invitations');
