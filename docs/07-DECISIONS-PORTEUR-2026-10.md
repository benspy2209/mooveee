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

---

## H. Assistant vocal et écrit (proposition de Stéphane, 20/10/2026)

Stéphane propose un assistant, à la voix et par écrit, qui comprend le
besoin d'un parent et utilise les fonctions de l'application : créer une
activité récurrente, chercher une aide pour un trajet, préparer une
demande à une autre famille, préparer une invitation. Il demande un avis
de faisabilité, pas un ajout au pilote.

**Verdict : faisable, et l'architecture s'y prête mieux qu'il n'y paraît,
à condition de traiter deux points durs et de commencer par l'écrit.**

### H.1 Ce qui est déjà acquis : les droits d'accès

C'est le point le plus solide, et il répond directement à l'exigence
« les mêmes droits d'accès que le parent, aucun élargissement
automatique ».

Si l'assistant agit avec la session du parent, il hérite de ses droits
**par construction** : la RLS refuse en base tout ce que le parent n'a
pas le droit de lire ou d'écrire. Aucune règle d'accès n'est réécrite,
donc aucune ne peut diverger. Un assistant qui tenterait de lire les
trajets d'un hub où la famille n'est pas validée recevrait zéro ligne,
sans qu'aucune ligne de code de l'assistant ait à le prévoir.

Même chose pour la divulgation de coordonnées : `hub_member_profiles`
choisit ses colonnes et ne renvoie ni téléphone ni code postal. Ce que
l'assistant ne peut pas lire, il ne peut pas le dire.

### H.2 Point dur numéro un : les données d'enfants (interdit 7)

Les cinq exemples proposés contiennent tous une donnée d'enfant :
l'activité d'un enfant, « Jules », le déplacement d'un mineur. L'interdit
numéro sept du projet est net : aucune donnée enfant ne part vers un
service d'IA externe.

La voix aggrave le problème. Un enregistrement où le parent dit « Jules »
transmet le prénom au fournisseur de transcription avant qu'on ait pu le
retirer. La reconnaissance vocale intégrée aux navigateurs n'est pas une
issue : sous Chrome elle envoie l'audio à Google.

**Solution d'architecture : l'assistant ne voit jamais les noms.** Avant
tout envoi, sur l'appareil, les prénoms connus sont remplacés par des
jetons (`<enfant_1>`, `<parent_2>`, `<hub_1>`), et restitués au retour.
Le remplacement est fiable, pas approximatif : on connaît la liste exacte
des prénoms visibles par ce parent (son foyer, ses hubs), elle vient de
la base. Le modèle ne reçoit que la structure de la demande et renvoie
une intention d'action sur des jetons. Cela satisfait l'interdit 7 à la
lettre, sans dépendre du contrat du fournisseur.

**Conséquence pratique : commencer par l'écrit.** À l'écrit, on maîtrise
exactement ce qui part. La voix suppose une transcription sur l'appareil,
c'est un chantier distinct.

### H.3 Point dur numéro deux : qui décide (interdits 4 et Concierge)

Le matching propose, il n'assigne jamais, et tout ce qui implique un
enfant passe par un humain. L'assistant **prépare**, il n'exécute pas :
résumé de ce qu'il va faire, confirmation explicite, et la distinction
« demande envoyée » / « trajet accepté » tenue dans les mots.

Stéphane décrit déjà exactement cela. Sur ce point, sa proposition est
alignée avec les règles du projet, il n'y a rien à arbitrer.

### H.4 Ce qui manque vraiment : un vocabulaire d'actions

C'est le vrai travail de fond, et il est indépendant de l'IA.

Aujourd'hui, **une seule action d'écriture est exposée comme opération
vérifiée côté serveur** : `accept_trip_request`. Toutes les autres
(créer une activité, demander une place, rejoindre un hub, inviter) sont
des écritures faites directement par l'interface, protégées par la RLS
mais sans transaction métier nommée.

Un assistant a besoin d'un vocabulaire fini d'actions atomiques et
vérifiées, sinon il faudrait lui laisser écrire en base, ce qui est
exclu. Ce travail est utile même si l'assistant ne se fait jamais.
Exemple concret trouvé en analysant : rejoindre un hub fait aujourd'hui
deux écritures séparées depuis le client, l'adhésion puis l'acceptation
du Pacte. Si la seconde échoue, la famille est membre sans avoir accepté
le Pacte. Un RPC transactionnel supprime ce cas.

### H.5 Fournisseur, données, coûts

- **Modèle** : fournisseur avec traitement en Union européenne et contrat
  de sous-traitance (Mistral en France, ou un grand modèle via une région
  européenne). Attention : le choix du fournisseur ne remplace pas la
  pseudonymisation de H.2, il s'y ajoute.
- **Voix** : à instruire séparément. C'est là que se trouvent les
  transcriptions, donc le risque.
- **Coût d'usage** : marginal à l'échelle d'un pilote, de l'ordre de
  quelques euros par mois. Ce n'est pas le coût qui décide.
- **AIPD** : elle n'est pas validée pour l'existant. Ce traitement devra
  y figurer, avec la détection d'opportunités (v4 §11.3).
- **PWA** : aucun obstacle pour l'écrit. Pour la voix, l'enregistrement
  audio dans une application web installée fonctionne, mais l'encapsulage
  Capacitor donnera un meilleur accès au micro et à la transcription sur
  appareil.

### H.6 Découpage proposé

1. **Préparable aujourd'hui, sans assistant et utile en soi** : passer
   les actions métier en RPC transactionnels nommés ; journal des actions
   confirmées (utile aussi pour l'AIPD) ; bibliothèque de
   pseudonymisation, testable sans aucun appel d'IA.
2. **Premier parcours, par écrit** : « trouver une aide pour un trajet ».
   Le choix de Stéphane est le bon : ce parcours lit des trajets
   existants et prépare une demande, il ne crée ni activité ni
   acceptation.
3. **Chantier distinct** : la voix, avec transcription sur l'appareil.
4. **En parallèle et bloquant** : avis professionnel sur l'AIPD, incluant
   ce traitement.

Rien de tout cela n'entre dans le pilote de novembre, comme Stéphane le
dit lui-même.

---

## I. Assistant IA : les trois questions de Stéphane (20/10/2026)

Complément à la section H. Stéphane demande l'intégration, la fiabilité
et le budget, plus les limites de la voix sur téléphone.

### I.0 Le constat qui commande tout : il n'y a pas de notification

Son exemple est un imprévu : « je ne peux plus conduire demain ».
L'assistant retrouve l'activité, cherche, prépare, et… prévient qui ?

État réel de la base : il existe une table `messages` (messagerie interne
par foyer, hub ou trajet) et une table `notification_preferences`
(maximum par jour, par semaine, heures calmes, canal). **Il n'existe
aucun moteur d'envoi** : ni notification poussée, ni email, ni SMS. Une
demande déposée n'est vue que si l'autre parent ouvre l'application.

Conséquence : pour un imprévu du jour, un assistant sans notification ne
sert à rien. **La pièce manquante n'est pas l'intelligence artificielle,
c'est la notification.** Elle est déjà au plan sous C13 ; elle devient le
prérequis du cas d'usage que Stéphane décrit, et elle a de la valeur
seule, sans aucun assistant.

### I.1 Intégration : ce qui est connectable, ce qui ne l'est pas

**Déjà connectable sans développement** — toutes les lectures. Les
tables passent par PostgREST sous RLS, et les fonctions de lecture
existent déjà : `hub_trips_view`, `hub_member_profiles`,
`trip_open_in_my_hubs`, `hub_trip_children_count`, `hub_for_join_code`,
`trip_children_aboard`. Un assistant peut donc chercher une possibilité
de trajet dès aujourd'hui, avec les droits du parent.

**Une seule écriture est déjà exposée proprement** :
`accept_trip_request`, transactionnelle, idempotente, qui vérifie
l'appartenance au foyer conducteur en première instruction. C'est le
modèle à suivre pour les autres.

**À développer, une action par outil** :

| Action | État | Remarque |
| --- | --- | --- |
| Créer une activité récurrente + générer les trajets | écrit par l'interface | la génération est déjà idempotente |
| Se désister d'un trajet | écrit par l'interface | doit libérer la place et tracer |
| Demander une place | insert direct | besoin d'une clé d'intention |
| Rejoindre un hub | **deux** inserts client | défaut connu : membre sans Pacte si le second échoue |
| Préparer une invitation | aucune écriture | déjà fait, c'est un lien |
| Notifier | **inexistant** | voir I.0 |

**Fournisseur.** Critère premier : traitement en Union européenne sous
contrat de sous-traitance, et appels de fonctions natifs. Mistral
(France) est le choix le plus simple à défendre dans l'AIPD. Les grands
modèles américains restent possibles via une région européenne, au prix
d'un contrat plus lourd. Dans tous les cas, prévoir une couche
d'abstraction : le fournisseur changera.

**Où tourne l'appel.** Dans une Edge Function Supabase, jamais depuis le
navigateur : la clé ne doit pas se trouver dans le bundle. Précédent
dans le projet : `access-code-login`.

### I.2 Fiabilité et confidentialité

**Les droits, à chaque action.** Règle absolue : l'Edge Function agit
avec le jeton du parent, jamais avec la clé `service_role`. Avec la clé
de service, toute la RLS tomberait et il faudrait réimplémenter les
droits dans le code de l'assistant — exactement ce qu'il ne faut pas
faire. Avec le jeton du parent, la base refuse d'elle-même tout ce qui
dépasse.

**Limiter les données transmises.** Pseudonymisation sur l'appareil
(section H.2) : le modèle reçoit des jetons, jamais des prénoms. On
n'envoie jamais une liste complète, seulement les éléments nécessaires à
la décision en cours.

**Les ambiguïtés se tranchent dans l'application, pas dans le modèle.**
Le modèle propose un jeton ; l'application vérifie qu'il correspond à
exactement une personne ou un trajet. Zéro correspondance ou plusieurs :
on demande une précision. Le modèle ne choisit jamais entre deux
personnes.

**La confirmation est structurelle.** Le modèle ne produit qu'une
intention. L'application affiche le résumé et n'appelle le RPC qu'après
le geste du parent. Même si le modèle se trompe ou qu'on lui souffle une
consigne malveillante, il ne peut rien déclencher seul.

**Les trois états demandés existent déjà** dans `trip_requests.status` :
`en_attente`, `accepte`, `refuse`, plus `annule` et `expire`. Il n'y a
rien à inventer, seulement à ne jamais confondre les mots dans
l'interface.

**Doubles envois en cas de coupure.** Chaque intention porte une clé
unique, et le RPC est idempotent sur cette clé
(`on conflict do nothing`, puis `get diagnostics` immédiat pour ne
déclencher les effets que si une ligne a bien été insérée). C'est
déjà la leçon tirée sur `accept_trip_request` et l'index
`trip_requests_accepted_unique` : on la réapplique, on n'invente rien.

### I.3 Budget

**Ordres de grandeur, pas devis.** Les trois postes sont distincts.

*Travail initial*, par blocs indépendants et utiles séparément :

| Bloc | Ordre de grandeur | Utile sans assistant |
| --- | --- | --- |
| Notifications (C13, prérequis) | 5 à 8 jours | oui, indispensable |
| Socle d'actions : RPC, idempotence, journal | 6 à 10 jours | oui |
| Pseudonymisation + couche fournisseur | 3 à 5 jours | non |
| Premier parcours écrit complet | 8 à 12 jours | non |
| Voix en PWA | 5 à 10 jours | non |

*Maintenance* : les modèles et leurs interfaces changent plusieurs fois
par an. Prévoir une révision régulière, plus la veille sur le contrat du
fournisseur. C'est un coût récurrent, pas un reste à finir.

*Coût d'usage, par demande complète.* Une demande suppose plusieurs
allers-retours : comprendre, chercher, proposer, confirmer. En ordre de
grandeur, quelques centimes la demande en écrit, et de l'ordre du double
avec transcription vocale et réponse parlée. Ces chiffres sont à
confirmer au moment du choix, les tarifs bougent vite.

**Sur l'option à 1 ou 2 € par mois.** Avec dix demandes par mois et par
famille, on est à l'équilibre, pas au large. Je ne promettrais pas ce
prix avant d'avoir mesuré. Et deux réserves de fond :

- toute monétisation relève de la partie C de ce document, en attente
  d'examen professionnel ; rien ne s'active avant ;
- une option payante par famille crée une inégalité d'accès, ce que le
  projet évite par ailleurs (fonds de solidarité, interdit 8).

**La voie institutionnelle est plus saine et déjà conforme.** Inclure
l'assistant dans un contrat avec un club ou une commune, facturé par
palier d'usage, respecte l'interdit 3 : jamais de ligne indexée sur le
trajet individuel. C'est la piste que je recommanderais.

**Mesurer** : oui, et dès le prototype. On journalise les jetons
consommés par demande et par étape. C'est typiquement un cas où l'on
mesure avant de tarifer, pas l'inverse.

### I.4 Limites de la voix sur téléphone

| Situation | Android (Chrome) | iPhone (Safari) |
| --- | --- | --- |
| Dicter, application ouverte | oui | oui, après un geste |
| Reconnaissance intégrée au navigateur | oui, mais l'audio part chez Google | partielle, capricieuse en application installée |
| Enregistrer puis transcrire nous-mêmes | oui | oui |
| Application en arrière-plan | micro coupé | micro coupé |
| **Écran verrouillé** | **non** | **non** |
| Mot de réveil, « Hey Mooveee » | **non** | **non** |

À retenir : **une application web ne peut pas écouter écran verrouillé,
ni sur Android ni sur iPhone.** Le parent doit ouvrir l'application et
appuyer sur un bouton. C'est gênant précisément dans le cas visé, où il
est souvent en déplacement.

L'issue est l'encapsulage natif déjà prévu pour l'App Store : accès au
micro en arrière-plan sous permission explicite, et surtout raccourcis
Siri et actions Android, qui donnent la vraie expérience mains libres.
Dans l'intervalle, la lecture à voix haute des réponses, elle,
fonctionne partout sans réserve.

Note de sécurité routière, qui n'est pas un détail au vu du cas d'usage :
viser l'usage au volant engage une responsabilité. Mieux vaut assumer
que l'assistant s'utilise à l'arrêt.

### I.5 Ce que je recommande

Ne pas commencer par l'assistant. Commencer par la notification, qui
manque, qui bloque l'assistant et qui sert immédiatement sans lui.
Ensuite le socle d'actions, utile seul. Puis un seul parcours écrit de
bout en bout, mesuré. La voix et la tarification après, avec des
chiffres réels plutôt que des hypothèses.

---

## J. Deux précisions de Stéphane (20/10/2026) : données et voix locale

Deux pistes proposées par le porteur, à intégrer à l'évaluation. Aucune
demande de développement pour le pilote. Les deux sont justes et vont
plus loin que la section H ; elles appellent chacune des raffinements et
une limite honnête.

### J.1 Ne transmettre que des références et des résultats

**Principe retenu.** Les noms, adresses, horaires précis et le calcul de
compatibilité restent dans Mooveee. Le modèle ne reçoit que des
identifiants opaques et des **résultats** de calcul, jamais les données
qui ont servi à les produire. Il raisonne sur une structure, l'application
détient le sens.

Cette formulation est meilleure que la pseudonymisation des seuls
prénoms décrite en H.2 : elle couvre toutes les catégories
identifiantes, pas une seule. Elle devient la règle.

**Le point que Stéphane soulève et qui est le vrai risque : les réponses
des outils.** On pense naturellement à nettoyer la phrase du parent. Or
les sorties sont bien plus bavardes : une recherche de trajet renvoie
aujourd'hui des libellés d'origine et de destination (« École
Saint-Joseph », « rue des Tilleuls »), une commune, des horaires exacts.
Sans traitement, on masquerait l'entrée pour tout divulguer à la sortie.

**Règle : le nettoyage est bidirectionnel et s'applique à chaque sortie
d'outil, pas seulement à l'entrée.** Un outil qui n'a pas de sortie
nettoyée n'est pas exposable à l'assistant.

**Ce qui peut sortir et ce qui ne peut pas :**

| Catégorie | Transmis au modèle | Forme |
| --- | --- | --- |
| Personnes, enfants | non | `<enfant_1>`, `<parent_2>` |
| Lieux, adresses | non | `<lieu_3>` |
| Commune, code postal | **non** | rien |
| Coordonnées géographiques | non | rien |
| Distance, durée | oui | valeur dérivée, « environ 4 km » |
| Compatibilité de deux trajets | oui | **résultat** calculé chez nous |
| Date et heure | oui | nécessaires au raisonnement |
| Texte libre saisi par un parent | **non** | voir ci-dessous |

**Deux limites à assumer.**

*La ré-identification par recoupement.* Même avec des jetons, « enfant_1,
mercredi 17 h, Rhode-Saint-Genèse » redevient identifiable dans une
petite commune. C'est pourquoi la commune et les coordonnées ne sortent
pas, même sous forme approchée. Les distances remplacent les lieux.

*Les champs de texte libre.* Le nom d'une activité (« Tennis de Jules »),
le message joint à une demande, une note : un remplacement fondé sur la
liste des prénoms connus ne couvre ni les diminutifs ni les fautes de
frappe. Conclusion prudente : **les champs libres ne sont pas envoyés au
modèle.** L'assistant travaille sur la structure, pas sur la prose des
parents.

**Conséquence favorable pour l'AIPD.** Avec cette architecture, le
fournisseur reçoit si peu qu'il ne peut raisonnablement pas réidentifier
une famille. Le risque est réduit à la source, pas géré par contrat. Cela
rend l'interdit 7 tenable à la lettre plutôt qu'au prix d'une
interprétation, et cela rend le choix du fournisseur moins déterminant,
sans le rendre indifférent.

**Point de conception.** La table de correspondance jeton vers
identifiant réel vit sur l'appareil, le temps de la conversation. Elle
n'est ni persistée côté serveur, ni envoyée, ni journalisée. La
conserver quelque part recréerait exactement le lien qu'on cherche à
supprimer.

### J.2 Voix : parcours guidé et transcription sur l'appareil

**Principe retenu, et à inscrire comme une règle :** si la transcription
sur l'appareil n'est pas disponible, on reste à l'écrit. **Aucune bascule
automatique vers un service de transcription extérieur.** Une bascule
silencieuse enverrait la voix d'un parent, et le prénom d'un enfant, à
un tiers sans décision explicite.

**Ce qui est techniquement possible aujourd'hui.** Faire tourner un
modèle de transcription dans le navigateur via WebAssembly est réaliste
pour des phrases courtes. Trois réserves concrètes :

- **le poids.** Le plus petit modèle utilisable en français pèse
  plusieurs dizaines de mégaoctets, et la qualité y est moyenne ; un
  modèle confortable dépasse largement cela. Le téléchargement proposé
  par Stéphane est donc justifié, mais ce n'est pas un détail : il faut
  l'annoncer, le faire en Wi-Fi, et jamais à l'insu du parent.
- **la vitesse.** Sur un téléphone récent, c'est fluide. Sur un appareil
  ancien, c'est lent et l'appareil chauffe. Le parcours guidé doit donc
  **mesurer** sur l'appareil réel, pas seulement demander une
  autorisation. Une transcription d'essai chronométrée tranche mieux
  qu'une case à cocher.
- **la persistance.** Sur iPhone, le stockage d'une application web peut
  être purgé après des semaines sans usage. Le modèle disparu doit être
  détecté, et son re-téléchargement proposé, jamais déclenché seul sur
  données mobiles.

**Parcours guidé au premier usage, dans cet ordre :** expliquer, tester
la faisabilité sur l'appareil, proposer le téléchargement en annonçant
le poids, demander l'autorisation du micro, faire un essai à blanc dont
le parent voit la transcription avant tout envoi, puis activer. À chaque
étape, l'abandon ramène à l'écrit sans dégrader quoi que ce soit.

**Une piste plus simple, à tester d'abord.** La dictée du clavier
système, sur iPhone comme sur Android, écrit dans un champ texte
ordinaire. Elle est déjà installée, gratuite, traitée sur l'appareil pour
beaucoup de langues sur iPhone, et ne demande **aucun développement ni
téléchargement** de notre part. Elle ne couvre pas le mains libres, mais
elle règle l'essentiel du confort de saisie pour un coût nul. À mettre
en premier, avant d'investir dans un modèle embarqué.

Rappel de la section I.4 : rien de tout cela ne lève la limite de
l'écran verrouillé, qui relève de l'application native.

### J.3 Effet sur la vérification de protection des données

Ces deux décisions allègent le dossier :

- le traitement par un tiers ne porte plus sur des données personnelles
  identifiables, mais sur des jetons et des résultats de calcul ;
- la voix n'est pas transmise, ou le service n'est pas activé ;
- aucune donnée d'enfant ne quitte l'application, ce qui satisfait
  l'interdit 7 sans aménagement.

Restent à documenter dans l'AIPD : la table de correspondance éphémère
sur l'appareil, le journal des actions confirmées, et le modèle de
transcription stocké localement. L'avis professionnel reste requis, et
reste le chemin critique.

---

## K. Accompagnement du parent (deux messages de Stéphane, 20-21/10/2026)

Demande : garder la présentation actuelle et renforcer l'accompagnement,
dans l'esprit de Duolingo — une question claire, une action évidente,
une progression compréhensible. Parcours guidé jusqu'au premier trajet
pour un nouveau parent ; raccourcis vers le besoin pour un parent déjà
inscrit. Plus trois remarques d'écran et un défaut sur Équilibre.

### K.1 Fait tout de suite (commit c150e70)

- **Défaut Équilibre corrigé.** Le message se basait sur la dynamique de
  participation, qui inclut le mouvement `solde_initial` (100 à la
  création du profil), alors que les deux compteurs affichés ne somment
  que `gain` et `usage`. Un parent fraîchement inscrit lisait donc
  « vous apportez plus d'aide que vous n'en recevez » devant deux zéros.
  Le message compare maintenant l'aide réellement échangée et dit, quand
  rien n'a eu lieu, que la dynamique affichée est la dotation de départ.
- **Demandes.** L'état vide disait « trouvez un trajet ouvert sur
  l'écran de votre hub » sans lien. C'est un bouton.

### K.2 Ce qui existe déjà et qu'il croit manquant

Vérifié dans le code : **Semaine a déjà son état vide** avec le bon
message et un bouton « Créer une activité ». Il reste à masquer les
réglages de génération tant qu'aucune activité n'existe, ce qui est une
demi-journée.

Plus largement : les écrans ont déjà des états vides corrects. Ce qui
manque n'est pas l'information, c'est **le fil** entre les écrans.

### K.3 La brique à poser : une fonction « prochaine étape »

Une seule fonction pure prend l'état du parent et renvoie l'étape
suivante, son libellé et sa destination. Ordre des prérequis réels,
relevé dans le code :

1. prénom (profil) ; 2. foyer ; 3. enfant ; 4. hub rejoint **et validé** ;
5. activité ; 6. premier trajet.

Cette fonction alimente trois choses à la fois :

- la bannière « voici votre prochaine étape », sur Foyer et ailleurs ;
- la reprise après interruption, sans état à stocker : l'étape se déduit
  de la base, elle n'a pas à être mémorisée ;
- **plus tard, l'assistant vocal** : quand un parent dira « je peux
  faire l'aller mais pas le retour », c'est cette même fonction qui
  dira ce qui manque encore. C'est la réponse à la question de
  Stéphane : oui, l'accompagnement se prévoit pour la voix, et c'est la
  même brique, testable sans aucune IA.

### K.4 Deux réserves de fond sur le modèle Duolingo

*La progression ne dépend pas que du parent.* Duolingo guide un parcours
solitaire : l'étape suivante est toujours à la portée de l'apprenant.
Ici, l'étape suivante est souvent « attendre qu'une autre famille
réponde ». Un accompagnement qui promet une progression continue
mentirait. Il doit savoir dire « vous avez fait votre part, c'est au
tour d'une autre famille », et le dire aussi bien que les autres étapes.

*Le ludique s'arrête où commence l'entraide.* Une barre de progression
pendant la configuration est sans risque : elle mesure un formulaire.
Mais ni série, ni badge, ni encouragement indexés sur les trajets
partagés : l'interdit 5 proscrit tout score de contribution visible, et
le vocabulaire imposé reste en vigueur.

### K.5 Charge et recommandation

| Bloc | Ordre de grandeur |
| --- | --- |
| Fonction « prochaine étape » + tests | 1 jour |
| Bannière de prochaine étape sur les écrans | 1 jour |
| Masquer les réglages avancés tant que c'est vide | 0,5 jour |
| Accueil orienté besoin pour parent déjà inscrit | 1,5 à 2 jours |
| Question d'entrée « De quoi avez-vous besoin ? » | 2 à 3 jours |

**Recommandation pour le pilote du 2 au 6 novembre : les trois premiers
blocs, pas les deux derniers.**

Raison : il reste moins de deux semaines, et les deux derniers blocs
changent la navigation. Surtout, le pilote existe pour observer comment
de vraies familles se débrouillent. Concevoir l'accueil orienté besoin
avant d'avoir vu où elles butent, c'est deviner. Après le pilote, on
saura.
