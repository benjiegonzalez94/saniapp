-- =============================================================================
-- 0015_document_scanning.sql  ·  SaniTi
-- Estado del análisis antivirus de los estudios subidos.
--
-- POR QUÉ UN ANTIVIRUS AUTOALOJADO Y NO UN SERVICIO EXTERNO
--
-- Un estudio de laboratorio lleva el nombre del paciente, su cédula y su
-- diagnóstico. Enviarlo a VirusTotal o a cualquier API de análisis en la nube no
-- es "escanear un archivo": es una transferencia internacional de datos de
-- salud a un tercero que los conserva e indexa. Bajo la LOPDP eso requiere base
-- legal, contrato de encargo y consentimiento informado — y ninguna de las tres
-- cosas justifica el trámite cuando un ClamAV en un contenedor hace el trabajo
-- sin que el archivo salga de la infraestructura.
--
-- El flujo tiene tres estados y ninguno se puede saltar:
--   1. `pendiente` — la fila existe y el archivo está subido, pero NO se sirve.
--   2. `limpio`    — analizado y sin hallazgos: sólo entonces se emite una URL
--                    firmada de descarga.
--   3. `infectado` / `error` — nunca se sirve. `infectado` además se audita.
--
-- La política de INSERT (migración 0007) obliga a que toda fila nazca
-- `pendiente`, así que el cliente no puede declarar limpio su propio archivo.
-- =============================================================================

alter table public.documents
  -- Qué motor y con qué versión de firmas dio el veredicto. Sin esto, un
  -- "limpio" de hace dos años no se distingue de uno de hoy, y las firmas
  -- antivirus caducan.
  add column scan_engine text,
  add column scan_signature_version text,
  add column scan_detail text,
  -- Intentos del worker. Un archivo que falla siempre no debe reintentarse
  -- eternamente ni quedarse invisible: a los 3 intentos pasa a `error`.
  add column scan_attempts smallint not null default 0
    check (scan_attempts >= 0 and scan_attempts <= 10),
  add column scan_claimed_at timestamptz;

-- Coherencia: un veredicto exige constancia de quién lo dio y cuándo.
alter table public.documents
  add constraint documents_scan_coherent check (
    scan_status = 'pendiente'
    or (scanned_at is not null and scan_engine is not null)
  ) not valid;
alter table public.documents validate constraint documents_scan_coherent;

-- El worker consume esta cola.
create index documents_scan_queue_idx
  on public.documents (created_at)
  where scan_status = 'pendiente' and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Toma de trabajo por el worker
--
-- `for update skip locked` permite ejecutar varios workers en paralelo sin que
-- dos analicen el mismo archivo. `scan_claimed_at` recupera los trabajos de un
-- worker que murió a mitad: pasados 10 minutos, el documento vuelve a la cola.
-- -----------------------------------------------------------------------------
create or replace function app.claim_documents_for_scan(p_limite int default 5)
returns table (
  id uuid,
  tenant_id uuid,
  patient_id uuid,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  scan_attempts smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidatos as (
    select d.id
    from public.documents d
    where d.scan_status = 'pendiente'
      and d.deleted_at is null
      and d.scan_attempts < 3
      and (d.scan_claimed_at is null or d.scan_claimed_at < now() - interval '10 minutes')
    order by d.created_at
    limit greatest(coalesce(p_limite, 5), 1)
    for update skip locked
  )
  update public.documents d
     set scan_claimed_at = now(),
         scan_attempts = d.scan_attempts + 1
   where d.id in (select c.id from candidatos c)
  returning d.id, d.tenant_id, d.patient_id, d.storage_path,
            d.mime_type, d.size_bytes, d.scan_attempts;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registro del veredicto
--
-- Sólo el worker (service_role) lo llama. Un documento infectado deja evento de
-- auditoría: alguien intentó subir malware a un expediente clínico y eso hay
-- que poder investigarlo, no sólo bloquearlo.
-- -----------------------------------------------------------------------------
create or replace function app.record_scan_result(
  p_document_id uuid,
  p_status app.scan_status,
  p_engine text,
  p_signature_version text default null,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_doc public.documents;
begin
  update public.documents
     set scan_status = p_status,
         scanned_at = now(),
         scan_engine = p_engine,
         scan_signature_version = p_signature_version,
         scan_detail = p_detail,
         scan_claimed_at = null
   where id = p_document_id
  returning * into v_doc;

  if v_doc.id is null then
    raise exception 'Documento inexistente: %', p_document_id using errcode = '22023';
  end if;

  if p_status = 'infectado' then
    insert into public.audit_log (
      tenant_id, actor_label, action, resource_type, resource_id, patient_id,
      summary, metadata
    ) values (
      v_doc.tenant_id, 'system', 'update', 'documents', p_document_id, v_doc.patient_id,
      format('Archivo rechazado por el antivirus: %s', coalesce(p_detail, 'sin detalle')),
      jsonb_build_object('engine', p_engine, 'archivo', v_doc.title,
                         'subido_por', v_doc.uploaded_by)
    );
  end if;
end;
$$;

-- Ambas son exclusivas del worker: corre sin usuario y con la clave de servicio.
revoke all on function app.claim_documents_for_scan(int) from public, anon, authenticated;
revoke all on function app.record_scan_result(uuid, app.scan_status, text, text, text)
  from public, anon, authenticated;
grant execute on function app.claim_documents_for_scan(int) to service_role;
grant execute on function app.record_scan_result(uuid, app.scan_status, text, text, text)
  to service_role;

-- Envoltorios en `public` para que PostgREST los alcance: el worker habla por
-- la API REST, no por conexión directa.
create or replace function public.claim_documents_for_scan(p_limite int default 5)
returns table (
  id uuid, tenant_id uuid, patient_id uuid, storage_path text,
  mime_type text, size_bytes bigint, scan_attempts smallint
)
language sql
security definer
set search_path = ''
as $$
  select * from app.claim_documents_for_scan(p_limite)
$$;

create or replace function public.record_scan_result(
  p_document_id uuid,
  p_status text,
  p_engine text,
  p_signature_version text default null,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status app.scan_status;
begin
  begin
    v_status := p_status::app.scan_status;
  exception when invalid_text_representation then
    raise exception 'Veredicto desconocido: %', p_status using errcode = '22023';
  end;

  perform app.record_scan_result(
    p_document_id, v_status, p_engine, p_signature_version, p_detail);
end;
$$;

revoke all on function public.claim_documents_for_scan(int) from public, anon, authenticated;
revoke all on function public.record_scan_result(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_documents_for_scan(int) to service_role;
grant execute on function public.record_scan_result(uuid, text, text, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Vista del estado de la cola, para el panel de la institución.
-- -----------------------------------------------------------------------------
create or replace function public.estado_cola_antivirus(p_tenant_id uuid)
returns table (pendientes bigint, infectados bigint, con_error bigint, mas_antiguo timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where scan_status = 'pendiente'),
    count(*) filter (where scan_status = 'infectado'),
    count(*) filter (where scan_status = 'error'),
    min(created_at) filter (where scan_status = 'pendiente')
  from public.documents
  where tenant_id = p_tenant_id and deleted_at is null
$$;

grant execute on function public.estado_cola_antivirus(uuid) to authenticated;
