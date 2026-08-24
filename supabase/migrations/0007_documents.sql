-- =============================================================================
-- 0007_documents.sql  ·  SaniTi
-- Estudios y resultados, su compartición entre médicos, e interconsultas.
--
-- Los archivos viven en Supabase Storage, no en la base. Bucket `clinical`,
-- privado, con la ruta canónica
--     {tenant_id}/{patient_id}/{document_id}
-- y las políticas de storage.objects derivan el tenant del primer segmento, de
-- modo que el aislamiento entre instituciones también aplica al bucket.
--
-- Nunca se entrega una URL pública: el acceso se sirve con URLs firmadas de
-- corta vida, emitidas sólo después de comprobar permisos y registrar el acceso.
-- =============================================================================

create type app.document_kind as enum (
  'laboratorio', 'imagen', 'informe', 'receta', 'consentimiento',
  'referencia', 'certificado', 'otro'
);

-- Todo lo que sube un usuario se trata como hostil hasta que se demuestre lo
-- contrario. Sin `clean` no se emite ninguna URL de descarga.
create type app.scan_status as enum ('pendiente', 'limpio', 'infectado', 'error');

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete set null,

  kind         app.document_kind not null default 'otro',
  title        text not null check (length(trim(title)) between 1 and 200),
  description  text,

  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 104857600), -- 100 MB
  -- Detecta corrupción y duplicados, y permite verificar la integridad del
  -- archivo descargado contra lo que se subió.
  sha256       bytea,

  scan_status  app.scan_status not null default 'pendiente',
  scanned_at   timestamptz,

  study_date   date,
  uploaded_by  uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index documents_patient_idx
  on public.documents (patient_id, created_at desc) where deleted_at is null;
create index documents_tenant_kind_idx
  on public.documents (tenant_id, kind, created_at desc) where deleted_at is null;
create index documents_pending_scan_idx
  on public.documents (created_at) where scan_status = 'pendiente';

-- -----------------------------------------------------------------------------
-- document_shares — compartir un estudio con un colega de la misma institución
-- -----------------------------------------------------------------------------
create table public.document_shares (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  document_id   uuid not null references public.documents(id) on delete cascade,

  shared_with   uuid not null references public.profiles(id) on delete cascade,
  shared_by     uuid not null references public.profiles(id) on delete restrict,
  message       text,
  can_download  boolean not null default true,

  expires_at    timestamptz,
  revoked_at    timestamptz,
  first_viewed_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (document_id, shared_with)
);

create index document_shares_recipient_idx
  on public.document_shares (shared_with, created_at desc)
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- Interconsultas: pedir la opinión de otro médico sobre un caso
-- -----------------------------------------------------------------------------
create type app.consult_status as enum ('abierta', 'respondida', 'cerrada');

create table public.case_consults (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete set null,

  requested_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to  uuid not null references public.profiles(id) on delete restrict,
  specialty    text,

  question     text not null check (length(trim(question)) between 5 and 4000),
  status       app.consult_status not null default 'abierta',
  answered_at  timestamptz,
  closed_at    timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index case_consults_assignee_idx
  on public.case_consults (assigned_to, status, created_at desc);
create index case_consults_patient_idx
  on public.case_consults (patient_id, created_at desc);

create table public.case_consult_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  consult_id uuid not null references public.case_consults(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,

  -- Cifrado igual que la nota clínica: es discusión clínica sobre un paciente.
  body_enc   text not null,
  key_version smallint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index case_consult_messages_idx
  on public.case_consult_messages (consult_id, created_at);

-- Al asignar una interconsulta, el destinatario entra al círculo de cuidado:
-- si no, en modo care_team no podría abrir el caso que se le acaba de pedir.
create or replace function app.consult_grants_care_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.care_team_members (tenant_id, patient_id, profile_id, relationship, added_by)
  values (new.tenant_id, new.patient_id, new.assigned_to, 'interconsulta', new.requested_by)
  on conflict (patient_id, profile_id) do update set ended_at = null, updated_at = now();
  return new;
end;
$$;

create trigger case_consults_care_team
  after insert on public.case_consults
  for each row execute function app.consult_grants_care_team();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.documents             enable row level security;
alter table public.document_shares       enable row level security;
alter table public.case_consults         enable row level security;
alter table public.case_consult_messages enable row level security;

-- Se ve un documento si se tiene acceso al paciente, o si te lo compartieron.
create policy documents_select on public.documents
  for select to authenticated
  using (
    deleted_at is null
    and (
      (app.can_read_patient(patient_id) and app.has_permission(tenant_id, 'documents.read'))
      or exists (
        select 1 from public.document_shares s
        where s.document_id = public.documents.id
          and s.shared_with = (select auth.uid())
          and s.revoked_at is null
          and (s.expires_at is null or s.expires_at > now())
      )
    )
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    app.has_permission(tenant_id, 'documents.upload')
    and app.can_read_patient(patient_id)
    -- Un documento nace sin escanear; marcarlo limpio es cosa del worker.
    and scan_status = 'pendiente'
  );

create policy documents_update on public.documents
  for update to authenticated
  using (app.has_permission(tenant_id, 'documents.upload') and app.can_read_patient(patient_id))
  with check (app.has_permission(tenant_id, 'documents.upload'));

-- El destinatario ve lo que le compartieron; el emisor, lo que compartió.
create policy document_shares_select on public.document_shares
  for select to authenticated
  using (
    shared_with = (select auth.uid())
    or shared_by = (select auth.uid())
    or app.has_permission(tenant_id, 'documents.share')
  );

-- Sólo se comparte con alguien que ya pertenece a la institución: sin esto,
-- compartir sería una vía para filtrar historias clínicas fuera del tenant.
create policy document_shares_insert on public.document_shares
  for insert to authenticated
  with check (
    app.has_permission(tenant_id, 'documents.share')
    and exists (
      select 1 from public.memberships m
      where m.profile_id = shared_with and m.tenant_id = public.document_shares.tenant_id
        and m.status = 'active'
    )
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.tenant_id = public.document_shares.tenant_id
        and d.deleted_at is null
    )
  );

create policy document_shares_update on public.document_shares
  for update to authenticated
  using (shared_by = (select auth.uid()) or app.has_permission(tenant_id, 'documents.share'))
  with check (shared_by = (select auth.uid()) or app.has_permission(tenant_id, 'documents.share'));

create policy case_consults_select on public.case_consults
  for select to authenticated
  using (
    assigned_to = (select auth.uid())
    or requested_by = (select auth.uid())
    or app.can_read_patient(patient_id)
  );

create policy case_consults_insert on public.case_consults
  for insert to authenticated
  with check (
    app.can_read_patient(patient_id)
    and app.has_permission(tenant_id, 'documents.share')
    and requested_by = (select auth.uid())
    and exists (
      select 1 from public.memberships m
      where m.profile_id = assigned_to and m.tenant_id = public.case_consults.tenant_id
        and m.status = 'active'
    )
  );

create policy case_consults_update on public.case_consults
  for update to authenticated
  using (assigned_to = (select auth.uid()) or requested_by = (select auth.uid()))
  with check (assigned_to = (select auth.uid()) or requested_by = (select auth.uid()));

create policy consult_messages_select on public.case_consult_messages
  for select to authenticated
  using (exists (
    select 1 from public.case_consults c
    where c.id = consult_id
      and (c.assigned_to = (select auth.uid()) or c.requested_by = (select auth.uid())
           or app.can_read_patient(c.patient_id))
  ));

create policy consult_messages_insert on public.case_consult_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.case_consults c
      where c.id = consult_id and c.status <> 'cerrada'
        and (c.assigned_to = (select auth.uid()) or c.requested_by = (select auth.uid()))
    )
  );

select app.attach_standard_triggers('public.documents');
select app.attach_standard_triggers('public.document_shares');
select app.attach_standard_triggers('public.case_consults');
select app.attach_standard_triggers('public.case_consult_messages');

-- =============================================================================
-- Supabase Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical', 'clinical', false, 104857600,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
        'application/dicom', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects.name NO incluye el bucket (ése va en bucket_id), así que el
-- primer segmento es el tenant. Como `name` es texto libre controlado por quien
-- sube, se valida que sea un UUID antes de convertirlo: una ruta malformada
-- debe denegar el acceso, no reventar la política con un error de casteo.
create or replace function app.storage_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

create policy clinical_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinical'
    and app.has_permission(app.storage_tenant(name), 'documents.read')
  );

create policy clinical_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clinical'
    and app.has_permission(app.storage_tenant(name), 'documents.upload')
  );

create policy clinical_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'clinical'
    and app.has_permission(app.storage_tenant(name), 'documents.upload')
  );

-- Sin política DELETE: los estudios clínicos no se borran desde el cliente.
