-- =============================================================================
-- 0012_patient_numbering.sql  ·  SaniTi
-- Numeración automática de historia clínica.
--
-- El correlativo lo asigna la base y no la aplicación: dos altas simultáneas
-- —una en recepción y otra en el consultorio— no pueden recibir el mismo
-- número, y app.next_counter() ya serializa el incremento.
--
-- Va en un trigger BEFORE INSERT en lugar de un RPC aparte para que sea el
-- mismo enunciado que inserta la fila: sin viaje extra y sin ventana en la que
-- un fallo deje un número consumido sin paciente.
-- =============================================================================

create or replace function app.assign_record_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.record_number is null then
    new.record_number := app.next_counter(new.tenant_id, 'record_number');
  end if;
  return new;
end;
$$;

-- La columna es NOT NULL, pero los triggers BEFORE corren antes de comprobar
-- las restricciones, así que insertar sin número es válido.
alter table public.patients alter column record_number drop not null;

create trigger patients_assign_record_number
  before insert on public.patients
  for each row execute function app.assign_record_number();

-- Se restaura la garantía: tras el trigger, ninguna fila puede quedar sin
-- número. Una historia clínica sin correlativo es inencontrable en papel, que
-- es exactamente el sistema del que venimos.
alter table public.patients
  add constraint patients_record_number_present check (record_number is not null)
  not valid;
alter table public.patients validate constraint patients_record_number_present;
