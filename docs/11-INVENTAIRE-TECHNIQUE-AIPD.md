# Inventaire technique pour l'AIPD — 7 novembre 2026

Réponse aux questions de la section 10 du dossier de Stéphane
(« Questions indispensables à Benjamin », version du 6 novembre).

Tout ce qui suit est **relevé dans le code et dans la base**, pas déclaré
de mémoire. Chaque constat porte sa méthode. Quand une chose n'existe
pas, c'est écrit comme telle : un inventaire qui ne contiendrait que des
bonnes nouvelles ne servirait à rien à l'avocate.

Trois constats sont à lire avant le reste :

1. **L'application envoyait l'adresse IP de chaque visiteur à Google**,
   pour un rendu strictement identique. Relevé puis **corrigé le jour
   même**, preuve à l'appui. § 3.4.
2. **Aucune donnée n'est jamais supprimée automatiquement.** Il n'existe
   aucune tâche de purge. § 5.
3. **La table des consentements est vide**, alors que trois photos
   d'enfants sont stockées. Le consentement ne peut pas être démontré
   au sens de l'article 7.1. § 6.

Le reste est plutôt bon, et les tests du § 7 le prouvent au lieu de
l'affirmer.

---

## 1. Quelle version sera activée au pilote

| | Pilote (11 déc. · démonstration) | Version complète |
| --- | --- | --- |
| Calendrier jour/semaine/mois | oui | oui |
| Foyer, enfants, activités | oui | oui |
| Hubs, pacte, validation par le responsable | oui | oui |
| Demande et offre de place, accord | oui | oui |
| Bulletin de trajet et confirmation de remise | oui | oui |
| Notifications par e-mail | oui | oui |
| Notifications sur téléphone | non | oui (22 déc.) |
| Carte et épingles | non | oui (22 déc.) |
| Voix | **non** | à décider (§ 4) |
| Position en direct, QR | **non** | non prévu |
| Hubs de proximité ou de chemin | **non** | non prévu au pilote |
| Messagerie entre parents | non | fil par trajet, à l'étude |
| Écrans institution, défraiement | non | non |

Les fonctions marquées « non » ne sont pas seulement masquées : pour la
voix, la position et le QR, **rien n'est écrit**. Pour les hubs de
proximité, la table existe (`hub_relations`) mais son `activation_status`
vaut `prepared` et aucun code ne la lit.

Liste à re-signer à chaque version livrée, comme le demande le dossier.

## 2. Dictionnaire de données

34 tables. Celles qui portent des données personnelles :

| Table | Champs personnels | Obligatoire ? |
| --- | --- | --- |
| `users` | prénom, nom, téléphone, code postal, avatar, langue | prénom seul obligatoire ; **téléphone et code postal renseignés chez 0 compte sur 9** |
| `children` | prénom, année de naissance, photo, consentement photo, siège rehausseur | prénom seul obligatoire |
| `households` / `household_members` | nom du foyer, rôle, administrateur | — |
| `household_invitations` | **adresse e-mail en clair**, rôle, auteur | pas d'expiration (§ 5) |
| `activities` | libellé, lieu, **coordonnées**, récurrence, horaires, marges | lieu facultatif |
| `trips` | origine et destination (libellé **et** coordonnées), heure, conducteur, places, lien aller-retour | 26 colonnes |
| `trip_children` | quel enfant dans quel trajet | — |
| `trip_requests` | demandeur, foyer, enfant, **message libre** | — |
| `trip_private_notes` | **note libre**, jamais visible hors du foyer | — |
| `trip_dropoff_confirmations` | qui a confirmé, quand | — |
| `messages` | **corps libre**, canal, auteur | table vide à ce jour |
| `reports` | auteur, cible, catégorie, **corps libre**, `involves_minor` | table vide |
| `mooves_balance` / `mooves_ledger` | compteur et journal par personne | — |
| `consents` | type, accordé, date, version de politique | **table vide** |
| `places`, `meeting_points`, `household_places` | lieux publics, coordonnées, photo | lieux publics uniquement |
| `hubs`, `hub_members`, `hub_pact_acceptances` | nom, code d'adhésion, commune, coordonnées du club | — |

Quatre champs de texte libre peuvent recevoir n'importe quoi, y compris
une donnée de santé ou une accusation, sans que rien ne les recherche :
`trip_requests.message`, `trip_private_notes.note`, `messages.body`,
`reports.body`. C'est le point que le dossier soulève au § 3, et il est
exact.

Aucun compte d'enfant. Aucun document d'identité. Aucune donnée
financière : vérifié, il n'existe aucune colonne de prix ou de montant
en euros ailleurs que dans le module de défraiement, désactivé et sans
aucune logique écrite.

**État réel de la base au 7 novembre** : 9 comptes, 14 enfants dont 13
avec année de naissance, 3 photos, 339 trajets, 0 message, 0
signalement, 0 consentement. Ce sont des comptes de test, mais les
enfants sont réels (les nôtres). À traiter avant le pilote : soit
purgés, soit intégrés au périmètre de l'analyse. Ils ne peuvent pas
rester dans un angle mort.

## 3. Hébergement, sous-traitants, flux sortants

### 3.1 Supabase — base, comptes, stockage, fonction

Projet `chmijnxukwsfqlvaontf`, **région eu-west-1 (Irlande, AWS)**,
PostgreSQL 17.6. Contient tout : la base, les comptes, les deux espaces
de fichiers, l'envoi des e-mails de connexion, et une fonction serveur
(`access-code-login`).

À obtenir pour l'AIPD : le contrat de sous-traitance, la liste des
sous-traitants ultérieurs, les conditions d'accès du support de
Supabase à la base, la durée de rétention de leurs journaux. **Supabase
Inc. est une société américaine** même si les serveurs sont en Irlande —
la qualification de ce point revient à l'avocate, pas à moi.

### 3.2 Vercel — hébergement de l'application

Front statique. Journaux d'accès avec adresse IP, durée à vérifier.
Même remarque sur la nationalité de la société. Région de déploiement à
confirmer.

### 3.3 Komoot — recherche d'adresse

`photon.komoot.io`, appelé à chaque frappe quand un parent cherche un
lieu (`src/lib/places.ts:53`). Reçoit **le texte tapé et l'adresse IP**.
Serveurs allemands, données OpenStreetMap.

Point à signaler franchement : c'est un **service public et gratuit,
utilisé sans contrat ni engagement de confidentialité**. Il n'y a pas de
DPA parce qu'il n'y a pas de relation contractuelle. Trois issues :
l'héberger nous-mêmes, prendre un fournisseur sous contrat, ou
documenter l'usage tel quel et l'assumer. Décision à prendre avec
l'avocate.

### 3.4 Google Fonts — relevé et corrigé le 7 novembre

**Ce qui était en place.** `src/styles.css` importait deux familles de
polices depuis `fonts.googleapis.com`. Conséquence : à chaque ouverture
de l'application, le navigateur du parent contactait Google et lui
transmettait son adresse IP, puis téléchargeait les fichiers depuis
`fonts.gstatic.com`. Deux domaines américains appelés à chaque page, un
flux documenté nulle part, et pour un résultat visuel identique à ce
qu'on obtient sans eux. Je ne l'avais pas vu avant cet inventaire.

**Ce qui est en place maintenant.** Les quatre fichiers de police sont
téléchargés une fois et servis depuis notre propre domaine
(`public/polices/`, 160 Ko au total, sous-ensembles latin et latin-ext
seulement). `src/polices.css` porte les quatorze déclarations
correspondantes et la note explicative.

**Preuve, puisque ce dossier en demande une.** Après construction du
projet : `grep` de `googleapis` et `gstatic` sur l'intégralité du build
→ **aucun fichier**. Les quatorze déclarations sont présentes dans le
CSS produit, les deux familles sont bien là, les quatre fichiers sont
servis. Contrôle de types et construction verts.

**État de la mesure : opérationnelle**, au sens du registre proposé au
§ 9 du dossier — pas « proposée ».

C'est la seule ligne du plan d'action qui **supprime** un transfert au
lieu de l'encadrer. Elle a pris une heure.

### 3.5 Envoi des e-mails

Aujourd'hui par le serveur SMTP mutualisé de Supabase. Le prestataire
réel derrière n'est pas identifiable de mon côté. Au pilote je bascule
sur un service dédié : **le choix (Brevo, français, ou Resend,
américain) doit être tranché par l'avocate avant que je branche quoi que
ce soit.** Brevo a ma préférence pour cette raison.

### 3.6 WhatsApp

`wa.me` sert à partager un lien d'invitation. **Aucun appel automatique** :
rien ne part tant que le parent ne clique pas, et c'est son propre
WhatsApp qui s'ouvre. À mentionner, pas à traiter comme un flux serveur.

### 3.7 Ce qui n'existe pas

Aucune mesure d'audience, aucun pixel, aucun traceur publicitaire,
aucun outil de suivi d'erreurs actif, aucun cookie autre que le jeton de
session. Vérifié par recherche sur `analytics`, `gtag`, `plausible`,
`sentry`, `posthog` : zéro résultat actif. Le service worker est
volontairement sans cache — rien de l'application ne reste sur
l'appareil.

## 4. La voix

**Rien n'est écrit.** Aucune ligne de code, aucune dépendance, aucun
appel. Le § 6 du dossier décrit trois architectures : aucune n'est
engagée, et la question reste entièrement ouverte pour l'avocate.

Ma position, pour mémoire : la dictée du navigateur envoie l'audio chez
Google ou Apple selon le téléphone, ce qui ferait sortir le prénom d'un
enfant vers un tiers sans qu'on puisse l'empêcher. Je ne la mettrai pas
en place sans avis juridique écrit.

## 5. Durées de conservation — rien n'est effacé

Deux tâches planifiées existent en base, vérifiées aujourd'hui :
`detect-opportunities` (chaque nuit) et `institution-metrics-monthly`
(mensuelle). **Aucune des deux ne supprime quoi que ce soit.**

Conséquence : depuis le 2 août 2026, **aucune donnée n'a jamais été
effacée automatiquement**. Les 339 trajets incluent des trajets passés
depuis des mois. Les invitations de foyer n'ont pas de date
d'expiration (la colonne n'existe pas). Les codes d'adhésion aux hubs
non plus.

Ce qui existe en revanche : `erase_user(uuid)`, qui efface un compte
entier en cascade, testée en conditions réelles le 15 août. Elle répond
au droit à l'effacement, pas à la limitation de conservation.

Il faut donc écrire une politique de durées, puis la coder. Je compte
**2 jours**, et je ne peux pas le faire avant que les durées soient
décidées — ce n'est pas une décision technique.

## 6. Le consentement ne peut pas être démontré

`consents` a la bonne structure : type, accordé, horodatage, date de
retrait, **version de politique**. Elle est **vide**.

Le consentement photo vit ailleurs : un booléen `photo_consent` sur
`children`. Il dit qu'une case est cochée. Il ne dit pas **quand**, ni
**par qui**, ni **sur quelle version de quelle politique**. Trois photos
d'enfants sont stockées, quatre enfants ont la case cochée.

L'article 7.1 demande de pouvoir démontrer le consentement. Aujourd'hui,
on ne le peut pas. Correction : **une demi-journée** pour écrire dans
`consents` à chaque case cochée ou décochée, le jour où une politique
existe et porte un numéro de version.

Et il n'y a **aucune page de politique de confidentialité dans
l'application** — vérifié, aucune route, aucune mention. L'information
de l'article 13 n'est donc donnée nulle part. C'est à écrire avec
l'avocate avant la première famille, pas avant la démonstration.

## 7. Preuves de cloisonnement — tests réels du 7 novembre

C'est le test que le dossier place en tête, et qu'il a raison d'y
placer : **vérifier ce que le serveur renvoie vraiment, pas ce que
l'écran affiche**. Je ne l'avais jamais fait de façon systématique.

Méthode : requêtes SQL exécutées en prenant l'identité de trois
utilisateurs réels (rôle `authenticated` et jeton correspondant), ce qui
contourne entièrement l'interface et interroge la base comme le ferait
un appel direct depuis une console de navigateur.

**Benjamin, membre du hub « Ecole Boomhut »**

| Table interrogée en direct | Lignes obtenues | Attendu |
| --- | --- | --- |
| `users` | 1 (lui) | 1 |
| `children` | 1 (le sien) | 1 |
| `trips` | 209 — **tous de son propre foyer**, vérifié | ses trajets |
| `messages`, `trip_private_notes`, `reports` | 0 | 0 |
| `mooves_balance` | 1 (le sien) | 1 |
| `hub_trips_view` | 3 | les trajets publiés |

**Stéphane, membre du même hub, autre foyer**

| Table | Lignes | Lecture |
| --- | --- | --- |
| `trips` **en direct** | **0** | la règle « jamais de lecture directe des trajets côté hub » est portée par la base, pas par le code de l'écran |
| `hub_trips_view` | 3 | il voit les trajets publiés de Benjamin, filtrés |
| `children` | 2 (les siens) | aucun enfant d'autrui |
| `users` | 1 (lui) | aucun profil d'autrui |

**Brigitte, membre d'un autre hub**

Tout à zéro : 0 trajet du hub Boomhut, 0 ligne de `trips`, 0 enfant
d'autrui, 0 profil d'autrui. Elle a également tenté d'extraire les
profils du hub Boomhut par la fonction dédiée
(`hub_member_profiles`) : **0 ligne**.

**Visiteur non connecté**

La base refuse au niveau des droits d'exécution, avant même d'évaluer
les règles : « permission denied for function `auth_hub_ids` ». Lecture
des lieux : 0.

**Ce que la vue du hub expose réellement**

13 colonnes : identifiant, hub, sens, statut, heure, libellé d'origine,
libellé de destination, point de rendez-vous, places, conducteur,
**prénom seul du conducteur**, nombre d'enfants. Aucune coordonnée,
aucun foyer, **aucun prénom d'enfant**.

Contenu réel vérifié : l'origine affichée est « Domicile », jamais une
adresse. Les destinations sont des lieux publics (« Hall Omnisports
Waterloo », « Wimbledon »). La règle « un lieu public, jamais un
domicile » tient en pratique, pas seulement sur le papier.

**Ce que ces tests ne prouvent pas** : ils portent sur 9 comptes et
3 hubs. Ils ne couvrent pas le membre non encore validé, le membre
retiré après coup, ni deux demandes simultanées sur la dernière place.
Ces trois cas sont dans ma liste avant le 11 décembre.

**Stockage des photos** : les deux espaces de fichiers sont privés
(`public: false`, vérifié), types d'images imposés, 5 Mo maximum,
affichage par lien signé d'une heure.

## 8. Protections proposées mais non prouvées

À ne pas cocher « en place » dans PIA :

- les durées de conservation — **rien n'existe** (§ 5) ;
- la traçabilité du consentement — **rien n'existe** (§ 6) ;
- l'information des personnes — **aucune page** (§ 6) ;
- les notifications — à écrire, donc leur flux reste à analyser ;
- le lien aller-retour — défaut connu, corrigé avant le 11 décembre ;
- l'écran de signalement — table prête, aucun écran ;
- le chiffrement au repos, les accès privilégiés, la restauration de
  sauvegarde : assurés par Supabase, **non vérifiés par moi**. Je peux
  rapporter ce que leur documentation affirme ; je ne peux pas le
  prouver. Si une preuve est exigée, elle relève d'un audit externe.

## 9. Ce que cet inventaire ajoute à mon planning

| Action | Durée | Quand |
| --- | --- | --- |
| ~~Servir les polices depuis notre domaine (§ 3.4)~~ | 1 h | **fait le 7 nov.** |
| Journaliser les consentements dans `consents` | ½ j | avec la politique |
| Écrire et coder les durées de conservation | 2 j | après décision |
| Expiration des invitations et des codes | ½ j | avant le pilote |
| Compléter les tests (non validé, retiré, concurrence) | 1 j | avant le 11 déc. |
| Schéma de flux pour l'avocate | ½ j | fait pour l'essentiel ici |

Environ **4 jours**, dont 3 étaient déjà comptés dans l'évaluation du
3 novembre, et un déjà consommé. Le 11 décembre tient.

## 10. Ce qu'il me faut en retour

1. **Les durées de conservation**, catégorie par catégorie. Je ne peux
   pas les inventer, et le dossier a raison de refuser qu'on les pose
   sans justification.
2. **Le service d'envoi d'e-mails** : Brevo ou Resend. Je ne branche
   rien avant.
3. **La politique de confidentialité**, avec un numéro de version, pour
   que `consents` ait quelque chose à enregistrer.
4. **Le sort des 14 enfants déjà en base** : purge avant le pilote, ou
   intégration au périmètre analysé.
5. **La recherche d'adresse** (§ 3.3) : on garde Komoot sans contrat, on
   l'héberge, ou on prend un fournisseur ?

---

*Méthode : lecture du code au 7 novembre 2026 (HEAD `ed45318`), requêtes
sur la base de production, tests d'accès par prise d'identité. Les
affirmations de Supabase et de Vercel sur leur propre infrastructure ne
sont pas vérifiées par moi et sont signalées comme telles.*
