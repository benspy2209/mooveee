-- 0024 — Retrait de trips_hub_select (rétro cadrage du 11/10/2026, trou B.2)
--
-- Constat : la policy trips_hub_select exposait la LIGNE ENTIÈRE de trips
-- aux membres validés du hub (une RLS filtre des lignes, jamais des
-- colonnes). La règle « jamais de select direct sur trips côté hub »
-- n'était tenue que par discipline de code.
--
-- Correctif : hub_trips_view devient la seule porte vers les trajets des
-- autres foyers. La vue est recréée SANS security_invoker : elle s'exécute
-- avec les droits de son propriétaire (postgres, propriétaire de trips,
-- donc hors RLS), choisit ses colonnes et porte elle-même le filtre
-- d'appartenance (published_to_hub + hub_id in auth_hub_ids()). Même
-- pattern que hub_member_profiles : une fonction ou vue definer qui
-- choisit ses colonnes, jamais une policy select.
--
-- Dépendance à migrer : la policy trip_requests_insert vérifiait le
-- trajet par un sous-select sur trips, exécuté avec les droits de
-- l'appelant (le demandeur). Sans trips_hub_select ce sous-select ne
-- verrait plus rien et toute demande de place échouerait. Le contrôle
-- passe donc par une fonction security definer dédiée.
--
-- Idempotente. Aucun changement de colonnes : types database.ts inchangés.
-- À appliquer par Ben. Vérification en fin de fichier.

begin;

-- 1. Contrôle « trajet ouvert dans un de mes hubs, pas le mien »,
--    hors RLS, réservé à authenticated.
create or replace function trip_open_in_my_hubs(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    where t.id = p_trip
      and t.published_to_hub
      and t.status = 'couvert_ouvert'
      and t.hub_id in (select auth_hub_ids())
      and t.household_id not in (select auth_household_ids())
  );
$$;

comment on function trip_open_in_my_hubs(uuid) is
  'Vrai si le trajet est publié, ouvert, dans un hub dont l appelant est '
  'membre validé, et n appartient pas à son foyer. Remplace le sous-select '
  'sur trips de trip_requests_insert depuis le retrait de trips_hub_select.';

revoke execute on function trip_open_in_my_hubs(uuid) from public, anon;
grant execute on function trip_open_in_my_hubs(uuid) to authenticated;

-- 2. Policy d'insertion des demandes : mêmes règles qu'en 0009, le
--    contrôle du trajet passe par la fonction.
drop policy if exists trip_requests_insert on trip_requests;
create policy trip_requests_insert on trip_requests for insert
  with check (
    requester_id = auth.uid()
    and requester_household_id in (select auth_household_ids())
    and child_belongs_to_household(child_id, requester_household_id)
    and trip_open_in_my_hubs(trip_id)
  );

-- 3. Fin de l'exposition de la ligne entière.
drop policy if exists trips_hub_select on trips;

-- 4. Vue recréée sans security_invoker. Colonnes identiques à 0019.
drop view if exists hub_trips_view;
create view hub_trips_view
with (security_invoker = false)
as
select
  t.id,
  t.hub_id,
  t.direction,
  t.status,
  t.scheduled_at,
  t.origin_label,
  t.destination_label,
  t.destination_place_id,
  t.meeting_point_id,
  t.seats_available,
  t.driver_id,
  hub_user_first_name(t.driver_id) as driver_first_name,
  hub_trip_children_count(t.id) as children_count
from trips t
where t.published_to_hub
  and t.hub_id in (select auth_hub_ids());

comment on view hub_trips_view is
  'SEULE porte vers les trajets des autres foyers (interdit n°9). '
  'Vue sans security_invoker : exécutée avec les droits du propriétaire, '
  'elle choisit ses colonnes et porte le filtre d appartenance au hub. '
  'Jamais private_note (table séparée), jamais children.first_name, '
  'jamais de contact, jamais household_id. children_count est un compte.';

revoke all on hub_trips_view from public, anon;
grant select on hub_trips_view to authenticated;

commit;

-- Vérification après application (à lancer en SQL) :
--   select polname from pg_policy where polrelid = 'trips'::regclass;
--     -> trips_household_all seulement
--   select relrowsecurity from pg_class where relname = 'trips'; -> true
--   select has_function_privilege('anon', 'trip_open_in_my_hubs(uuid)', 'execute');
--     -> false
--   select has_table_privilege('anon', 'hub_trips_view', 'select'); -> false
--   Connecté en membre d'un hub : select * from hub_trips_view renvoie les
--   trajets publiés des autres foyers ; select * from trips where
--   household_id <> <mon foyer> renvoie 0 ligne ; une demande de place
--   (insert trip_requests) sur un trajet ouvert d'un autre foyer passe,
--   sur son propre trajet échoue (42501).
