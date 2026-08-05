# Primer Mooveee

Projet actif : Mooveee (client externe, partage de trajets enfants).
Séquence CLAUDE.md : étape 5 (hubs) — socle livré, publication des
trajets vers le hub à venir (2e prompt).

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

## Next step exact
1. Ben applique les migrations 0004 → 0008, puis régénère les types.
2. Tester : activités → Générer les trajets → attribuer conducteur,
   annuler/rétablir, naviguer les semaines.
3. Étape 5 : statuts de hub et transition solo → active.

## Blockers
- Migrations 0004/0005/0006/0007 pas appliquées → photos, activités
  et vue Semaine échoueront tant que non poussées (0007 requise pour
  le ON CONFLICT de la génération).
- .gitignore modifié non commité (préexistant, pas touché).
