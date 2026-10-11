# Backend Schema : Mooveee

> Reconstitué le 11/10/2026 depuis `supabase/migrations/0001` à `0023` et comparé à l'état réel du projet Supabase `chmijnxukwsfqlvaontf` (migrations appliquées, advisors). Tout est [déduit du code] sauf mention [à confirmer]. Les colonnes `created_at timestamptz default now()` et `id uuid pk default gen_random_uuid()` ne sont répétées que lorsqu'elles s'écartent du standard.

## 1. Tables

### Paramètres

#### app_settings (lecture publique authentifiée, aucune écriture client)
| key | valeur actuelle | rôle |
|-----|-----------------|------|
| hub_activation_member_count | 5 | membres validés pour passer un hub de `solo` à `active` (trigger) |
| mooves_initial_balance | 60 | crédit unique à la création du profil (0016, arbitrage porteur) |
| mooves_imbalance_weeks | 4 | semaines d'indicateur négatif avant message Concierge |
| mooves_distance_scale | [3:30, 6:40, 10:50, 15:60, null:70] | barème de gain par palier de km |
| reidentification_min_families | 12 | plancher de familles pour générer un agrégat |
| dropoff_reminder_minutes | 20 | délai avant relance du bulletin de dépôt |
| concierge_trip_reminder_hours | 24 | fenêtre du rappel de trajet (proposition, à valider porteur) |
| concierge_hub_solo_weeks | 3 | hub solo stagnant (proposition) |
| concierge_hub_inactive_weeks | 3 | hub actif sans trajet publié (proposition) |
| volunteer_daily_cap_eur | 44.02 | plafond légal volontariat 2026 |
| volunteer_annual_cap_eur | 1760.83 | plafond légal volontariat 2026 |
| erasure_delay_days | 30 | délai droit à l'effacement, non appliqué automatiquement |

### Identité et foyer

#### users
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| id | uuid | PK = auth.users.id, cascade | |
| first_name | text | not null | saisi sur /bienvenue |
| last_name | text | | optionnel |
| phone | text | | colonne présente, jamais saisie par l'UI |
| avatar_url | text | | jamais utilisée |
| postal_code | text | | zone floue (Doc1 §12.4), jamais saisie par l'UI |
| locale | text | default 'fr-BE' | |
| updated_at | timestamptz | | pas de trigger de mise à jour |

#### households
| Colonne | Type | Contraintes |
|---------|------|-------------|
| name | text | not null |
| created_by | uuid | FK users |

#### household_members
| Colonne | Type | Contraintes |
|---------|------|-------------|
| household_id, user_id | uuid | FK cascade, unique (household_id, user_id) |
| role | household_role | parent, beau_parent, grand_parent, autre_referent |
| is_admin | boolean | default false |
| joined_at | timestamptz | |

#### household_invitations (0003)
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| household_id | uuid | FK cascade | |
| email | text | not null | aucun email n'est envoyé, aucun parcours d'acceptation |
| invited_by | uuid | FK users | |
| status | text | default 'en_attente' | jamais mis à jour par le code |

### Enfants et activités

#### children
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| household_id | uuid | FK cascade | un enfant = un seul foyer (pas de garde alternée) |
| first_name | text | not null | stocké une seule fois, référencé par FK partout |
| birth_year | integer | | année seule, minimisation |
| photo_url | text | | chemin relatif dans le bucket privé, jamais une URL publique |
| photo_consent | boolean | default false | la photo n'est signée que si true |
| booster_seat | boolean | default false | rehausseur |
| updated_at | timestamptz | | |

Aucune colonne allergies, santé, adresse, position. Décision du porteur, ne pas ajouter.

#### activities
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| child_id, household_id | uuid | FK cascade | |
| hub_id | uuid | FK hubs | non utilisé par l'UI aujourd'hui |
| label | text | not null | |
| location_label | text | | texte libre ou libellé Photon |
| place_id | uuid | FK places set null (0019) | lieu public normalisé |
| lat, lng | numeric(9,6) | | présentes, jamais remplies par l'UI |
| rrule | text | | null = ponctuel ; sinon `FREQ=WEEKLY;BYDAY=...` |
| starts_at, ends_at | timestamptz | | ancre DTSTART portant les heures (pas de 15 min) |
| distance_band | distance_band | not null default 'courte' (0015) | courte / moyenne / longue, menu déroulant |

### Trajets

#### trips
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| household_id | uuid | FK cascade | foyer propriétaire |
| activity_id | uuid | FK set null | null = trajet manuel ou « Je passe par là » |
| hub_id | uuid | FK hubs | hub de publication |
| direction | trip_direction | aller / retour | |
| status | trip_status | couvert, couvert_ouvert, partiellement_couvert, conditionnel, non_couvert, annule ; default non_couvert | partiellement_couvert et conditionnel ne sont jamais écrits par le code |
| driver_id | uuid | FK users | attribution humaine, jamais automatique |
| scheduled_at | timestamptz | not null | UTC |
| origin_label, destination_label | text | | « Domicile » ou lieu |
| origin_place_id, destination_place_id | uuid | FK places (0019) | lieux publics seulement |
| origin_lat/lng, destination_lat/lng | numeric | | présentes, jamais remplies |
| meeting_point_id | uuid | FK meeting_points, check `trip_meeting_point_in_hub` | |
| seats_total | smallint | | jamais rempli par l'UI |
| seats_available | smallint | check <= seats_total | « places offertes aux autres familles », décrémenté par `accept_trip_request` |
| distance_km | numeric(6,2) | | toujours null (dette distance) |
| distance_band | distance_band | nullable (0015) | copié depuis l'activité à la génération |
| published_to_hub | boolean | default false | |
| linked_trip_id | uuid | FK trips (0019) | aller/retour lié, affichage seul |
| has_children | boolean | default true (0019) | false = « Je passe par là » |
| updated_at | timestamptz | | |

Index unique `trips_activity_occurrence_unique (activity_id, direction, scheduled_at)` non partiel (0007) : idempotence de la génération. `private_note` supprimée en 0021.

#### trip_private_notes (0021)
trip_id PK FK cascade, household_id FK, note not null, updated_at. RLS foyer, with check que le trajet appartient au même foyer.

#### trip_children
PK (trip_id, child_id). Contrainte : enfant du même foyer que le trajet OU demande de hub acceptée (`trip_child_hub_request_accepted`, 0009).

#### trip_requests
| Colonne | Type | Contraintes |
|---------|------|-------------|
| trip_id | uuid | FK cascade |
| requester_id, requester_household_id, child_id | uuid | FK cascade |
| status | trip_request_status | en_attente, accepte, refuse, annule, expire ; `expire` jamais écrit |
| message | text | texte libre du parent demandeur |
| responded_at | timestamptz | |

Index uniques partiels : une seule `en_attente` par (trip_id, child_id) (0009) ; une seule `accepte` par (trip_id, child_id) (0021).

#### trip_dropoff_confirmations (0014)
trip_id, child_id (unique ensemble), confirmed_by FK users, confirmed_at. Bulletin de dépôt du conducteur.

### Hubs

#### hubs
| Colonne | Type | Contraintes | Rôle |
|---------|------|-------------|------|
| name | text | not null | |
| kind | hub_kind | ecole, club, quartier, conservatoire, autre | |
| status | hub_status | solo, active, structured ; default solo | `structured` jamais écrit |
| join_code | text | unique | 6 caractères sans ambiguïté, généré client, retry sur 23505 |
| place_label, municipality | text | not null | lieu du hub, jamais un domicile |
| place_lat, place_lng | numeric | | jamais remplis |
| owner_id | uuid | FK users | |
| institution_id | uuid | FK institutions | jamais rempli par l'UI |
| activated_at, certified_at | timestamptz | | |

#### hub_members
hub_id, user_id (unique), household_id, is_admin default false, validated_at (null = en attente), joined_at.

#### hub_pact_acceptances
hub_id, user_id, pact_version text (valeur codée en dur `'1.0'` dans `hubs.tsx`), accepted_at ; unique (hub, user, version). Texte du pacte dans le code, pas en base.

#### meeting_points (0014)
hub_id, label not null, description, photo_url (bucket `meeting-point-photos`), lat/lng (jamais remplis), is_default (un seul par hub, index partiel).

#### hub_bridges (Doc1 §9.1, gelé)
source_hub_id, target_hub_id, bridge_type text, is_active default false, approved_at. Lecture membres des deux hubs, aucune écriture.

#### hub_relations (0020, gelé `prepared`)
hub_a_id, hub_b_id, relation_type (proximite, chemin), activation_status (prepared, active). Lecture admins des deux hubs, aucune écriture client. Activation = action manuelle du porteur.

### Lieux (v4 §7)

#### places (0019)
label, external_place_id unique (identifiant Photon/OSM), lat, lng, postal_code, municipality, created_by. Lieux PUBLICS uniquement. Lecture : tous les authentifiés. Insertion : created_by = soi.

#### household_places (0019)
household_id, place_id (unique ensemble), custom_label. Favoris du foyer.

### Mooves

#### mooves_balance
user_id PK, balance integer default 0 (négatif autorisé, aucun check), updated_at.

#### mooves_ledger
user_id, movement (gain, usage, ajustement, fonds_solidarite, solde_initial), amount integer signé, trip_id FK set null, grant_id, reason. Index unique partiel : un seul `solde_initial` par user (0017).

#### solidarity_fund_grants
beneficiary_id, institution_id ou sponsor_label (check l'un des deux), amount, granted_by, reason. Aucune FK vers un parent payeur. Trigger `trg_solidarity_grant_apply` crédite le ledger.

### Observation et institutionnel (sans UI)

#### opportunity_matches (0020)
trip_id, request_trip_id (unique ensemble), driver_user_id, hub_id, via_hub_relation_id, status (detecte_silencieux par défaut, signal_envoye, ouvert_par_utilisateur, accepte, refuse, expire), detected_at. RLS activée, zéro policy : invisible côté client, voulu pendant l'observation.

#### notification_preferences (0020)
user_id PK, max_per_day, max_per_week, quiet_hours_start/end, channel (push, email, aucune). RLS self complète, aucune UI, aucune valeur par défaut (calibrage après pilote).

#### institutions, institutional_messages, institution_usage_metrics, impact_snapshots
Schéma 0001, RLS sans policy (muettes). `institution_usage_metrics` (active_families, hubs_count, trips_volume, unique par institution et mois) et `impact_snapshots` (families_count, trips_shared, km_saved et co2_saved_kg toujours null, unique par hub et mois) sont remplies par pg_cron (0023), jamais par un client.

#### volunteer_recognitions, defraiement_records
Schéma v4 §9 : vecteur (club, po_ecole, commune, association_parents), taux par institution, is_active default false, plafonds dans app_settings. Lecture self. Aucune logique métier, aucune UI, interdiction d'activation avant validation juridique.

#### consents, messages, reports
Présentes depuis 0001 avec policies self/scope, jamais lues ni écrites par le code applicatif. `reports.involves_minor` prévoit l'escalade humaine ; aucun écran de signalement n'existe.

## 2. Relations principales

- users 1→n household_members n→1 households ; households 1→n children, activities, trips, household_places, household_invitations.
- children 1→n activities ; activities 1→n trips (génération) ; trips n→n children via trip_children.
- trips 1→n trip_requests ; trip_requests n→1 children (enfant du demandeur) ; trips 1→n trip_dropoff_confirmations.
- hubs 1→n hub_members, hub_pact_acceptances, meeting_points, trips (publication) ; hub_bridges et hub_relations relient deux hubs.
- places 1→n activities, trips (origin/destination), household_places.
- users 1→1 mooves_balance, 1→n mooves_ledger ; trips 1→n mooves_ledger.
- trips (opportunité) ↔ trips (besoin) via opportunity_matches.

## 3. Règles d'accès (RLS), telles qu'appliquées

Helpers `security definer` : `auth_household_ids()`, `auth_admin_household_ids()`, `auth_household_member_ids()`, `auth_hub_ids()` (membres validés), `auth_hub_admin_ids()`, `auth_hub_member_user_ids()`.

| Table | Lire | Créer | Modifier | Supprimer |
|-------|------|-------|----------|-----------|
| users | soi ; co-membres de foyer | soi (id = auth.uid) | soi | personne (effacement par `erase_user`) |
| households | membres ; créateur | created_by = soi | membres | personne |
| household_members | membres du foyer ; admins | créateur bootstrap ; admins | admins | admins |
| household_invitations | membres | admins | personne | personne |
| children | foyer (all) | foyer | foyer | foyer |
| activities | foyer (all) | foyer | foyer | foyer |
| trips | foyer (all) ; membres du hub si published_to_hub (LIGNE entière, voir §8 ; **supprimé par 0024**) | foyer | foyer | foyer |
| trip_private_notes | foyer (all) | foyer, trajet du foyer | foyer | foyer |
| trip_children | foyer (all) + contrainte enfant du foyer ou demande acceptée | | | |
| trip_requests | foyer demandeur ou foyer conducteur | soi, son foyer, son enfant, trajet publié couvert_ouvert d'un de ses hubs, jamais son propre trajet | foyer conducteur (refus) | personne |
| trip_dropoff_confirmations | parent de l'enfant ou conducteur | conducteur du trajet, enfant à bord | personne | auteur |
| hubs | membres validés ; owner | owner_id = soi | owner ou admin | personne |
| hub_members | membres validés ; soi | soi, non validé, non admin (sauf owner bootstrap) | admins (valider) | admins (refuser) |
| hub_pact_acceptances | soi | soi | personne | personne |
| meeting_points | membres validés | admins | admins | admins |
| hub_bridges | membres des deux hubs | personne | personne | personne |
| hub_relations | admins des deux hubs | personne | personne | personne |
| places | tous les authentifiés | created_by = soi | personne | personne |
| household_places | foyer (all) | foyer | foyer | foyer |
| mooves_balance, mooves_ledger, solidarity_fund_grants | soi | personne | personne | personne |
| notification_preferences | soi | soi | soi | personne |
| consents | soi (all) | soi | soi | soi |
| messages | foyer ou hub selon channel | author = soi | personne | personne |
| reports | reporter = soi | reporter = soi | personne | personne |
| volunteer_recognitions, defraiement_records | soi | personne | personne | personne |
| app_settings | tous | personne | personne | personne |
| opportunity_matches, institutions, institutional_messages, institution_usage_metrics, impact_snapshots | personne | personne | personne | personne |

Storage : `child-photos/{household_id}/{child_id}.{ext}` CRUD si le premier segment ∈ `auth_household_ids()` ; `meeting-point-photos/{hub_id}/{mp_id}.{ext}` lecture membres validés, écriture admins.

## 4. Fonctions, triggers, vue

### Vue
`hub_trips_view` (security_invoker en 0019 ; **0024 écrite le 11/10, non appliquée** : recréée SANS security_invoker, droits du propriétaire, `trips_hub_select` supprimée, `trip_requests_insert` passe par `trip_open_in_my_hubs(uuid)` definer) : id, hub_id, direction, status, scheduled_at, origin_label, destination_label, destination_place_id, meeting_point_id, seats_available, driver_id, driver_first_name (via `hub_user_first_name`), children_count (via `hub_trip_children_count`). Filtre `published_to_hub and hub_id in auth_hub_ids()`. Seul chemin autorisé vers les trajets des autres foyers.

### RPC appelables par `authenticated` (toutes vérifient l'appelant)
| Fonction | Rôle |
|----------|------|
| accept_trip_request(uuid) | transaction : vérifie foyer conducteur, place dispo, passe en `accepte`, insère trip_children (on conflict do nothing), décrémente seats_available et passe en `couvert` si 0, applique gain conducteur et usage demandeur UNIQUEMENT si insertion réelle |
| hub_for_join_code(text) | identité publique d'un hub (id, name, kind, municipality) depuis un code |
| hub_member_profiles(uuid) | prénom, nom, is_admin, validated_at des membres, réservé aux membres validés |
| hub_user_first_name(uuid), hub_trip_children_count(uuid) | briques de la vue |
| hub_trip_matching_needs_count(uuid) | compte des foyers du hub ayant un besoin non couvert compatible (fenêtre 90 min, libellé similaire), réservé au foyer conducteur |
| trip_children_aboard(uuid) | prénoms des enfants à bord, réservé au driver_id ; seul chemin nominatif vers le conducteur |
| trip_request_first_contact(uuid) | vrai si les deux foyers n'ont jamais eu de demande acceptée entre eux |
| meeting_point_set_default(uuid) | security invoker, un seul défaut par hub |
| trip_labels_similar(text, text) | normalisation accents, inclusion, chevauchement de tokens |
| helpers auth_* et check_* | utilisés par les policies et contraintes |

### Fonctions révoquées pour tous les rôles clients
`mooves_apply_movement` (seule écriture du ledger et de la balance), `mooves_amount_for_distance`, `mooves_amount_for_band` (courte→30, moyenne→50, longue→70), `solidarity_grant_apply`, `mooves_grant_initial_balance`, `users_grant_initial_balance`, `detect_opportunities()` (appariement besoin/opportunité, 90 min, même destination_place_id ou libellé similaire, places > 0 ou has_children false, statut `detecte_silencieux`), `erase_user(uuid)` (service_role), `compute_institution_metrics(date)` et `compute_impact_snapshots(date)` (service_role, exception si le seuil manque).

### Triggers
- `trg_hub_activation` after insert/update of validated_at on hub_members : solo → active au seuil.
- `trg_solidarity_grant_apply` on solidarity_fund_grants : mouvement `fonds_solidarite`.
- `users_after_insert_initial_balance` on users : mouvement `solde_initial` unique.

### pg_cron
- `detect-opportunities` : `15 3 * * *`.
- métriques et snapshots : le 1er du mois 03h30 (mois échu).

## 5. Storage
| Bucket | Public | Contenu | Limites |
|--------|--------|---------|---------|
| child-photos | non | photo d'enfant, seulement si photo_consent | 5 Mo, jpeg/png/webp, URL signée 1 h, suppression explicite côté app avant la ligne |
| meeting-point-photos | non | photo d'un point de rendez-vous | 5 Mo, jpeg/png/webp |

## 6. Edge Functions
| Nom | Déclencheur | Rôle | Secrets |
|-----|-------------|------|---------|
| access-code-login | POST depuis `/login` (mode code), verify_jwt false | lit le préfixe du code, retrouve l'email dans le secret, `signInWithPassword` avec la clé anon, renvoie access et refresh token ; réponse identique pour préfixe inconnu et code faux | ACCESS_CODE_EMAILS (JSON) + SUPABASE_URL / SUPABASE_ANON_KEY injectés |

Provisoire (D2) : supprimée avec le mode code d'accès dès que Brevo fonctionne. Prochaine : `places-search` (proxy Photon, D6, C9).

## 7. Données de départ et opérations
- `app_settings` seedés par migrations (voir §1).
- Comptes de test connus : `debruijneb@gmail.com`, `swauquaire@gmail.com`, `mooveee.app@proton.me` (codes d'accès posés par `npm run set-dev-password`). Comptes orphelins signalés dans le primer : à effacer par `npm run erase-user` avant pilote. [à confirmer]
- Hubs présents en base d'après le primer : « Ecole Boomhut », « Quartier Léopold » (Waterloo). [à confirmer]

## 8. Écarts entre schéma et usage
- Décisions du 11/10 à porter en schéma : table `policy_texts` (type, version, texte) et écriture de `consents` à chaque acceptation (D7) ; pacte dans `policy_texts`, `hub_pact_acceptances.pact_version` lié (D8) ; `hub_member_profiles` → prénom + initiale (D5) ; `hi_member_select` resserrée à l'invitant et aux admins (D5) ; RPC `activity_apply_changes`, `trip_unpublish`, `trip_set_driver`, `trip_publish` avec recalcul des places (D3, D4) ; lecture de `places` sans `created_by` et Edge Function proxy Photon (D6).
- Corrigé par 0024 (écrite, à appliquer) : `trips_hub_select` exposait la LIGNE entière de `trips` aux membres du hub (y compris `seats_total`, `distance_km`, `activity_id`, labels d'origine). La règle « jamais de select direct sur trips côté hub » n'est tenue que par discipline de code (la vue), pas par la RLS. Depuis 0021 la note privée est hors de la table, donc l'exposition résiduelle est faible, mais `origin_label` d'un trajet publié vaut « Domicile » et pourrait un jour contenir une adresse.
- Colonnes jamais alimentées : `users.phone`, `users.postal_code`, `users.avatar_url`, `activities.lat/lng`, `trips.*_lat/lng`, `trips.seats_total`, `trips.distance_km`, `hubs.place_lat/lng`, `hubs.institution_id`, `meeting_points.lat/lng`, `impact_snapshots.km_saved/co2_saved_kg`.
- Statuts d'enum jamais écrits : `partiellement_couvert`, `conditionnel`, `structured`, `expire`.
- Tables sans aucun usage applicatif : `consents`, `messages`, `reports`, `hub_bridges`, `notification_preferences`, `institutions*`, `volunteer_*`, `defraiement_records`.
- `household_invitations.status` jamais mis à jour ; aucune relation avec `auth.users` à l'acceptation.
- Versions des migrations 0019 à 0023 enregistrées en base sous horodatage (appliquées via MCP), pas sous leur numéro de fichier.
- `trip_labels_similar` et `meeting_point_set_default` sans `set search_path` (advisor WARN).
