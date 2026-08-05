-- =====================================================================
-- 0008 — Hubs : policies manquantes et helpers (étape 5, socle)
--
-- État avant cette migration :
--   hubs                 : select/update/insert OK (0001)
--   hub_members          : select + insert self (0001), mais AUCUNE
--                          policy update/delete → un admin ne peut ni
--                          valider ni refuser. L'insert self permettait
--                          en outre de s'auto-valider et de s'auto-
--                          promouvoir admin : verrouillé ici.
--   hub_pact_acceptances : RLS activée sans AUCUNE policy → table
--                          inaccessible.
--   users                : lisible entre co-membres de foyer (0003)
--                          mais pas entre co-membres de hub → la liste
--                          des membres d'un hub n'aurait aucun nom.
--
-- Helpers SECURITY DEFINER comme dans 0003 pour éviter toute récursion
-- de policy sur hub_members.
-- =====================================================================

-- --- helpers ---------------------------------------------------------

-- Hubs où l'utilisateur est admin validé.
create or replace function auth_hub_admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hub_id from hub_members
  where user_id = auth.uid() and is_admin and validated_at is not null;
$$;

-- Utilisateurs co-membres d'un de mes hubs (validés ou en attente :
-- un admin doit pouvoir afficher le nom d'un demandeur pour statuer).
create or replace function auth_hub_member_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.user_id
  from hub_members hm
  where hm.hub_id in (
    select hub_id from hub_members
    where user_id = auth.uid() and validated_at is not null
  );
$$;

-- Résolution d'un code d'adhésion. SECURITY DEFINER volontaire : un
-- non-membre ne peut rien lire de hubs via la RLS, mais quelqu'un qui
-- détient le code exact doit voir de quoi il s'agit avant d'adhérer.
-- N'expose que l'identité publique du hub, jamais ses membres.
create or replace function hub_for_join_code(p_code text)
returns table (id uuid, name text, kind hub_kind, municipality text)
language sql
stable
security definer
set search_path = public
as $$
  select h.id, h.name, h.kind, h.municipality
  from hubs h
  where h.join_code = upper(trim(p_code));
$$;

-- --- hub_members -----------------------------------------------------

-- Verrou : on ne s'insère soi-même que non validé et non admin, SAUF le
-- créateur du hub (bootstrap owner = premier membre validé admin).
-- La validation est un acte d'admin (update ci-dessous), jamais un
-- auto-service.
drop policy if exists hub_members_self_insert on hub_members;
create policy hub_members_self_insert on hub_members for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from hubs h
        where h.id = hub_members.hub_id and h.owner_id = auth.uid()
      )
      or (validated_at is null and is_admin = false)
    )
  );

drop policy if exists hub_members_admin_update on hub_members;
create policy hub_members_admin_update on hub_members for update
  using (hub_id in (select auth_hub_admin_ids()))
  with check (hub_id in (select auth_hub_admin_ids()));

-- Refus d'une demande = suppression de la ligne, par un admin.
drop policy if exists hub_members_admin_delete on hub_members;
create policy hub_members_admin_delete on hub_members for delete
  using (hub_id in (select auth_hub_admin_ids()));

-- --- hub_pact_acceptances --------------------------------------------

-- Chacun lit et enregistre ses propres acceptations, à condition
-- d'avoir une entrée hub_members (même non validée : le pacte
-- s'accepte à l'entrée). Personne ne modifie ni ne supprime une
-- acceptation : c'est un enregistrement de consentement.
drop policy if exists hub_pact_self_select on hub_pact_acceptances;
create policy hub_pact_self_select on hub_pact_acceptances for select
  using (user_id = auth.uid());

drop policy if exists hub_pact_self_insert on hub_pact_acceptances;
create policy hub_pact_self_insert on hub_pact_acceptances for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from hub_members hm
      where hm.hub_id = hub_pact_acceptances.hub_id
        and hm.user_id = auth.uid()
    )
  );

-- --- users -----------------------------------------------------------

-- Prénom/nom visibles entre co-membres de hub (liste des membres,
-- demandes à valider). Aucune autre colonne exposée par l'app côté hub.
drop policy if exists users_hub_select on users;
create policy users_hub_select on users for select
  using (id in (select auth_hub_member_user_ids()));
