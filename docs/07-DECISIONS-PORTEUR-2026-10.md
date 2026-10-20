# 07 — Décisions du porteur, octobre 2026 (référence unique)

Statut : **brouillon Ben du 18/10/2026**, à relire puis envoyer à Stéphane.
Source : réponses de Stéphane aux questions 3 à 7 (messages des 11 et
18/10/2026). Les réponses 1 et 2 (pilote, mobile) sont déjà reportées en
`06-PLAN.md` section C (Q1, D9).

Ce document répond à la demande de Stéphane (question 7) : une référence
datée et numérotée qui distingue les décisions produit retenues (partie A),
ce qui est prévu pour le pilote du 2 novembre et sa faisabilité (partie B),
et les mécanismes financiers qui exigent un examen professionnel avant
activation (partie C). La partie D liste les contradictions avec les anciens
documents. La partie E, les décisions qui restent à prendre.

Règle de lecture : tant qu'une décision de la partie A n'est pas reportée
dans `CLAUDE.md`, `01-PRD.md`, `02-TRD.md` ou `05-BACKEND-SCHEMA.md`, ce sont
ces documents qui s'appliquent au code. Les mécanismes de la partie C ne
sont **jamais** codés avant la levée de leur réserve.

---

## A. Décisions produit retenues (P = porteur, 11/10/2026)

| # | Sujet | Décision | Reportée dans |
|---|-------|----------|---------------|
| P10 | Garde alternée | Un enfant garde une seule fiche et un seul calendrier, mais peut être rattaché à **plusieurs foyers**. Le principe central est « l'enfant et son cercle d'adultes habilités ». Les périodes de garde sont facultatives. L'accès au calendrier d'un enfant ne donne accès ni aux autres enfants ni aux informations privées de l'autre foyer. | à faire : 01, 02, 05, CLAUDE.md (dette « Garde alternée ») |
| P11 | Modifications de trajet | Tout trajet organisé affiche son statut et son conducteur. Toute modification trace **qui, quand, quoi**. Si un conducteur a accepté, un changement d'horaire, de lieu, d'enfant ou de conducteur exige une **nouvelle confirmation** des personnes concernées ; la proposition ne remplace jamais l'accord existant. Une annulation est signalée immédiatement et reste visible. Deux adultes ne peuvent pas créer des engagements contradictoires pour le même déplacement : conflit détecté, résolution demandée. | à faire : 01, 03 ; complète D3, D4 |
| P12 | Mooves, compteur | Chaque famille démarre à **100 Mooves** (était 60, arbitrage d'août). Gain quand on transporte les enfants d'autres familles, usage quand on en bénéficie. Information **privée** au conducteur sur sa contribution et son excédent au-dessus de 100 ; information privée à la famille bénéficiaire en cas de déséquilibre durable. Aucune alerte négative côté conducteur sur le solde d'une autre famille, aucun classement public, liberté d'accepter ou refuser. | à faire : `app_settings.mooves_initial_balance` 60 → 100 (migration) ; 01, 05 |
| P13 | Mooves, volet financier | **Cible** : recharge payante pour rééquilibrer, fonds alimenté par les recharges, avantages pour les conducteurs excédentaires (socle de 100 conservé), partenaires (remises), financement communal pour familles en difficulté. Hypothèses : 1 Moove ≈ 0,10 €, 0,40 €/km soit 4 Mooves/km. **Rien n'est activé avant examen professionnel** (partie C). | aucun report dans le code ; voir C |
| P14 | Distance | Avant acceptation : zone de départ et destination sans adresse personnelle, distance **par tranches** (< 2 km, 2 à 5 km, …), horaire, estimation du détour en minutes pour le conducteur. Après acceptation : lieu exact convenu, partagé avec les seules personnes concernées, de préférence un point de rendez-vous plutôt que le domicile. L'affichage par tranches reste distinct du calcul interne, qui peut être plus précis pour les Mooves. | à faire : 01, 02 ; clôt Q7 du plan |
| P15 | Notifications | Priorité aux **notifications mobiles liées aux trajets dès le pilote**, sans SMS. Deux actions distinctes : « J'ai pris connaissance » (lecture, notamment d'une annulation) et « J'accepte la modification » (changement sur un trajet déjà accepté). La notification ouvre le trajet concerné. L'application enregistre qui a confirmé et quand, et montre les confirmations attendues. Une annulation apparaît comme telle même sans accusé de lecture. Proche du départ, l'absence de confirmation est signalée pour appel téléphonique. L'envoi n'est jamais une preuve de lecture. Hors pilote : rappels secondaires, dont ceux liés aux Mooves. | à faire : 01, 02, 03, 05 ; remplace la ligne C13 du plan |
| P16 | Référence documentaire | Stéphane ne confirme pas que le fichier « v4 » (mention « Version 3 » en page de garde) est la dernière version consolidée. Ben renvoie le fichier exact. Le présent document devient la référence des arbitrages d'octobre. | fichier à envoyer : `~/Documents/WORK/Projets_Clients/mooveee/MOOVEEE_Instructions_Techniques_Partenaire_v4.docx` (37 746 octets, reçu le 15/08/2026) |

---

## B. Pilote du 2 au 6 novembre 2026 : ce qui est réalisable

Cadre rappelé : stage de tennis à Rhode-Saint-Genèse, 10 à 15 familles,
hub fermé, PWA installée (D9), aucune vraie famille sans DPIA validée
(règle `CLAUDE.md`). Il reste **dix jours ouvrés** entre le 19/10 et le
30/10. Les P0 déjà planifiés (C1 à C6, C14, CP) occupent l'essentiel de
ce temps à eux seuls.

### B1. Utilisable au pilote sans développement nouveau

- Compteur privé des Mooves : ledger, solde, écran d'équilibre privé,
  barème par tranche (30/40/50/60/70), message Concierge privé après
  4 semaines de déséquilibre. Un paramètre à changer : solde initial 100.
- Information privée au conducteur sur sa contribution : l'écran
  d'équilibre existe. L'« excédent au-dessus de 100 » est un libellé à
  ajouter, sans nouvelle donnée (une demi-journée).
- Fonds de solidarité : la table `solidarity_fund_grants` et son trigger
  existent (crédit à une famille par une institution ou un sponsor
  nommé, sans parent payeur). C'est la brique du financement communal
  de P13, mais **sans UI et sans argent** : aucune activation au pilote.
- Points de rendez-vous par hub, bulletin de dépôt, fenêtre de confiance.
- Distance par tranches : le conducteur déclare déjà `distance_band`
  (courte, moyenne, longue) sur le trajet. Pour le pilote, toutes les
  familles vont au même club : un affichage « zone (code postal) →
  club » suffit.

### B2. À développer pour le pilote, faisable si tout le reste tient

**Notifications de trajet (P15), périmètre minimal.** Estimation revue :
cinq à six jours, contre trois à quatre pour la seule infrastructure push
estimée avant la question 6. Découpage :

1. Table `notifications` en base (destinataire, trajet, type, créée le,
   lue le, confirmée le, action attendue : aucune / prise de
   connaissance / acceptation). C'est la **source de vérité** et la
   preuve de lecture : l'écran « Mes notifications » dans l'app
   fonctionne même si le push n'arrive jamais. Un jour et demi.
2. Web Push : table `push_subscriptions`, clés VAPID, Edge Function
   `send-push` déclenchée à l'insertion d'une notification, demande de
   permission après un geste dans l'app installée. Le contenu du push
   est **neutre** (« Un trajet a changé. Ouvrez Mooveee. ») et ouvre le
   trajet : aucun prénom d'enfant ne transite par les serveurs d'Apple
   ou de Google (interdit 7). Deux jours.
3. Repli email Brevo (dépend de C4) pour toute notification non poussée
   dans les minutes qui suivent, ou si l'utilisateur n'a aucun abonnement
   push. Une demi-journée une fois C4 livré.
4. Événements couverts : demande reçue, acceptée, refusée, annulation
   d'un trajet, retrait du conducteur. Branchés dans les RPC existants
   et dans C6. Un jour.
5. Confirmation « J'ai pris connaissance » sur l'annulation, avec
   horodatage et liste des confirmations attendues visible du
   conducteur et des parents du trajet ; bandeau « confirmation
   manquante, appelez » quand le départ est à moins de 2 h (paramètre
   `app_settings`). Un jour. Le partage du numéro de téléphone entre
   personnes d'un même trajet accepté est un prérequis : `users.phone`
   existe mais n'est jamais saisi ; il faut la saisie au profil et une
   fonction `security definer` limitée au cercle du trajet.

**Conditions côté téléphones (réponse à la question de Stéphane).**

- Android : Chrome ou Edge. Le push fonctionne dans le navigateur et
  dans l'app installée. Depuis Android 13, le système demande en plus sa
  propre autorisation de notifications. Les économiseurs de batterie de
  certains constructeurs (Samsung, Xiaomi) peuvent retarder la
  réception : à signaler dans la feuille d'accueil du pilote.
- iPhone : le push web n'existe **que pour une app ajoutée à l'écran
  d'accueil** (iOS 16.4 minimum), jamais dans Safari ouvert sur le site.
  L'autorisation est demandée après un geste dans l'app installée. Le
  mode Concentration et le mode Ne pas déranger retardent l'affichage.
- Dans les deux cas : la réception n'est pas garantie et l'envoi n'est
  jamais une preuve. La preuve est l'action dans l'app (point 1).

**Secours quand un parent refuse ou ne peut pas recevoir** : email Brevo
(point 3), écran « Mes notifications » avec pastille à l'ouverture, et le
bandeau d'appel téléphonique proche du départ (point 5). Aucun SMS.

### B3. Reporté après le pilote, avec le principe qui tient lieu de solution

**Modification d'un trajet accepté (P11, P15 « J'accepte la
modification »).** Au pilote, un trajet accepté est **immuable**. Changer
l'horaire, le lieu ou le conducteur revient à annuler le trajet (notifié,
à confirmer) puis à en publier un autre, que les parents redemandent et
que le conducteur réaccepte. La « nouvelle confirmation des personnes
concernées » est obtenue par construction, et rien ne remplace
silencieusement l'accord existant. Le flux complet (proposition de
changement, acceptation par chaque partie, application atomique,
journal qui / quand / quoi, détection de conflit entre deux adultes) est
un chantier de quatre à cinq jours, à planifier après le 6/11.

**Garde alternée (P10).** Le schéma actuel rattache un enfant à un seul
foyer (`children.household_id`), et les six fonctions d'accès, les
policies RLS et la contrainte `trip_children_household_match` reposent
dessus. Le modèle demandé exige une table de rattachement enfant ↔ foyer
(ou enfant ↔ adulte habilité) avec droits par adulte, la révision de
toutes les policies touchant `children`, `activities`, `trips`,
`trip_children`, et une vue « mes calendriers » qui agrège les enfants
auxquels un adulte a accès. Cinq à huit jours, hors tests. Pour le pilote,
une famille séparée inscrit l'enfant dans un seul foyer ; l'autre parent
peut être invité comme membre de ce foyer s'ils l'acceptent tous deux.
À dire explicitement aux familles du stage.

**Détour en minutes et distance calculée (P14).** Les tranches déclarées
suffisent au pilote. Le calcul exact (domicile flouté au code postal →
point de rendez-vous ou lieu public) demande un moteur d'itinéraire tiers
appelé depuis une Edge Function, sans donnée enfant dans la requête.
Deux jours, après le pilote.

**Rappels secondaires** (dépôt, Mooves, hub inactif) : la détection
existe côté client ; leur envoi en push suit l'infrastructure de B2.

### B4. Ce que le pilote exige par ailleurs (inchangé)

C1 hygiène, C2 erreurs, C3 tests, C4 Brevo, C5 consentements et pacte en
base avec textes validés, C6 cohérence des trajets, C14 PWA, CP stage
(date de fin d'activité, comptes des 15 familles), et la **DPIA validée**
avec le traitement « notifications » ajouté au registre (sous-traitants :
Brevo, services push d'Apple et de Google).

---

## C. Mécanismes financiers : examen professionnel avant toute activation

Ce que Stéphane demande (P13) fait **évoluer** la Note d'arbitrage
Mooves v2 de juillet 2026, qui excluait l'achat de Mooves et tout avantage
individuel, et sur laquelle reposent les interdits 1 et 2 de `CLAUDE.md`.
Stéphane le dit lui-même. Position proposée pour Ben : on **garde les
interdits dans le code** jusqu'à une Note v3 signée après avis
professionnel. Le compteur privé (P12) en est techniquement séparable, et
il est déjà construit ainsi.

### C1. Ce qui est déjà prévu et sert la cible

- Le ledger n'a aucune écriture côté client ; seule
  `mooves_apply_movement` écrit, et elle est révoquée. Une recharge se
  brancherait **côté serveur** (webhook du prestataire de paiement →
  Edge Function → mouvement de type `recharge`), jamais depuis l'app.
  L'architecture actuelle est donc compatible avec la cible, sans
  rien rouvrir.
- `solidarity_fund_grants` modélise déjà un crédit octroyé par une
  institution ou un sponsor à une famille, sans parent payeur : c'est la
  brique du financement communal.
- Le module défraiement bénévole (schéma seul, `is_active = false`)
  reste **parallèle** et ne doit pas être fusionné avec les avantages
  conducteurs.

### C2. Ce qu'il faudrait construire (estimation, hors validation)

- Comptabilité du fonds : table des recharges, table du fonds
  (entrées = recharges, sorties = avantages attribués), règle « aucun
  avantage présenté sans financement disponible » vérifiée en base.
- Catalogue d'avantages (dont partenaires), conditions, Mooves
  nécessaires, attribution avec conservation du socle de 100, journal.
- Intégration d'un prestataire de paiement (Stripe ou Mollie), CGV,
  factures ou reçus, TVA, droit de rétractation.
- Demande d'aide communale : formulaire, instruction humaine, octroi via
  `solidarity_fund_grants`.
- Ordre de grandeur : trois à quatre semaines, après validation.

### C3. Points à faire examiner (liste pour le conseil, pas un avis)

1. **Qualification des Mooves** dès qu'ils s'achètent et donnent accès à
   des avantages : bon à usage multiple (TVA), monnaie électronique
   (loi du 11 mars 2018), ou simple compteur ? La réponse conditionne
   tout le reste.
2. **Statut du conducteur** : des avantages financés par l'argent des
   familles aidées sont-ils une rémunération ? Frontière entre partage
   de frais (référence 0,40 €/km, proche du forfait kilométrique) et
   transport rémunéré de personnes : assurance auto (usage), RC,
   fiscalité du conducteur, droit social.
3. **Qui encaisse** : l'entité exploitante doit exister (ASBL, SRL,
   commune), avec compte bancaire, comptabilité du fonds, et
   responsabilité en cas de fonds insuffisant.
4. **Partenaires** : la remise « 20 € pour 25 € » est une piste ; son
   traitement TVA et contractuel dépend du point 1.
5. **Communes** : base légale de l'aide, critères d'attribution,
   protection des données des familles demandeuses (situation
   financière = donnée sensible de fait).
6. **Vocabulaire** : la liste des mots interdits dans l'interface
   (portefeuille, crédit, achat, solde…) découle de la Note v2 ; elle
   sera à réviser avec la Note v3, pas avant.
7. **DPIA** : nouveau traitement (paiement, aide sociale), nouveaux
   sous-traitants.

---

## D. Contradictions avec les documents antérieurs (à harmoniser)

| Point | Ancien document | Réponse d'octobre | Impact code |
|-------|-----------------|-------------------|-------------|
| Achat de Mooves, avantages individuels | Note d'arbitrage v2 §5 : interdits ; `CLAUDE.md` interdits 1 et 2 | P13 : cible avec recharge, fonds, avantages, partenaires | aucun tant que C n'est pas levé ; Note v3 à écrire |
| Solde initial | arbitrage août : 60 (`app_settings`, 0017) ; Note v2 : paramètre à null | P12 : 100 | une migration, une ligne |
| Enfant et foyer | Doc1 évoque la garde alternée ; schéma : un foyer par enfant | P10 : plusieurs foyers, une fiche | chantier post-pilote, cinq à huit jours |
| Notifications | plan C13 : « P1 après pilote » | P15 : dès le pilote | C13 devient P0, périmètre B2 |
| Modification d'un trajet accepté | D3, D4 : annulation notifiée | P11, P15 : proposition + nouvelle confirmation + journal | pilote : immuable (B3) ; après : chantier |
| Distance | Q7 du plan ouverte depuis août | P14 : tranches avant, lieu exact après, calcul interne libre | tranches existent ; calcul après pilote |
| Vocabulaire interface | `CLAUDE.md` : « achat », « crédit », « solde » interdits | P13 emploie « acheter des Mooves » | inchangé jusqu'à Note v3 |
| Version du doc technique | « v4 » en nom de fichier, « Version 3 » en page de garde | P16 : à vérifier par Stéphane | Ben envoie le fichier |

---

## E. Décisions encore nécessaires

Pour Stéphane :
- Confirmer que le pilote accepte : trajet accepté immuable, un foyer par
  enfant, tranches déclarées, pas de détour en minutes.
- Confirmer le périmètre B2 des notifications comme seule nouveauté
  fonctionnelle du pilote, au détriment de tout autre ajout.
- Désigner qui valide la DPIA et quand (bloquant, rappel de Q1b).
- Nommer l'entité qui encaisserait les recharges et le conseil qui
  examinera la partie C.
- Trancher le fichier de référence après réception du v4.

Pour Ben :
- Reporter P10 à P16 dans 01, 02, 03, 05 et `CLAUDE.md` une fois le
  présent document validé par Stéphane.
- Réordonner le plan : C13 en P0 avec le périmètre B2, nouvelle ligne
  « modification d'un trajet accepté » et « garde alternée » en P1 après
  le 6/11.
- Écrire la migration `mooves_initial_balance` = 100 (numéro après 0024).

---

## F. Brouillon de réponse à Stéphane (à relire par Ben)

> Salut Stéphane,
>
> Merci pour les sept réponses, elles tranchent ce qui bloquait. J'ai tout
> réuni dans une référence unique datée (document 07 ci-joint), en trois
> blocs comme tu le demandes : décisions produit (P10 à P16), pilote du
> 2 novembre et faisabilité, mécanismes financiers à faire examiner.
>
> **Pour le 2 novembre.** J'ai réexaminé les notifications : je les passe en
> priorité du pilote. Périmètre : demandes, acceptations, refus, annulations,
> retrait de conducteur, en notification mobile (app installée, Android et
> iPhone 16.4+), avec repli email, écran « Mes notifications » dans l'app
> comme preuve de lecture, bouton « J'ai pris connaissance » horodaté sur
> les annulations, et bandeau « appelez » si une confirmation manque à
> moins de deux heures du départ. Le contenu du push reste neutre : aucun
> prénom d'enfant ne passe par Apple ou Google. Compte cinq à six jours,
> contre les trois à quatre annoncés, parce que la confirmation explicite
> et le repli s'ajoutent à l'infrastructure. C'est tenable si c'est la seule
> nouveauté fonctionnelle du pilote.
>
> **Ce que je propose de simplifier pour le stage, sans trahir tes
> principes.** Un trajet accepté est immuable : le modifier revient à
> l'annuler (notifié, confirmé) puis à en publier un nouveau. La nouvelle
> confirmation est obtenue par construction et rien ne remplace l'accord
> existant en silence. Le flux complet de proposition de changement avec
> journal et détection de conflit vient juste après le pilote. Même logique
> pour la garde alternée : le modèle « un enfant, un calendrier, plusieurs
> foyers » demande de revoir le cœur du schéma (cinq à huit jours), je le
> planifie après le 6/11 ; pour le stage, un enfant est dans un seul foyer
> et le second parent peut y être invité comme membre. Distance : les
> tranches sont déjà là, le détour en minutes vient après.
>
> **Mooves.** Le compteur privé que tu décris existe déjà (gain, usage,
> équilibre privé, message privé en cas de déséquilibre durable) ; je passe
> le départ à 100 et j'ajoute l'excédent au-dessus de 100 côté conducteur.
> Le volet recharge, fonds, avantages et partenaires est bien séparable
> techniquement, et l'architecture actuelle le permet sans rien rouvrir
> (toute écriture passerait côté serveur). Mais il contredit la Note
> d'arbitrage de juillet, qui fonde deux de nos interdits de code. Je garde
> ces interdits en place jusqu'à une Note v3 appuyée sur un avis
> professionnel. La partie C du document liste les sept points à faire
> examiner (qualification des Mooves, statut du conducteur et assurance,
> entité qui encaisse, partenaires, communes, vocabulaire, DPIA).
>
> **Document de référence.** Je joins le fichier exact sur lequel je
> travaille, « Instructions Techniques Partenaire v4 », reçu le 15 août.
>
> **Trois décisions dont j'ai besoin de toi cette semaine** : valider le
> périmètre du pilote ci-dessus ; me dire qui valide la DPIA et quand
> (rien ne va aux familles sans elle) ; nommer l'entité et le conseil pour
> le volet financier.
>
> Benjamin

Pièces à joindre : le présent document (export PDF) et
`MOOVEEE_Instructions_Techniques_Partenaire_v4.docx`.

---

## G. Retour de test du 19/10/2026 (Stéphane) et traitement

Stéphane a créé un compte de test (« Test mooveee », `stefchat1234@proton.me`,
créé et connecté le 19/10) pour faire parcourir l'application par ChatGPT dans
un navigateur partagé. Quatre points en sont ressortis.

### G.1 Connexion par code — CORRIGÉ le 20/10/2026

Symptôme signalé : l'écran demande un code, l'email reçu ne contient qu'un
bouton « Sign in », sans code. Le lien fonctionne sur le téléphone qui reçoit
l'email, mais pas quand on lit l'email sur un appareil et qu'on se connecte
depuis un autre.

Diagnostic : **deux causes**, pas une.

1. Le template Supabase « Magic Link » était celui par défaut, en anglais,
   avec `{{ .ConfirmationURL }}` seul. La variable `{{ .Token }}` n'y
   figurait pas, donc aucun code n'était affiché.
2. `mailer_otp_length` valait **8** côté serveur, alors que le champ de
   saisie impose six chiffres (`pattern="[0-9]{6}"`, `maxLength={6}` dans
   `src/routes/login.tsx`). Même avec le code dans l'email, la saisie aurait
   été impossible. Ce second point n'était visible d'aucun écran.

Correction : template français affichant le code en grand puis le lien en
secours, sujet « Votre code de connexion Mooveee », `mailer_otp_length` aligné
à 6. Le template est désormais versionné dans `supabase/templates/` avec sa
procédure d'application : la configuration Auth d'un projet Supabase n'est pas
une migration, elle ne se lisait nulle part dans le dépôt.

Vérifié de bout en bout le 20/10 sur un compte réel : demande de code,
réception de l'email français avec un code à six chiffres, puis échange de ce
code contre une session (`POST /auth/v1/verify`, jetons émis). Aucune
modification du code de l'application n'a été nécessaire : le front attendait
déjà six chiffres.

Deux limites à connaître pour les tests : un email par minute maximum vers la
même adresse (`smtp_max_frequency = 60`) et trente emails par heure pour le
projet. Le code vaut une heure.

### G.2 Invitation par WhatsApp — faisable, un arbitrage à rendre d'abord

Techniquement court. Le code d'adhésion existe déjà (`hubs.join_code`, affiché
dans l'écran Hubs, résolu par le RPC `hub_for_join_code`). Il manque une route
publique d'arrivée qui pré-remplit le code et un bouton de partage ouvrant
WhatsApp avec le message prêt. Aucun compte WhatsApp Business, aucune API, rien
à payer : un lien `wa.me` suffit, et il sert aussi pour SMS et email.

**Ce qu'il faut trancher avant de l'écrire.** Un code d'adhésion dans un
message WhatsApp devient transférable à l'infini : capture d'écran, groupe de
classe, transfert. Aujourd'hui, quiconque détient le code entre dans le hub et
voit les trajets publiés. Le rendre partageable en un geste multiplie cette
surface. Trois options, par ordre de solidité :

- lien nominatif à usage unique et expirant, émis par un administrateur du hub
  (le plus sûr, le plus de travail) ;
- code de hub partageable mais entrée en attente de validation par un
  administrateur avant d'accéder aux trajets (compatible avec l'interdit
  numéro 8 : ce n'est pas une dégradation de fonction, c'est un contrôle
  d'entrée) ;
- code partageable et entrée immédiate, comme aujourd'hui (le plus simple, le
  plus exposé).

Recommandation : la deuxième pour le pilote. Décision attendue de Stéphane.

### G.3 Solde initial à 100 — migration prête, PAS encore appliquée

Stéphane confirme le 19/10 : « on peut mettre 100 au départ ». C'est la
décision P12 déjà consignée, et la migration `0025_solde_initial_100.sql` est
écrite depuis le 11/10. Elle n'est **pas appliquée** : la base renvoie encore
60 (`select value from app_settings where key = 'mooves_initial_balance'`).

À appliquer par Ben. Les comptes de test déjà crédités à 60 gardent leur ligne :
aucun rattrapage prévu, à trancher avant les premières familles si l'on veut
l'égalité stricte.

### G.4 Carte pour les hubs et les lieux de rendez-vous — déjà à moitié fait

La recherche de lieux publics s'appuie déjà sur Photon (OpenStreetMap, serveurs
européens, sans clé), dans `src/lib/places.ts` et `src/components/PlaceField.tsx`,
avec les coordonnées stockées dans `places`. Ce qui manque n'est pas la
recherche, c'est l'affichage.

Trois niveaux, de l'immédiat au lourd :

1. **Un lien d'itinéraire** sur chaque lieu et chaque hub, qui ouvre
   l'application de cartes du téléphone (Google Maps, Apple Plans, Waze). Les
   coordonnées sont déjà là, c'est une URL à construire. Aucune donnée ne
   quitte l'application, c'est l'utilisateur qui ouvre son outil.
2. **Une carte affichée** dans l'application (MapLibre et tuiles
   OpenStreetMap, sans clé) pour situer les hubs et les points de
   rendez-vous. Travail moyen, cohérent avec l'hébergement européen.
3. **L'API Google Maps**, qui suppose une clé, une facturation à l'usage et
   l'envoi des requêtes de localisation à Google, donc hors Union
   européenne. Cela contredit le choix d'un hébergement européen fait pour ce
   projet et alourdit la DPIA, qui n'est pas validée.

Recommandation : le niveau 1 tout de suite, le niveau 2 après le pilote, le
niveau 3 jamais sans avis juridique.

Dans les trois cas, l'interdit numéro 6 tient : aucune position d'enfant n'est
stockée, aucun historique de trajet réel. On affiche des lieux publics déclarés
par les parents, jamais le déplacement d'une personne.

### G.5 Brouillon de réponse à Stéphane

> Salut Stéphane,
>
> La connexion est corrigée. Il y avait deux problèmes : l'email ne contenait
> pas le code, et le serveur générait un code à huit chiffres alors que
> l'écran n'en accepte que six. L'email arrive maintenant en français avec le
> code en grand, et le lien reste dessous pour qui lit ses mails sur le même
> appareil. Testé de bout en bout. Tu peux refaire tourner le test dans le
> navigateur partagé. Deux détails utiles : un seul email par minute vers la
> même adresse, et le code vaut une heure.
>
> Les 100 Mooves au départ : c'est noté, je le pose en base.
>
> L'invitation par WhatsApp : c'est court à faire, un lien suffit, sans API ni
> compte professionnel. Avant de l'écrire j'ai besoin d'un arbitrage de ta
> part. Un code d'adhésion envoyé par WhatsApp se transfère ensuite sans
> limite, capture d'écran comprise, et aujourd'hui quiconque a le code entre
> dans le hub et voit les trajets. Je propose que le code reste partageable
> mais que l'entrée d'une nouvelle famille attende la validation d'un
> responsable du hub. Ça garde toutes les fonctions familiales, ça ajoute
> seulement une porte. Dis-moi si tu valides.
>
> Les cartes : la recherche d'adresses marche déjà avec OpenStreetMap, et
> c'est volontaire, les serveurs sont européens et il n'y a pas de clé à
> payer. Ce qui manque c'est l'affichage. Je peux ajouter tout de suite un
> bouton d'itinéraire sur chaque lieu et chaque hub, qui ouvre Google Maps ou
> Plans sur le téléphone. Une carte intégrée dans l'application, je la ferais
> après le pilote. Passer à l'API Google elle-même, je ne le conseille pas :
> cela envoie les recherches de localisation hors d'Europe, alors qu'on a
> choisi un hébergement européen et que la DPIA n'est pas validée.
>
> Benjamin
