-- =====================================================================
-- 0006 — trip_children : policy manquante + cohérence enfant/foyer
--
-- RLS est activée sur trip_children depuis 0001 (deny by default) mais
-- aucune policy n'avait été écrite : la table était inaccessible.
-- Accès limité aux trajets du/des foyer(s) de l'utilisateur. La
-- sous-requête sur trips passe elle-même par la RLS de trips
-- (trips_household_all) : pas de récursion, trip_children n'est jamais
-- interrogée par sa propre policy.
-- =====================================================================

drop policy if exists trip_children_household_all on trip_children;
create policy trip_children_household_all on trip_children for all
  using (exists (
    select 1 from trips t
    where t.id = trip_children.trip_id
      and t.household_id in (select auth_household_ids())
  ))
  with check (exists (
    select 1 from trips t
    where t.id = trip_children.trip_id
      and t.household_id in (select auth_household_ids())
  ));

-- Cohérence enfant/foyer : même problème que sur activities (0005).
-- La policy vérifie l'appartenance au foyer du trajet, mais un
-- child_id d'un autre foyer resterait insérable si son UUID est connu.
create or replace function trip_child_household_match(p_trip uuid, p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from trips t
    join children c on c.id = p_child
    where t.id = p_trip
      and c.household_id = t.household_id
  );
$$;

alter table trip_children
  drop constraint if exists trip_children_household_match;

alter table trip_children
  add constraint trip_children_household_match
  check (trip_child_household_match(trip_id, child_id));
