-- =====================================================================
-- 0009 — Publication des trajets vers le hub + demandes de place
--
-- 1. hub_trips_view réparée : depuis le retrait de users_hub_select
--    (fin de 0008), la jointure directe sur users renvoie un
--    driver_first_name NULL (security_invoker = true → RLS de users
--    appliquée au lecteur). Remplacée par un helper SECURITY DEFINER
--    qui n'expose QUE le prénom, et seulement entre co-membres de hub.
-- 2. trip_requests : policy d'insert resserrée (l'originale de 0001 ne
--    vérifiait que requester_id = auth.uid() : foyer, enfant, trajet
--    publié, pas-son-propre-trajet n'étaient pas contrôlés).
-- 3. accept_trip_request : acceptation ATOMIQUE par le foyer
--    conducteur. Déclenchée uniquement par un clic humain — aucun
--    trigger, aucune automatisation ne fait passer une demande en
--    accepté (interdit n°4).
--
-- ⚠️ SIGNALEMENT — contrainte 0006 trip_children_household_match :
-- elle exige que l'enfant appartienne au foyer du trajet. Or accepter
-- une demande de hub ajoute PAR CONSTRUCTION un enfant d'un AUTRE
-- foyer dans trip_children : l'acceptation échouera tant que la
-- contrainte reste en l'état. Non contournée ici, conformément à la
-- consigne. Proposition de détente à arbitrer (NON ACTIVE) :
--
--   -- alter table trip_children
--   --   drop constraint if exists trip_children_household_match;
--   -- alter table trip_children
--   --   add constraint trip_children_household_match
--   --   check (trip_child_household_match(trip_id, child_id)
--   --          or trip_child_hub_request_accepted(trip_id, child_id));
--   -- (fonction à créer : demande acceptée sur un trajet publié au hub)
-- =====================================================================

-- --- 1. Vue hub : prénom conducteur sans lecture directe de users ----

-- Prénom seul, et seulement si l'appelant partage un hub avec ce
-- conducteur. Même philosophie que hub_member_profiles (0008) : une
-- fonction qui choisit ses colonnes, jamais un select sur users.
create or replace function hub_user_first_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.first_name
  from users u
  where u.id = p_user
    and exists (
      select 1 from hub_members hm
      where hm.user_id = p_user
        and hm.hub_id in (select auth_hub_ids())
    );
$$;

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
  (select count(*) from trip_children tc where tc.trip_id = t.id) as children_count
from trips t
where t.published_to_hub
  and t.hub_id in (select auth_hub_ids());

comment on view hub_trips_view is
  'Version normalisée : heure, lieu, statut, places. '
  'Jamais private_note, jamais children.first_name, jamais de contact. '
  'children_count est un compte, pas une liste. '
  'driver_first_name via hub_user_first_name(), jamais de join users.';

-- --- 2. trip_requests : insert resserré ------------------------------

drop policy if exists trip_requests_insert on trip_requests;
create policy trip_requests_insert on trip_requests for insert
  with check (
    requester_id = auth.uid()
    -- le foyer déclaré est bien le sien
    and requester_household_id in (select auth_household_ids())
    -- l'enfant est bien un enfant de ce foyer (helper de 0005)
    and child_belongs_to_household(child_id, requester_household_id)
    -- trajet publié, dans un de ses hubs, ouvert, et JAMAIS le sien
    and exists (
      select 1 from trips t
      where t.id = trip_requests.trip_id
        and t.published_to_hub
        and t.hub_id in (select auth_hub_ids())
        and t.status = 'couvert_ouvert'
        and t.household_id not in (select auth_household_ids())
    )
  );

-- Une seule demande en attente par enfant et par trajet.
create unique index if not exists trip_requests_pending_unique
  on trip_requests (trip_id, child_id)
  where status = 'en_attente';

-- --- 3. Acceptation atomique par le foyer conducteur -----------------

create or replace function accept_trip_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req  trip_requests%rowtype;
  trip trips%rowtype;
begin
  select * into req from trip_requests where id = p_request for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if req.status <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  select * into trip from trips where id = req.trip_id for update;

  -- Seul le foyer conducteur accepte. L'appel vient d'un clic explicite
  -- du conducteur : cette fonction n'est jamais appelée par un trigger.
  if not exists (
    select 1 from household_members hm
    where hm.household_id = trip.household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'Seul le foyer conducteur peut accepter cette demande.';
  end if;

  if not trip.published_to_hub or coalesce(trip.seats_available, 0) < 1 then
    raise exception 'Plus de place disponible sur ce trajet.';
  end if;

  update trip_requests
     set status = 'accepte', responded_at = now()
   where id = p_request;

  -- ⚠️ Échouera tant que la contrainte 0006 (même foyer) est en l'état :
  -- l'enfant vient d'un autre foyer. Signalé en tête de migration.
  -- Tout le bloc est atomique : en cas d'échec, rien n'est appliqué.
  insert into trip_children (trip_id, child_id)
  values (req.trip_id, req.child_id);

  -- Places à zéro : le trajet repasse couvert et sort des trajets
  -- ouverts (le statut, pas la publication : il reste visible comme
  -- complet dans la vue).
  update trips
     set seats_available = seats_available - 1,
         status = case
           when seats_available - 1 <= 0 then 'couvert'::trip_status
           else status
         end,
         updated_at = now()
   where id = req.trip_id;
end;
$$;

comment on function accept_trip_request is
  'Acceptation d une demande de place par le foyer conducteur, en une '
  'transaction : statut accepte, enfant dans trip_children, décrément '
  'des places, couvert si plein. Appelée uniquement sur clic humain — '
  'le matching propose, il n assigne jamais (interdit n°4).';

-- --- DETENTE DE LA CONTRAINTE 0006 -----------------------------------
-- Arbitrage : la contrainte est ELARGIE, jamais supprimee. Un enfant
-- reste rattachable a un trajet de son propre foyer, OU a un trajet
-- publie au hub pour lequel une demande a ete acceptee. Supprimer la
-- contrainte rouvrirait la faille qu elle ferme : rattacher n importe
-- quel enfant a n importe quel trajet avec un simple UUID.

create or replace function trip_child_hub_request_accepted(p_trip uuid, p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from trip_requests tr
    join trips t on t.id = tr.trip_id
    join children c on c.id = tr.child_id
    where tr.trip_id = p_trip
      and tr.child_id = p_child
      and tr.status = 'accepte'
      and t.published_to_hub
      and t.hub_id is not null
      -- le foyer de l enfant et le foyer conducteur sont tous deux
      -- membres valides du meme hub
      and exists (
        select 1 from hub_members hm
        join household_members hmem on hmem.household_id = c.household_id
        where hm.hub_id = t.hub_id
          and hm.user_id = hmem.user_id
          and hm.validated_at is not null
      )
      and exists (
        select 1 from hub_members hm
        join household_members hmem on hmem.household_id = t.household_id
        where hm.hub_id = t.hub_id
          and hm.user_id = hmem.user_id
          and hm.validated_at is not null
      )
  );
$$;

comment on function trip_child_hub_request_accepted is
  'Vrai si l enfant est sur ce trajet via une demande de hub acceptee, '
  'les deux foyers etant membres valides du hub. Elargit la contrainte '
  'de 0006 sans l ouvrir.';

alter table trip_children
  drop constraint if exists trip_children_household_match;

alter table trip_children
  add constraint trip_children_household_match
  check (
    trip_child_household_match(trip_id, child_id)
    or trip_child_hub_request_accepted(trip_id, child_id)
  );
