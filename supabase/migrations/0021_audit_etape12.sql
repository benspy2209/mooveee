-- 0021 — Audit sécurité étape 12 : durcissements issus de l'inventaire
-- complet (RLS, fonctions, effacement RGPD). Doc v4 §11.
--
-- Constats corrigés ici :
--   a) la plupart des fonctions public étaient exécutables par anon
--      (dont hub_for_join_code : sondage de codes d'adhésion sans compte) ;
--   b) trips.private_note restait lisible par un membre du hub via un
--      select direct (une RLS filtre les lignes, pas les colonnes) —
--      dette documentée depuis l'étape 5 ; 0 note en base, déplacement
--      sans migration de données ;
--   c) deux demandes acceptées pouvaient coexister pour le même enfant
--      sur le même trajet (l'index unique ne couvrait que en_attente) ;
--   d) aucune fonction d'effacement : households.created_by,
--      hubs.owner_id, trips.driver_id et consorts sont en NO ACTION,
--      la suppression d'un compte était structurellement impossible.

-- ---------------------------------------------------------------------------
-- 1. Hygiène des rôles : anon n'exécute RIEN dans public.
--    L'app appelle toujours en authenticated ; PostgREST n'a aucune
--    raison d'exposer quoi que ce soit à anon.
-- ---------------------------------------------------------------------------

-- Leçon : anon hérite d'EXECUTE via le grant implicite à PUBLIC posé à
-- la création de chaque fonction. Révoquer anon seul ne retire rien :
-- il faut révoquer PUBLIC, puis re-granter explicitement authenticated
-- sur le set légitime (policies, contraintes check, RPC, vue hub).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public', f.sig);
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
end $$;

grant execute on function accept_trip_request(uuid) to authenticated;
grant execute on function auth_household_ids() to authenticated;
grant execute on function auth_admin_household_ids() to authenticated;
grant execute on function auth_household_member_ids() to authenticated;
grant execute on function auth_hub_ids() to authenticated;
grant execute on function auth_hub_admin_ids() to authenticated;
grant execute on function auth_hub_member_user_ids() to authenticated;
grant execute on function child_belongs_to_household(uuid, uuid) to authenticated;
grant execute on function trip_child_household_match(uuid, uuid) to authenticated;
grant execute on function trip_child_hub_request_accepted(uuid, uuid) to authenticated;
grant execute on function trip_meeting_point_in_hub(uuid, uuid) to authenticated;
grant execute on function hub_for_join_code(text) to authenticated;
grant execute on function hub_member_profiles(uuid) to authenticated;
grant execute on function hub_user_first_name(uuid) to authenticated;
grant execute on function hub_trip_children_count(uuid) to authenticated;
grant execute on function hub_trip_matching_needs_count(uuid) to authenticated;
grant execute on function trip_children_aboard(uuid) to authenticated;
grant execute on function trip_request_first_contact(uuid) to authenticated;
grant execute on function meeting_point_set_default(uuid) to authenticated;
grant execute on function trip_labels_similar(text, text) to authenticated;

-- Les futures fonctions ne seront exécutables ni par PUBLIC ni par anon
-- par défaut : chaque nouveau point d'entrée devra être granté exprès.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- 2. Notes privées : table dédiée au foyer, colonne retirée de trips.
--    Résout la dette « private_note lisible côté hub ». La vue
--    hub_trips_view ne l'exposait pas ; le front ne la lisait pas encore ;
--    0 donnée existante (vérifié avant migration).
-- ---------------------------------------------------------------------------

create table if not exists trip_private_notes (
  trip_id      uuid primary key references trips(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  note         text not null,
  updated_at   timestamptz not null default now()
);

comment on table trip_private_notes is
  'Notes privees d''un trajet, visibles du seul foyer. Table separee de '
  'trips : la policy hub de trips lit des LIGNES entieres, une note '
  'privee ne doit jamais y habiter (audit etape 12).';

alter table trip_private_notes enable row level security;

drop policy if exists trip_private_notes_household_all on trip_private_notes;
create policy trip_private_notes_household_all on trip_private_notes
  for all to authenticated
  using (household_id in (select auth_household_ids()))
  with check (
    household_id in (select auth_household_ids())
    and exists (
      select 1 from trips t
      where t.id = trip_id and t.household_id = trip_private_notes.household_id
    )
  );

alter table trips drop column if exists private_note;

-- ---------------------------------------------------------------------------
-- 3. Une seule acceptation par enfant et par trajet.
-- ---------------------------------------------------------------------------

-- Purge préalable : des doublons acceptés existaient déjà (constatés à
-- l'application). On garde la plus ancienne acceptation, les autres
-- passent en annule — sans effet de bord : places et Mooves sont gérés
-- par accept_trip_request de façon idempotente.
update trip_requests tr
   set status = 'annule'
 where tr.status = 'accepte'
   and exists (
     select 1 from trip_requests earlier
      where earlier.trip_id = tr.trip_id
        and earlier.child_id = tr.child_id
        and earlier.status = 'accepte'
        and (earlier.created_at < tr.created_at
             or (earlier.created_at = tr.created_at and earlier.id < tr.id))
   );

create unique index if not exists trip_requests_accepted_unique
  on trip_requests (trip_id, child_id)
  where status = 'accepte';

-- ---------------------------------------------------------------------------
-- 4. Effacement RGPD : erase_user(p_user) — droit à l'effacement sous
--    30 jours (Doc v4 §11.2). JAMAIS exposée aux clients : exécutée par
--    l'opérateur (dashboard / service role) après la procédure humaine.
--    Les objets Storage (photos enfants, photos meeting points) sont
--    supprimés côté application AVANT d'appeler cette fonction.
-- ---------------------------------------------------------------------------

create or replace function erase_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  v_other uuid;
begin
  -- 1. Détacher le conducteur des trajets d'autres foyers : l'attribution
  --    disparaît, le trajet redevient à couvrir.
  update trips
     set driver_id = null,
         status = 'non_couvert'
   where driver_id = p_user;

  -- 2. Registres portés par l'utilisateur (FK NO ACTION).
  delete from trip_dropoff_confirmations where confirmed_by = p_user;
  delete from household_invitations where invited_by = p_user;
  delete from institutional_messages where author_id = p_user;
  update solidarity_fund_grants set granted_by = null where granted_by = p_user;

  -- 3. Hubs possédés : transférer à un autre admin validé, sinon à un
  --    autre membre validé, sinon dissoudre le hub (dépublication des
  --    trajets et activités rattachés, puis suppression).
  for h in select id from hubs where owner_id = p_user loop
    select hm.user_id into v_other
      from hub_members hm
     where hm.hub_id = h.id and hm.user_id <> p_user
       and hm.validated_at is not null
     order by hm.is_admin desc, hm.joined_at
     limit 1;

    if v_other is not null then
      update hubs set owner_id = v_other where id = h.id;
      update hub_members set is_admin = true
        where hub_id = h.id and user_id = v_other;
    else
      update trips set hub_id = null, published_to_hub = false
        where hub_id = h.id;
      update activities set hub_id = null where hub_id = h.id;
      delete from hubs where id = h.id;
    end if;
  end loop;

  -- 4. Foyers créés par l'utilisateur.
  for h in select household_id as id from household_members
            where user_id = p_user loop
    select hm.user_id into v_other
      from household_members hm
     where hm.household_id = h.id and hm.user_id <> p_user
     limit 1;

    if v_other is null then
      -- Seul membre : le foyer part avec lui (cascade : enfants,
      -- activités, trajets, demandes, messages).
      delete from households where id = h.id;
    else
      -- D'autres membres restent : le foyer survit, la référence
      -- created_by est repointée.
      update households set created_by = v_other
        where id = h.id and created_by = p_user;
    end if;
  end loop;

  -- Foyers créés mais quittés depuis longtemps : repointer aussi.
  update households hh
     set created_by = (
       select hm.user_id from household_members hm
        where hm.household_id = hh.id limit 1
     )
   where hh.created_by = p_user
     and exists (select 1 from household_members hm where hm.household_id = hh.id);
  delete from households where created_by = p_user;

  -- 5. Le compte : auth.users cascade vers public.users, qui cascade
  --    vers memberships, consentements, ledger et solde Mooves,
  --    préférences, signalements, adhésions hub.
  delete from auth.users where id = p_user;
end;
$$;

comment on function erase_user(uuid) is
  'Droit a l''effacement (Doc v4 §11.2). Detache le conducteur des '
  'trajets d''autres foyers, transfere ou dissout les hubs possedes, '
  'supprime le foyer si l''utilisateur en etait le seul membre, puis '
  'supprime le compte auth (cascades). Objets Storage a purger cote '
  'application AVANT l''appel. Executee par l''operateur uniquement.';

revoke execute on function erase_user(uuid)
  from public, anon, authenticated;
