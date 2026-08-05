-- =====================================================================
-- 0007 — Idempotence de la génération de trajets
--
-- Un trajet généré est identifié par (activité, direction, horaire).
-- L'index unique garantit côté données qu'une régénération ne crée
-- jamais de doublon, quel que soit le code client ou une double
-- soumission. Le client insère avec ON CONFLICT DO NOTHING : les
-- trajets existants (conducteur attribué, occurrence annulée) ne sont
-- JAMAIS écrasés, une régénération n'ajoute que les occurrences
-- manquantes.
--
-- Index non partiel volontairement : activity_id nullable, et les
-- NULL étant distincts dans un index unique, les trajets manuels sans
-- activité ne sont pas contraints. Un index partiel (where activity_id
-- is not null) empêcherait l'inférence ON CONFLICT côté PostgREST.
-- =====================================================================

create unique index if not exists trips_activity_occurrence_unique
  on trips (activity_id, direction, scheduled_at);
