-- =====================================================================
-- 0005 — Policy manquante sur activities
--
-- RLS est activée sur activities depuis 0001 (deny by default) mais
-- aucune policy n'avait été écrite : la table était inaccessible.
-- Même périmètre que children : toutes les opérations, limitées au(x)
-- foyer(s) de l'utilisateur via le helper auth_household_ids().
-- =====================================================================

drop policy if exists activities_household_all on activities;
create policy activities_household_all on activities for all
  using (household_id in (select auth_household_ids()))
  with check (household_id in (select auth_household_ids()));

-- Coherence enfant/foyer : un enfant ne peut etre rattache qu a une
-- activite de son propre foyer. La policy RLS ne verifie que le
-- household_id ; sans cette contrainte, un child_id d un autre foyer
-- reste insérable si son UUID est connu.
create or replace function child_belongs_to_household(p_child uuid, p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from children
    where id = p_child and household_id = p_household
  );
$$;

alter table activities
  drop constraint if exists activities_child_household_match;

alter table activities
  add constraint activities_child_household_match
  check (child_belongs_to_household(child_id, household_id));
