-- =============================================================================
-- 0014_medications.sql  ·  SaniTi
-- Vademécum de atención primaria y cruce con las alergias del paciente.
--
-- POR QUÉ UN CATÁLOGO Y NO TEXTO LIBRE
--
-- Con el medicamento escrito a mano no hay forma fiable de avisar de una
-- alergia: "Amoxicilina 500mg" no se parece a "Penicilina" en ninguna
-- comparación de cadenas, y son la misma familia. Cada fármaco declara aquí sus
-- `allergen_keys` —los nombres con los que un paciente o un médico podrían
-- haber anotado la alergia— y eso convierte el aviso en algo que funciona.
--
-- El médico sigue pudiendo escribir un medicamento que no esté en la lista: el
-- catálogo acelera y avisa, no impone. Pero en ese caso no habrá cruce, y la
-- interfaz lo dice.
-- =============================================================================

create table public.medications (
  code        text primary key check (code ~ '^[a-z0-9][a-z0-9_-]{1,48}$'),
  generic_name text not null,
  brand_names text not null default '',
  -- Presentaciones habituales, para ofrecerlas y no teclearlas.
  presentations text[] not null default '{}',
  -- Pauta típica: acelera lo que el médico escribe el 80 % de las veces.
  usual_dose  text,
  usual_frequency text,
  category    text not null,

  /*
   * Nombres por los que esta molécula podría estar anotada en una alergia,
   * incluida su familia. Amoxicilina lleva 'penicilina' y 'betalactamico'
   * porque una alergia registrada como "Penicilina" DEBE hacer saltar el aviso.
   * En minúsculas y sin acentos: se comparan normalizados.
   */
  allergen_keys text[] not null default '{}',

  is_common   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.medications
  add column search_text text generated always as (
    lower(translate(generic_name || ' ' || brand_names,
                    'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))
  ) stored;

create index medications_search_idx
  on public.medications using gin (search_text extensions.gin_trgm_ops);
create index medications_allergen_idx on public.medications using gin (allergen_keys);

insert into public.medications
  (code, generic_name, brand_names, presentations, usual_dose, usual_frequency,
   category, allergen_keys, is_common) values

  -- Analgésicos y antipiréticos
  ('paracetamol', 'Paracetamol', 'Acetaminofén Tempra Winadol',
   '{"500 mg tableta","1 g tableta","120 mg/5 mL jarabe","100 mg/mL gotas"}',
   '500 mg - 1 g', 'cada 8 horas', 'Analgésico',
   '{"paracetamol","acetaminofen"}', true),
  ('ibuprofeno', 'Ibuprofeno', 'Advil Motrin',
   '{"400 mg tableta","600 mg tableta","100 mg/5 mL suspensión"}',
   '400 mg', 'cada 8 horas', 'AINE',
   '{"ibuprofeno","aine","antiinflamatorio","aines"}', true),
  ('diclofenaco', 'Diclofenaco', 'Voltaren Cataflam',
   '{"50 mg tableta","75 mg/3 mL ampolla","gel tópico 1%"}',
   '50 mg', 'cada 8 horas', 'AINE',
   '{"diclofenaco","aine","antiinflamatorio","aines"}', true),
  ('naproxeno', 'Naproxeno', 'Flanax Apronax',
   '{"250 mg tableta","550 mg tableta"}', '550 mg', 'cada 12 horas', 'AINE',
   '{"naproxeno","aine","antiinflamatorio","aines"}', true),
  ('ketorolaco', 'Ketorolaco', 'Dolac',
   '{"10 mg tableta","30 mg/mL ampolla"}', '10 mg', 'cada 8 horas', 'AINE',
   '{"ketorolaco","aine","antiinflamatorio","aines"}', false),
  ('acido_acetilsalicilico', 'Ácido acetilsalicílico', 'Aspirina',
   '{"100 mg tableta","500 mg tableta"}', '100 mg', 'cada 24 horas', 'Antiagregante',
   '{"aspirina","acido acetilsalicilico","aas","salicilato","aine","aines"}', true),
  ('tramadol', 'Tramadol', 'Tramal',
   '{"50 mg cápsula","100 mg/2 mL ampolla"}', '50 mg', 'cada 8 horas', 'Opioide',
   '{"tramadol","opioide"}', false),

  -- Antibióticos
  ('amoxicilina', 'Amoxicilina', 'Amoxil Trifamox',
   '{"500 mg cápsula","875 mg tableta","250 mg/5 mL suspensión"}',
   '500 mg', 'cada 8 horas por 7 días', 'Antibiótico',
   '{"amoxicilina","penicilina","betalactamico","betalactamicos","amoxil"}', true),
  ('amoxicilina_clavulanico', 'Amoxicilina + ácido clavulánico', 'Augmentin Clavulin',
   '{"875/125 mg tableta","600 mg/5 mL suspensión"}',
   '875/125 mg', 'cada 12 horas por 7 días', 'Antibiótico',
   '{"amoxicilina","clavulanico","penicilina","betalactamico","betalactamicos","augmentin"}', true),
  ('penicilina_benzatinica', 'Penicilina G benzatínica', 'Benzetacil',
   '{"1 200 000 UI ampolla","2 400 000 UI ampolla"}',
   '1 200 000 UI', 'dosis única intramuscular', 'Antibiótico',
   '{"penicilina","betalactamico","betalactamicos","benzetacil"}', false),
  ('cefalexina', 'Cefalexina', 'Keflex',
   '{"500 mg cápsula","250 mg/5 mL suspensión"}',
   '500 mg', 'cada 6 horas por 7 días', 'Antibiótico',
   '{"cefalexina","cefalosporina","betalactamico","betalactamicos"}', true),
  ('azitromicina', 'Azitromicina', 'Zitromax',
   '{"500 mg tableta","200 mg/5 mL suspensión"}',
   '500 mg', 'cada 24 horas por 3 días', 'Antibiótico',
   '{"azitromicina","macrolido","macrolidos","eritromicina"}', true),
  ('claritromicina', 'Claritromicina', 'Klaricid',
   '{"500 mg tableta"}', '500 mg', 'cada 12 horas por 7 días', 'Antibiótico',
   '{"claritromicina","macrolido","macrolidos"}', false),
  ('ciprofloxacino', 'Ciprofloxacino', 'Ciproxina',
   '{"500 mg tableta"}', '500 mg', 'cada 12 horas por 7 días', 'Antibiótico',
   '{"ciprofloxacino","quinolona","quinolonas","fluoroquinolona"}', true),
  ('levofloxacino', 'Levofloxacino', 'Levaquin',
   '{"500 mg tableta","750 mg tableta"}', '500 mg', 'cada 24 horas por 7 días', 'Antibiótico',
   '{"levofloxacino","quinolona","quinolonas","fluoroquinolona"}', false),
  ('trimetoprima_sulfametoxazol', 'Trimetoprima + sulfametoxazol', 'Bactrim',
   '{"160/800 mg tableta","40/200 mg/5 mL suspensión"}',
   '160/800 mg', 'cada 12 horas por 7 días', 'Antibiótico',
   '{"sulfametoxazol","trimetoprima","sulfa","sulfas","sulfonamida","bactrim","cotrimoxazol"}', true),
  ('nitrofurantoina', 'Nitrofurantoína', 'Macrodantina',
   '{"100 mg cápsula"}', '100 mg', 'cada 12 horas por 5 días', 'Antibiótico',
   '{"nitrofurantoina","macrodantina"}', true),
  ('metronidazol', 'Metronidazol', 'Flagyl',
   '{"500 mg tableta","250 mg/5 mL suspensión","óvulo 500 mg"}',
   '500 mg', 'cada 8 horas por 7 días', 'Antibiótico',
   '{"metronidazol","flagyl","nitroimidazol"}', true),
  ('doxiciclina', 'Doxiciclina', 'Vibramicina',
   '{"100 mg cápsula"}', '100 mg', 'cada 12 horas por 7 días', 'Antibiótico',
   '{"doxiciclina","tetraciclina","tetraciclinas"}', false),

  -- Antiparasitarios y antimicóticos
  ('albendazol', 'Albendazol', 'Zentel',
   '{"400 mg tableta","400 mg/10 mL suspensión"}',
   '400 mg', 'dosis única, repetir en 15 días', 'Antiparasitario',
   '{"albendazol","benzimidazol"}', true),
  ('ivermectina', 'Ivermectina', 'Ivexterm',
   '{"6 mg tableta","gotas 6 mg/mL"}', '200 mcg/kg', 'dosis única', 'Antiparasitario',
   '{"ivermectina"}', true),
  ('nitazoxanida', 'Nitazoxanida', 'Annita Kidonax',
   '{"500 mg tableta","100 mg/5 mL suspensión"}',
   '500 mg', 'cada 12 horas por 3 días', 'Antiparasitario',
   '{"nitazoxanida"}', true),
  ('fluconazol', 'Fluconazol', 'Diflucan',
   '{"150 mg cápsula","200 mg tableta"}', '150 mg', 'dosis única', 'Antimicótico',
   '{"fluconazol","azol","antimicotico"}', true),
  ('clotrimazol', 'Clotrimazol', 'Canesten',
   '{"crema 1%","óvulo 500 mg"}', 'aplicar', 'cada 12 horas por 7 días', 'Antimicótico',
   '{"clotrimazol","azol","antimicotico"}', true),

  -- Digestivo
  ('omeprazol', 'Omeprazol', 'Losec Prilosec',
   '{"20 mg cápsula","40 mg cápsula"}', '20 mg', 'cada 24 horas en ayunas', 'Digestivo',
   '{"omeprazol","inhibidor de bomba"}', true),
  ('ranitidina', 'Ranitidina', 'Zantac',
   '{"150 mg tableta","300 mg tableta"}', '150 mg', 'cada 12 horas', 'Digestivo',
   '{"ranitidina"}', false),
  ('metoclopramida', 'Metoclopramida', 'Plasil Primperan',
   '{"10 mg tableta","10 mg/2 mL ampolla"}', '10 mg', 'cada 8 horas', 'Antiemético',
   '{"metoclopramida","plasil"}', true),
  ('dimenhidrinato', 'Dimenhidrinato', 'Mareol Dramamine',
   '{"50 mg tableta"}', '50 mg', 'cada 8 horas', 'Antiemético',
   '{"dimenhidrinato","dramamine"}', false),
  ('butilescopolamina', 'Butilescopolamina', 'Buscapina',
   '{"10 mg tableta","20 mg/mL ampolla"}', '10 mg', 'cada 8 horas', 'Antiespasmódico',
   '{"butilescopolamina","buscapina","escopolamina"}', true),
  ('sales_rehidratacion', 'Sales de rehidratación oral', 'Pedialyte Suero oral',
   '{"sobre 20,5 g","solución 500 mL"}', '1 sobre en 1 L de agua', 'a libre demanda', 'Digestivo',
   '{}', true),
  ('loperamida', 'Loperamida', 'Imodium',
   '{"2 mg cápsula"}', '2 mg', 'tras cada deposición, máximo 8 al día', 'Digestivo',
   '{"loperamida"}', false),

  -- Respiratorio y alergia
  ('loratadina', 'Loratadina', 'Clarityne',
   '{"10 mg tableta","5 mg/5 mL jarabe"}', '10 mg', 'cada 24 horas', 'Antihistamínico',
   '{"loratadina","antihistaminico"}', true),
  ('cetirizina', 'Cetirizina', 'Zyrtec',
   '{"10 mg tableta","5 mg/5 mL jarabe"}', '10 mg', 'cada 24 horas por la noche', 'Antihistamínico',
   '{"cetirizina","antihistaminico"}', true),
  ('clorfenamina', 'Clorfenamina', 'Clorotrimeton',
   '{"4 mg tableta","2 mg/5 mL jarabe"}', '4 mg', 'cada 8 horas', 'Antihistamínico',
   '{"clorfenamina","antihistaminico"}', false),
  ('salbutamol', 'Salbutamol', 'Ventolin',
   '{"inhalador 100 mcg/dosis","solución para nebulizar 5 mg/mL"}',
   '2 inhalaciones', 'cada 6 horas según necesidad', 'Broncodilatador',
   '{"salbutamol","ventolin"}', true),
  ('prednisona', 'Prednisona', 'Meticorten',
   '{"5 mg tableta","20 mg tableta","50 mg tableta"}',
   '20 mg', 'cada 24 horas por la mañana', 'Corticoide',
   '{"prednisona","corticoide","esteroide"}', true),
  ('dexametasona', 'Dexametasona', 'Decadron',
   '{"4 mg tableta","4 mg/mL ampolla","8 mg/2 mL ampolla"}',
   '4 mg', 'cada 8 horas', 'Corticoide',
   '{"dexametasona","corticoide","esteroide"}', true),
  ('ambroxol', 'Ambroxol', 'Mucosolvan',
   '{"30 mg tableta","15 mg/5 mL jarabe"}', '30 mg', 'cada 8 horas', 'Mucolítico',
   '{"ambroxol"}', true),
  ('budesonida_formoterol', 'Budesonida + formoterol', 'Symbicort',
   '{"inhalador 160/4,5 mcg"}', '1 inhalación', 'cada 12 horas', 'Broncodilatador',
   '{"budesonida","formoterol","corticoide"}', false),

  -- Cardiovascular y metabólico
  ('losartan', 'Losartán', 'Cozaar Hyzaar',
   '{"50 mg tableta","100 mg tableta"}', '50 mg', 'cada 24 horas', 'Antihipertensivo',
   '{"losartan","ara2","sartan"}', true),
  ('enalapril', 'Enalapril', 'Renitec',
   '{"10 mg tableta","20 mg tableta"}', '10 mg', 'cada 12 horas', 'Antihipertensivo',
   '{"enalapril","ieca","inhibidor de eca"}', true),
  ('amlodipino', 'Amlodipino', 'Norvasc',
   '{"5 mg tableta","10 mg tableta"}', '5 mg', 'cada 24 horas', 'Antihipertensivo',
   '{"amlodipino","calcioantagonista"}', true),
  ('hidroclorotiazida', 'Hidroclorotiazida', 'Hidrenox',
   '{"25 mg tableta","50 mg tableta"}', '25 mg', 'cada 24 horas por la mañana', 'Diurético',
   '{"hidroclorotiazida","tiazida","sulfa","sulfas"}', true),
  ('furosemida', 'Furosemida', 'Lasix',
   '{"40 mg tableta","20 mg/2 mL ampolla"}', '40 mg', 'cada 24 horas', 'Diurético',
   '{"furosemida","sulfa","sulfas","diuretico de asa"}', false),
  ('metformina', 'Metformina', 'Glucophage',
   '{"500 mg tableta","850 mg tableta","1 g tableta"}',
   '850 mg', 'cada 12 horas con las comidas', 'Antidiabético',
   '{"metformina","biguanida"}', true),
  ('glibenclamida', 'Glibenclamida', 'Euglucon',
   '{"5 mg tableta"}', '5 mg', 'cada 24 horas antes del desayuno', 'Antidiabético',
   '{"glibenclamida","sulfonilurea","sulfa","sulfas"}', false),
  ('atorvastatina', 'Atorvastatina', 'Lipitor',
   '{"20 mg tableta","40 mg tableta"}', '20 mg', 'cada 24 horas por la noche', 'Hipolipemiante',
   '{"atorvastatina","estatina","estatinas"}', true),
  ('levotiroxina', 'Levotiroxina', 'Eutirox Synthroid',
   '{"25 mcg tableta","50 mcg tableta","100 mcg tableta"}',
   '50 mcg', 'cada 24 horas en ayunas', 'Hormona tiroidea',
   '{"levotiroxina"}', true),

  -- Otros
  ('sulfato_ferroso', 'Sulfato ferroso', 'Fer-In-Sol',
   '{"300 mg tableta","125 mg/mL gotas"}', '300 mg', 'cada 24 horas con jugo de cítrico', 'Suplemento',
   '{"hierro","sulfato ferroso"}', true),
  ('acido_folico', 'Ácido fólico', '',
   '{"1 mg tableta","5 mg tableta"}', '1 mg', 'cada 24 horas', 'Suplemento',
   '{"acido folico"}', true),
  ('complejo_b', 'Complejo B', 'Neurobion',
   '{"tableta","ampolla"}', '1 tableta', 'cada 24 horas', 'Suplemento', '{}', false),
  ('lidocaina', 'Lidocaína', 'Xylocaína',
   '{"al 2% ampolla","gel 2%"}', 'según procedimiento', 'aplicación única', 'Anestésico local',
   '{"lidocaina","xilocaina","anestesico local"}', false);

-- -----------------------------------------------------------------------------
-- Búsqueda, igual que el catálogo CIE-10: por palabras y con lo común primero.
-- -----------------------------------------------------------------------------
create or replace function public.buscar_medicamento(p_termino text, p_limite int default 20)
returns table (
  code text, generic_name text, brand_names text, presentations text[],
  usual_dose text, usual_frequency text, category text, allergen_keys text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (
    select nullif(
      array_remove(
        string_to_array(
          btrim(lower(translate(coalesce(p_termino, ''),
            'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))),
          ' '),
        ''),
      '{}'::text[]) as palabras
  )
  select m.code, m.generic_name, m.brand_names, m.presentations,
         m.usual_dose, m.usual_frequency, m.category, m.allergen_keys
  from public.medications m, n
  where n.palabras is null
     or (select bool_and(m.search_text like '%' || w || '%') from unnest(n.palabras) as w)
  order by
    m.is_common desc,
    (n.palabras is not null and m.search_text like n.palabras[1] || '%') desc,
    m.generic_name
  limit least(coalesce(p_limite, 20), 50);
$$;

-- -----------------------------------------------------------------------------
-- El cruce que evita el daño
--
-- Devuelve las alergias activas del paciente que chocan con lo que se va a
-- prescribir. El paso no evidente es el primero:
--
--   1. La alergia se RESUELVE a su propia familia. "Ibuprofeno" se busca en el
--      catálogo, se encuentra el ibuprofeno y se toman todas sus claves
--      —{ibuprofeno, aine, antiinflamatorio}—. Sin este paso, una alergia
--      anotada como fármaco concreto nunca avisaría de otro de la misma
--      familia: naproxeno no se parece a ibuprofeno en ninguna comparación de
--      cadenas, y la reactividad cruzada entre AINE es real.
--
--   2. Se cruza ese conjunto con las claves del fármaco a prescribir.
--
-- `match_kind` distingue el aviso duro del preventivo: 'directa' es el mismo
-- fármaco que consta en la alergia; 'familia' es un pariente. Los dos se
-- muestran, pero no dicen lo mismo y la interfaz los redacta distinto.
--
-- Vive en la base y no en la aplicación a propósito: cualquier camino que
-- prescriba —la consulta, una receta suelta, un futuro flujo por WhatsApp—
-- consulta la misma verdad.
-- -----------------------------------------------------------------------------
create or replace function app.normalizar(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(coalesce(p_texto, ''), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))
$$;

create or replace function public.verificar_alergias(
  p_patient_id uuid,
  p_medication_codes text[]
)
returns table (
  medication_code text,
  medication_name text,
  allergy_id uuid,
  allergy_substance text,
  allergy_severity app.allergy_severity,
  allergy_reaction text,
  match_kind text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with alergias as (
    select a.id, a.substance, a.severity, a.reaction,
           app.normalizar(a.substance) as norm
    from public.allergies a
    where a.patient_id = p_patient_id and a.is_active
  ),
  -- Paso 1: qué familias implica cada alergia registrada.
  implicadas as (
    select
      al.id,
      al.substance,
      al.severity,
      al.reaction,
      al.norm,
      -- La propia palabra escrita, más las claves de todo fármaco del catálogo
      -- que la alergia identifique.
      array_agg(distinct clave) filter (where clave is not null) || array[al.norm]
        as claves
    from alergias al
    left join public.medications fuente
      on exists (
        select 1 from unnest(fuente.allergen_keys) as k
        where al.norm like '%' || k || '%' or k like '%' || al.norm || '%'
      )
    left join lateral unnest(fuente.allergen_keys) as clave on true
    group by al.id, al.substance, al.severity, al.reaction, al.norm
  )
  -- Paso 2: cruzar con lo que se quiere prescribir.
  select
    m.code,
    m.generic_name,
    i.id,
    i.substance,
    i.severity,
    i.reaction,
    case
      when m.search_text like '%' || i.norm || '%' then 'directa'
      else 'familia'
    end
  from public.medications m
  join implicadas i
    on exists (
      select 1 from unnest(m.allergen_keys) as mk
      where mk = any (i.claves)
    )
  where m.code = any (p_medication_codes)
  order by
    -- Lo que puede matar, primero; y el choque directo antes que el de familia.
    case i.severity
      when 'mortal' then 0 when 'severa' then 1 when 'moderada' then 2 else 3
    end,
    case when m.search_text like '%' || i.norm || '%' then 0 else 1 end,
    m.generic_name;
$$;

grant execute on function app.normalizar(text) to authenticated;

grant execute on function public.buscar_medicamento(text, int) to authenticated;
grant execute on function public.verificar_alergias(uuid, text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: catálogo de referencia, igual para todas las instituciones.
-- -----------------------------------------------------------------------------
alter table public.medications enable row level security;

create policy medications_select on public.medications
  for select to authenticated using (true);

grant select on public.medications to authenticated;

-- -----------------------------------------------------------------------------
-- Folio de receta, correlativo por institución (mismo patrón que la historia
-- clínica): dos médicos prescribiendo a la vez no pueden recibir el mismo.
-- -----------------------------------------------------------------------------
create or replace function app.assign_prescription_folio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folio is null then
    new.folio := app.next_counter(new.tenant_id, 'prescription_folio');
  end if;
  return new;
end;
$$;

alter table public.prescriptions alter column folio drop not null;

create trigger prescriptions_assign_folio
  before insert on public.prescriptions
  for each row execute function app.assign_prescription_folio();

alter table public.prescriptions
  add constraint prescriptions_folio_present check (folio is not null) not valid;
alter table public.prescriptions validate constraint prescriptions_folio_present;

-- El renglón de la receta guarda de qué fármaco del catálogo salió, para poder
-- reconstruir el cruce de alergias a posteriori en una revisión.
alter table public.prescription_items
  add column medication_code text references public.medications(code) on delete set null;
