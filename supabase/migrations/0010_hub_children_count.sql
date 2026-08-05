-- =====================================================================
-- 0010 — children_count correct dans hub_trips_view
--
-- hub_trips_view est en security_invoker : le count sur trip_children
-- s executait avec les droits de l appelant, qui ne voit que les
-- lignes de son propre foyer (trip_children_household_all). Un membre
-- du hub voyait donc systematiquement 0 enfant a bord.
--
-- Corrige par une fonction security definer plutot que par un
-- elargissement de la policy : un COMPTE n expose aucune identite,
-- alors qu ouvrir trip_children au hub exposerait les child_id.
-- =====================================================================

create or replace function hub_trip_children_count(p_trip uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from trip_children tc
  join trips t on t.id = tc.trip_id
  where tc.trip_id = p_trip
    and t.published_to_hub
    and t.hub_id in (select auth_hub_ids());
$$;

comment on function hub_trip_children_count is
  'Nombre d enfants a bord d un trajet publie, pour les membres valides '
  'du hub. Renvoie un COMPTE, jamais une liste : aucun child_id ni '
  'prenom ne sort par ce chemin (interdit n 9).';

drop view if exists hub_trips_view;

create view hub_trips_view
with (security_invoker = true)
as
select
  t.id,
  t.hub_id,
  t.direction,
  t.status,
  t.scheduled_at,
  t.origin_label,
  t.destination_label,
  t.meeting_point_id,
  t.seats_available,
  t.driver_id,
  hub_user_first_name(t.driver_id) as driver_first_name,
  hub_trip_children_count(t.id) as children_count
from trips t
where t.published_to_hub
  and t.hub_id in (select auth_hub_ids());

comment on view hub_trips_view is
  'Version normalisee : heure, lieu, statut, places. '
  'Jamais private_note, jamais children.first_name, jamais de contact. '
  'children_count est un compte, pas une liste. '
  'driver_first_name et children_count via fonctions security definer, '
  'jamais de join direct sur users ou trip_children.';
