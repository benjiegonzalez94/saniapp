-- =============================================================================
-- seed.sql  ·  SaniTi
-- Datos de DESARROLLO. Se ejecutan sólo con `supabase db reset` en local.
--
-- NUNCA se aplican en producción: `supabase db push` sólo envía migraciones,
-- no este archivo.
--
-- Crea la institución piloto, tres cuentas con roles distintos y dos pacientes
-- de prueba, para poder recorrer la aplicación sin registrarse a mano.
--
-- Todas las contraseñas son "saniti123" — evidentemente inservibles fuera de
-- una máquina de desarrollo.
-- =============================================================================

do $$
declare
  v_tenant  uuid;
  v_medico  uuid := gen_random_uuid();
  v_recep   uuid := gen_random_uuid();
  v_admin   uuid := gen_random_uuid();
  v_pac1    uuid := gen_random_uuid();
  v_pac2    uuid := gen_random_uuid();
  v_enc     uuid := gen_random_uuid();
begin
  -- ---------------------------------------------------------------------------
  -- Cuentas
  -- ---------------------------------------------------------------------------
  -- OJO con las columnas de token: GoTrue (el servicio de autenticación) las
  -- lee en cadenas de Go NO anulables, así que dejarlas en NULL rompe el
  -- ingreso con "converting NULL to string is unsupported" — un error 500
  -- opaco, antes incluso de comparar la contraseña. Deben ir a cadena vacía.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new,
     email_change_token_current, email_change, phone_change, phone_change_token,
     reauthentication_token)
  select
    u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    u.email,
    extensions.crypt('saniti123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', u.nombre), now(), now(),
    '', '', '', '', '', '', '', ''
  from (values
    (v_medico, 'elvis.gonzalez@saniti.test', 'Elvis Olver González Sacón'),
    (v_recep,  'recepcion@saniti.test',      'Recepción Mendieta'),
    (v_admin,  'admin@saniti.test',          'Administración')
  ) as u(id, email, nombre);

  -- GoTrue también espera una identidad por proveedor: sin ella, el usuario
  -- existe pero no tiene forma de autenticarse por correo.
  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data, last_sign_in_at,
     created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, 'email',
         jsonb_build_object('sub', u.id::text, 'email', u.email,
                            'email_verified', true, 'phone_verified', false),
         now(), now(), now()
  from (values
    (v_medico, 'elvis.gonzalez@saniti.test'),
    (v_recep,  'recepcion@saniti.test'),
    (v_admin,  'admin@saniti.test')
  ) as u(id, email);

  -- El trigger on_auth_user_created ya creó los perfiles; se completa la ficha
  -- profesional del médico.
  update public.profiles
     set license_number = 'ACESS-000000', license_country = 'EC',
         specialty = 'Medicina General'
   where id = v_medico;

  -- ---------------------------------------------------------------------------
  -- Institución piloto
  -- ---------------------------------------------------------------------------
  insert into public.tenants
    (legal_name, commercial_name, slug, kind, country, timezone, access_model, dpo_email)
  values
    ('Hospital Básico Mendieta', 'Hospital Mendieta', 'hospital-mendieta',
     'hospital', 'EC', 'America/Guayaquil', 'open', 'privacidad@saniti.test')
  returning id into v_tenant;

  insert into public.memberships (tenant_id, profile_id, role, status, accepted_at) values
    (v_tenant, v_admin,  'owner',        'active', now()),
    (v_tenant, v_medico, 'physician',    'active', now()),
    (v_tenant, v_recep,  'receptionist', 'active', now());

  -- ---------------------------------------------------------------------------
  -- Pacientes
  --
  -- Sin cédula: el índice ciego se calcula con SANITI_BLIND_INDEX_KEY, que vive
  -- en el servidor de aplicación y la base no conoce. Regístrelas desde la
  -- interfaz para ver el cifrado en acción.
  -- ---------------------------------------------------------------------------
  insert into public.patients
    (id, tenant_id, given_name, family_name, birth_date, sex_at_birth, phone, city, created_by)
  values
    (v_pac1, v_tenant, 'María Fernanda', 'Zambrano Cedeño', '1978-03-14', 'female',
     '+593991234567', 'Manta', v_medico),
    (v_pac2, v_tenant, 'Julio César', 'Intriago Loor', '1995-11-02', 'male',
     '+593987654321', 'Manta', v_medico);

  -- Consentimientos: sin ellos no se puede abrir historia clínica ni enviar
  -- recordatorios, y el trigger de la bandeja de salida lo impone.
  insert into public.patient_consents
    (tenant_id, patient_id, purpose, granted, method, policy_version, recorded_by)
  select v_tenant, p.id, c.purpose, c.granted, 'presencial', 'v1', v_medico
  from (values (v_pac1), (v_pac2)) as p(id)
  cross join (values
    ('tratamiento_datos'::app.consent_purpose, true),
    ('atencion_medica', true),
    ('whatsapp', true)
  ) as c(purpose, granted);

  -- ---------------------------------------------------------------------------
  -- Antecedentes de María Fernanda: lo que el médico ve al abrir el expediente
  -- ---------------------------------------------------------------------------
  insert into public.allergies
    (tenant_id, patient_id, substance, reaction, severity, recorded_by)
  values
    (v_tenant, v_pac1, 'Penicilina', 'Urticaria generalizada y angioedema', 'severa', v_medico),
    (v_tenant, v_pac1, 'Ibuprofeno', 'Dispepsia', 'leve', v_medico);

  insert into public.encounters
    (id, tenant_id, patient_id, provider_id, kind, status, started_at, ended_at, created_by)
  values
    (v_enc, v_tenant, v_pac1, v_medico, 'control', 'finalizada',
     now() - interval '3 months', now() - interval '3 months', v_medico);

  insert into public.diagnoses
    (tenant_id, patient_id, encounter_id, code, display, kind, is_chronic, onset_date, recorded_by)
  values
    (v_tenant, v_pac1, v_enc, 'I10', 'Hipertensión esencial', 'definitivo', true,
     '2019-06-01', v_medico),
    (v_tenant, v_pac1, v_enc, 'E11', 'Diabetes mellitus tipo 2', 'definitivo', true,
     '2021-02-15', v_medico);

  insert into public.vitals
    (tenant_id, patient_id, encounter_id, measured_at, height_cm, weight_kg,
     temperature_c, heart_rate, respiratory_rate, systolic_bp, diastolic_bp,
     oxygen_saturation, glucose_mgdl, recorded_by)
  values
    (v_tenant, v_pac1, v_enc, now() - interval '3 months',
     158.0, 72.4, 36.6, 78, 16, 138, 86, 97, 126.0, v_medico);

  -- NO se siembra ninguna nota clínica, y es una decisión, no un olvido.
  --
  -- El texto de una nota se cifra en el servidor de aplicación con AES-256-GCM
  -- ligado a su fila, usando una clave que la base de datos no conoce. Desde
  -- aquí es imposible fabricar una nota legible: lo que se insertara daría
  -- error de descifrado al abrirla y rompería la navegación del demo.
  --
  -- Que no se pueda sembrar una nota ES la demostración de que el cifrado
  -- funciona. La primera nota se crea desde la interfaz, en "Nueva consulta".

  raise notice '--------------------------------------------------------------';
  raise notice 'Datos de desarrollo listos. Contraseña de todas: saniti123';
  raise notice '  Médico:    elvis.gonzalez@saniti.test';
  raise notice '  Recepción: recepcion@saniti.test';
  raise notice '  Admin:     admin@saniti.test';
  raise notice 'Institución: /i/hospital-mendieta';
  raise notice '--------------------------------------------------------------';
end;
$$;
