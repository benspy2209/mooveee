-- 0023 — Étape 10 : métriques institutionnelles (Doc v4 §10).
--
-- Le volume détermine le PALIER (tier essentiel / pro / reseau) facturé
-- en abonnement fixe périodique. Il ne génère JAMAIS une ligne de
-- facture proportionnelle : aucune logique de facturation ici, seulement
-- la collecte mensuelle (interdit absolu n°3).
--
-- Les 4 tables institutionnelles restent muettes côté client : aucune
-- institution n'a de compte à ce stade, le porteur lit via le dashboard.
-- Les vues agrégées destinées aux institutions viendront avec leurs
-- accès — toujours anonymisées, jamais nominatives.

-- Upserts mensuels : une ligne par institution/hub et par mois.
create unique index if not exists institution_usage_metrics_period_unique
  on institution_usage_metrics (institution_id, period_month);

create unique index if not exists impact_snapshots_period_unique
  on impact_snapshots (hub_id, period_month);

-- ---------------------------------------------------------------------------
-- 1. Métriques d'usage par institution
-- ---------------------------------------------------------------------------

create or replace function compute_institution_metrics(
  p_month date default date_trunc('month', now())::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz := p_month;
  v_to   timestamptz := p_month + interval '1 month';
  v_count integer;
begin
  insert into institution_usage_metrics
    (institution_id, period_month, active_families, hubs_count, trips_volume,
     features_enabled, computed_at)
  select
    i.id,
    p_month,
    -- Familles actives : foyers membres validés d'un hub de
    -- l'institution avec au moins un trajet planifié sur le mois.
    (select count(distinct hm.household_id)
       from hub_members hm
       join hubs h on h.id = hm.hub_id and h.institution_id = i.id
      where hm.validated_at is not null
        and exists (
          select 1 from trips t
           where t.household_id = hm.household_id
             and t.scheduled_at >= v_from and t.scheduled_at < v_to
        )),
    (select count(*) from hubs h where h.institution_id = i.id),
    -- Volume : métrique INTERNE de détermination du palier, jamais une
    -- base de facturation directe.
    (select count(*)
       from trips t
       join hubs h on h.id = t.hub_id
      where h.institution_id = i.id
        and t.published_to_hub
        and t.scheduled_at >= v_from and t.scheduled_at < v_to),
    '{}'::jsonb,
    now()
  from institutions i
  on conflict (institution_id, period_month) do update
    set active_families = excluded.active_families,
        hubs_count      = excluded.hubs_count,
        trips_volume    = excluded.trips_volume,
        computed_at     = excluded.computed_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function compute_institution_metrics(date) is
  'Collecte mensuelle par institution (Doc v4 §10) : familles actives, '
  'hubs, volume. Determine le palier d''abonnement — ne facture rien, '
  'jamais de ligne « X trajets x Y euros ».';

revoke execute on function compute_institution_metrics(date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Instantanés d'impact anonymisés, gardés par le seuil de
--    réidentification (AIPD §5.4) : AUCUN agrégat sous
--    app_settings.reidentification_min_families.
-- ---------------------------------------------------------------------------

create or replace function compute_impact_snapshots(
  p_month date default date_trunc('month', now())::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz := p_month;
  v_to   timestamptz := p_month + interval '1 month';
  v_min  integer;
  v_count integer;
begin
  select (value #>> '{}')::integer into v_min
    from app_settings where key = 'reidentification_min_families';
  if v_min is null then
    raise exception 'reidentification_min_families absent de app_settings — aucun agregat genere';
  end if;

  insert into impact_snapshots
    (hub_id, municipality, period_month, families_count, trips_shared, computed_at)
  select
    h.id,
    h.municipality,
    p_month,
    agg.families_count,
    agg.trips_shared,
    now()
  from hubs h
  cross join lateral (
    select
      (select count(distinct hm.household_id)
         from hub_members hm
        where hm.hub_id = h.id and hm.validated_at is not null) as families_count,
      -- Trajet « partagé » : publié au hub, sur le mois, avec au moins
      -- une demande acceptée (un enfant d'un autre foyer à bord).
      (select count(distinct t.id)
         from trips t
         join trip_requests tr on tr.trip_id = t.id and tr.status = 'accepte'
        where t.hub_id = h.id
          and t.scheduled_at >= v_from and t.scheduled_at < v_to) as trips_shared
  ) agg
  where agg.families_count >= v_min
  on conflict (hub_id, period_month) do update
    set families_count = excluded.families_count,
        trips_shared   = excluded.trips_shared,
        municipality   = excluded.municipality,
        computed_at    = excluded.computed_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function compute_impact_snapshots(date) is
  'Agregats anonymes par hub et par mois, generes UNIQUEMENT au-dela du '
  'seuil de reidentification (app_settings.reidentification_min_families, '
  'AIPD §5.4). km_saved/co2_saved_kg restent null tant que la distance '
  'des trajets n''est pas tranchee (dette distance_km).';

revoke execute on function compute_impact_snapshots(date)
  from public, anon, authenticated;

grant execute on function compute_institution_metrics(date) to service_role;
grant execute on function compute_impact_snapshots(date) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Planification mensuelle (le 1er à 03h30), pg_cron si disponible.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible : lancer compute_institution_metrics() et compute_impact_snapshots() manuellement chaque mois.';
    return;
  end;

  perform cron.schedule(
    'institution-metrics-monthly',
    '30 3 1 * *',
    'select compute_institution_metrics((date_trunc(''month'', now()) - interval ''1 month'')::date); select compute_impact_snapshots((date_trunc(''month'', now()) - interval ''1 month'')::date);'
  );
exception when others then
  raise notice 'Planification pg_cron impossible (%) : lancer les calculs manuellement.', sqlerrm;
end $$;
