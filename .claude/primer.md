# Primer Mooveee

Projet actif : Mooveee (client externe, partage de trajets enfants).
Séquence CLAUDE.md : étape 5 (hubs) livrée — socle + publication +
demandes de place. Contrainte 0006 ÉLARGIE par Ben en fin de 0009
(appliquée) : enfant rattachable à un trajet de son foyer OU à un
trajet hub avec demande acceptée (trip_child_hub_request_accepted).
Acceptation débloquée, message UI temporaire retiré (c4f39f2).

## Fait
- Auth magic link + onboarding profil /bienvenue (étape 1).
- Écran Mon Foyer complet /foyer (étape 2, commit b4d10ab) + migration
  0003 (appliquée par Ben, types régénérés aadb9e6).
- 05/08 : écran Enfants du foyer (616bc2a) : /_authed/enfants, liste
  (prénom, année, photo si photo_consent), ajout/édition inline,
  suppression confirmée deux temps, lien depuis /foyer. Prénom requis,
  année seule, rehausseur, consentement photo séparé. Aucun champ
  allergies/santé/géoloc.
- 05/08 : photo via Supabase Storage (e93784f) :
  - Migration 0004 (NON APPLIQUÉE, Ben pousse) : bucket child-photos
    privé (jamais public, 5 Mo, jpeg/png/webp = validation serveur),
    policies storage.objects select/insert/update/delete si
    (storage.foldername(name))[1] ∈ auth_household_ids().
  - Chemin {household_id}/{child_id}.{ext}, upsert au remplacement ;
    children.photo_url = chemin relatif, jamais d'URL publique.
  - Affichage par createSignedUrls (1 h), signature demandée UNIQUEMENT
    si photo_consent true.
  - Suppression Storage explicite (le cascade SQL ne le fait pas) :
    enfant supprimé, photo remplacée (ext différente), consentement
    retiré. Fichier supprimé AVANT la ligne enfant.
  - Upload sans consentement coché → refus avec message.

- 05/08 : écran Activités (7993a30) : /_authed/activites, groupées par
  enfant, ajout/édition/suppression confirmée. Ponctuel = rrule null +
  starts_at/ends_at ; hebdo = rrule iCal FREQ=WEEKLY;BYDAY=… +
  starts_at/ends_at comme ancre DTSTART portant les heures. Lieu texte
  libre, AUCUNE coordonnée GPS (lat/lng existent en base, non
  utilisées). Liens depuis /foyer et /enfants.
  - Migration 0005 (NON APPLIQUÉE, Ben pousse) : policy
    activities_household_all manquante — RLS était activée sans policy,
    table inaccessible avant application.

- 05/08 : vue Semaine + trajets (2f26f5a) : /_authed/semaine, 7 jours
  en colonnes 6h-22h, cartes positionnées par heure, couleur par
  enfant, nav semaine préc/suiv. Génération 4 semaines depuis les
  activités (aller domicile→lieu à starts_at, retour inverse à
  ends_at, trip_children liés). Occurrences hebdo calculées en
  calendrier Europe/Brussels (mur d'horloge réappliqué par date,
  jamais +7j UTC) — testé DST oct+mars, 16h reste 16h. Dédup par clé
  activité|direction|horaire : annulations et conducteurs survivent à
  la régénération. Conducteur = select membres du foyer (humain,
  jamais auto) → couvert/non_couvert ; annulation trajet unitaire
  (statut annule, rétablissable) sans toucher l'activité.
  published_to_hub false partout, private_note jamais exposée.
  - Migration 0006 (NON APPLIQUÉE, Ben pousse) : policy
    trip_children_household_all manquante (RLS sans policy) +
    contrainte cohérence enfant/foyer trip_children (fonction
    trip_child_household_match, même pattern que 0005 de Ben).

- 05/08 : horizon + idempotence (c0c8b4c) : horizon choisissable
  4 sem/3 mois (défaut)/6 mois/1 an ; upsert par lots de 200 avec
  progression X/Y ; ON CONFLICT DO NOTHING sur index unique
  trips_activity_occurrence_unique (migration 0007, NON APPLIQUÉE —
  index NON partiel exprès : NULLs distincts couvrent les trajets
  manuels, et un index partiel casserait l'inférence ON CONFLICT de
  PostgREST). Conducteurs/annulations jamais écrasés. Heures
  d'activité au pas de 15 min (step 900). Grille Semaine déjà
  proportionnelle aux minutes ; minutes vérifiées aux DST (16h45 OK).
- 05/08 : fixes /semaine (5aa77b0) : patch optimiste de la grille
  (conducteur/annulation affichés immédiatement, refetch en fond) ;
  détail trajet en modale centrée (Escape + clic fond pour fermer).
- 05/08 : hubs socle (8c491d7) : /_authed/hubs — création (nom, type,
  lieu, commune, join_code ABC123 sans caractères ambigus, retry sur
  collision 23505, owner = 1er membre validé admin, statut solo),
  adhésion par code via RPC hub_for_join_code (security definer, seule
  l'identité publique du hub), demande non validée → un admin valide
  (update) ou refuse (delete). Pacte v1.0 en dur, accepté à la
  création/adhésion, gate PactGate si version manquante, enregistré
  dans hub_pact_acceptances. Détail hub : statut + compteur validés +
  « encore N pour activer » (seuil app_settings), bannière visible à
  la bascule solo→active (trigger DB existant), join_code affiché aux
  admins seulement, membres validés prénom/nom.
  - Migration 0008 (NON APPLIQUÉE, Ben pousse) : helpers
    auth_hub_admin_ids / auth_hub_member_user_ids / hub_for_join_code ;
    hub_members_self_insert verrouillé (auto-validation/auto-admin
    interdits sauf owner bootstrap), admin update/delete ; policies
    hub_pact_acceptances (self select/insert, ni update ni delete) ;
    users_hub_select (noms entre co-membres de hub).
  - Correctif Ben (a94bc09) : users_hub_select SUPPRIMÉE (exposait
    téléphone/CP — RLS filtre les lignes, pas les colonnes). Profils
    côté hub UNIQUEMENT via RPC hub_member_profiles(p_hub). Types
    régénérés par Ben (0008 partiellement appliquée ?). Leçon dans
    tasks/lessons.md. Pas touché : publication trajets, matching,
    Mooves.

- 05/08 : publication hub + demandes (8429794) : modale /semaine →
  PublishSection (hub + places, conducteur requis, statut
  couvert_ouvert ; dépublier → couvert/non_couvert, seats null). Écran
  hub : « Trajets ouverts des autres familles » lu EXCLUSIVEMENT via
  hub_trips_view (à venir, couvert_ouvert, foyer propre exclu par
  driver_id), demande de place (enfant + message, unique en_attente
  par enfant/trajet, 23505 traduit). /demandes : envoyées (détails via
  la vue, enfant nommé côté demandeur seulement) + reçues (trips
  nested = MON foyer, légitime ; nom demandeur via hub_member_profiles,
  jamais users ; enfant du demandeur JAMAIS nommé côté conducteur).
  Accepter = rpc accept_trip_request (clic humain), Refuser = update.
  - Migration 0009 (NON APPLIQUÉE) : hub_trips_view recréée avec
    hub_user_first_name() (le join users direct renvoyait NULL depuis
    le retrait de users_hub_select) ; trip_requests_insert resserrée
    (foyer, enfant du foyer, trajet publié couvert_ouvert, jamais son
    propre trajet) ; index unique en_attente ; RPC accept_trip_request
    atomique (statut+trip_children+décrément+couvert si 0).
  - ⚠️ SIGNALÉ, NON CONTOURNÉ : la contrainte 0006
    trip_children_household_match bloque l'acceptation (enfant d'un
    AUTRE foyer par construction). Proposition de détente en
    commentaire dans 0009, arbitrage Ben requis. Message UI clair si
    l'erreur survient.

- 05/08 : fix génération (5766c1e) : rattachement enfant/trajet
  intégré à chaque génération, sur TOUS les trajets générés du foyer
  (rattrapage inclus, upsert ON CONFLICT DO NOTHING sur PK
  trip_id/child_id, pagination 1000). Cause du bug : liens posés
  uniquement sur les trajets nouvellement insérés → trajets créés
  avant l'application de la policy 0006 jamais rattrapés.
- seats_available TRANCHÉ par Ben le 05/08 : sémantique « places
  offertes aux autres familles », aucun calcul, labels renommés dans
  la modale de publication et la liste hub (fbc8d5c).

- 06/08 : système Mooves (aae259c), étape 7 :
  - Migration 0010 (NON APPLIQUÉE, Ben pousse) : barème
    mooves_distance_scale dans app_settings (30/40/50/60/70, paliers
    3/6/10/15 km, on conflict do nothing) ; mooves_amount_for_distance
    (distance null = 1er palier, noté en reason) ;
    mooves_apply_movement (ledger + balance même transaction, lit
    mooves_initial_balance si non-null en solde_initial, AUCUNE
    positivité) ; accept_trip_request étendu (gain conducteur + usage
    demandeur rattachés au trip, dans la MÊME transaction, pas de
    trigger) ; trigger fonds de solidarité → mouvement
    fonds_solidarite (mécanique base seule, pas d'UI).
  - AUCUNE policy d'écriture ledger/balance/grants côté client : deny
    by default = pas d'achat ni transfert possibles. Selects self de
    0001 suffisent.
  - /equilibre : strictement privé — aide apportée / aide reçue /
    dynamique de participation + historique. Vocabulaire imposé
    respecté (vérifié par grep : zéro solde/crédit/gagner/dépenser
    dans l'UI). Négatif = message rassurant, rien de bloqué. Lit
    mooves_imbalance_weeks (sans effet tant que null). Lien /foyer.

- 06/08 : fix acceptation (e88042d) : migration 0011 (NON APPLIQUÉE) —
  trip_children en ON CONFLICT DO NOTHING dans accept_trip_request,
  décrément places + Mooves UNIQUEMENT si insertion réelle
  (GET DIAGNOSTICS), demande accepte dans tous les cas. UI /demandes :
  rechargement de l'état réel après échec du RPC (plus d'affichage
  optimiste), idem sur refus.

- 06/08 : matching Macarons sans distance (e5b1336) :
  - Écran hub : « Suggestions pour votre foyer » — croisement client
    entre mes trajets non_couvert (lecture directe légitime, cercle
    intime) et les trajets ouverts de hub_trips_view : même direction,
    même jour bruxellois, fenêtre 90 min, libellé identique/similaire
    (normalisation accents + inclusion + chevauchement de tokens).
    Tri : identique > similaire, puis delta croissant. 3 explications
    par suggestion (horaire, lieu, écart en minutes), pas de score.
    Rien d'automatique : mêmes boutons demander/accepter.
  - ⚠️ Signal Mooves §5.5 : documenté dans compareSuggestions mais
    SANS effet pour l'instant — le niveau du demandeur est constant
    pour un même utilisateur, il ne peut pas départager ses propres
    suggestions. Sa vraie place = départage des demandes reçues côté
    conducteur (nécessite exposition croisée d'un signal → arbitrage
    Ben, signalé dans le message de livraison).
  - /semaine : trajet publié → compte des familles du hub au besoin
    correspondant (rpc hub_trip_matching_needs_count, un compte jamais
    une liste, réservé au foyer conducteur).
  - Migration 0012 (NON APPLIQUÉE) : trip_labels_similar +
    hub_trip_matching_needs_count (security definer, revoke
    public/anon, grant authenticated). Fenêtre 90 min alignée
    client/SQL.

- 09/08 : connexion de développement (91287ee) — SMTP Supabase plafonné
  bloquait les tests multi-comptes. scripts/set-dev-password.ts
  (service_role via SUPABASE_SERVICE_ROLE_KEY dans .env.local, jamais
  VITE_, refus si absente ; npm run set-dev-password -- email mdp) +
  bloc mot de passe sur /login gaté import.meta.env.DEV (vérifié
  absent du bundle prod par grep). Magic link = seul mode du produit
  réel. Comptes de test : debruijneb@gmail.com (foyer Benjamin),
  ben@beneloo.com (Foyer de Steph). Orphelins à ne pas toucher :
  swauquaire@gmail.com, benspy@gmail.com.

- 09/08 : étape 8 sécurité enfant (32dc3e2), migration 0014 (NON
  APPLIQUÉE) :
  - Les 3 tables muettes de 0001 ont leurs policies : meeting_points
    (select membres validés, écriture admins, un défaut/hub par index
    partiel, RPC meeting_point_set_default en SECURITY INVOKER),
    trip_dropoff_confirmations (insert conducteur du trajet + enfant à
    bord, select parent de l'enfant OU conducteur, delete auteur, pas
    d'update), hub_bridges (select membres des 2 hubs, AUCUNE policy
    d'écriture — deny assumé jusqu'à construction des ponts §9.1).
  - trip_children_aboard (definer, revoke public/anon) : prénoms des
    enfants à bord réservés au conducteur (driver_id = auth.uid()) —
    élargissement assumé §12.2, seul chemin nominatif vers lui.
  - trip_request_first_contact (definer) : fenêtre de confiance §12.3,
    vrai si les 2 foyers n'ont aucune demande acceptée entre eux.
  - Contrainte trips_meeting_point_in_hub, bucket privé
    meeting-point-photos ({hub_id}/{mp_id}.{ext}, lecture membres,
    écriture admins), app_settings dropoff_reminder_minutes = 20.
  - UI : section points de rendez-vous dans le hub (CRUD admin, photo,
    défaut), choix du point à la publication + affichage cartes hub ;
    bulletin de dépôt par enfant dans le détail trajet (conducteur) ;
    /demandes : statut de dépôt côté parent (heure ou « en attente »),
    rappel premier contact sur les demandes reçues en attente ;
    bannière de relance conducteur dans _authed (délai app_settings,
    lookback 24 h), accroche push documentée dans
    lib/dropoff-reminders.ts. Types database.ts étendus À LA MAIN pour
    les 3 RPC (la régénération les écrasera proprement).

- 09/08 : navigation (dfb7b36) — header _authed avec menu hamburger
  mobile-first (7 écrans + Se déconnecter, page courante marquée,
  fermeture lien/extérieur/Escape), liens d'en-tête retirés des 6
  écrans (les CTA contextuels et cartes du foyer restent). Racine / :
  connecté → /foyer, anonyme → /login (atterrissage magic link) ;
  /login → /foyer si connecté ; page scaffold supprimée. Bannière de
  relance passée sous le header (plus sticky).

- 09/08 : tranches de distance, arbitrage porteur (migration 0015 NON
  APPLIQUÉE) — enum distance_band courte/moyenne/longue (menu
  déroulant, jamais saisie libre/adresse/coordonnées, distance_km
  reste null). Barème 5 paliers CONSERVÉ, correspondance par max_km :
  courte→30 (max_km 3), moyenne→50 (palier central max_km 10),
  longue→70 (dernier). activities.distance_band not null default
  courte (existantes basculées), trips.distance_band nullable,
  backfill migration + rattrapage à chaque génération (comme les
  enfants). accept_trip_request : tranche d'abord, sinon distance_km,
  sinon premier palier noté. Formulaire activité : « Distance du
  trajet depuis le domicile », défaut tranche courte.

- 09/08 : solde initial (migration 0017 NON APPLIQUÉE) — trigger
  after insert sur users → mooves_grant_initial_balance (definer,
  révoquée, leçon 0016) : crédit unique de mooves_initial_balance (60
  depuis 0016) à la création du profil /bienvenue, rien si null.
  Idempotence : test d'existence + index unique partiel (user_id)
  where movement='solde_initial'. mooves_apply_movement purgée de sa
  branche « premier mouvement » (double crédit sinon). Rattrapage des
  comptes existants dans la migration (Benjamin + 2 Stéphane, soldes
  modifiés = attendu). Aucun changement UI ni types nécessaires.
  Ben a posé 0016 : revoke mooves_amount_for_band (oubli 0015, leçon
  dans tasks/lessons.md) + paramètres porteur (initial 60, déséquilibre
  4 semaines).

## Next step exact
0. Ben : SUPABASE_SERVICE_ROLE_KEY dans .env.local (dashboard →
   Project Settings → API → service_role), puis
   npm run set-dev-password -- debruijneb@gmail.com <mdp> et idem
   ben@beneloo.com. Si « provider disabled » à la connexion :
   Authentication → Sign In / Providers → activer Email password.
1. Ben applique les migrations manquantes jusqu'à 0017, régénère les
   types.
2. Tester étape 8 : créer un meeting point (admin), publier avec point,
   accepter une demande premier contact (rappel visible), confirmer un
   dépôt côté conducteur, vérifier l'heure côté parent, bannière de
   relance après le délai.
3. Étape 9 : mode Concierge, automatisations de base.

## Blockers
- Migrations : 0009 appliquée par Ben (contrainte élargie, types
  régénérés). Statut exact de 0004→0008 non confirmé un par un —
  vérifier au premier test si une policy manque.
- .gitignore modifié non commité (préexistant, pas touché).
