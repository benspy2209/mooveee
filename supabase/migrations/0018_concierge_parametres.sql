-- =====================================================================
-- 0018 — Mode Concierge (étape 9) : paramètres de détection
--
-- Les quatre automatisations de l'étape 9 (rappel de trajet, hub en
-- démarrage qui stagne, hub inactif, déséquilibre durable) sont des
-- DÉTECTIONS EN LECTURE, calculées au chargement des écrans concernés
-- avec les policies existantes : trips (foyer), trip_requests (foyer),
-- hub_trips_view (membres), hub_member_profiles (RPC 0008),
-- mooves_balance/mooves_ledger (self), app_settings (lecture libre).
-- Aucune table nouvelle, aucune policy manquante pour ces lectures,
-- aucune fonction security definer nécessaire — donc rien à révoquer.
--
-- Le Concierge ne crée aucune demande, n'assigne aucun trajet,
-- n'exclut personne : il affiche des notifications. Les cas humains
-- (conflit, signalement, incident, exclusion, situation sensible)
-- n'apparaissent nulle part ici, et ne devront jamais y apparaître.
--
-- Passage cron/push plus tard : les mêmes détections, documentées dans
-- src/lib/concierge.ts, seront portées côté serveur. Rien n'est câblé.
--
-- Vérification faite au passage : les tables encore sans policy
-- (institutions, institutional_messages, institution_usage_metrics,
-- impact_snapshots) relèvent des étapes 10 et 12, pas de celle-ci.
--
-- Tous les délais sont des paramètres, jamais des constantes. Les
-- valeurs ci-dessous sont des PROPOSITIONS à valider par le porteur —
-- mooves_imbalance_weeks (4) est déjà tranché depuis 0016.
-- =====================================================================

insert into app_settings (key, value, description) values
  ('concierge_trip_reminder_hours', '24',
   'Concierge : fenêtre en heures avant un trajet pour rappeler le '
   'conducteur et les familles dont un enfant est à bord (étape 9). '
   'Proposition à valider par le porteur.'),
  ('concierge_hub_solo_weeks', '3',
   'Concierge : semaines sans nouveau membre validé au-delà '
   'desquelles un hub en démarrage est considéré comme stagnant — '
   'suggestion d''invitation à son admin (étape 9). Proposition à '
   'valider par le porteur.'),
  ('concierge_hub_inactive_weeks', '3',
   'Concierge : semaines sans aucun trajet publié au-delà desquelles '
   'un hub actif est signalé comme inactif à ses admins (étape 9). '
   'Proposition à valider par le porteur.')
on conflict (key) do nothing;
