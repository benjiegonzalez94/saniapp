-- =============================================================================
-- 0016_appointment_reminders.sql  ·  SaniTi
-- Planificación automática de los recordatorios de cita.
--
-- Va en un trigger y no en la aplicación por la misma razón que el cruce de
-- alergias: cualquier camino que agende —la web, recepción, el portal del
-- paciente, el bot de WhatsApp de la fase 4— tiene que producir el mismo plan
-- de avisos. Si dependiera del código que llama, el bot agendaría citas sin
-- recordatorio y nadie se daría cuenta hasta que un paciente no apareciera.
--
-- El plan (appointment_reminders) es distinto de la cola de envío
-- (notification_outbox), y la separación importa:
--
--   · appointment_reminders es el PLAN, atado al ciclo de vida de la cita. Si
--     la cita se cancela o se reprograma, el trigger de 0008 cancela sus
--     recordatorios pendientes automáticamente.
--   · notification_outbox es el DESPACHO. Ahí es donde el trigger de
--     consentimiento (0009) decide si el mensaje puede salir.
--
-- Un recordatorio sólo pasa del plan al despacho cuando llega su hora, y ahí
-- vuelve a comprobarse el consentimiento: el paciente pudo revocarlo entre que
-- se agendó la cita y el día anterior.
-- =============================================================================

-- Antelación por defecto, en horas. Configurable por institución en
-- tenants.settings->'reminder_hours': un consultorio puede querer avisar sólo
-- el día antes y un hospital con quirófano, una semana.
create or replace function app.horas_recordatorio(p_tenant uuid)
returns int[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(value::int order by value::int desc)
     from public.tenants t,
          jsonb_array_elements_text(t.settings -> 'reminder_hours') as value
     where t.id = p_tenant
       and jsonb_typeof(t.settings -> 'reminder_hours') = 'array'),
    -- Un aviso el día antes para que dé tiempo a reprogramar, y otro dos horas
    -- antes para el que lo leyó ayer y se le olvidó.
    array[24, 2]
  )
$$;

create or replace function app.plan_recordatorios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_horas int[];
  v_hora  int;
  v_momento timestamptz;
  v_canal app.reminder_channel;
begin
  -- Sólo se planifica para citas vivas y futuras. Registrar a posteriori una
  -- consulta que ya ocurrió no debe disparar avisos.
  if new.status not in ('solicitada', 'confirmada') or new.starts_at <= now() then
    return new;
  end if;

  v_horas := app.horas_recordatorio(new.tenant_id);

  -- El canal se decide por lo que el paciente autorizó, en este orden de
  -- preferencia. Si no autorizó ninguno no se planifica nada: crear filas que
  -- el trigger de consentimiento va a marcar como no enviables sólo llena la
  -- tabla de ruido.
  select c into v_canal
  from unnest(array['whatsapp', 'sms', 'email']::app.reminder_channel[]) as c
  where app.has_consent(
          new.patient_id,
          (c::text)::app.consent_purpose)
  limit 1;

  if v_canal is null then
    return new;
  end if;

  foreach v_hora in array v_horas loop
    v_momento := new.starts_at - make_interval(hours => v_hora);

    -- Un recordatorio cuya hora ya pasó no se planifica: una cita agendada
    -- para dentro de una hora no debe generar el aviso "de 24 horas antes".
    if v_momento > now() then
      insert into public.appointment_reminders
        (tenant_id, appointment_id, channel, scheduled_for)
      values (new.tenant_id, new.id, v_canal, v_momento)
      on conflict (appointment_id, channel, scheduled_for) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

create trigger appointments_plan_reminders
  after insert on public.appointments
  for each row execute function app.plan_recordatorios();

-- Reprogramar es cambiar starts_at: el plan viejo ya no sirve. El trigger de
-- 0008 cancela los pendientes al pasar por 'reprogramada'; aquí se replanifica
-- cuando la hora cambia sin pasar por ese estado.
create or replace function app.replan_recordatorios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    update public.appointment_reminders
       set status = 'cancelado',
           failed_reason = 'La cita se movió de hora',
           updated_at = now()
     where appointment_id = new.id and status = 'programado';

    perform app.plan_recordatorios_para(new.id);
  end if;
  return new;
end;
$$;

-- Versión invocable con un identificador, para replanificar sin depender del
-- registro NEW de un trigger de inserción.
create or replace function app.plan_recordatorios_para(p_appointment_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cita  public.appointments;
  v_horas int[];
  v_hora  int;
  v_momento timestamptz;
  v_canal app.reminder_channel;
  v_creados int := 0;
begin
  select * into v_cita from public.appointments where id = p_appointment_id;

  if v_cita.id is null
     or v_cita.status not in ('solicitada', 'confirmada')
     or v_cita.starts_at <= now() then
    return 0;
  end if;

  select c into v_canal
  from unnest(array['whatsapp', 'sms', 'email']::app.reminder_channel[]) as c
  where app.has_consent(v_cita.patient_id, (c::text)::app.consent_purpose)
  limit 1;

  if v_canal is null then
    return 0;
  end if;

  v_horas := app.horas_recordatorio(v_cita.tenant_id);

  foreach v_hora in array v_horas loop
    v_momento := v_cita.starts_at - make_interval(hours => v_hora);
    if v_momento > now() then
      insert into public.appointment_reminders
        (tenant_id, appointment_id, channel, scheduled_for)
      values (v_cita.tenant_id, p_appointment_id, v_canal, v_momento)
      on conflict (appointment_id, channel, scheduled_for) do nothing;
      v_creados := v_creados + 1;
    end if;
  end loop;

  return v_creados;
end;
$$;

create trigger appointments_replan_reminders
  after update of starts_at on public.appointments
  for each row execute function app.replan_recordatorios();

-- -----------------------------------------------------------------------------
-- Del plan al despacho
--
-- Lo consume el worker de recordatorios: toma los que ya vencieron y los pasa a
-- notification_outbox, donde el trigger de consentimiento vuelve a comprobar la
-- autorización. Esa segunda comprobación no es redundante: entre que se agendó
-- la cita y hoy, el paciente pudo revocar.
-- -----------------------------------------------------------------------------
create or replace function app.despachar_recordatorios(p_limite int default 50)
returns table (reminder_id uuid, outbox_status app.outbox_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_estado app.outbox_status;
begin
  for r in
    select ar.id, ar.tenant_id, ar.appointment_id, ar.channel, ar.scheduled_for,
           a.starts_at, a.patient_id,
           p.given_name, p.phone, p.email,
           pr.full_name as medico,
           t.timezone
    from public.appointment_reminders ar
    join public.appointments a on a.id = ar.appointment_id
    join public.patients p on p.id = a.patient_id
    join public.profiles pr on pr.id = a.provider_id
    join public.tenants t on t.id = ar.tenant_id
    where ar.status = 'programado'
      and ar.scheduled_for <= now()
      and a.status in ('solicitada', 'confirmada')
      and a.starts_at > now()
    order by ar.scheduled_for
    limit greatest(coalesce(p_limite, 50), 1)
    for update of ar skip locked
  loop
    insert into public.notification_outbox
      (tenant_id, patient_id, channel, recipient, template, variables,
       body_preview, dedupe_key)
    values (
      r.tenant_id,
      r.patient_id,
      r.channel,
      case r.channel when 'email' then r.email::text else r.phone end,
      'recordatorio_cita',
      jsonb_build_object(
        'paciente', r.given_name,
        'medico', r.medico,
        'fecha', to_char(r.starts_at at time zone r.timezone, 'DD/MM/YYYY'),
        'hora',  to_char(r.starts_at at time zone r.timezone, 'HH24:MI')
      ),
      format('Recordatorio: cita con %s el %s a las %s',
             r.medico,
             to_char(r.starts_at at time zone r.timezone, 'DD/MM/YYYY'),
             to_char(r.starts_at at time zone r.timezone, 'HH24:MI')),
      -- Idempotencia: un reintento del worker no duplica el aviso.
      'rec:' || r.id::text
    )
    on conflict (dedupe_key) do nothing
    returning status into v_estado;

    update public.appointment_reminders
       set status = case
             when v_estado = 'sin_consentimiento' then 'sin_consentimiento'::app.reminder_status
             else 'enviando'::app.reminder_status
           end,
           updated_at = now()
     where id = r.id;

    reminder_id := r.id;
    outbox_status := coalesce(v_estado, 'programado');
    return next;
  end loop;
end;
$$;

create or replace function public.despachar_recordatorios(p_limite int default 50)
returns table (reminder_id uuid, outbox_status text)
language sql
security definer
set search_path = ''
as $$
  select d.reminder_id, d.outbox_status::text from app.despachar_recordatorios(p_limite) d
$$;

revoke all on function public.despachar_recordatorios(int) from public, anon, authenticated;
grant execute on function public.despachar_recordatorios(int) to service_role;

-- Un destinatario nulo haría fallar el envío en el peor momento: cuando el
-- paciente ya contaba con el aviso. Se detecta al planificar, no al enviar.
alter table public.notification_outbox
  add constraint notification_outbox_recipient_no_vacio
  check (length(trim(recipient)) > 0) not valid;
alter table public.notification_outbox
  validate constraint notification_outbox_recipient_no_vacio;
