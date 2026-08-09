-- =====================================================================
-- 0014 — Sécurité enfant (étape 8) : Meeting Points, bulletin de
-- trajet, fenêtre de confiance (Doc1 §12 et §13)
--
-- Trois tables du schéma initial avaient la RLS activée sans aucune
-- policy (deny by default, tables muettes) : meeting_points,
-- trip_dropoff_confirmations, hub_bridges. Chacune reçoit ici ses
-- policies pour les opérations réellement utilisées — et rien de plus.
--
-- Cloisonnement (§12.4) :
--   - le parent voit le statut de dépôt de SES enfants uniquement ;
--   - le conducteur voit les enfants à bord de SES trajets uniquement ;
--   - aucun prénom d'enfant ne transite par le hub.
-- =====================================================================

-- --- paramètre de relance (jamais une constante) ----------------------

insert into app_settings (key, value, description) values
  ('dropoff_reminder_minutes', '20',
   'Délai en minutes après scheduled_at sans confirmation de dépôt '
   'avant relance du conducteur (Doc1 §12.2)')
on conflict (key) do nothing;

-- =====================================================================
-- 1. MEETING POINTS (Doc1 §12.1)
-- =====================================================================

-- Lecture : tout membre validé du hub. La table ne contient aucune
-- donnée personnelle (un lieu public, pas un domicile) : une policy
-- select suffit, pas besoin de fonction à colonnes choisies.
drop policy if exists meeting_points_member_select on meeting_points;
create policy meeting_points_member_select on meeting_points for select
  using (hub_id in (select auth_hub_ids()));

-- Écriture : admins du hub uniquement.
drop policy if exists meeting_points_admin_insert on meeting_points;
create policy meeting_points_admin_insert on meeting_points for insert
  with check (hub_id in (select auth_hub_admin_ids()));

drop policy if exists meeting_points_admin_update on meeting_points;
create policy meeting_points_admin_update on meeting_points for update
  using (hub_id in (select auth_hub_admin_ids()))
  with check (hub_id in (select auth_hub_admin_ids()));

drop policy if exists meeting_points_admin_delete on meeting_points;
create policy meeting_points_admin_delete on meeting_points for delete
  using (hub_id in (select auth_hub_admin_ids()));

-- Un seul point par défaut par hub, garanti par la base.
create unique index if not exists meeting_points_one_default_per_hub
  on meeting_points (hub_id) where is_default;

-- Bascule du point par défaut en une transaction. SECURITY INVOKER
-- volontaire : la RLS ci-dessus s'applique, seuls les admins du hub
-- peuvent donc réellement modifier les lignes.
create or replace function meeting_point_set_default(p_meeting_point uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_hub uuid;
begin
  select hub_id into v_hub from meeting_points where id = p_meeting_point;
  if v_hub is null then
    raise exception 'Point de rendez-vous introuvable.';
  end if;
  if v_hub not in (select auth_hub_admin_ids()) then
    raise exception 'Réservé aux admins du hub.';
  end if;

  update meeting_points
     set is_default = false
   where hub_id = v_hub and is_default and id <> p_meeting_point;

  update meeting_points
     set is_default = true
   where id = p_meeting_point;
end;
$$;

comment on function meeting_point_set_default is
  'Définit le point de rendez-vous par défaut d un hub en une '
  'transaction (l index partiel interdit deux défauts simultanés). '
  'SECURITY INVOKER : la RLS admin de meeting_points fait autorité.';

-- Le meeting point choisi à la publication doit appartenir au hub du
-- trajet. Même pattern que trip_child_household_match (0006) : une
-- contrainte se resserre par fonction vérifiée, jamais par confiance
-- dans l'UI.
create or replace function trip_meeting_point_in_hub(p_mp uuid, p_hub uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_mp is null or exists (
    select 1 from meeting_points mp
    where mp.id = p_mp and mp.hub_id = p_hub
  );
$$;

alter table trips
  drop constraint if exists trips_meeting_point_in_hub;

alter table trips
  add constraint trips_meeting_point_in_hub
  check (trip_meeting_point_in_hub(meeting_point_id, hub_id));

-- --- photos des meeting points ---------------------------------------
-- Bucket PRIVÉ comme child-photos (0004) : pas de donnée enfant ici,
-- mais un bucket public exposerait les lieux de rendez-vous des hubs à
-- quiconque devine une URL. Chemin : {hub_id}/{meeting_point_id}.{ext},
-- affichage par URL signée de courte durée. La suppression du fichier
-- est explicite côté application (le cascade SQL ne touche pas Storage).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-point-photos',
  'meeting-point-photos',
  false,
  5242880, -- 5 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists meeting_point_photos_select on storage.objects;
create policy meeting_point_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-point-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_hub_ids() as h
    )
  );

drop policy if exists meeting_point_photos_insert on storage.objects;
create policy meeting_point_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-point-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_hub_admin_ids() as h
    )
  );

drop policy if exists meeting_point_photos_update on storage.objects;
create policy meeting_point_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meeting-point-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_hub_admin_ids() as h
    )
  )
  with check (
    bucket_id = 'meeting-point-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_hub_admin_ids() as h
    )
  );

drop policy if exists meeting_point_photos_delete on storage.objects;
create policy meeting_point_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meeting-point-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_hub_admin_ids() as h
    )
  );

-- =====================================================================
-- 2. BULLETIN DE TRAJET (Doc1 §12.2)
-- =====================================================================

-- Insert : le CONDUCTEUR du trajet uniquement, en son nom, et seulement
-- pour un enfant réellement à bord. Les sous-requêtes passent par la
-- RLS de l'appelant : trips et trip_children sont visibles car le
-- trajet appartient à son foyer (trips_household_all, 0006).
drop policy if exists dropoff_driver_insert on trip_dropoff_confirmations;
create policy dropoff_driver_insert on trip_dropoff_confirmations for insert
  with check (
    confirmed_by = auth.uid()
    and exists (
      select 1 from trips t
      where t.id = trip_id and t.driver_id = auth.uid()
    )
    and exists (
      select 1 from trip_children tc
      where tc.trip_id = trip_dropoff_confirmations.trip_id
        and tc.child_id = trip_dropoff_confirmations.child_id
    )
  );

-- Select, deux chemins et pas un de plus (cloisonnement §12.4) :
--   - le parent, pour SES enfants (children passe par la RLS foyer) ;
--   - le conducteur, pour SES trajets.
-- Aucun chemin hub : personne d'autre ne voit ces lignes.
drop policy if exists dropoff_parent_or_driver_select on trip_dropoff_confirmations;
create policy dropoff_parent_or_driver_select on trip_dropoff_confirmations for select
  using (
    exists (
      select 1 from children c
      where c.id = child_id
        and c.household_id in (select auth_household_ids())
    )
    or exists (
      select 1 from trips t
      where t.id = trip_id and t.driver_id = auth.uid()
    )
  );

-- Delete : l'auteur peut annuler une confirmation erronée (mauvais
-- clic). Pas de policy update : une confirmation ne se modifie pas,
-- elle s'annule et se refait.
drop policy if exists dropoff_author_delete on trip_dropoff_confirmations;
create policy dropoff_author_delete on trip_dropoff_confirmations for delete
  using (confirmed_by = auth.uid());

-- Enfants à bord d'un trajet, avec prénom, pour le CONDUCTEUR seul.
-- ÉLARGISSEMENT ASSUMÉ et borné : le conducteur transporte physiquement
-- ces enfants, il doit pouvoir les identifier pour confirmer chaque
-- dépôt (Doc1 §12.2). Le prénom d'un enfant d'un autre foyer ne sort
-- par AUCUN autre chemin : jamais dans hub_trips_view, jamais côté
-- demandes, jamais pour le reste du foyer conducteur.
create or replace function trip_children_aboard(p_trip uuid)
returns table (child_id uuid, first_name text, is_own_child boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t trips%rowtype;
begin
  select * into t from trips where id = p_trip;
  if not found then
    return;
  end if;

  if t.driver_id is null or t.driver_id <> auth.uid() then
    raise exception 'Réservé au conducteur du trajet.';
  end if;

  return query
  select c.id, c.first_name, c.household_id = t.household_id
  from trip_children tc
  join children c on c.id = tc.child_id
  where tc.trip_id = p_trip;
end;
$$;

comment on function trip_children_aboard is
  'Prénoms des enfants à bord, réservé au conducteur du trajet pour le '
  'bulletin de dépôt (Doc1 §12.2). Seul chemin par lequel le prénom '
  'd un enfant d un autre foyer atteint le conducteur.';

revoke execute on function trip_children_aboard(uuid) from public;
revoke execute on function trip_children_aboard(uuid) from anon;
grant execute on function trip_children_aboard(uuid) to authenticated;

-- =====================================================================
-- 3. FENÊTRE DE CONFIANCE (Doc1 §12.3)
-- =====================================================================

-- Vrai si ces deux foyers (demandeur et conducteur) n'ont encore jamais
-- partagé de trajet, dans un sens comme dans l'autre. Sert uniquement à
-- afficher un rappel de contact préalable : aucune messagerie, aucun
-- blocage, aucune automatisation — le conducteur reste seul à décider.
create or replace function trip_request_first_contact(p_request uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req  trip_requests%rowtype;
  trip trips%rowtype;
begin
  select * into req from trip_requests where id = p_request;
  if not found then
    raise exception 'Demande introuvable.';
  end if;

  select * into trip from trips where id = req.trip_id;

  -- Réservé au foyer conducteur : c'est lui qui accepte, c'est à lui
  -- que le rappel s'adresse.
  if not exists (
    select 1 from household_members hm
    where hm.household_id = trip.household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'Réservé au foyer conducteur du trajet.';
  end if;

  return not exists (
    select 1
    from trip_requests tr
    join trips t2 on t2.id = tr.trip_id
    where tr.id <> p_request
      and tr.status = 'accepte'
      and (
        (tr.requester_household_id = req.requester_household_id
         and t2.household_id = trip.household_id)
        or
        (tr.requester_household_id = trip.household_id
         and t2.household_id = req.requester_household_id)
      )
  );
end;
$$;

comment on function trip_request_first_contact is
  'Fenêtre de confiance (Doc1 §12.3) : vrai si les foyers demandeur et '
  'conducteur n ont jamais eu de demande acceptée entre eux. Déclenche '
  'un rappel de contact préalable dans l UI, rien d autre.';

revoke execute on function trip_request_first_contact(uuid) from public;
revoke execute on function trip_request_first_contact(uuid) from anon;
grant execute on function trip_request_first_contact(uuid) to authenticated;

-- =====================================================================
-- 4. HUB_BRIDGES (Doc1 §9.1) — policies minimales
-- =====================================================================

-- Lecture : membres validés d'un des deux hubs du pont. AUCUNE policy
-- d'écriture, délibérément : la création et l'activation d'un pont
-- relèvent d'un processus non construit à ce stade (étape ultérieure,
-- passage Concierge probable). Deny by default assumé et documenté —
-- ne pas ajouter de policy insert/update/delete sans arbitrage.
drop policy if exists hub_bridges_member_select on hub_bridges;
create policy hub_bridges_member_select on hub_bridges for select
  using (
    source_hub_id in (select auth_hub_ids())
    or target_hub_id in (select auth_hub_ids())
  );
