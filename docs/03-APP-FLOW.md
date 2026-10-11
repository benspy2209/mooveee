# App Flow : Mooveee

> Reconstitué le 11/10/2026 par lecture intégrale des neuf fichiers de `src/routes/`. Libellés entre guillemets = texte exact de l'interface. Références de lignes au commit e68b1d0. [déduit du code] partout ; [à confirmer] signalé.

## 1. Plan du site

| ID | Écran | Route | Accès | Onglet |
|----|-------|-------|-------|--------|
| E0 | Aiguillage | `/` | public ; connecté → E3, anonyme → E1 ; point d'atterrissage du magic link | |
| E1 | Connexion | `/login` | public ; connecté → E3 | |
| E2 | Bienvenue (profil) | `/bienvenue` | connecté sans ligne `users` ; profil existant → E3 | |
| E3 | Mon foyer | `/foyer` | connecté + profil | Foyer |
| E4 | Les enfants du foyer | `/enfants` | connecté + profil ; sans foyer : appel à l'action vers E3 | via E3 |
| E5 | Les activités des enfants | `/activites` | idem ; sans enfant : appel à l'action vers E4 | via E3 |
| E6 | La semaine | `/semaine` | idem ; sans foyer : appel à l'action vers E3 | Semaine |
| E6a | Détail du trajet (modale) | dans E6 | | |
| E6b | Je passe par là (modale) | dans E6, si membre d'au moins un hub | | |
| E7 | Les hubs | `/hubs` | idem ; sans pacte accepté : écran Pacte à la place du détail | Hubs |
| E8 | Les demandes de place | `/demandes` | idem | Demandes |
| E9 | Mon équilibre d'entraide | `/equilibre` | connecté + profil, sans condition de foyer | Équilibre |

Absents : page 404, page d'erreur de route, paramètres du compte, suppression de compte, mentions légales et politique de confidentialité, aide ou contact, écran institution, écran de signalement. [déduit du code]

Layout `_authed` : header verre + wordmark, deux bannières conditionnelles (relance de dépôt en ambre, rappel de trajet en bleu, bouton « Masquer » non persisté), tab bar 5 onglets. Gardes : session absente → E1 ; profil absent → E2.

## 2. Fiches écran

### E0 : Aiguillage `/`
- But : attendre la résolution de session (le client Supabase lit le hash du magic link) puis rediriger.
- États : « Chargement… » puis `Navigate`. Aucune erreur affichée si le lien est expiré (la redirection tombe sur E1 sans message). [écart]

### E1 : Connexion `/login` (322 lignes)
- But : ouvrir une session.
- Contenu : kicker « Trajets partagés entre familles », wordmark, deux modes commutables.
- Mode « code » (défaut) : champ « Code d'accès » (placeholder « ex. ben-12345678 ») ; le préfixe avant le tiret choisit l'email dans `CODE_EMAILS` (3 comptes codés en dur), le code complet est le mot de passe Supabase.
- Mode « email » : champ « Adresse email » → `signInWithOtp` ; puis champ « Code de connexion » 6 chiffres (`one-time-code`) ou clic sur le lien reçu.

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Se connecter » (code) | `signInWithPassword` → session → E3 | « Code d'accès invalide. » ; message dédié si le provider mot de passe est désactivé côté Supabase |
| « Pas de code d'accès ? Recevoir un code par email » | bascule le mode | |
| « Recevoir le code de connexion » | envoi OTP, bandeau vert « Un email a été envoyé à … » | « Une erreur est survenue : {message brut} » |
| « Se connecter » (OTP) | `verifyOtp` → session par `onAuthStateChange` → E3 | message brut |
| « Changer d'adresse ou renvoyer un email » | retour au champ email | |

- États : envoi (« Envoi en cours… »), vérification (« Vérification… »). Pas d'état « lien expiré », pas de limitation de tentatives côté UI.
- US couvertes : US1.
- Notes : le mode code est documenté « provisoire tant que le SMTP n'est pas branché » ; l'email de redirection est `window.location.origin` (incompatible Capacitor, voir TRD §9).

### E2 : Bienvenue `/bienvenue` (98 lignes)
- But : créer la ligne `users` (prénom obligatoire, nom optionnel).
- Action « Continuer » → insert `users` → trigger solde initial 60 → E3. Erreur : message brut.
- États : « Création en cours… ». Pas de collecte de consentement, pas de lien vers une politique de confidentialité. [écart RGPD]
- US couvertes : US2.

### E3 : Mon foyer `/foyer` (483 lignes)
- But : voir et administrer le foyer, point d'entrée vers E4 et E5, déconnexion.
- Lectures : `household_members` (première appartenance, `limit(1)` sans tri), `households`, `household_members` + `users(first_name, last_name)`, `household_invitations` (`status = en_attente`).
- Sans foyer : écran « Créez votre foyer » (nom libre, créateur = parent admin).
- Contenu : nom du foyer, membres (initiale, prénom nom, « (vous) », badge rôle), invitations en attente (email complet, badge « Invité·e », visible de tous les membres), formulaire d'invitation (admin seulement), cartes « Les enfants » et « Les activités », lien « Se déconnecter ».

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Créer le foyer » | insert `households` puis insert `household_members` (admin, parent) ; pas de rollback entre les deux | message brut |
| « Inviter un adulte responsable » → « Inviter » | insert `household_invitations` (email normalisé, rôle) ; aucun email envoyé ; bouton affiche « Envoi… » | message brut ; email déjà invité → message brut de contrainte unique |
| « Se déconnecter » | `signOut()` sans retour | aucune |

- Manques : renommer le foyer, changer un rôle, retirer un membre, révoquer une invitation, accepter une invitation (aucun parcours côté invité).
- US : US3, US4 (partielle).

### E4 : Les enfants du foyer `/enfants` (660 lignes)
- But : CRUD enfants avec photo consentie.
- Lectures : `children` (prénom, année, photo, consentement, rehausseur) ; `createSignedUrls` 3600 s uniquement si `photo_consent`.
- Ligne : photo ou initiale, prénom, « Né(e) en {année} » ou « Année de naissance non renseignée », « · Rehausseur ».

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Ajouter un enfant » / « Modifier » → « Enregistrer » | insert ou update `children` ; puis upload `child-photos/{household}/{child}.{ext}` (upsert) ; puis update `photo_url` ; retrait du consentement → suppression du fichier | « Pour enregistrer une photo, vous devez cocher la case de consentement ci-dessous. » ; « Format non accepté. Formats autorisés : JPEG, PNG ou WebP. » ; « La photo dépasse la taille maximale de 5 Mo. » ; upload : « La photo n'a pas pu être enregistrée : … Les autres informations ont bien été sauvegardées, vous pouvez réessayer. » |
| « Supprimer » → « Confirmer » | `storage.remove` puis delete `children` (cascade activités, trajets liés) | message brut à chaque étape |

- États : chargement, vide « Aucun enfant pour le moment. Ajoutez un premier enfant pour préparer vos trajets. », erreur. Manques : échec de signature silencieux, URL signées non renouvelées après 1 h, « Annuler » après création partielle laisse un enfant invisible jusqu'au rechargement.
- Règles : année entre (année courante − 25) et année courante ; consentement photo = case distincte, versionnée nulle part.
- US : US5.

### E5 : Les activités des enfants `/activites` (843 lignes)
- But : CRUD activités ; chaque enregistrement génère les trajets sur 91 jours.
- Lectures : `children`, `activities`. Écritures : `activities`, puis `generateTripsForHousehold` (lit `activities` et `trips`, upsert `trips` par lots de 200, upsert `trip_children`, update `distance_band`, `place_id`, `linked_trip_id`).
- Formulaire : « Enfant concerné », « Activité » (ex. « football, solfège… »), « Lieu (optionnel) » (PlaceField : autocomplete Photon dès 3 caractères, 300 ms, favoris étoilés, texte libre en secours, aide « Le lieu de l'activité (école, club, salle) — jamais votre domicile. »), « Distance du trajet depuis le domicile » (Moins de 3 km / De 3 à 15 km / Plus de 15 km, défaut courte), récurrence (hebdomadaire avec jours, ou ponctuelle avec date), heures début et fin au pas de 15 min.

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Ajouter » / « Enregistrer » | écrit l'activité, génère, notice verte « Activité enregistrée : ses trajets sont prêts jusqu'à trois mois à l'avance. » | « Choisissez au moins un jour de la semaine. » ; « L'heure de fin doit être après l'heure de début. » ; génération : notice ambre « L'activité est enregistrée, mais la création de ses trajets a échoué : … » |
| « Supprimer » → « Confirmer » | delete `activities` ; les trajets générés restent (FK set null) | message brut |
| étoile PlaceField | upsert ou delete `household_places` | aucune (promesse non gérée) |

- Manques : modifier un horaire ne met pas à jour les trajets déjà générés ; la notice ne disparaît jamais ; les timestamps du formulaire sont construits dans le fuseau du navigateur, pas en Europe/Brussels ; activité à cheval sur minuit impossible.
- US : US6.

### E6 : La semaine `/semaine` (1 622 lignes)
- But : timeline des trajets du foyer, génération, conducteur, publication, bulletin de dépôt.
- Lectures : `children`, `household_members` + `users`, `hub_members` + `hubs` (validés), `trips` de la semaine (lundi → dimanche, Europe/Brussels) avec `activities(label)` et `trip_children(child_id)`, prochain trajet à venir.
- Contenu : « La semaine », navigation « ← Semaine précédente » / « Semaine suivante → », sélecteur « Horizon de génération » (4 semaines, 3 mois, 6 mois, 1 an), « Générer les trajets », « Je passe par là » (si hub), légende des enfants (6 couleurs), un bloc par jour non vide, une ligne par trajet (heure, Aller/Retour, ⇄ si aller/retour lié, origine → destination, activité, prénom du premier enfant ou « · passage sans enfant », pastille « Annulé » / prénom conducteur / « À couvrir », « Publié au hub »).
- États vides : « Aucun trajet cette semaine. Vos prochains trajets commencent le {date}. » + « Afficher cette semaine-là » ; « Aucun trajet pour le moment. » + « Créer une activité ».

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Générer les trajets » | génération idempotente avec progression « Génération… {n}/{total} » ; message « Tout est à jour… » ou « {N} trajet(s) créé(s) sur {horizon}, enfants rattachés. » | « Une erreur est survenue : … » |
| ligne de trajet | ouvre E6a | |
| « Je passe par là » | ouvre E6b | |

#### E6a : Détail du trajet (modale, Escape et clic fond)
- Select « Conducteur » (membres du foyer, option « Personne pour le moment (à couvrir) ») → update `trips.driver_id` + statut couvert/non_couvert ; état local mis à jour AVANT la réponse serveur. [écart]
- Section « Partage au hub » (`PublishSection`) : hub, « Places offertes aux autres familles » (1 à 8, défaut 2), point de rendez-vous du hub (défaut présélectionné), « Publier » → update `trips` (`published_to_hub`, `seats_*`, `meeting_point_id`, statut couvert_ouvert) ; publié : « {n} places restantes sur les {total} offertes », compte « {k} famille(s) du hub ont un besoin correspondant » via RPC, « Dépublier du hub » (remet seats et meeting point à null sans vérifier les demandes acceptées). Sans conducteur : « Désignez d'abord un conducteur pour pouvoir proposer des places au hub. »
- Section bulletin (`DropoffSection`, conducteur seulement) : RPC `trip_children_aboard` (prénoms, y compris d'autres foyers), état par enfant, « Confirmer le dépôt » → insert `trip_dropoff_confirmations`, « Annuler » → delete ; relance « L'heure du trajet est passée depuis plus de {20} minutes : merci de confirmer le dépôt des enfants. »
- « Annuler ce trajet » → « Oui, annuler » (statut annule) ; « Rétablir ce trajet ».
- Erreurs : message brut en bas de modale. Pas de focus trap.

#### E6b : Je passe par là (modale, `role="dialog"`)
- Hub, sens (« Vers le lieu (aller) » / « Depuis le lieu (retour) »), lieu (PlaceField), date et heure à venir, places 1 à 4. « Publier au hub » → insert `trips` (`has_children false`, `couvert_ouvert`, `published_to_hub true`, conducteur = soi, `activity_id null`). Erreurs : « Indiquez le lieu devant lequel vous passez. », « Choisissez un moment à venir. », message brut. Pas d'Escape, clic fond perd la saisie.
- US : US7, US9, US12.

### E7 : Les hubs `/hubs` (1 970 lignes)
- But : lister ses hubs, rejoindre, créer, administrer, voir les trajets ouverts et les suggestions.
- Lectures (liste) : `household_members`, `hub_members` + `hubs`, `hub_pact_acceptances`. Lectures (détail, 10 requêtes) : `hubs`, RPC `hub_member_profiles`, `app_settings` (seuil 5), `hub_trips_view` (couvert_ouvert, à venir), `trips` du foyer (non_couvert, à venir), `household_members`, `children`, `meeting_points` + URL signées, paramètres Concierge, dernière publication du hub.
- Contenu : « Les hubs » + texte explicatif ; « Mes hubs » (nom, type, commune, « · Admin », statut « En démarrage » / « Actif » / « Structuré ») ; « Demandes en attente » (« Demande d'adhésion en attente de validation par un administrateur du hub. ») ; détail du hub sélectionné ; formulaires « Saisir un code d'adhésion » et « Créer un nouveau hub ».
- Écran Pacte (`PactGate`) si la version 1.0 n'est pas acceptée : 5 engagements en dur (entraide sans contrepartie financière, horaires et adultes convenus, sécurité en voiture, confidentialité du hub, alerte d'un admin), « Accepter le pacte » → insert `hub_pact_acceptances`.
- Détail : en-tête (nom, type, lieu, commune, statut), bandeau « Le seuil est atteint : le hub est maintenant actif ! » (quasi inatteignable, voir rapport), « N membre(s) validé(s) — encore N pour activer le hub. », encart admin « Code d'adhésion à partager avec les familles : {code} », encarts Concierge admin (stagnant 3 semaines, inactif 3 semaines), « Membres » (prénom nom, « Admin »), « Demandes d'adhésion à traiter » (admin : « Valider » / « Refuser »), « Points de rendez-vous » (admin : ajout avec photo 5 Mo, « Définir par défaut », « Supprimer » → « Confirmer »), « Suggestions pour votre foyer » (mes besoins non couverts × trajets ouverts : même sens, même jour, 90 min, lieu identique ou similaire ; trois explications, pas de score), « Trajets ouverts des autres familles » (cartes : heure, origine → destination, « Conduit par {prénom} », places, enfants à bord en nombre, point de rendez-vous, « Demander une place » → enfant + message → « Envoyer la demande »).

| Action | Résultat | Si erreur |
|--------|----------|-----------|
| « Chercher » (code 6 car.) | RPC `hub_for_join_code` → identité publique | « Aucun hub ne correspond à ce code. Vérifiez-le avec la personne qui vous l'a transmis. » ; « Vous êtes déjà membre de « {nom} », ou votre demande est déjà en attente. » |
| « Demander à rejoindre ce hub » | insert `hub_members` (non validé) puis insert `hub_pact_acceptances` ; « Demande envoyée pour « {nom} ». Un administrateur du hub doit maintenant la valider. » | message brut, pas de compensation |
| « Créer le hub » | jusqu'à 5 tentatives d'insert `hubs` (code généré client), puis `hub_members` admin validé, puis pacte | « Impossible de générer un code d'adhésion unique. » ; message brut ; hub orphelin possible |
| « Valider » / « Refuser » | update `validated_at` / delete `hub_members` | message brut |
| « Envoyer la demande » | insert `trip_requests` ; « Demande envoyée. Le conducteur doit maintenant l'accepter — suivez son état dans « Mes demandes ». » | « Une demande est déjà en attente pour cet enfant sur ce trajet. » ; message brut |

- États : « Chargement… », « Chargement du hub… », erreurs avec « Réessayer » (liste) ou sans (détail), vides « Aucun trajet ouvert pour le moment… », « Aucun point de rendez-vous défini… », « Ajoutez d'abord un enfant à votre foyer pour demander une place. ».
- US : US8, US10, US14.

### E8 : Les demandes de place `/demandes` (517 lignes)
- But : traiter les demandes reçues, suivre les demandes envoyées.
- Lectures : `trip_requests` envoyées (+ `children(first_name)` de mon foyer), `trip_requests` reçues (+ `trips!inner` de mon foyer + `activities(label)`), `hub_trips_view` pour les trajets demandés, RPC `hub_member_profiles` par hub (nom du demandeur), RPC `trip_request_first_contact` par demande en attente, `trip_dropoff_confirmations` pour les demandes acceptées.
- « Demandes reçues sur mes trajets » : parent demandeur (prénom nom), trajet, message libre, bandeau premier contact (« première fois que vos deux foyers partagent un trajet » [libellé à vérifier]), « Accepter » → RPC `accept_trip_request`, « Refuser » → update statut. Après échec : rechargement de l'état réel (pas d'optimisme).
- « Mes demandes envoyées » : statut (En attente, Acceptée, Refusée, Annulée, Expirée), trajet via la vue (« Trajet plus disponible dans le hub » si absent), prénom de mon enfant, « Dépôt confirmé par le conducteur à {HH:MM} » ou « Dépôt : en attente de confirmation du conducteur. ».
- États vides : « Aucune demande reçue pour le moment. », « Aucune demande envoyée. Trouvez un trajet ouvert sur l'écran de votre hub. ».
- Manques : annuler une demande envoyée, lien vers le trajet ou le hub, pagination, erreurs des quatre requêtes secondaires ignorées.
- US : US10, US11, US12.

### E9 : Mon équilibre d'entraide `/equilibre` (252 lignes)
- But : indicateur privé.
- Lectures : `mooves_balance`, `mooves_ledger` (200 derniers), `app_settings.mooves_imbalance_weeks`.
- Contenu : mention « Ces informations sont strictement privées… », trois compteurs « Aide apportée » / « Aide reçue » / « Dynamique de participation » (signé), phrase de lecture selon le signe, bloc Concierge « Un coup de main pour la suite ? » après 4 semaines négatives (sans lien ni bouton), « Historique de participation » (Aide apportée — trajet conduit, Aide reçue — place sur un trajet, Ajustement, Fonds de solidarité, Dynamique initiale ; montants suffixés « Mooves »).
- Vide : « Aucun mouvement pour le moment. Conduisez ou demandez une place via votre hub : chaque trajet accepté apparaîtra ici. »
- US : US13.

## 3. Parcours principaux

### P1 : Première connexion jusqu'au premier trajet visible
1. E1 : code d'accès ou email + code OTP.
2. E2 : prénom → profil créé, solde initial 60.
3. E3 : « Créer le foyer ».
4. E3 → E4 : « Ajouter un enfant » (prénom, année).
5. E4 → E5 : « Ajouter une activité » (hebdo, lieu, tranche, heures) → trajets générés sur 3 mois.
6. E6 : la semaine affiche les trajets « À couvrir » ; E6a : désigner un conducteur.
Point de contrôle : un tennis le mercredi 16h donne un aller 16h et un retour à l'heure de fin chaque mercredi, y compris après le changement d'heure.

### P2 : Rejoindre ou créer un hub
1. E7 : « Saisir un code d'adhésion » → « Chercher » → « Demander à rejoindre ce hub » (pacte accepté dans la foulée) ; ou « Créer un nouveau hub » (créateur admin validé).
2. Un admin du hub : E7 → « Demandes d'adhésion à traiter » → « Valider ».
3. Le nouveau membre voit le détail du hub, les membres, les trajets ouverts.
Point de contrôle : avant validation, le demandeur ne voit que « Demande d'adhésion en attente… » et aucune donnée du hub ; au 5e membre validé, le statut passe à « Actif ».

### P3 : Partager un trajet de bout en bout
1. Conducteur, E6a : conducteur désigné → « Partage au hub » → hub, places, point de rendez-vous → « Publier ».
2. Autre famille, E7 : carte dans « Trajets ouverts des autres familles » (ou dans « Suggestions pour votre foyer ») → « Demander une place » → enfant + message → « Envoyer la demande ».
3. Conducteur, E8 : « Demandes reçues » → bandeau premier contact si jamais partagé → « Accepter » (RPC : enfant à bord, place décrémentée, gain conducteur et usage demandeur en une transaction).
4. Demandeur, E8 : statut « Acceptée » ; E9 : mouvement « Aide reçue ».
5. Jour J, conducteur, E6a : bulletin → « Confirmer le dépôt » pour chaque enfant ; sinon bannière de relance après 20 min à l'ouverture de l'app.
6. Demandeur, E8 : « Dépôt confirmé par le conducteur à {heure} ».
Point de contrôle : à aucune étape le conducteur ne voit le prénom de l'enfant avant acceptation ; le demandeur ne voit jamais le téléphone ni le code postal du conducteur ; un double clic sur « Accepter » ne crédite qu'une fois.

### P4 : Passage sans enfant (v4 §4.1)
1. E6 : « Je passe par là » → hub, sens, lieu, moment, places → « Publier au hub ».
2. Le trajet apparaît aux autres familles comme un trajet ouvert ; même parcours P3 étapes 2 à 6.

### P5 : Effacement d'un compte (opérateur, hors application)
1. Demande du parent par un canal externe [à confirmer : lequel].
2. Ben : `npm run erase-user -- <email>` (purge Storage puis RPC `erase_user`).
Point de contrôle : 0 ligne, 0 objet ; trajets d'autres foyers où il conduisait détachés et remis « À couvrir » ; autre foyer intact. Testé le 15/08 et le 16/08.

## 4. Règles transverses
- Redirection si non connecté : vers E1, sans mémorisation de la page demandée (pas de `redirect` ni `next`). [écart]
- Sans profil : vers E2 systématiquement.
- Navigation : tab bar fixe (Semaine, Demandes, Hubs, Équilibre, Foyer) ; E4 et E5 via cartes dans E3 ; pas de bouton retour dans le header ; geste retour système = historique du routeur.
- Emails déclenchés : aucun, hormis les emails d'authentification Supabase (magic link et OTP) soumis au plafond SMTP par défaut.
- Notifications : bannières à l'ouverture seulement (relance de dépôt, rappel de trajet 24 h) ; aucun push, aucune persistance du « Masquer ».
- Données tierces : prénom et nom des parents visibles entre membres validés d'un hub (`hub_member_profiles`) ; prénom seul du conducteur dans les cartes de trajet ; prénoms d'enfants d'autres foyers uniquement pour le conducteur du trajet (bulletin) ; message libre de demande affiché tel quel.
- Fuseau : affichage forcé `Europe/Brussels` partout ; saisie du formulaire d'activité dans le fuseau du navigateur (incohérence, voir rapport).
- Multi-foyer : chaque écran prend la première appartenance renvoyée (`limit(1)` sans tri). Un adulte dans deux foyers aurait un comportement instable.
