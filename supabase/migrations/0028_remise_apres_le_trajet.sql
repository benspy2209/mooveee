-- =====================================================================
-- 0028 — Une remise ne se confirme pas avant d'avoir eu lieu
--
-- Règle de sécurité posée par le porteur (28/10/2026) : « aucune remise
-- ne peut être confirmée sans avoir réellement eu lieu ». Le bulletin
-- de trajet acceptait jusqu'ici une confirmation à n'importe quel
-- moment, y compris la veille : un parent aurait pu voir « déposé »
-- avant que l'enfant soit monté en voiture. C'est exactement le genre
-- d'affichage qui doit être impossible, pas seulement improbable.
--
-- La garde est portée par la base, pas par l'interface : la policy
-- d'insertion exige que l'heure du trajet soit passée. L'interface
-- masque les boutons en plus, mais une requête directe est refusée.
--
-- Le `delete` n'est pas touché : corriger une confirmation faite par
-- erreur doit rester possible à tout moment.
-- =====================================================================

drop policy if exists dropoff_driver_insert on trip_dropoff_confirmations;

create policy dropoff_driver_insert on trip_dropoff_confirmations
  for insert to authenticated
  with check (
    confirmed_by = auth.uid()
    and exists (
      select 1 from trips t
       where t.id = trip_dropoff_confirmations.trip_id
         and t.driver_id = auth.uid()
         -- Le trajet doit avoir commencé.
         and t.scheduled_at <= now()
    )
    and exists (
      select 1 from trip_children tc
       where tc.trip_id = trip_dropoff_confirmations.trip_id
         and tc.child_id = trip_dropoff_confirmations.child_id
    )
  );

-- Vérification après application :
--   select with_check from pg_policies
--    where tablename = 'trip_dropoff_confirmations'
--      and policyname = 'dropoff_driver_insert';
--   → contient « scheduled_at <= now() »
