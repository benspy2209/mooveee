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
