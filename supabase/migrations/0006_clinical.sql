-- =============================================================================
-- 0006_clinical.sql  ·  SaniTi
-- Historia clínica: atenciones, notas, diagnósticos, signos vitales, alergias
-- y recetas.
--
-- Dos principios rigen este archivo:
--
--  1. LA NARRATIVA VA CIFRADA. El texto libre de una nota clínica es el dato más
--     sensible del sistema y no se consulta por contenido desde SQL, así que se
--     guarda cifrado con AES-256-GCM y la clave fuera de la base. Los datos
--     estructurados (CIE-10, signos vitales, alergias) quedan en claro porque
--     alimentan alertas, gráficas y búsquedas, y sin ellos el producto no sirve.
--
--  2. LO FIRMADO NO SE TOCA. Una nota firmada es un documento médico-legal. No
--     se edita: se enmienda con una nota nueva que apunta a la anterior. El
--     trigger app.block_signed_update() lo impone en la base, no en la UI.
-- =============================================================================

create type app.encounter_kind as enum
  ('consulta', 'control', 'emergencia', 'teleconsulta', 'procedimiento', 'domiciliaria');
create type app.encounter_status as enum
  ('planificada', 'en_curso', 'finalizada', 'cancelada', 'no_asistio');
create type app.diagnosis_kind as enum ('presuntivo', 'definitivo', 'descartado');
create type app.allergy_severity as enum ('leve', 'moderada', 'severa', 'mortal');

-- -----------------------------------------------------------------------------
-- Inmutabilidad tras la firma
-- -----------------------------------------------------------------------------
create or replace function app.block_signed_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.signed_at is not null then
    -- Se permite exactamente una transición: marcar la fila como enmendada.
    if new.amended_by is distinct from old.amended_by and old.amended_by is null then
      return new;
    end if;
    raise exception
      'Registro clínico firmado el %: es inmutable. Cree una enmienda.', old.signed_at
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function app.block_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros clínicos no se eliminan (tabla %)', tg_table_name
    using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- encounters — cada acto médico
-- -----------------------------------------------------------------------------
create table public.encounters (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  patient_id  uuid not null references public.patients(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,

  kind        app.encounter_kind not null default 'consulta',
  status      app.encounter_status not null default 'planificada',

  reason      text,
  started_at  timestamptz,
  ended_at    timestamptz,

  signed_by   uuid references public.profiles(id) on delete restrict,
  signed_at   timestamptz,
  amended_by  uuid references public.encounters(id) on delete set null,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint encounters_interval check (ended_at is null or started_at is null
                                        or ended_at >= started_at),
  constraint encounters_signature check ((signed_at is null) = (signed_by is null))
);

create index encounters_patient_idx on public.encounters (patient_id, started_at desc);
create index encounters_provider_idx on public.encounters (provider_id, started_at desc);
create index encounters_tenant_status_idx on public.encounters (tenant_id, status, started_at desc);

-- -----------------------------------------------------------------------------
-- clinical_notes — nota SOAP, cifrada de extremo a extremo del lado servidor
-- -----------------------------------------------------------------------------
create table public.clinical_notes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,

  -- Payload cifrado (AES-256-GCM, base64 de iv||tag||ciphertext). Contiene el
  -- objeto {subjective, objective, assessment, plan} completo.
  content_enc  text not null,
  -- Identifica con qué clave se cifró, para poder rotarla sin descifrar todo.
  key_version  smallint not null default 1,

  -- Metadatos NO sensibles, para listar sin descifrar.
  title        text,
  word_count   int,

  author_id    uuid not null references public.profiles(id) on delete restrict,
  signed_by    uuid references public.profiles(id) on delete restrict,
  signed_at    timestamptz,
  amended_by   uuid references public.clinical_notes(id) on delete set null,
  amendment_reason text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint notes_signature check ((signed_at is null) = (signed_by is null))
);

create index clinical_notes_patient_idx on public.clinical_notes (patient_id, created_at desc);
create index clinical_notes_encounter_idx on public.clinical_notes (encounter_id);

-- -----------------------------------------------------------------------------
-- diagnoses — CIE-10. En claro: alimentan alertas, tableros y búsquedas.
-- -----------------------------------------------------------------------------
create table public.diagnoses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,

  code_system  text not null default 'ICD-10',
  code         text not null check (length(trim(code)) between 1 and 16),
  display      text not null,
  kind         app.diagnosis_kind not null default 'presuntivo',

  is_chronic   boolean not null default false,
  onset_date   date,
  resolved_at  date,
  notes        text,

  recorded_by  uuid not null references public.profiles(id) on delete restrict,
  signed_by    uuid references public.profiles(id) on delete restrict,
  signed_at    timestamptz,
  amended_by   uuid references public.diagnoses(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint diagnoses_resolution check (resolved_at is null or onset_date is null
                                         or resolved_at >= onset_date)
);

create index diagnoses_patient_idx on public.diagnoses (patient_id, created_at desc);
create index diagnoses_code_idx on public.diagnoses (tenant_id, code_system, code);
create index diagnoses_chronic_idx on public.diagnoses (patient_id) where is_chronic;

-- -----------------------------------------------------------------------------
-- vitals — series numéricas para graficar la evolución del paciente
-- -----------------------------------------------------------------------------
create table public.vitals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete restrict,
  patient_id    uuid not null references public.patients(id) on delete restrict,
  encounter_id  uuid references public.encounters(id) on delete restrict,

  measured_at   timestamptz not null default now(),

  -- Rangos fisiológicos: atajan el error de digitación antes de que dispare
  -- una alerta clínica falsa.
  height_cm        numeric(5,1)  check (height_cm between 20 and 260),
  weight_kg        numeric(5,2)  check (weight_kg between 0.3 and 500),
  temperature_c    numeric(4,1)  check (temperature_c between 25 and 45),
  heart_rate       int           check (heart_rate between 10 and 300),
  respiratory_rate int           check (respiratory_rate between 3 and 90),
  systolic_bp      int           check (systolic_bp between 40 and 300),
  diastolic_bp     int           check (diastolic_bp between 20 and 200),
  oxygen_saturation int          check (oxygen_saturation between 30 and 100),
  glucose_mgdl     numeric(5,1)  check (glucose_mgdl between 10 and 1200),
  pain_score       int           check (pain_score between 0 and 10),

  bmi numeric(5,2) generated always as (
    case when height_cm is not null and weight_kg is not null and height_cm > 0
         then round(weight_kg / ((height_cm / 100.0) ^ 2), 2)
    end
  ) stored,

  recorded_by  uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint vitals_bp_coherent check (systolic_bp is null or diastolic_bp is null
                                       or systolic_bp > diastolic_bp)
);

create index vitals_patient_idx on public.vitals (patient_id, measured_at desc);

-- -----------------------------------------------------------------------------
-- allergies — se consultan en cada prescripción, van en claro
-- -----------------------------------------------------------------------------
create table public.allergies (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,

  substance    text not null,
  reaction     text,
  severity     app.allergy_severity not null default 'moderada',
  onset_date   date,
  is_active    boolean not null default true,

  recorded_by  uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (patient_id, substance)
);

create index allergies_patient_idx on public.allergies (patient_id) where is_active;

-- -----------------------------------------------------------------------------
-- prescriptions
-- -----------------------------------------------------------------------------
create table public.prescriptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  patient_id   uuid not null references public.patients(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,

  prescriber_id uuid not null references public.profiles(id) on delete restrict,
  folio         bigint not null,

  notes        text,
  signed_by    uuid references public.profiles(id) on delete restrict,
  signed_at    timestamptz,
  amended_by   uuid references public.prescriptions(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, folio),
  constraint prescriptions_signature check ((signed_at is null) = (signed_by is null))
);

create table public.prescription_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,

  medication      text not null,
  presentation    text,
  dose            text not null,
  route           text,
  frequency       text not null,
  duration        text,
  quantity        text,
  instructions    text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index prescriptions_patient_idx on public.prescriptions (patient_id, created_at desc);
create index prescription_items_rx_idx on public.prescription_items (prescription_id);

-- -----------------------------------------------------------------------------
-- Triggers: inmutabilidad y sellos de tiempo
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['encounters', 'clinical_notes', 'diagnoses', 'prescriptions'] loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function app.block_signed_update()', t || '_immutable', t);
    execute format(
      'create trigger %I before delete on public.%I
         for each row execute function app.block_delete()', t || '_no_delete', t);
  end loop;

  foreach t in array array['encounters', 'clinical_notes', 'diagnoses', 'vitals',
                           'allergies', 'prescriptions', 'prescription_items'] loop
    execute format('select app.attach_standard_triggers(''public.%I'')', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS — todo se apoya en app.can_read_patient / app.can_write_patient, que
-- aplican el criterio de mínimo necesario y el registro de break-glass.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['encounters', 'clinical_notes', 'diagnoses', 'vitals',
                           'allergies', 'prescriptions'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (app.can_read_patient(patient_id))', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (app.can_write_patient(patient_id)
                     and app.can_access_tenant(tenant_id))', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (app.can_write_patient(patient_id))
         with check (app.can_write_patient(patient_id))', t || '_update', t);
    -- Sin política DELETE, y además el trigger *_no_delete lo bloquea.
  end loop;
end;
$$;

-- Los renglones de la receta heredan el acceso de su receta.
alter table public.prescription_items enable row level security;

create policy prescription_items_select on public.prescription_items
  for select to authenticated
  using (exists (select 1 from public.prescriptions rx
                 where rx.id = prescription_id and app.can_read_patient(rx.patient_id)));

create policy prescription_items_write on public.prescription_items
  for all to authenticated
  using (exists (select 1 from public.prescriptions rx
                 where rx.id = prescription_id and rx.signed_at is null
                   and app.can_write_patient(rx.patient_id)))
  with check (exists (select 1 from public.prescriptions rx
                      where rx.id = prescription_id and rx.signed_at is null
                        and app.can_write_patient(rx.patient_id)));

-- Firmar exige el permiso clinical.sign, que sólo tienen los médicos.
create or replace function public.sign_clinical_record(
  p_table text,
  p_id    uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid;
  v_patient uuid;
begin
  if p_table not in ('encounters', 'clinical_notes', 'diagnoses', 'prescriptions') then
    raise exception 'Tabla no firmable: %', p_table using errcode = '22023';
  end if;

  execute format(
    'select tenant_id, patient_id from public.%I where id = $1 and signed_at is null', p_table)
    into v_tenant, v_patient using p_id;

  if v_tenant is null then
    raise exception 'Registro inexistente o ya firmado' using errcode = '22023';
  end if;

  if not app.has_permission(v_tenant, 'clinical.sign') then
    perform app.audit('permission_denied', p_table, p_id, v_tenant, v_patient,
                      'Intento de firma sin permiso clinical.sign');
    raise exception 'Sólo el personal médico puede firmar' using errcode = '42501';
  end if;

  execute format(
    'update public.%I set signed_by = $1, signed_at = now() where id = $2', p_table)
    using (select auth.uid()), p_id;

  perform app.audit('sign', p_table, p_id, v_tenant, v_patient, 'Registro clínico firmado');
end;
$$;

grant execute on function public.sign_clinical_record(text, uuid) to authenticated;
