# TRD : Mooveee

> Rétro cadrage du 11/10/2026, reconstitué en lecture seule depuis le code (commit e68b1d0 du 16/08/2026). Les mentions [déduit du code] viennent du repo ; [à confirmer] demande une décision ou une vérification de Ben ou du porteur (Stéphane). Les trois documents de référence du porteur (Note d'arbitrage Mooves v2, Instructions Techniques Partenaire v4, Doc1 De A à Z v4) restent la source métier ; `CLAUDE.md` en est la synthèse opérationnelle et n'est pas remplacé par ce fichier.

## 0. Nature de l'application mobile

Mooveee n'est aujourd'hui ni une application Capacitor, ni Expo, ni native. [déduit du code] Le repo ne contient aucun `capacitor.config.*`, aucun dossier `ios/` ou `android/`, aucun `app.json`, aucun manifest PWA, aucun service worker. C'est une application web React compilée en SPA statique (`tanstackStart({ spa: { enabled: true } })` dans `vite.config.ts`), pensée mobile d'abord (barre d'onglets fixe à cinq entrées, `safe-area-inset-bottom`, cibles pouce), et explicitement conçue pour être encapsulée plus tard par Capacitor (`CLAUDE.md`, section Mode SPA ; commentaire « encapsulage iOS prévu » dans `src/routes/_authed.tsx`).

Conséquence : la section 9 (mobile) ci-dessous décrit des prérequis à poser, pas un existant. Toute ligne y est [à confirmer].

## 1. Stack

| Couche | Choix | Remarque |
|--------|-------|----------|
| Front | React 19.2 + TypeScript 6 + Vite 8 | [déduit du code] `package.json` |
| Framework | TanStack Start 1.168 (mode SPA, prerender du shell, `maskPath: '/'`) + TanStack Router 1.170 (file based, `src/routes/`) + TanStack Query 5.101 (installé, QueryClient créé, non utilisé par les écrans) | [déduit du code] les écrans lisent Supabase en `useEffect` + `useState`, pas en `useQuery` |
| Serveur de build | Nitro 3.0.260610-beta (`nitro/vite`) | [déduit du code] produit `.output/` ; aucune route serveur, aucune server function, aucun loader serveur |
| UI | Tailwind CSS 4.1 + `tw-animate-css` + `@tailwindcss/typography` ; shadcn/ui configuré (`components.json`, style new-york, base zinc) mais aucun composant shadcn installé (`src/components/ui/` absent) ; icônes lucide-react | [déduit du code] |
| Backend / BDD | Supabase, projet `chmijnxukwsfqlvaontf` « Mooveee », organisation `nepfuwmomxxpggysmwrf`, compte Ben (pas Lovable Cloud) | [déduit du code] `supabase/.temp/linked-project.json` ; région UE : [à confirmer] |
| Auth | Supabase Auth : (a) mode principal « code d'accès » = `signInWithPassword` avec un email déduit du préfixe du code (`CODE_EMAILS` dans `src/routes/login.tsx`) ; (b) mode secours = `signInWithOtp` magic link + code OTP 6 chiffres (`verifyOtp type email`) | [déduit du code] le mode (a) est annoncé provisoire « tant que le SMTP n'est pas branché » |
| Fichiers | Supabase Storage, 2 buckets privés : `child-photos` et `meeting-point-photos` (5 Mo, jpeg/png/webp, URL signées 1 h) | [déduit du code] migrations 0004 et 0014 |
| Fonctions serveur | Une Edge Function depuis le 11/10 : `access-code-login` (verify_jwt false, secret `ACCESS_CODE_EMAILS`, provisoire jusqu'à Brevo). Le reste de la logique composée est en RPC PL/pgSQL `security definer` | `supabase/functions/access-code-login/index.ts` |
| Tâches planifiées | pg_cron : `detect-opportunities` 03h15 quotidien ; calculs institutionnels le 1er du mois 03h30 | [déduit du code] migrations 0020 et 0023 |
| Hébergement | Vercel, team `beneloo`, projet `mooveeesss` (framework détecté « nitro », Node 24.x), dernier déploiement production READY du 14/08/2026 | vérifié via l'API Vercel le 11/10 |
| Domaine / DNS | `mooveee.app` (308 vers `www.mooveee.app`), DNS Cloudflare d'après `CLAUDE.md` | domaines vérifiés côté Vercel ; zone Cloudflare [à confirmer] |
| Protection Vercel | SSO activé sur toutes les URL sauf domaines personnalisés : les previews `*.vercel.app` exigent un compte Vercel de l'équipe | vérifié le 11/10 |
| Géocodage | Photon (OSM), `https://photon.komoot.io/api/`, sans clé, biais Belgique, appelé AUJOURD'HUI depuis le client | [déduit du code] `src/lib/places.ts`. Décision D6 du 11/10 : passage par une Edge Function proxy, plus aucune requête directe (C9) |
| Polices | Google Fonts (Fraunces, Manrope) chargées par `@import url(...)` dans `src/styles.css` | [déduit du code] appel tiers à chaque ouverture, voir section 4 |
| Emails transactionnels | Aucun aujourd'hui. Décision D2 du 11/10 : Brevo, branché d'abord dans Supabase Auth (SMTP custom), puis pour les invitations et notifications (C4, C8, C13) | |
| Paiement | Aucun, interdit par conception (interdits 1 à 3 de `CLAUDE.md`) | |
| Analytics / monitoring | Aucun. `@sentry/*` est seulement exclu du bundle Nitro | [déduit du code] |
| Tests | Aucun test automatisé dans le repo (0 fichier `*.test.*`, pas de Playwright ni Vitest). Vérifications faites à la main (Chrome, SQL) d'après `.claude/primer.md` | [déduit du code] |

## 2. Portabilité

- Projet Supabase sur le compte de Ben : oui. [déduit du code]
- Repo GitHub : `benspy2209/mooveee`, branche `main`, 80 commits, Vercel relié au repo (domaine `mooveeesss-git-main-beneloo.vercel.app`). [déduit du code]
- Dépendance à un service Lovable : aucune. Le projet est né avec `create-tsrouter-app` (`.cta.json`), pas avec Lovable. [déduit du code]
- Migrations versionnées dans `supabase/migrations/0001` à `0023`. Écart : les cinq dernières (0019 à 0023) ont été appliquées via le MCP Supabase et sont enregistrées en base sous des versions horodatées (`20260815084808_places_trajets_v4`, etc.), pas sous `0019`. `supabase migration list` affichera donc cinq fichiers locaux « non appliqués » et cinq versions distantes « sans fichier ». À réconcilier (`supabase migration repair`) avant toute nouvelle migration par CLI. [déduit du code, vérifié en base]
- Gestionnaire de paquets : npm (décision D1 du 11/10). `pnpm-lock.yaml` supprimé le 11/10 ; `pnpm-workspace.yaml` reste (contient `allowBuilds`), à vérifier s'il est encore utile.
- `README.md` est encore le gabarit TanStack (parle de `src/routes/demo/`, de server functions). À réécrire ou à remplacer par un renvoi vers `CLAUDE.md` et `docs/`. [déduit du code]

## 3. Conventions de code

- Langue du code : anglais pour les identifiants, français pour les commentaires et l'interface. Tables et colonnes `snake_case` au pluriel ; enums en français (`couvert_ouvert`, `en_attente`). [déduit du code]
- Alias d'import : `@/*` et `#/*` pointent tous deux sur `src/` (`tsconfig.json`) ; le code utilise `@/`. [déduit du code]
- Structure réelle :
  ```
  src/
    routes/            __root.tsx, index.tsx, login.tsx, _authed.tsx (layout + tab bar + bannières)
    routes/_authed/    activites, bienvenue, demandes, enfants, equilibre, foyer, hubs, semaine
    lib/               supabase.ts, auth.tsx (contexte), trips.ts (génération DST), places.ts (Photon),
                       concierge.ts, dropoff-reminders.ts, utils.ts
    components/        PlaceField.tsx (seul composant partagé)
    types/database.ts  types générés Supabase (régénérés après 0023)
    styles.css         tokens, shell, boutons, tab bar
  supabase/migrations/ 0001 à 0023
  scripts/             set-dev-password.ts, erase-user.ts (service_role, local uniquement)
  ```
- Les écrans sont monolithiques : `hubs.tsx` 1 970 lignes, `semaine.tsx` 1 622 lignes, `activites.tsx` 843 lignes. Aucun découpage en composants hors `PlaceField`. [déduit du code]
- Gestion des erreurs : message inline rouge (`bg-red-50`) par formulaire, `console.error` ailleurs. Pas de système de toast, pas de boundary d'erreur de route, pas de page 404 (`notFoundComponent` et `errorComponent` absents). [déduit du code]
- Formulaires : état React brut, validation HTML (`required`, `pattern`), aucun react-hook-form ni zod. [déduit du code]
- Données : lecture directe `supabase.from(...)` dans les écrans, patch optimiste sur `/semaine`, rechargement après échec sur `/demandes`. [déduit du code]
- Fuseau : saisie en heure belge, stockage UTC, arithmétique d'occurrences en calendrier `Europe/Brussels` (`src/lib/trips.ts`). Règle non négociable de `CLAUDE.md`. [déduit du code]

## 4. Sécurité

Règles en vigueur (détail et historique des six failles dans `CLAUDE.md`, section « Règles de sécurité apprises ») :

- RLS activée sur les 34 tables de `public`. Cinq tables ont RLS sans policy, volontairement muettes côté client : `institutions`, `institutional_messages`, `institution_usage_metrics`, `impact_snapshots`, `opportunity_matches` (confirmé par l'advisor Supabase du 11/10). [déduit du code]
- Rôle `anon` : aucune fonction exécutable (revoke global 0021 + `alter default privileges`). Rôle `authenticated` : 20 fonctions `security definer` exécutables, listées par l'advisor comme WARN « authenticated_security_definer_function_executable ». Chacune est voulue et vérifie l'identité de l'appelant ou ne renvoie que des identifiants du foyer courant ; à documenter comme exceptions assumées dans le dashboard. [déduit du code]
- Fonctions révoquées pour tous les rôles clients : `mooves_apply_movement`, `mooves_amount_for_distance`, `mooves_amount_for_band`, `solidarity_grant_apply`, `mooves_grant_initial_balance`, `users_grant_initial_balance`, `detect_opportunities`, `erase_user` (service_role seulement), `compute_institution_metrics`, `compute_impact_snapshots` (service_role seulement). [déduit du code]
- `hub_trips_view` : après 0024, vue sans `security_invoker` (droits du propriétaire), seule porte vers les trajets des autres foyers ; `trips` n'a plus que `trips_household_all`. [écrit, à appliquer]
- Deux fonctions sans `search_path` fixé : `trip_labels_similar` et `meeting_point_set_default` (advisor WARN). À corriger par migration. [vérifié en base]
- Clés côté client : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` seulement. `SUPABASE_SERVICE_ROLE_KEY` est lue par les deux scripts Node, jamais préfixée `VITE_`. [déduit du code]
- Données exposées dans le bundle : plus aucune depuis le 11/10 (build local vérifié : 0 email). La correspondance code → compte vit dans le secret `ACCESS_CODE_EMAILS` de l'Edge Function `access-code-login`. Le bundle live est à redéployer (push main).
- Protection mots de passe compromis (HaveIBeenPwned) désactivée côté Supabase Auth. Pertinent tant que le mode « code d'accès » (= mot de passe) existe. [vérifié en base]
- Données personnelles stockées : prénom et nom du parent, téléphone et code postal (colonnes présentes, non saisies par l'UI aujourd'hui), prénom et année de naissance de l'enfant, photo d'enfant sous consentement séparé, lieux publics d'activité, horaires de trajets, messages de demande libres, ledger Mooves. Durée de conservation : `erasure_delay_days = 30` dans `app_settings`, aucune purge automatique codée. [déduit du code]
- Table `consents` : existe avec RLS self, mais n'est jamais écrite par l'application. Aucun consentement (inscription, cercle intime, hub, photo enfant) n'est tracé en base ; le pacte de hub est tracé dans `hub_pact_acceptances`, et `children.photo_consent` est une case à cocher sans version de politique. [déduit du code]
- Sortie de données vers des tiers : texte saisi dans le champ lieu vers Photon (komoot), requêtes de police vers Google Fonts. Aucune donnée enfant ne part vers un service d'IA (interdit 7 respecté : aucun appel IA dans le code). [déduit du code]

## 5. Variables d'environnement

| Nom | Où | Usage |
|-----|----|-------|
| VITE_SUPABASE_URL | client (Vercel + `.env.local`) | URL du projet Supabase |
| VITE_SUPABASE_ANON_KEY | client (Vercel + `.env.local`) | clé publique anon ; le code lève une exception au démarrage si absente |
| SUPABASE_SERVICE_ROLE_KEY | local uniquement (`.env.local`, jamais Vercel) | `scripts/set-dev-password.ts`, `scripts/erase-user.ts` |
| SUPABASE_URL | local uniquement, optionnel | repli de `VITE_SUPABASE_URL` dans les scripts |
| ACCESS_CODE_EMAILS | secret Edge Function (Supabase) | JSON préfixe → email des comptes à code d'accès ; posé par `supabase secrets set` ; à supprimer avec le mode code (C4) |

Aucune variable serveur n'existe côté Vercel puisqu'aucun code serveur ne tourne au runtime. [déduit du code]

## 6. Intégrations externes

| Service | Usage | Appelé depuis | Coût |
|---------|-------|---------------|------|
| Supabase (Auth, PostgREST, Storage, pg_cron) | tout le backend | client + cron interne | plan [à confirmer] |
| Photon komoot.io | autocomplete de lieux publics | client, à la frappe (debounce 300 ms) | gratuit, sans SLA, conditions d'usage [à confirmer] |
| Google Fonts | Fraunces + Manrope | client, au chargement CSS | gratuit ; alternative : auto-héberger les fichiers woff2 |
| Vercel | hébergement statique + Nitro | build | plan team beneloo [à confirmer] |
| GitHub | source | push main = deploy | |

## 7. Performance et qualité

- Mobile d'abord : oui (tab bar, `max-w-md` sur la barre, écrans en colonne unique). [déduit du code]
- Lighthouse : jamais mesuré dans le repo. [à confirmer]
- Devtools TanStack (router + query) rendus dans `__root.tsx` sans garde `import.meta.env.DEV`. Vérifier qu'ils sont bien retirés du bundle de production par `@tanstack/devtools-vite` (`removeDevtoolsOnBuild`). [à confirmer]
- `<html lang="en">` alors que toute l'interface est en français : à corriger (lecteurs d'écran, césure, traduction automatique du navigateur). [déduit du code]
- Pas de `viewport-fit=cover` dans la meta viewport : sur iOS en WebView plein écran, `env(safe-area-inset-bottom)` vaut 0 et la tab bar passera sous la barre home. [déduit du code]
- Tests : aucun. Cible proposée en Phase 2 : Vitest sur `src/lib/trips.ts` (DST) et `concierge.ts` (fonctions pures), Playwright sur P1 à P4. [à confirmer]

## 8. Journal des décisions techniques (reconstitué)

| Date | Décision | Raison | Source |
|------|----------|--------|--------|
| 2026-08-02 | Repo créé avec create-tsrouter-app, pas Lovable | contrôle total du schéma et de la RLS | `.cta.json`, historique git |
| 2026-08-05 | Photos enfants en Storage privé, URL signées 1 h, suppression explicite | RGPD mineurs | migration 0004, primer |
| 2026-08-05 | Génération de trajets en calendrier Europe/Brussels | bug DST | `src/lib/trips.ts` |
| 2026-08-05 | Profils côté hub uniquement via RPC `hub_member_profiles` | une RLS filtre des lignes, pas des colonnes | 0008 + correctif a94bc09 |
| 2026-08-09 | Tranches de distance (courte/moyenne/longue) au lieu d'adresses ou de km | pas de géolocalisation domicile | migration 0015 |
| 2026-08-09 | Solde initial 60, déséquilibre 4 semaines | arbitrage porteur | migration 0016 |
| 2026-08-15 | Mode SPA tranché, aucun code serveur au runtime | encapsulation Capacitor future | `vite.config.ts`, `CLAUDE.md` |
| 2026-08-15 | Matching Macarons 3D abandonné, remplacé par `detect_opportunities()` en observation | doc v4 §12 | migration 0020 |
| 2026-08-15 | Connexion par code d'accès fixe en mode principal | SMTP Supabase plafonné bloque les tests | `login.tsx`, primer |
| 2026-08-15 | Tab bar 5 onglets, DA « lagoon » étendue à toute l'app | retour Ben « tristounet » | `styles.css`, primer |
| 2026-08-16 | Métriques institutionnelles par pg_cron, seuil de réidentification bloquant | interdit 3 et AIPD | migration 0023 |
| 2026-10-11 | npm seul ; Brevo ; Photon via Edge Function ; consentements et pacte versionnés en base ; prénom + initiale hors foyer ; règles D3 et D4 sur les trajets | rétro cadrage, décisions Ben | `docs/06-PLAN.md` §C |
| 2026-10-11 | `trips_hub_select` supprimée, `hub_trips_view` sans security_invoker, helper `trip_open_in_my_hubs` | app publique, trou B.2 | migration 0024 (écrite, à appliquer) |

## 9. Adaptation mobile (prérequis, rien n'existe)

Tout [à confirmer]. Hypothèse de travail : Capacitor sur la base React actuelle (cohérent avec la décision SPA du 15/08).

- Plateformes et versions minimales : iOS [16 ?], Android [API 26 ?].
- Build et signature : Xcode + compte Apple Developer ; Android Studio + keystore. Qui détient les comptes développeur (Hakuna Matata, le porteur, une ASBL) : à trancher, cela conditionne le nom de l'éditeur sur les stores.
- Deep links et URL scheme : indispensable pour le magic link. Piège connu : avec Capacitor, le callback Supabase arrive par `appUrlOpen` avec les tokens dans le fragment ; il faut appeler `supabase.auth.setSession` dans le listener, pas compter sur `detectSessionInUrl` ni sur le routeur. Le `emailRedirectTo: window.location.origin` actuel ne fonctionnera pas dans l'app.
- Notifications push : aucun code. Les trois accroches sont documentées (`lib/concierge.ts`, `lib/dropoff-reminders.ts`, `notification_preferences` non calibrée). Nécessitera une Edge Function ou un cron serveur + FCM/APNs + stockage de tokens push (table absente).
- Permissions natives : caméra et photothèque (photo enfant, photo point de rendez-vous). Pas de géolocalisation (interdit 6).
- Stockage local et hors ligne : la session Supabase est en `localStorage` ; aucune mise en cache de données, aucun état hors ligne. Un écran sans réseau reste sur « Chargement… ».
- Mises à jour : stores ; OTA (Capgo ou équivalent) [à décider].
- Capacitor et Supabase Storage : les URL signées 1 h fonctionnent dans la WebView ; l'upload via `<input type="file">` fonctionne mais la caméra directe demande le plugin Camera.
- Google Fonts par `@import` : à auto-héberger avant l'encapsulation (hors ligne, RGPD, latence au démarrage).
