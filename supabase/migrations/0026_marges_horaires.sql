-- =====================================================================
-- 0026 — Marges horaires des trajets (retour du porteur, 22/10/2026)
--
-- DÉFAUT CORRIGÉ. Jusqu'ici lib/trips.ts posait l'aller à l'heure de
-- début de l'activité et le retour à son heure de fin. Un tennis de
-- 17 h à 18 h produisait donc un trajet « aller » à 17 h — alors qu'à
-- 17 h l'enfant doit être ARRIVÉ, pas partir. Le premier trajet du
-- pilote l'aurait montré.
--
-- Trois réglages par activité, tous facultatifs. Quand ils sont nuls,
-- les valeurs de app_settings.trip_margins_default s'appliquent :
--
--   aller   : départ = début   − marge d'arrivée − durée de trajet
--   retour  : départ = fin     + délai de sortie
--
-- La durée de trajet est SAISIE, pas calculée : aucun service
-- d'itinéraires n'est appelé, donc aucune donnée de localisation ne
-- sort de l'application (décision du 22/10, à réexaminer avec l'AIPD).
-- =====================================================================

alter table activities
  add column if not exists arrival_margin_min integer,
  add column if not exists departure_delay_min integer,
  add column if not exists travel_minutes integer;

alter table activities
  drop constraint if exists activities_margins_sane;
alter table activities
  add constraint activities_margins_sane check (
    (arrival_margin_min  is null or arrival_margin_min  between 0 and 120) and
    (departure_delay_min is null or departure_delay_min between 0 and 120) and
    (travel_minutes      is null or travel_minutes      between 0 and 180)
  );

comment on column activities.arrival_margin_min is
  'Minutes d''avance souhaitées à l''arrivée, avant le début. Null = valeur par défaut.';
comment on column activities.departure_delay_min is
  'Minutes avant de repartir, après la fin. Null = valeur par défaut.';
comment on column activities.travel_minutes is
  'Durée de trajet estimée, saisie par le parent. Null = valeur par défaut.';

insert into app_settings (key, value)
values ('trip_margins_default',
        '{"arrival_margin_min": 10, "departure_delay_min": 10, "travel_minutes": 15}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Rattrapage des trajets déjà générés.
--
-- On DÉCALE chaque occurrence, on ne la recalcule pas depuis l'activité :
-- `activities.starts_at` porte le créneau de RÉFÉRENCE (la première
-- occurrence), la récurrence venant de `rrule`. Recalculer depuis lui
-- ramènerait toutes les occurrences futures d'une activité hebdomadaire
-- à la même date, et la première tentative a d'ailleurs échoué sur
-- `trips_activity_occurrence_unique` (22/10/2026). Un décalage uniforme
-- préserve les dates et l'unicité.
--
-- Trois gardes :
--   * seulement les trajets À VENIR, sans conducteur et sans demande
--     acceptée — on ne déplace jamais un horaire sur lequel deux
--     familles se sont mises d'accord ;
--   * jamais vers une heure déjà occupée par le même couple
--     activité/direction ;
--   * rien du tout si 0026 est déjà enregistrée, pour qu'un second
--     passage ne décale pas une deuxième fois.
-- ---------------------------------------------------------------------

with defauts as (
  select
    coalesce((value ->> 'arrival_margin_min')::int, 10)  as m_arr,
    coalesce((value ->> 'departure_delay_min')::int, 10) as m_dep,
    coalesce((value ->> 'travel_minutes')::int, 15)      as m_trv
  from app_settings where key = 'trip_margins_default'
),
deja_applique as (
  select exists (
    select 1 from supabase_migrations.schema_migrations where version = '0026'
  ) as oui
),
recalcul as (
  select
    t.id,
    t.activity_id,
    t.direction,
    case t.direction
      when 'aller' then t.scheduled_at
        - make_interval(mins =>
            coalesce(a.arrival_margin_min, d.m_arr)
            + coalesce(a.travel_minutes, d.m_trv))
      else t.scheduled_at
        + make_interval(mins => coalesce(a.departure_delay_min, d.m_dep))
    end as nouvelle_heure
  from trips t
  join activities a on a.id = t.activity_id
  cross join defauts d
  cross join deja_applique q
  where q.oui = false
    and t.scheduled_at > now()
    and t.status <> 'annule'
    and t.driver_id is null
    and not exists (
      select 1 from trip_requests r
      where r.trip_id = t.id and r.status = 'accepte'
    )
)
update trips t
   set scheduled_at = r.nouvelle_heure
  from recalcul r
 where t.id = r.id
   and r.nouvelle_heure is distinct from t.scheduled_at
   and not exists (
     select 1 from trips x
      where x.activity_id = r.activity_id
        and x.direction = r.direction
        and x.scheduled_at = r.nouvelle_heure
        and x.id <> t.id
   );

-- Vérification après application :
--   select a.label, t.direction,
--          a.starts_at at time zone 'Europe/Brussels' as creneau_reference,
--          t.scheduled_at at time zone 'Europe/Brussels' as depart_trajet
--     from trips t join activities a on a.id = t.activity_id
--    where t.scheduled_at > now() order by t.scheduled_at limit 10;
--   → pour un aller, le départ précède l'heure de début de l'activité.
