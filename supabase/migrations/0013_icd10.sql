-- =============================================================================
-- 0013_icd10.sql  ·  SaniTi
-- Catálogo CIE-10.
--
-- No es la CIE-10 completa (unas 14 000 rúbricas): es un subconjunto curado de
-- lo que de verdad se ve en una consulta de medicina general en la costa
-- ecuatoriana. Un buscador con 14 000 entradas hace que el médico teclee y
-- descarte; con 150 bien elegidas, encuentra al segundo intento.
--
-- Incluye deliberadamente dengue, zika y chikunguña: en Manta son diagnóstico
-- corriente, no exótico, y omitirlos obligaría a escribirlos a mano cada vez.
--
-- La tabla queda preparada para cargar el catálogo completo si algún día hace
-- falta —el índice trigram escala— sin cambiar nada de la interfaz.
-- =============================================================================

create extension if not exists "pg_trgm" with schema extensions;

create table public.icd10_codes (
  code        text primary key check (code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$'),
  display     text not null,
  chapter     text not null,
  -- Marca lo habitual en atención primaria: la interfaz lo ofrece primero.
  is_common   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Sinónimos coloquiales. La CIE-10 dice "faringitis"; el médico con prisa
-- teclea "garganta". Sin esta columna, la búsqueda falla justo en los términos
-- que uno usaría hablando con el paciente.
alter table public.icd10_codes add column keywords text not null default '';

-- Búsqueda por texto sin acentos ni mayúsculas. Se materializa en una columna
-- para poder indexarla: `translate` sobre la marcha no es indexable.
alter table public.icd10_codes
  add column search_text text generated always as (
    lower(translate(display || ' ' || keywords, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))
  ) stored;

create index icd10_search_idx
  on public.icd10_codes using gin (search_text extensions.gin_trgm_ops);
create index icd10_common_idx on public.icd10_codes (display) where is_common;

insert into public.icd10_codes (code, display, chapter, is_common) values
  -- Infecciosas y parasitarias
  ('A09',   'Diarrea y gastroenteritis de presunto origen infeccioso', 'Infecciosas', true),
  ('A90',   'Dengue sin signos de alarma',                             'Infecciosas', true),
  ('A91',   'Dengue grave',                                            'Infecciosas', true),
  ('A92.0', 'Fiebre de chikunguña',                                    'Infecciosas', true),
  ('A92.5', 'Enfermedad por virus del Zika',                           'Infecciosas', true),
  ('A08',   'Infección intestinal viral',                              'Infecciosas', true),
  ('B82',   'Parasitosis intestinal sin otra especificación',           'Infecciosas', true),
  ('B34.9', 'Infección viral no especificada',                          'Infecciosas', true),
  ('B35.4', 'Tiña del cuerpo',                                          'Infecciosas', false),
  ('B37.3', 'Candidiasis vulvovaginal',                                 'Infecciosas', true),
  ('B01',   'Varicela',                                                 'Infecciosas', false),
  ('A15',   'Tuberculosis respiratoria confirmada',                     'Infecciosas', false),
  ('B24',   'Enfermedad por VIH sin otra especificación',               'Infecciosas', false),

  -- Respiratorias
  ('J00',   'Rinofaringitis aguda (resfriado común)',                   'Respiratorias', true),
  ('J01',   'Sinusitis aguda',                                          'Respiratorias', true),
  ('J02.9', 'Faringitis aguda no especificada',                         'Respiratorias', true),
  ('J03.9', 'Amigdalitis aguda no especificada',                        'Respiratorias', true),
  ('J04.0', 'Laringitis aguda',                                         'Respiratorias', false),
  ('J06.9', 'Infección aguda de vías respiratorias superiores',         'Respiratorias', true),
  ('J11',   'Influenza con virus no identificado',                      'Respiratorias', true),
  ('J18.9', 'Neumonía no especificada',                                 'Respiratorias', true),
  ('J20.9', 'Bronquitis aguda no especificada',                         'Respiratorias', true),
  ('J40',   'Bronquitis no especificada como aguda o crónica',          'Respiratorias', false),
  ('J44.9', 'Enfermedad pulmonar obstructiva crónica',                  'Respiratorias', false),
  ('J45.9', 'Asma no especificada',                                     'Respiratorias', true),
  ('J30.4', 'Rinitis alérgica no especificada',                         'Respiratorias', true),

  -- Digestivas
  ('K21.9', 'Enfermedad por reflujo gastroesofágico sin esofagitis',    'Digestivas', true),
  ('K29.7', 'Gastritis no especificada',                                'Digestivas', true),
  ('K30',   'Dispepsia funcional',                                      'Digestivas', true),
  ('K59.0', 'Estreñimiento',                                            'Digestivas', true),
  ('K58.9', 'Síndrome de intestino irritable',                          'Digestivas', true),
  ('K80.2', 'Cálculo de la vesícula biliar sin colecistitis',           'Digestivas', false),
  ('K64.9', 'Hemorroides no especificadas',                             'Digestivas', true),
  ('K02.9', 'Caries dental no especificada',                            'Digestivas', false),
  ('K92.2', 'Hemorragia gastrointestinal no especificada',              'Digestivas', false),

  -- Cardiovasculares
  ('I10',   'Hipertensión esencial (primaria)',                          'Cardiovasculares', true),
  ('I11.9', 'Cardiopatía hipertensiva sin insuficiencia cardíaca',       'Cardiovasculares', false),
  ('I25.1', 'Enfermedad aterosclerótica del corazón',                    'Cardiovasculares', false),
  ('I50.9', 'Insuficiencia cardíaca no especificada',                     'Cardiovasculares', false),
  ('I83.9', 'Várices de miembros inferiores sin úlcera ni inflamación',  'Cardiovasculares', true),
  ('I48',   'Fibrilación y aleteo auricular',                            'Cardiovasculares', false),
  ('I64',   'Accidente cerebrovascular no especificado',                  'Cardiovasculares', false),

  -- Endocrinas, metabólicas y nutricionales
  ('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones',               'Endocrinas', true),
  ('E11.6', 'Diabetes mellitus tipo 2 con otras complicaciones',         'Endocrinas', false),
  ('E10.9', 'Diabetes mellitus tipo 1 sin complicaciones',               'Endocrinas', false),
  ('E03.9', 'Hipotiroidismo no especificado',                            'Endocrinas', true),
  ('E05.9', 'Tirotoxicosis no especificada',                             'Endocrinas', false),
  ('E78.5', 'Hiperlipidemia no especificada',                            'Endocrinas', true),
  ('E66.9', 'Obesidad no especificada',                                  'Endocrinas', true),
  ('E86',   'Depleción del volumen (deshidratación)',                    'Endocrinas', true),
  ('E44',   'Desnutrición proteicocalórica moderada y leve',             'Endocrinas', false),

  -- Sangre
  ('D50.9', 'Anemia por deficiencia de hierro no especificada',          'Sangre', true),
  ('D64.9', 'Anemia no especificada',                                    'Sangre', true),

  -- Musculoesqueléticas
  ('M54.5', 'Lumbago no especificado',                                   'Musculoesqueléticas', true),
  ('M54.2', 'Cervicalgia',                                               'Musculoesqueléticas', true),
  ('M25.5', 'Dolor articular',                                           'Musculoesqueléticas', true),
  ('M79.1', 'Mialgia',                                                   'Musculoesqueléticas', true),
  ('M79.7', 'Fibromialgia',                                              'Musculoesqueléticas', false),
  ('M15.9', 'Poliartrosis no especificada',                              'Musculoesqueléticas', true),
  ('M17.9', 'Gonartrosis no especificada',                               'Musculoesqueléticas', true),
  ('M10.9', 'Gota no especificada',                                      'Musculoesqueléticas', false),
  ('M06.9', 'Artritis reumatoide no especificada',                       'Musculoesqueléticas', false),

  -- Genitourinarias
  ('N39.0', 'Infección de vías urinarias de sitio no especificado',      'Genitourinarias', true),
  ('N30.0', 'Cistitis aguda',                                            'Genitourinarias', true),
  ('N20.0', 'Cálculo del riñón',                                         'Genitourinarias', false),
  ('N18.9', 'Enfermedad renal crónica no especificada',                  'Genitourinarias', false),
  ('N40',   'Hiperplasia prostática',                                    'Genitourinarias', false),
  ('N76.0', 'Vaginitis aguda',                                           'Genitourinarias', true),
  ('N91.2', 'Amenorrea no especificada',                                 'Genitourinarias', false),
  ('N94.6', 'Dismenorrea no especificada',                               'Genitourinarias', true),

  -- Piel
  ('L20.9', 'Dermatitis atópica no especificada',                        'Piel', true),
  ('L23.9', 'Dermatitis alérgica de contacto de causa no especificada',  'Piel', true),
  ('L30.9', 'Dermatitis no especificada',                                'Piel', true),
  ('L50.9', 'Urticaria no especificada',                                 'Piel', true),
  ('L03.9', 'Celulitis no especificada',                                 'Piel', true),
  ('L02.9', 'Absceso cutáneo, furúnculo y ántrax',                       'Piel', true),
  ('L70.0', 'Acné vulgar',                                               'Piel', false),
  ('B86',   'Escabiosis (sarna)',                                        'Piel', true),

  -- Neurológicas y salud mental
  ('G43.9', 'Migraña no especificada',                                   'Neurológicas', true),
  ('G44.2', 'Cefalea tensional',                                         'Neurológicas', true),
  ('R51',   'Cefalea',                                                   'Neurológicas', true),
  ('G40.9', 'Epilepsia no especificada',                                 'Neurológicas', false),
  ('F32.9', 'Episodio depresivo no especificado',                        'Salud mental', true),
  ('F41.1', 'Trastorno de ansiedad generalizada',                        'Salud mental', true),
  ('F41.9', 'Trastorno de ansiedad no especificado',                     'Salud mental', true),
  ('F51.0', 'Insomnio no orgánico',                                      'Salud mental', true),
  ('F10.2', 'Dependencia del alcohol',                                   'Salud mental', false),

  -- Ojos y oídos
  ('H10.9', 'Conjuntivitis no especificada',                             'Ojos y oídos', true),
  ('H66.9', 'Otitis media no especificada',                              'Ojos y oídos', true),
  ('H60.3', 'Otitis externa infecciosa',                                 'Ojos y oídos', true),
  ('H61.2', 'Tapón de cerumen',                                          'Ojos y oídos', true),
  ('H52.4', 'Presbicia',                                                 'Ojos y oídos', false),

  -- Embarazo y control
  ('Z34.9', 'Supervisión de embarazo normal no especificado',            'Embarazo', true),
  ('O21.0', 'Hiperemesis gravídica leve',                                'Embarazo', false),
  ('Z39.2', 'Atención posparto de rutina',                               'Embarazo', false),

  -- Síntomas y signos frecuentes
  ('R50.9', 'Fiebre no especificada',                                    'Síntomas', true),
  ('R10.4', 'Dolor abdominal no especificado',                           'Síntomas', true),
  ('R11',   'Náusea y vómito',                                           'Síntomas', true),
  ('R05',   'Tos',                                                       'Síntomas', true),
  ('R42',   'Mareo y desvanecimiento',                                   'Síntomas', true),
  ('R53',   'Malestar, fatiga y astenia',                                'Síntomas', true),
  ('R07.4', 'Dolor torácico no especificado',                            'Síntomas', true),
  ('R60.0', 'Edema localizado',                                          'Síntomas', false),

  -- Prevención y trámites
  ('Z00.0', 'Examen médico general',                                     'Prevención', true),
  ('Z00.1', 'Control de salud rutinario del niño',                       'Prevención', true),
  ('Z01.4', 'Examen ginecológico de rutina',                             'Prevención', false),
  ('Z23',   'Necesidad de inmunización',                                 'Prevención', true),
  ('Z71.3', 'Consulta para instrucción y vigilancia dietética',          'Prevención', false),
  ('Z76.0', 'Consulta para repetición de receta',                        'Prevención', true),

  -- Lesiones
  ('T14.9', 'Lesión no especificada',                                    'Lesiones', false),
  ('S93.4', 'Esguince de tobillo',                                       'Lesiones', true),
  ('T78.4', 'Alergia no especificada',                                   'Lesiones', true),
  ('T63.4', 'Efecto tóxico del veneno de otros artrópodos',              'Lesiones', false);

-- Sinónimos de uso corriente en consulta.
update public.icd10_codes set keywords = v.kw
from (values
  ('J02.9', 'garganta dolor odinofagia'),
  ('J03.9', 'garganta amigdalas anginas placas'),
  ('J00',   'gripe catarro resfrio mocos'),
  ('J06.9', 'gripe ivrs vias altas'),
  ('J11',   'gripe influenza'),
  ('J01',   'sinusitis congestion nasal'),
  ('J20.9', 'bronquios tos flema'),
  ('J45.9', 'asma silbido broncoespasmo'),
  ('N39.0', 'orina ardor disuria ivu itu'),
  ('N30.0', 'orina vejiga ardor'),
  ('N20.0', 'piedra rinon calculo colico renal'),
  ('K29.7', 'estomago acidez ardor'),
  ('K21.9', 'acidez reflujo agrio'),
  ('K59.0', 'no obra constipacion'),
  ('A09',   'diarrea soltura estomago'),
  ('R11',   'vomito asco arqueo'),
  ('I10',   'presion alta tension hta'),
  ('E11.9', 'azucar alta dm2 glicemia'),
  ('E78.5', 'colesterol trigliceridos grasa'),
  ('E66.9', 'sobrepeso gordura peso'),
  ('E03.9', 'tiroides lenta'),
  ('D50.9', 'anemia hierro debilidad'),
  ('M54.5', 'espalda cintura lumbar rinones'),
  ('M54.2', 'cuello nuca torticolis'),
  ('M15.9', 'artrosis desgaste huesos'),
  ('M17.9', 'rodilla desgaste'),
  ('G43.9', 'migrana jaqueca cabeza'),
  ('R51',   'cabeza dolor'),
  ('H10.9', 'ojo rojo lagana conjuntiva'),
  ('H66.9', 'oido dolor otitis'),
  ('H61.2', 'oido tapado cera'),
  ('L50.9', 'ronchas alergia picazon'),
  ('L30.9', 'piel sarpullido comezon'),
  ('B86',   'sarna picazon rasca'),
  ('B82',   'lombrices parasitos amebas'),
  ('F41.9', 'nervios angustia ansiedad'),
  ('F32.9', 'tristeza depresion animo'),
  ('F51.0', 'no duerme desvelo insomnio'),
  ('A90',   'dengue mosquito zancudo'),
  ('A92.0', 'chikungunya mosquito'),
  ('A92.5', 'zika mosquito'),
  ('R50.9', 'calentura temperatura fiebre'),
  ('R53',   'cansancio debilidad decaimiento'),
  ('R42',   'mareo vertigo desmayo'),
  ('Z00.0', 'chequeo control examen general'),
  ('Z76.0', 'receta repetir medicina'),
  ('Z23',   'vacuna inmunizacion'),
  ('S93.4', 'torcedura tobillo esguince'),
  ('I83.9', 'varices piernas venas'),
  ('K64.9', 'almorranas hemorroides'),
  ('N76.0', 'flujo vaginal picazon'),
  ('B37.3', 'flujo hongos candidiasis'),
  ('N94.6', 'colicos menstruales regla')
) as v(code, kw)
where public.icd10_codes.code = v.code;

-- -----------------------------------------------------------------------------
-- Búsqueda
--
-- Cada palabra escrita se busca POR SEPARADO y todas deben aparecer, en
-- cualquier orden y en cualquier parte de la descripción. Es lo que hace que
-- "infeccion urin" encuentre "Infección de vías urinarias": tratando el texto
-- como una sola subcadena no coincidiría, porque entre las dos palabras hay
-- otras dos. Un médico teclea fragmentos, no la rúbrica literal.
--
-- Lo habitual en atención primaria va primero: se busca "dengue", no "A90".
-- -----------------------------------------------------------------------------
create or replace function public.buscar_icd10(p_termino text, p_limite int default 20)
returns table (code text, display text, chapter text, is_common boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with normalizado as (
    select
      lower(translate(coalesce(p_termino, ''), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU')) as t,
      nullif(
        array_remove(
          string_to_array(
            btrim(lower(translate(coalesce(p_termino, ''),
              'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'))),
            ' '),
          ''),
        '{}'::text[]
      ) as palabras
  )
  select c.code, c.display, c.chapter, c.is_common
  from public.icd10_codes c, normalizado n
  where n.palabras is null
     or c.code ilike n.t || '%'
     -- Todas las palabras presentes, en cualquier orden.
     or (select bool_and(c.search_text like '%' || w || '%') from unnest(n.palabras) as w)
  order by
    -- Sin nada escrito, se ofrece el vademécum de atención primaria.
    c.is_common desc,
    -- Lo que empieza por lo escrito, antes que lo que sólo lo contiene.
    (n.palabras is not null and c.search_text like n.palabras[1] || '%') desc,
    length(c.display),
    c.display
  limit least(coalesce(p_limite, 20), 50);
$$;

grant execute on function public.buscar_icd10(text, int) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
--
-- Catálogo de referencia, igual para todas las instituciones: no lleva
-- tenant_id y se lee sin restricción. Se escribe sólo por migración.
-- -----------------------------------------------------------------------------
alter table public.icd10_codes enable row level security;

create policy icd10_select on public.icd10_codes
  for select to authenticated using (true);

grant select on public.icd10_codes to authenticated;
