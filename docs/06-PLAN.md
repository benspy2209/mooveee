# Plan d'implémentation : Mooveee

> Rétro cadrage du 11/10/2026. La Phase 1 (construction) est faite hors Lovable, étape par étape, et documentée dans `CLAUDE.md` (séquence 1 à 12) et `.claude/primer.md`. Ce fichier remplace la section « Phase 1 Lovable » du gabarit par l'état réel, puis propose la Phase 2 priorisée. Rien n'est exécuté : chaque ligne est une proposition à trancher par Ben.

## Phase 1 : construction (faite, du 02/08 au 16/08/2026)

| # | Étape (`CLAUDE.md`) | Migrations | État | Point de contrôle observé |
|---|----------------------|------------|------|---------------------------|
| 1 | Modèle de données + RLS | 0001, 0002 | fait | 34 tables, RLS partout |
| 2 | Cercle intime : auth, profil, foyer, membres, invitations | 0003 | fait, invitations incomplètes | E1 à E3 ; aucune invitation envoyée ni acceptable |
| 3 | Enfants (Storage privé), activités (rrule) | 0004 à 0006 | fait | E4, E5 ; photo signée 1 h sous consentement |
| 4 | Trajets, génération 1 an, Semaine, attribution, annulation | 0007 | fait | E6 ; DST testé oct + mars |
| 5 | Hubs : code, adhésion, pacte, publication, demandes | 0008 à 0010 | fait | E7, E8 ; `hub_trips_view` seul chemin |
| 6 | Mooves : ledger, équilibre privé, solidarité | 0011, 0012, 0015 à 0017 | fait | E9 ; double clic sans double crédit |
| 7 | Matching Macarons | 0013 | abandonné, brique conservée | suggestions client + compte RPC |
| 8 | Sécurité enfant : bulletin, points de RDV, premier contact | 0014 | fait | E6a bulletin, E8 bandeau |
| 9 | Concierge de base | 0018 | fait (lecture seule) | 4 bannières ou encarts |
| 7bis | Chantier v4 : lieux, trajets enrichis, opportunités | 0019, 0020 | fait | Photon, favoris, cron 03h15 |
| 10 | Métriques institutionnelles | 0023 | fait, sans UI | cron mensuel, seuil 12 |
| 11 | Défraiement : schéma seulement | 0001 | clos | is_active false |
| 12 | Audit RLS, effacement | 0021, 0022 | fait | anon 0 fonction, `erase_user` testé |
| — | Design « lagoon », tab bar, timeline | — | fait | commits 3b47308, e897d81, e97615a |

Critères de sortie de Phase 1 atteints : parcours P1 à P4 réalisables, schéma versionné, code sur GitHub, production sur mooveee.app. Non atteints : zéro test automatisé, DPIA non validée, connexion provisoire par code d'accès.

## Rapport de rétro cadrage (11/10/2026)

### A. Écarts et incohérences (code vs documents, ou code vs code)

1. **Mobile annoncé, web livré.** Aucun Capacitor, Expo, manifest ni service worker. L'app est une SPA web mobile-first. `CLAUDE.md` parle d'« encapsulable par Capacitor » : c'est une intention, pas un existant.
2. **Connexion provisoire devenue principale.** Le code d'accès (mot de passe Supabase, emails en dur dans le bundle) est le mode par défaut de `/login` ; le magic link, seul mode « produit réel » selon le primer, est en secours. Le template email Supabase doit contenir `{{ .Token }}` pour que le code OTP existe (action Ben non vérifiée).
3. **Invitations de foyer sans parcours.** Ligne créée, bouton « Envoi… », aucun email, aucun écran d'acceptation, aucune révocation ; index unique sur l'email rend une faute de frappe définitive.
4. **Consentements jamais tracés.** Table `consents` (5 types, `policy_version`) jamais écrite. Le consentement photo est un booléen non versionné. Aucune politique de confidentialité ni mention légale dans l'app.
5. **Modification d'activité sans mise à jour des trajets.** La génération n'ajoute que le manquant : changer l'heure laisse les anciens trajets ; supprimer l'activité laisse ses trajets (FK set null), y compris publiés. La notice dit pourtant « ses trajets sont prêts ».
6. **Dépublier ou retirer le conducteur ignore les demandes acceptées.** Dépublication remet `seats_*` à null sans vérifier `trip_requests accepte` ; retirer le conducteur passe le trajet en `non_couvert` tout en gardant `published_to_hub` → trajet fantôme hors de la vue. Republier remet `seats_available` au total (surbooking possible).
7. **Fuseau incohérent.** `activites.tsx` construit les timestamps dans le fuseau du navigateur ; `trips.ts` raisonne en Europe/Brussels. Un parent hors de Belgique décale ses activités.
8. **Texte en dur qui devrait être paramétré.** Pacte v1.0 et son texte (`hubs.tsx`), fenêtre 90 min dupliquée client/SQL, « jusqu'à trois mois à l'avance » alors que l'horizon va jusqu'à 1 an, plafonds de places 8 (publication) vs 4 (passage), TTL 3600 s, 5 Mo.
9. **Migrations 0019 à 0023** enregistrées en base sous horodatage, pas sous leur numéro : `supabase migration list` est incohérent.
10. **Documents du porteur** : « Instructions Techniques Partenaire v4 » étiqueté « Version 3 » en page de garde, divergence jamais clarifiée.
11. **README** = gabarit TanStack ; `AGENTS.md` = catalogue d'intents TanStack ; deux lockfiles (npm et pnpm).
12. **`<html lang="en">`**, devtools TanStack rendus sans garde `DEV`, Google Fonts par `@import`.
13. **Enum et colonnes mortes** : statuts `partiellement_couvert`, `conditionnel`, `structured`, `expire` jamais écrits ; `users.phone`, `postal_code`, `avatar_url`, toutes les lat/lng, `seats_total`, `distance_km`, `household_places.custom_label` jamais alimentés. `hub_bridges`, `hub_relations`, `messages`, `reports`, `notification_preferences`, tables institutionnelles sans UI.
14. **Signal Mooves (§5.5)** documenté mais sans effet : le niveau du demandeur est constant pour l'utilisateur qui regarde ses propres suggestions.
15. **Vocabulaire imposé** : respecté (0 mot interdit dans l'UI, vérifié par grep et par lecture). À préserver.

### B. Trous de sécurité et de robustesse

Sécurité et RGPD :
1. **Emails personnels dans le bundle** (`CODE_EMAILS`) et mode mot de passe actif avec protection HaveIBeenPwned désactivée.
2. **`trips_hub_select` expose la ligne entière** aux membres du hub ; la discipline « via la vue » n'est pas portée par la RLS. Faible exposition résiduelle depuis 0021, mais fragile.
3. **`places.created_by` lisible par tout authentifié** : qui a cherché quel lieu (avec lat/lng et code postal) est visible de n'importe quel compte.
4. **Texte libre vers Photon** : la saisie part vers komoot.io en `fetch` direct (IP, User-Agent, Referer) dès 3 caractères ; un parent qui tape son adresse l'envoie à un tiers. Aucun proxy, aucune `referrerPolicy`.
5. **Message libre de demande** affiché tel quel au conducteur : canal possible pour un téléphone, une adresse, un prénom d'enfant.
6. **Nom de famille des parents** exposé entre membres de hub (`hub_member_profiles`) et au conducteur (E8), alors que la vue ne donne que le prénom du conducteur. Décision à confirmer.
7. **`origin_label` / `destination_label` libres** exposés au hub via la vue : « Domicile » aujourd'hui, mais rien n'interdit une adresse.
8. **Email des invités** visible de tous les membres du foyer, pas seulement des admins.
9. **`join_code` généré côté client** et énumérable via `hub_for_join_code` sans limitation de débit visible.
10. **Deux fonctions sans `search_path`** (`trip_labels_similar`, `meeting_point_set_default`) : advisor WARN.
11. **`updated_at`, `validated_at`, `responded_at` posés par l'horloge du client**, alors que `validated_at` alimente les détections Concierge.
12. **Aucune purge** après `erasure_delay_days`, aucune journalisation applicative des effacements.

Robustesse :
13. **Écritures multi-étapes sans transaction** : création de foyer (2 inserts), adhésion à un hub (2), création de hub (3, hub orphelin possible, code consommé), création d'enfant avec photo (3), point de rendez-vous (3, fichier orphelin). Candidats à des RPC.
14. **Erreurs ignorées** sur une douzaine de requêtes secondaires : vue hub dans E8 (« Trajet plus disponible » affiché à tort), `hub_member_profiles`, `trip_request_first_contact` (le garde-fou de premier contact peut disparaître sans signal), confirmations de dépôt, URL signées (photos qui disparaissent), `meeting_points`, `app_settings.dropoff_reminder_minutes` (la relance ne s'affiche jamais), paramètres Concierge, dernière publication (hub « inactif » affiché à tort). Pattern : seul `data` est destructuré.
15. **Bulletin de dépôt** : si le RPC échoue, le composant rend `null` avant d'afficher l'erreur.
16. **État optimiste sur le conducteur** (`setDriverId` avant l'await) : le seul endroit où l'UI précède le serveur.
17. **`imbalanceIsDurable` fail-open** si `mooves_imbalance_weeks` redevient JSON `null` (`Number(null) = 0`) : message Concierge affiché pour toute dynamique négative. Valeur actuelle 4, risque latent.
18. **Génération côté client** sur 1 an : centaines de requêtes, pas de verrou, deux onglets peuvent générer en parallèle ; un échec laisse des trajets sans liens.
19. **`limit(1)` sans tri** sur `household_members` dans cinq écrans : comportement instable pour un adulte dans deux foyers.
20. **URL signées non renouvelées** après 1 h d'onglet ouvert ; bannières « Masquer » non persistées ; notice d'activité jamais effacée ; `load()` sans indicateur pendant les rechargements.
21. **Aucun test automatisé, aucune boundary d'erreur de route, aucune page 404, aucun monitoring.**
22. **Mobile** : pas de `viewport-fit=cover` (safe-area = 0 en WebView iOS), champs à 38 px, pas de focus visible, modale sans Escape (passage), `lang="en"`.

### C. Questions tranchées et ouvertes

Décisions de Ben du 11/10/2026 (reportées dans les docs 01, 02, 05) :
- D1 Gestionnaire de paquets : npm. `pnpm-lock.yaml` supprimé le 11/10.
- D2 SMTP : Brevo. Le code d'accès et les emails en dur sont retirés dès que l'authentification par email fonctionne.
- D3 Trajets après modification ou suppression d'activité : les trajets futurs non publiés sont supprimés ; les trajets publiés sont annulés avec notification aux familles concernées, jamais supprimés en silence.
- D4 Dépublication ou retrait du conducteur avec demandes acceptées : interdit sans annulation explicite ; l'annulation notifie chaque demande acceptée. Republier ne remet pas les places au total : recalcul depuis les demandes actives.
- D5 Identité hors foyer : prénom plus initiale du nom. Email des invités visible du seul invitant et des admins du foyer.
- D6 Photon : Edge Function proxy, aucune requête directe depuis le client.
- D7 Consentements : tracés en base à chaque acceptation, avec version du texte et horodatage.
- D8 Pacte : en base, versionné ; la version acceptée est liée à chaque consentement.
- D9 (Stéphane, 11/10) Mobile : PWA installable sur l'écran d'accueil, pas de stores pour le pilote ; publication sur les stores plus tard, au nom de la structure exploitante.

Réponses de Stéphane aux questions 3 à 7 (11 et 18/10) : consolidées dans
`07-DECISIONS-PORTEUR-2026-10.md` (P10 à P16, faisabilité 2/11, volet
financier sous réserve). Les lignes ci-dessous restent telles quelles
jusqu'à validation de ce document par Stéphane.

Restent ouvertes, à voir avec le client (Stéphane) :

1. **Pilote** : proposition Stéphane du 11/10 = stage de tennis à Rhode-Saint-Genèse, 2 au 6 novembre 2026 (Toussaint néerlandophone), 10 à 15 familles, hub fermé ; objectif, pas obligation. Reste : qui valide la DPIA (voir 2b).
1b. **AIPD** : le doc v4 §11.4 parle d'un « premier jet rédigé » ; il n'est ni dans le repo ni sur le Mac de Ben (recherche du 11/10) : il est dans le corpus de Stéphane. Ben fournit l'annexe technique (DFD, registre des traitements, sous-traitants). Ancienne formulation : date cible, nombre de familles, et surtout qui valide la DPIA et quand. Rien ne va en pilote avant (règle `CLAUDE.md`).
2. ~~Connexion~~ tranché (D2). Reste : garder l'OTP 6 chiffres en plus du lien, oui par défaut.
3. **Mobile** : web mobile seul pour le pilote, ou Capacitor dès maintenant ; iOS et Android ou iOS d'abord ; qui détient les comptes développeur et apparaît comme éditeur sur les stores.
4. ~~Consentements~~ tranché (D7). Reste : rédaction des textes et emplacement de la politique de confidentialité (lié à la DPIA).
5. ~~Nom de famille~~ tranché (D5) : prénom plus initiale.
6. ~~Lieux~~ tranché (D6) : Edge Function proxy. `places.created_by` à retirer de la lecture (inclus dans C9).
7. **Distance** : position Stéphane 11/10 = tranches avant acceptation, lieu exact après (P14, doc 07).
8. ~~Trajets après modification~~ tranché (D3).
9. ~~Dépublication~~ tranché (D4). Dépend du canal de notification (question 12) pour la partie « notifie ».
10. **Signal Mooves §5.5** côté conducteur (départage des demandes reçues) : activer avec un libellé qualitatif, ou laisser hors pilote. Position Stéphane 11/10 : P12, P13 (doc 07) ; volet financier sous réserve d'examen professionnel.
11. **Garde alternée** : position Stéphane 11/10 = enfant dans plusieurs foyers, une fiche (P10, doc 07) ; proposé hors pilote.
12. **Notifications** : position Stéphane 11/10 = push trajets dès le pilote, sans SMS, deux actions de confirmation (P15, doc 07) ; périmètre B2.
13. ~~Pacte~~ tranché (D8) : en base, versionné, lié aux consentements.
14. **Documents** : clarifier « v4 » vs « Version 3 » avec Stéphane ; valider les trois délais Concierge proposés (24 h, 3 semaines, 3 semaines).
15. ~~Repo~~ tranché (D1) : npm. Reste : réparer l'historique des migrations, réécrire README (C1).

## Phase 2 : Claude Code (proposition priorisée, rien d'exécuté)

Priorité P0 = bloquant pilote ; P1 = avant les premières vraies familles ; P2 = confort ou préparation mobile. Chaque étape = une migration ou un commit, un point de contrôle vérifiable, docs 03 et 05 mis à jour.

| # | P | Étape | Portée | Point de contrôle |
|---|---|-------|--------|-------------------|
| C0 | P0 | Exposition publique, fait en premier (demande Ben du 11/10, l'app est publique sur www.mooveee.app) | migration 0024 (fin de `trips_hub_select`, vue sans security_invoker, helper `trip_open_in_my_hubs`), ÉCRITE le 11/10, à appliquer par Ben ; retrait des emails du bundle selon l'option retenue (voir journal) | `select polname from pg_policy where polrelid='trips'::regclass` = `trips_household_all` seul ; grep `gmail` dans `.output/public` = 0 |
| CP | P0 | Spécifique pilote Toussaint (proposition Stéphane du 11/10 : stage de tennis Rhode-Saint-Genèse, 2 au 6 novembre 2026, 10 à 15 familles, hub fermé autour du club) | date de fin sur une activité récurrente (`activities.until` ou `UNTIL` dans la rrule, respectée par `trips.ts`) sinon un stage de 5 jours génère 3 mois de trajets ; libellé « stage » ; 15 comptes créés par email (dépend de C4 Brevo) ; feuille de retours parents | une activité « stage lundi au vendredi 9h-16h, du 2 au 6/11 » génère exactement 10 trajets |
| C1 | P0 | Hygiène repo et base | réparer `supabase migration list` (repair des 5 versions), un seul lockfile, README réécrit, `lang="fr-BE"`, devtools gardés par `DEV`, `search_path` sur les 2 fonctions | `supabase migration list` propre ; advisor sans WARN search_path ; build prod sans devtools |
| C2 | P0 | Gestion d'erreur systématique | destructurer `error` sur toutes les requêtes secondaires ; bulletin affiche l'erreur ; retirer l'optimisme sur le conducteur ; `errorComponent` + `notFoundComponent` dans `__root` | Playwright : couper le réseau sur E8 affiche une erreur, pas « Trajet plus disponible » |
| C3 | P0 | Tests | Vitest sur `trips.ts` (DST, idempotence), `concierge.ts` (imbalance, fail-closed sur null), `places.ts` ; Playwright sur P1 à P3 avec deux comptes de test | `npm test` vert en CI GitHub Actions |
| C4 | P0 | Authentification réelle | SMTP Brevo (D2) branché dans Supabase Auth, template avec `{{ .Token }}`, retrait définitif du mode code d'accès et de `set-dev-password`, désactivation du provider mot de passe | login par email réel reçu en < 1 min ; grep `gmail` dans le bundle = 0 |
| C5 | P0 | Consentements et pacte en base (D7, D8) | table `policy_texts` (type, version, texte, publié le) ; `consents` écrit à chaque acceptation avec `policy_version` et horodatage (inscription, photo enfant, hub) ; pacte = `policy_texts` type `pacte_hub`, `hub_pact_acceptances.pact_version` référence la version ; `PactGate` lit le texte en base ; pages Politique de confidentialité et Mentions légales liées depuis E1, E2, E3 | une ligne `consents` par acceptation ; grep `PACT_TEXT` dans `src` = 0 ; textes validés par le conseil DPIA |
| C6 | P0 | Cohérence trajets (D3, D4) | RPC `activity_apply_changes` : trajets futurs non publiés supprimés, trajets publiés passés en `annule` avec notification aux familles des demandes acceptées, jamais de suppression silencieuse ; RPC `trip_unpublish` et `trip_set_driver` : refus (42501 explicite) s'il existe des demandes acceptées, sauf annulation explicite qui notifie chaque demande ; `trip_publish` recalcule `seats_available` = places offertes moins demandes acceptées actives | tests : modifier l'heure ne laisse aucun trajet orphelin ; dépublier avec une demande acceptée renvoie une erreur lisible ; republier après 1 acceptation sur 3 places affiche 2 |
| C7 | P1 | Transactions composées | RPC `household_create`, `hub_create` (code généré serveur), `hub_join` (membre + pacte), `child_upsert_with_photo` finalisé après upload | aucun foyer ou hub orphelin possible : test d'échec forcé de la 2e étape |
| C8 | P1 | Invitations de foyer | email d'invitation (Edge Function + SMTP de C4), page d'acceptation avec token, révocation admin, retrait de membre, changement de rôle, renommage | P6 : inviter → recevoir → accepter → apparaître dans E3 |
| C9 | P1 | Minimisation côté hub (D5, D6) | `hub_member_profiles` et E8 renvoient prénom + initiale du nom ; email des invités visible de l'invitant et des admins seulement (policy `hi_member_select` resserrée) ; `places.created_by` non lisible (vue `places_public` ou fonction) ; Edge Function `places-search` proxy Photon (secret, rate limit, pas de Referer), `places.ts` ne parle plus qu'à Supabase ; filtre léger sur le message libre | aucune requête `photon.komoot.io` depuis le navigateur ; `select created_by from places` refusé à `authenticated` |
| C10 | P1 | Fuseau et dates | `activites.tsx` utilise `fromBrusselsWallClock` ; `updated_at`/`validated_at`/`responded_at` par triggers `now()` | test DST sur la saisie d'activité depuis un navigateur en UTC |
| C11 | P1 | Paramètres en base | fenêtre 90 min et plafonds de places dans `app_settings`, libellé d'horizon dynamique (le pacte est traité en C5) | grep `90` dans `hubs.tsx` = 0 |
| C12 | P1 | Multi-foyer | `household_members` : `order by joined_at` partout, ou sélecteur de foyer si Q11 = garde alternée | comportement déterministe pour un compte à deux foyers |
| C13 | P1 (après pilote) | Notifications | Web Push (VAPID) : table `push_subscriptions`, demande de permission après un geste dans l'app installée (iOS 16.4+ seulement en PWA installée), Edge Function `send-push` + cron serveur portant `dropoff-reminders` et `concierge` ; email Brevo en repli ; `notification_preferences` avec défauts | relance de dépôt reçue en push 20 min après un trajet sans confirmation, sur Android et iPhone de test |
| C14 | P0 | PWA pour le pilote (D9) | manifest (nom, icônes 192/512/maskable, `display: standalone`, `theme_color` lagon), service worker vite-plugin-pwa en `autoUpdate` avec précache du shell (sans mise en cache des données Supabase), `viewport-fit=cover`, safe-area top, champs 44 px, polices auto-hébergées ; connexion dans la PWA par code OTP 6 chiffres (sur iPhone le lien magique ouvre Safari, pas l'app installée) | Lighthouse « installable » ; installée sur un iPhone et un Android de test, connexion par code OTP depuis l'app installée, session conservée après fermeture |
| C15 | P3 (plus tard, D9) | Capacitor et stores, au nom de la structure exploitante | init iOS/Android, URL scheme, `appUrlOpen` + `setSession`, plugin Camera, TestFlight et test interne, fiche store, politique de confidentialité en ligne (C5) | magic link ouvre l'app et connecte ; build TestFlight installé sur un iPhone de test |
| C16 | P2 | Observabilité et opérations | Sentry (déjà exclu du bundle Nitro, donc prévu) ou équivalent ; journal des effacements ; purge selon `erasure_delay_days` ; tableau SQL des métriques pour le porteur | une erreur front remonte avec release et route |
| C17 | P2 | Dettes produit | annuler une demande envoyée, pagination E8, renouvellement des URL signées, persistance du « Masquer », notice d'activité effaçable, favoris renommables (`custom_label`) | recette des US du PRD |

Ordre suggéré : C1 → C2 → C3 (une semaine), puis C4 + C5 + C6 en parallèle des retours de Stéphane, puis C7 à C12 avant la première famille, C13 à C17 selon la réponse à Q3.

## Journal d'avancement

| Date | Étape | Statut | Note |
|------|-------|--------|------|
| 2026-08-16 | Phase 1 | fait | dernier commit e68b1d0 |
| 2026-10-11 | Rétro cadrage | fait | six docs créés dans `docs/`, aucun fichier de code modifié |
| 2026-10-11 | Décisions D1 à D8 | fait | reportées dans 01, 02, 05, 06 ; `pnpm-lock.yaml` supprimé |
| 2026-10-18 | Réponses Stéphane Q3-Q7 | brouillon | doc 07 à relire par Ben puis envoyer ; rien reporté dans le code |
| 2026-10-11 | C0 | fait côté code | Edge Function `access-code-login` déployée (v1) + secret posé + `login.tsx` sans email, build vérifié 0 email ; migration 0024 : voir note d'application ci-dessous ; déploiement Vercel = push main |
