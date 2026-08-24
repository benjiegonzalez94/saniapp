-- =============================================================================
-- 0011_grants.sql  ·  SaniTi
-- Privilegios de tabla para los roles de la API.
--
-- POR QUÉ EXISTE ESTE ARCHIVO
--
-- RLS y los privilegios son dos capas distintas, y Postgres las evalúa en este
-- orden: primero comprueba si el rol tiene el privilegio sobre la tabla, y sólo
-- después aplica las políticas para decidir qué filas ve. Sin GRANT, la
-- política NUNCA SE EJECUTA — la consulta muere antes con "permission denied".
--
-- En esta versión de Supabase, los privilegios por defecto de `public` están
-- configurados para el rol `supabase_admin`, pero las migraciones se aplican
-- como `postgres`. Resultado: las tablas nacen sin DML para `authenticated` ni
-- `service_role`, y toda la seguridad parece funcionar porque todo está
-- denegado. Es un fallo cómodo —nadie ve datos ajenos— pero la aplicación
-- entera queda inservible, y peor: las pruebas de aislamiento pasan por el
-- motivo equivocado.
--
-- Los grants de aquí son explícitos y mínimos: cada tabla recibe exactamente
-- las operaciones para las que tiene política. Un `grant all on all tables`
-- habría funcionado igual de bien para la aplicación y habría destruido la
-- correspondencia entre las dos capas.
--
-- La migración 9999 comprueba que no queden políticas inalcanzables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- authenticated — usuarios con sesión. TODAS sus consultas pasan por RLS.
-- -----------------------------------------------------------------------------

-- Instituciones e identidad
grant select, update                 on public.tenants               to authenticated;
grant select, update                 on public.profiles              to authenticated;
grant select, insert, update, delete on public.memberships           to authenticated;
grant select                         on public.permissions           to authenticated;
grant select                         on public.role_permissions      to authenticated;
grant select, update                 on public.invitations           to authenticated;

-- El alta de instituciones no lleva INSERT: pasa por public.create_tenant(),
-- que crea el tenant y su propietario en la misma transacción.

-- Auditoría: sólo lectura, y filtrada por el permiso audit.read.
grant select                         on public.audit_log             to authenticated;

-- Pacientes y privacidad
grant select, insert, update         on public.patients              to authenticated;
grant select, insert, update, delete on public.care_team_members     to authenticated;
grant select, insert                 on public.patient_consents      to authenticated;
grant select, insert, update, delete on public.data_subject_requests to authenticated;
grant select, update                 on public.break_glass_grants    to authenticated;

-- Sin INSERT en break_glass_grants: la única vía es public.break_glass(), que
-- obliga a dar motivo y audita antes de conceder nada.

-- Historia clínica. Sin DELETE en ninguna: los registros clínicos se enmiendan,
-- no se borran, y además lo impide el trigger app.block_delete().
grant select, insert, update         on public.encounters            to authenticated;
grant select, insert, update         on public.clinical_notes        to authenticated;
grant select, insert, update         on public.diagnoses             to authenticated;
grant select, insert, update         on public.vitals                to authenticated;
grant select, insert, update         on public.allergies             to authenticated;
grant select, insert, update         on public.prescriptions         to authenticated;
grant select, insert, update, delete on public.prescription_items    to authenticated;

-- Documentos e interconsultas
grant select, insert, update         on public.documents             to authenticated;
grant select, insert, update         on public.document_shares       to authenticated;
grant select, insert, update         on public.case_consults         to authenticated;
grant select, insert                 on public.case_consult_messages to authenticated;

-- Agenda
grant select, insert, update, delete on public.locations             to authenticated;
grant select, insert, update, delete on public.provider_schedules    to authenticated;
grant select, insert, update, delete on public.schedule_exceptions   to authenticated;
grant select, insert, update         on public.appointments          to authenticated;
grant select, insert, update, delete on public.appointment_reminders to authenticated;

-- Sin DELETE en appointments: una cita se cancela, y así queda el registro de
-- que existió y de quién la canceló.

-- Mensajería: sólo lectura. Quien escribe es el webhook con service_role.
grant select                         on public.whatsapp_conversations to authenticated;
grant select                         on public.whatsapp_messages      to authenticated;
grant select, update                 on public.notification_outbox    to authenticated;

-- Facturación
grant select                         on public.plans                 to authenticated;
grant select, update                 on public.subscriptions         to authenticated;
grant select                         on public.invoices              to authenticated;

-- -----------------------------------------------------------------------------
-- anon — sin sesión. Sólo el catálogo público de precios.
-- -----------------------------------------------------------------------------
grant select on public.plans to anon;

-- -----------------------------------------------------------------------------
-- service_role — el backend de confianza. IGNORA RLS.
--
-- Lo usan el webhook de WhatsApp, el worker de recordatorios y los webhooks de
-- facturación, que no tienen usuario detrás y deben poder escribir en cualquier
-- institución. Se le conceden todas las tablas EXCEPTO las excepciones de
-- abajo, que se mantienen fuera de su alcance a propósito.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to service_role;

-- La bitácora sigue siendo de sólo anexado incluso para el backend: se escribe
-- por app.audit(), nunca a mano, y no se puede corregir a posteriori.
revoke insert, update, delete on public.audit_log from service_role;

-- Los catálogos sólo cambian por migración.
revoke insert, update, delete on public.permissions      from service_role;
revoke insert, update, delete on public.role_permissions from service_role;

-- -----------------------------------------------------------------------------
-- Secuencias
--
-- Ninguna tabla expuesta usa secuencias: las claves son uuid y los correlativos
-- por institución pasan por app.next_counter(). La identidad de audit_log sólo
-- la toca app.audit(), que es SECURITY DEFINER. Se deja constancia para que
-- quien añada una tabla con `bigserial` sepa que tendrá que conceder USAGE.
-- -----------------------------------------------------------------------------
