# PRD : Mooveee

> Rétro cadrage du 11/10/2026. Reconstitué depuis le code (commit e68b1d0), `CLAUDE.md`, `.claude/primer.md` et les trois documents du porteur tels qu'ils y sont cités. [déduit du code] = observé dans le repo ; [à confirmer] = à valider par Ben ou le porteur Stéphane. Ce PRD décrit ce que l'application FAIT, pas ce que les documents du porteur promettent : les écarts sont listés en §8 et dans `docs/06-PLAN.md`.

## 1. Le problème
- Pour qui : parents belges (Bruxelles et Brabant wallon d'après les lieux de test) dont les enfants ont des activités régulières (école, club, conservatoire) nécessitant des trajets en voiture. Secondairement, les institutions qui fédèrent ces familles (école, club, commune). [déduit des enums `hub_kind` et `institutions.kind`]
- Le problème : chaque foyer conduit seul, sur les mêmes trajets que ses voisins, sans outil de confiance pour partager. [déduit du Doc1 cité dans `CLAUDE.md`]
- Comment ils s'en sortent aujourd'hui : groupes WhatsApp, arrangements informels. [à confirmer]
- Pourquoi maintenant : pilote avec de vraies familles envisagé après validation DPIA ; données de test du porteur attendues depuis mi-août 2026. [à confirmer]

## 2. La promesse
Mooveee permet à des familles qui se connaissent par une école, un club ou un quartier de partager les trajets de leurs enfants, sans argent entre parents et sans jamais exposer les enfants hors du cercle de confiance.

## 3. Utilisateurs et rôles

| Rôle | Ce qu'il fait | Ce qu'il ne peut pas faire |
|------|---------------|----------------------------|
| Anonyme | voit /login ; se connecte par code d'accès (provisoire) ou par email (lien magique ou code 6 chiffres) | rien d'autre : `anon` n'exécute aucune fonction, aucune table n'est lisible |
| Parent sans foyer | crée son profil (/bienvenue), crée un foyer ou attend une invitation | enfants, activités, trajets, hubs (écrans en appel à l'action) |
| Membre de foyer | gère enfants, activités, trajets, notes privées ; voit les membres du foyer ; rejoint un hub ; demande des places ; consulte son équilibre privé | modifier les membres (admin seul) ; voir le solde d'un autre |
| Admin de foyer | tout ce qui précède + rôles et retrait des membres, invitations | ajouter un membre d'autorité (l'entrée est volontaire) |
| Membre de hub validé | voit les membres (prénom, nom), les trajets ouverts, les points de rendez-vous ; demande une place ; publie ses trajets ; signale un passage ; voit les suggestions | voir un prénom d'enfant d'un autre foyer (sauf conducteur, enfants à bord) ; voir téléphone, email, code postal |
| Admin de hub | valide ou refuse les adhésions, gère les points de rendez-vous, voit le code d'adhésion, reçoit les alertes Concierge du hub | exclure un membre validé (aucune UI), activer un pont ou une relation de hub |
| Conducteur d'un trajet publié | accepte ou refuse les demandes, voit les prénoms des enfants à bord, confirme les dépôts | être assigné automatiquement |
| Opérateur (Ben, service_role) | applique les migrations, efface un compte (`erase_user`), lit les logs d'opportunités, pose les codes d'accès | tout cela sans trace applicative : aucune UI d'administration |
| Institution | aucun accès aujourd'hui (tables muettes) | tout |

## 4. Fonctionnalités

### Livrées (V1 telle que codée) [déduit du code]
- F1 Connexion et profil : code d'accès (préfixe → email, mot de passe Supabase), ou email avec lien magique et code OTP ; onboarding prénom/nom ; déconnexion.
- F2 Foyer : création, rôles (parent, beau-parent, grand-parent, autre référent), admin, retrait, invitations par email (ligne en base seulement).
- F3 Enfants : prénom, année de naissance, rehausseur, photo sous consentement séparé (Storage privé, URL signée 1 h, suppression explicite).
- F4 Activités : ponctuelle ou hebdomadaire (rrule), lieu public avec autocomplete Photon et favoris du foyer, tranche de distance (courte, moyenne, longue), génération automatique des trajets sur 3 mois à l'enregistrement.
- F5 Semaine et trajets : timeline par jour, navigation semaine, génération idempotente jusqu'à 1 an, attribution humaine du conducteur, annulation et rétablissement, aller/retour lié, notes privées, « Je passe par là » (trajet adulte sans enfant, publié).
- F6 Hubs : création avec code d'adhésion, adhésion par code validée par un admin, pacte v1.0 obligatoire, statut En démarrage → Actif à 5 membres, points de rendez-vous avec photo et défaut, alertes Concierge hub (stagnant, inactif).
- F7 Partage au hub : publication d'un trajet avec places offertes et point de rendez-vous, liste des trajets ouverts des autres familles via la vue filtrée, demande de place (enfant + message), acceptation transactionnelle ou refus par le conducteur, suivi des demandes envoyées et reçues.
- F8 Suggestions : croisement local entre mes besoins non couverts et les trajets ouverts (même sens, même jour, 90 min, lieu similaire), compte des familles du hub ayant un besoin compatible côté conducteur. Propose, n'assigne jamais.
- F9 Sécurité enfant : bulletin de dépôt par enfant (conducteur), relance après 20 min, rappel de premier contact entre deux foyers qui n'ont jamais partagé, statut de dépôt visible par le parent.
- F10 Mooves : équilibre d'entraide strictement privé (aide apportée, aide reçue, dynamique de participation, historique), solde initial 60 à la création du profil, gain par tranche (30/50/70) à l'acceptation, négatif autorisé, fonds de solidarité en base, message d'aide après 4 semaines de déséquilibre.
- F11 Concierge (lecture seule, au chargement) : rappel 24 h avant un trajet (conducteur et parents d'enfants à bord), hub solo stagnant 3 semaines, hub actif sans publication 3 semaines, déséquilibre durable.
- F12 Lieux intelligents (v4 §7) : référentiel `places` partagé, dédoublonné par identifiant OSM, favoris par foyer, propagation sur les trajets.
- F13 Backend sans interface : détection nocturne d'opportunités en observation silencieuse (v4 §12), métriques institutionnelles mensuelles sous seuil de réidentification, effacement RGPD complet par l'opérateur, schéma du défraiement bénévole (inactif).

### Plus tard (hors V1, explicitement)
- Notifications push et emails (invitations, rappels, demandes) : accroches documentées, rien de câblé. [déduit du code]
- Encapsulation mobile Capacitor, publication sur les stores. [déduit de `CLAUDE.md`]
- Tableau de bord institution (vues agrégées uniquement), messages institutionnels. [tables présentes, muettes]
- Ponts entre hubs (`hub_bridges`) et relations de proximité (`hub_relations`, gelé `prepared`). [v4 §6]
- Signalement et escalade humaine (`reports`), messagerie (`messages`). [tables jamais utilisées]
- Consentements versionnés (`consents`). [table jamais écrite]
- Garde alternée (un enfant dans deux foyers). [dette `CLAUDE.md`]
- Activation des notifications d'opportunité après revue des logs avec le porteur. [v4 §12.3]
- Module défraiement : logique métier après validation juridique vecteur par vecteur.

### Jamais (les neuf interdits de `CLAUDE.md`)
Donnée financière liée aux Mooves ; paiement entre utilisateurs ; facturation au trajet ; assignation automatique ; score de contribution public ; géolocalisation enfant ; donnée enfant vers une IA externe ; dégradation d'un hub non certifié ; sortie du cercle intime sans filtrage. Plus : champ santé/allergies enfant (décision du porteur).

## 5. User stories et critères d'acceptation (reconstitués)

- US1 (F1) : En tant que parent, je veux me connecter sans mot de passe pour accéder à mon foyer.
  - Critère : saisie d'un email → email reçu avec lien et code ; code à 6 chiffres accepté → redirection /foyer. [à confirmer : le template Supabase doit contenir `{{ .Token }}`, et le SMTP n'est pas branché, donc ce critère n'est pas vérifiable en production aujourd'hui]
- US2 (F1) : En tant que nouveau connecté, je veux saisir mon prénom pour que les autres familles me reconnaissent.
  - Critère : sans profil, toute route protégée redirige vers /bienvenue ; prénom obligatoire ; solde initial 60 posé par trigger.
- US3 (F2) : En tant que parent, je veux créer mon foyer et y voir les autres adultes référents.
  - Critère : création = membre admin ; un membre non admin ne voit pas les boutons de gestion.
- US4 (F2) : En tant qu'admin de foyer, je veux inviter un co-parent par email.
  - Critère actuel : une ligne `household_invitations` est créée et listée. Aucun email n'est envoyé et l'invité n'a aucun parcours pour rejoindre. [écart : US non terminée]
- US5 (F3) : En tant que parent, je veux enregistrer mon enfant avec le minimum de données.
  - Critère : prénom obligatoire, année seule, rehausseur ; photo refusée sans consentement coché ; photo supprimée du Storage au retrait du consentement et à la suppression de l'enfant.
- US6 (F4) : En tant que parent, je veux déclarer une activité récurrente pour que ses trajets apparaissent sans ressaisie.
  - Critère : hebdo à 16h → trajets aller à 16h et retour à ends_at chaque semaine sur 3 mois, heure inchangée aux changements d'heure ; régénération n'écrase ni conducteur ni annulation.
- US7 (F5) : En tant que parent, je veux désigner qui conduit chaque trajet.
  - Critère : liste des membres du foyer ; choix humain ; statut couvert/non couvert ; jamais d'attribution par le système.
- US8 (F6) : En tant que parent, je veux rejoindre le hub de l'école avec un code et accepter le pacte.
  - Critère : code 6 caractères → identité publique du hub ; demande en attente ; validation par un admin ; pacte v1.0 accepté et tracé ; sans pacte, le détail du hub est bloqué.
- US9 (F7) : En tant que conducteur, je veux offrir des places sur un trajet au hub.
  - Critère : conducteur requis ; places 1 à 8 ; point de rendez-vous facultatif ; le trajet apparaît aux autres familles via la vue, sans prénom d'enfant ni note privée.
- US10 (F7) : En tant que parent, je veux demander une place pour mon enfant.
  - Critère : un seul enfant de mon foyer par demande ; une seule demande en attente par enfant et trajet ; jamais sur mon propre trajet ; le conducteur voit mon prénom, jamais le prénom de mon enfant avant acceptation.
- US11 (F7) : En tant que conducteur, je veux accepter une demande en un clic sans risque de double.
  - Critère : RPC atomique ; places décrémentées et Mooves mouvementés une seule fois même en double clic ; en cas d'échec l'écran recharge l'état réel.
- US12 (F9) : En tant que conducteur, je veux confirmer le dépôt de chaque enfant.
  - Critère : liste nominative réservée au conducteur ; relance affichée 20 min après l'heure sans confirmation ; le parent voit l'heure de dépôt.
- US13 (F10) : En tant que parent, je veux comprendre mon équilibre d'entraide sans qu'il soit visible des autres.
  - Critère : écran privé, vocabulaire imposé, aucun chiffre côté hub, message d'aide (jamais de reproche) après 4 semaines négatives.
- US14 (F8) : En tant que parent, je veux voir les trajets du hub qui correspondent à mes besoins.
  - Critère : suggestions expliquées (horaire, lieu, écart en minutes), triées, sans score ; même boutons que la liste.
- US16 (F11) : En tant que parent, je veux être rappelé de mes trajets et des dépôts à confirmer.
  - Critère actuel : bannières à l'ouverture de l'app (trajet dans les 24 h, dépôt non confirmé 20 min après l'heure), masquables sans persistance. Aucune notification hors de l'app. [écart : critère du Doc1 §12.2 non atteint sans push ou email]
- US15 (F13, opérateur) : En tant qu'opérateur, je veux effacer un compte à sa demande.
  - Critère : `npm run erase-user -- <email>` purge Storage puis base ; trajets tiers détachés ; foyer voisin intact. Testé le 15/08 et le 16/08.

## 6. Mesure de réussite
- Indicateur principal : trajets partagés (demandes acceptées) par hub actif et par mois. [à confirmer]
- Seuil V1 : [à définir avec le porteur]. Les métriques existent en base (`institution_usage_metrics.trips_volume`, `impact_snapshots.trips_shared`) mais ne sont lisibles par aucun écran et ne sont générées qu'au-delà de 12 familles.
- Comment on le mesure : SQL par l'opérateur ; pas d'analytics produit.

## 7. Contraintes
- Langue : français (fr-BE) seulement ; `<html lang="en">` à corriger.
- RGPD : données de mineurs (prénom, année, photo consentie, trajets, présence à bord). DPIA non validée ; aucun pilote avec de vraies familles avant validation (`CLAUDE.md`). Table `consents` jamais alimentée. Durée de conservation déclarée 30 jours pour l'effacement, pas de purge automatique.
- Hébergement : Supabase `eu-west-1` (Irlande, UE), Vercel team beneloo, domaine `mooveee.app`. Région Vercel des fonctions sans objet (statique).
- Budget mensuel : [à confirmer].
- Échéance : [à confirmer]. Retours du porteur attendus sur le parcours de test depuis le 15/08/2026.
- Documents d'autorité : Note d'arbitrage Mooves v2 > Instructions Techniques Partenaire v4 (étiquetée « Version 3 », divergence à clarifier avec Stéphane) > Doc1 De A à Z v4.

## 8. Décisions et questions ouvertes
Tranché le 11/10/2026 (détail `docs/06-PLAN.md` §C) : npm ; SMTP Brevo puis retrait du code d'accès ; trajets futurs non publiés supprimés et trajets publiés annulés avec notification quand une activité change ; dépublication ou retrait du conducteur interdits sans annulation explicite notifiée, places recalculées depuis les demandes actives ; prénom plus initiale hors foyer, email des invités réservé à l'invitant et aux admins ; Photon derrière une Edge Function ; consentements tracés en base avec version et horodatage ; pacte en base, versionné, lié aux consentements.

Ouvertes, à voir avec le client :
- Pilote et DPIA : date, qui valide.
- Distance des trajets : rester sur les tranches déclarées ou calculer depuis `places` (arbitrage porteur toujours requis).
- Garde alternée : la modéliser ou l'exclure du pilote.
- Signal Mooves dans le départage des demandes reçues (exposition croisée d'un niveau qualitatif) : oui ou non.
- Mobile : Capacitor ou web mobile seul pour le pilote ; qui détient les comptes développeur.
- Divergence « v4 » / « Version 3 » du document partenaire.
