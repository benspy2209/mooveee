-- =====================================================================
-- MOOVEEE — Migration 0003 — Écran Mon Foyer
--
-- 1. Correction de la récursion de policy sur household_members :
--    hm_admin_write interrogeait household_members dans sa propre
--    policy, ce que les Instructions interdisent (helpers obligatoires).
-- 2. Policies manquantes pour le parcours de création de foyer :
--    relecture du foyer par son créateur, insertion du premier membre.
-- 3. Lecture des profils des co-membres du foyer (prénom, nom).
-- 4. Table household_invitations : invitation simple d'un autre adulte
--    responsable par email. Une entrée en attente suffit à ce stade,
--    le parcours d'acceptation viendra dans une étape ultérieure.
--
-- Idempotente : rejouable sans erreur.
-- =====================================================================

begin;

-- =====================================================================
-- 1. HELPERS RLS SUPPLÉMENTAIRES
-- SECURITY DEFINER pour éviter la récursion de policies, comme
-- auth_household_ids() et auth_hub_ids() (migration 0001 §8).
-- =====================================================================

-- Foyers dont l'utilisateur courant est admin.
create or replace function auth_admin_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members
  where user_id = auth.uid() and is_admin;
$$;

-- Utilisateurs membres d'un des foyers de l'utilisateur courant
-- (lui-même inclus).
create or replace function auth_household_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.user_id from household_members hm
  where hm.household_id in (
    select household_id from household_members where user_id = auth.uid()
  );
$$;

-- =====================================================================
-- 2. CORRECTION RÉCURSION household_members
-- =====================================================================

drop policy if exists hm_admin_write on household_members;
create policy hm_admin_write on household_members for all
  using (household_id in (select auth_admin_household_ids()))
  with check (household_id in (select auth_admin_household_ids()));

-- Amorçage : le créateur d'un foyer s'insère comme premier membre.
-- Restreint à soi-même et aux foyers qu'on a soi-même créés.
drop policy if exists hm_self_insert_creator on household_members;
create policy hm_self_insert_creator on household_members for insert
  with check (
    user_id = auth.uid()
    and household_id in (
      select id from households where created_by = auth.uid()
    )
  );

-- =====================================================================
-- 3. POLICIES MANQUANTES PARCOURS FOYER
-- =====================================================================

-- Sans cette policy, le créateur ne peut pas relire (returning) le
-- foyer qu'il vient de créer tant qu'il n'en est pas encore membre.
drop policy if exists households_creator_select on households;
create policy households_creator_select on households for select
  using (created_by = auth.uid());

-- Les membres d'un même foyer voient leurs profils respectifs
-- (prénom, nom). Aucune exposition hors du foyer.
drop policy if exists users_household_select on users;
create policy users_household_select on users for select
  using (id in (select auth_household_member_ids()));

-- =====================================================================
-- 4. INVITATIONS FOYER
-- =====================================================================

create table if not exists household_invitations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  email         text not null,
  role          household_role not null default 'parent',
  invited_by    uuid not null references users(id),
  status        text not null default 'en_attente'
                check (status in ('en_attente', 'acceptee', 'revoquee')),
  created_at    timestamptz not null default now()
);

comment on table household_invitations is
  'Invitation d un autre adulte responsable dans le foyer. '
  'Étape volontairement minimale : une entrée en attente, pas encore '
  'de parcours d acceptation ni d envoi d email.';

create unique index if not exists household_invitations_household_email
  on household_invitations (household_id, lower(email));

alter table household_invitations enable row level security;

drop policy if exists hi_member_select on household_invitations;
create policy hi_member_select on household_invitations for select
  using (household_id in (select auth_household_ids()));

-- Seul un admin du foyer invite.
drop policy if exists hi_admin_insert on household_invitations;
create policy hi_admin_insert on household_invitations for insert
  with check (
    household_id in (select auth_admin_household_ids())
    and invited_by = auth.uid()
  );

commit;
