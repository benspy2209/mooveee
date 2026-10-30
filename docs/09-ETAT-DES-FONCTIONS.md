# État des fonctions — 30 octobre 2026

Réponse à la demande de Stéphane (messages du 28 et du 29/10, formulée
deux fois) : pour chaque ensemble de fonctions, ce qui existe, ce qui
reste à faire, la difficulté ou la dépendance, et le moment — avant ou
après le pilote.

Le document est écrit depuis le code et la base, pas depuis les
intentions. Quand une table existe sans écran, c'est écrit. Quand une
fonction n'a jamais été utilisée par un vrai parent, c'est écrit aussi.

Trois mots ont un sens strict ici :

- **Fonctionne** : le chemin complet a été parcouru au moins une fois,
  écran compris.
- **Existe** : le code et la base sont là, le chemin complet n'a pas été
  parcouru par quelqu'un d'autre que moi.
- **Amorcé** : la table est en base, aucun écran ne s'en sert.

---

## 1. Entrer dans l'application

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Connexion par code à 6 caractères | Fonctionne (corrigé le 19/10 : le code manquait dans l'e-mail) | À reparcourir par Stéphane de bout en bout | Envoi d'e-mail par le serveur Supabase mutualisé — lent et parfois en indésirables | Avant |
| Lien magique (repli) | Fonctionne | — | Même dépendance | Avant |
| Envoi d'e-mail fiable | Non fait | Brancher un service d'envoi dédié | Brevo ou Resend, gratuit au volume du pilote, ~1 heure de travail | Avant |
| Profil (prénom, nom, téléphone, code postal) | Fonctionne | — | — | Avant |
| Tutoriel dans l'application | Écrit comme document, pas intégré | Reprendre les 11 étapes en écrans d'accueil | Aucune | Avant |

## 2. Le foyer

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Créer un foyer, s'y nommer | Fonctionne | — | — | Avant |
| Deuxième adulte, rôle administrateur | Fonctionne | Nom tronqué à l'affichage (défaut signalé par Stéphane) | Aucune | Avant |
| Inviter l'autre adulte | **Existe à moitié** : la ligne d'invitation est créée, aucun e-mail n'est envoyé et il n'y a pas d'écran d'acceptation | Reprendre le mécanisme du lien de hub, qui marche | Dépend du service d'envoi ci-dessus | Avant |
| Garde alternée (un enfant dans deux foyers) | Impossible : un enfant appartient à un seul foyer | Modèle à rouvrir | Touche le cœur du schéma et la RLS. Plusieurs jours, et un risque de régression partout | Après — sauf si une famille du pilote est concernée, auquel cas il faut le savoir tout de suite |

## 3. Les enfants

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Prénom, année de naissance, siège rehausseur | Fonctionne | — | — | Avant |
| Photo | Fonctionne : stockage privé, consentement explicite, affichage par lien d'une heure, fichier supprimé au retrait du consentement | — | — | Avant |
| Supprimer un enfant | Fonctionne | Bouton trop près de « Modifier » (défaut signalé) | Aucune | Avant |
| Allergies, santé | Volontairement absent | — | Donnée de santé au sens du RGPD : consentement séparé et accès restreint. Décision du porteur : pas maintenant | Après, et seulement avec la DPIA |

## 4. Les activités

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Activité récurrente (jour, heure, fin de série) | Fonctionne, y compris aux deux changements d'heure | — | — | Avant |
| Lieu de l'activité | Fonctionne, recherche d'adresse sur fond de carte libre | Qualité des résultats moyenne sur les petites communes | Photon/OpenStreetMap, gratuit. Google donnerait mieux, contre un coût et un transfert de données | Avant pour la recherche actuelle ; arbitrage à rendre pour Google |
| Marges horaires (arriver avant, repartir après, durée du trajet) | Fonctionne depuis le 28/10, appliqué aussi aux activités déjà créées | À vérifier par Stéphane sur ses propres activités | — | Avant |
| Séries : modifier une occurrence sans casser la série | **Partiel** : on peut annuler une occurrence, pas la déplacer | Déplacement d'une occurrence seule | Une journée | Avant |

## 5. Les trajets et le calendrier

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Génération des trajets jusqu'à un an | Fonctionne, rejouable sans doublon | — | — | Avant |
| Vue Semaine | Fonctionne | C'est la seule vue | — | Avant |
| Vue Jour et vue Mois | N'existent pas | À construire | Deux à trois jours. C'est le point central de la demande de Stéphane sur le calendrier | Avant |
| Statuts explicites du trajet (À organiser, Je conduis, Aide demandée, En attente d'accord, Confirmé, Annulé) | Fonctionne depuis le 30/10 | — | — | Avant |
| Je conduis / je me retire | Fonctionne | — | — | Avant |
| Annuler une occurrence | Fonctionne | — | — | Avant |
| Distance réelle du trajet | **Non calculée** : le barème s'applique par tranche, la distance reste vide | Soit un calcul d'itinéraire, soit une tranche déclarée par le parent | Un calcul d'itinéraire est un service externe : coût au-delà d'un quota, et une adresse de départ qui sort de l'application | Arbitrage de Stéphane requis |

## 6. Demander et offrir une place

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Publier un trajet au hub | Fonctionne, filtré : aucun prénom d'enfant ni contact ne sort du foyer | — | — | Avant |
| Demander une place | Fonctionne | — | — | Avant |
| Accepter, refuser | Fonctionne, en une seule transaction, à l'abri du double clic | — | — | Avant |
| Deux demandes qui forment un seul besoin (aller **et** retour) | **Non lié** : ce sont deux demandes indépendantes, et l'écran peut afficher « résolu » quand une seule des deux places est obtenue | À corriger : lier les deux, et ne rien afficher comme résolu tant que les deux ne le sont pas | Une à deux journées. Défaut signalé par Stéphane, et c'est le plus trompeur de la liste | Avant |
| Le conducteur voit qui monte | Fonctionne, prénoms réservés au conducteur | — | — | Avant |

## 7. Les hubs

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Créer un hub, code d'adhésion | Fonctionne | — | — | Avant |
| Lien d'invitation partageable par WhatsApp | Fonctionne depuis le 22/10 | — | — | Avant |
| Pacte d'engagement | Fonctionne ; depuis le 30/10 le texte suit le geste (créer ou rejoindre) | — | — | Avant |
| Validation d'un membre par le responsable | Fonctionne | — | — | Avant |
| Retirer un membre | Fonctionne, en deux temps | — | — | Avant |
| Co-administrateur | Fonctionne depuis le 28/10 | — | — | Avant |
| « En démarrage » (hub d'une seule famille) | Fonctionne, et dit maintenant qu'aucune fonction n'est limitée | — | — | Avant |
| Trouver un hub sans code | N'existe pas | Décision de principe avant le code | Un annuaire de hubs expose l'existence d'un groupe de familles. Arbitrage de Stéphane requis | Avant si la réponse est simple (demande au responsable), après si c'est un annuaire |
| Ponts entre hubs | Amorcé, volontairement gelé | — | — | Après |

## 8. Sécurité de l'enfant

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Bulletin de trajet : le conducteur confirme chaque dépôt | Fonctionne | — | — | Avant |
| Le parent voit la confirmation | Fonctionne | — | — | Avant |
| Relance si le dépôt n'est pas confirmé | Fonctionne, mais seulement quand le parent ouvre l'application | Devient utile avec les notifications | Voir § 9 | Avant |
| Aucune remise confirmée sans avoir eu lieu | Fonctionne depuis le 30/10, garde posée dans la base et pas seulement dans l'écran | — | — | Avant (règle de sécurité demandée par Stéphane) |
| Points de rendez-vous | Fonctionne | — | — | Avant |
| Signalement d'un problème | **Amorcé** : la table existe, aucun écran | Écran de signalement, et la règle « un signalement impliquant un enfant ne se résout jamais tout seul » | Deux jours, dont la procédure humaine à écrire avec Stéphane | Avant — un pilote avec de vraies familles sans chemin de signalement est difficile à défendre |
| Niveau de confiance visible (vérifié, parrainé…) | **Rien en base**, contrairement à ce que je croyais | Modèle + écran | Deux jours. Jamais dérivé des Mooves, jamais un chiffre | À trancher : utile au pilote, pas indispensable |

## 9. Notifications — le point bloquant

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Préférences de notification (quotas, heures de silence) | **Amorcé** : la table existe, rien ne l'utilise | — | — | Avant |
| Moteur d'envoi | **N'existe pas.** Aujourd'hui l'application ne prévient personne de rien | À construire : détection des événements, file d'envoi, respect des quotas | Trois à cinq jours, plus un service d'envoi d'e-mail. C'est la dépendance de presque tout le reste | Avant. Rien d'autre ne mérite d'être fait d'abord |
| E-mail | — | Événements : demande reçue, demande acceptée ou refusée, trajet de demain, dépôt non confirmé | Brevo ou Resend | Avant |
| Notification sur le téléphone, application ouverte ou fermée | — | Push web | Fonctionne sur Android et sur ordinateur. **Sur iPhone, il faut que l'utilisateur ait ajouté l'application à son écran d'accueil** | Avant pour Android, à expliquer pour iPhone |
| Notification iPhone sans passer par l'écran d'accueil | — | Application dans l'App Store | Compte développeur Apple (99 €/an), encapsulation, et le délai de validation d'Apple | Après |
| SMS | — | — | Coût par message, à chiffrer. Déconseillé au pilote | Après |

## 10. Se parler entre parents

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Message entre deux parents | **N'existe pas.** La table `messages` est en base et porte déjà une colonne « trajet », mais ses trois canaux sont « mon foyer », « tout le hub » et « l'institution parle » : aucun canal à deux | Décider la forme, puis construire | Trois jours après les notifications, dont elles dépendent. La forme est une décision de Stéphane : fil attaché au trajet, ou messagerie libre entre familles | Avant, sous une forme minimale : un fil par trajet, qui se ferme avec le trajet |
| Message d'une institution aux familles | Amorcé | — | — | Après |

## 11. Les Mooves

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Compteur, journal, écran Équilibre privé | Fonctionne | — | — | Avant |
| Barème par tranche de distance | Fonctionne, valeurs en paramètre et jamais dans le code | Dépend de la distance (§ 5) | — | Avant |
| Dotation de départ à 100 | Fonctionne ; les comptes créés avant le 21/10 ont été mis à niveau le 30/10 | — | — | Fait |
| Fonds de solidarité | Fonctionne | — | — | Avant |
| Ce qu'on dit à une famille qui descend bas | Rien n'est dit | Un message à écrire | Aucune difficulté technique. C'est une décision de ton, et elle appartient à Stéphane | Avant |
| Achat, conversion, transfert de Mooves | Structurellement impossible, et ça doit le rester | — | — | Jamais |

## 12. Institutions

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Calcul mensuel des indicateurs, seuil anti-réidentification | Fonctionne, automatique | — | — | Fait |
| Écran pour l'institution | N'existe pas | Tout | Trois à cinq jours | Après |
| Certification d'un hub | N'existe pas | — | N'ajoute jamais de fonction aux familles, seulement des outils de gestion | Après |
| Facturation par palier | N'existe pas, et ne doit jamais être indexée sur le trajet | — | — | Après |
| Défraiement des bénévoles | Schéma seul, désactivé, aucune logique écrite | — | Validation juridique vecteur par vecteur (club, école, commune, association de parents) avant toute communication | Après |

## 13. Le reste

| Fonction | État actuel | Travail restant | Difficulté ou dépendance | Avant / après pilote |
| --- | --- | --- | --- | --- |
| Accompagnement guidé sur l'écran d'accueil | Fonctionne depuis le 22/10 | — | — | Avant |
| Installable comme une application | Fonctionne | — | — | Avant |
| Finitions visuelles signalées par Stéphane (contrastes, hauteurs de blocs, boutons sur trois lignes, bandeaux qui masquent le contenu) | À corriger | Une passe complète | Deux jours | Avant |
| Détection d'opportunités | En observation pure, volontairement : elle regarde, elle ne propose rien | — | Nouveau traitement à inscrire dans la DPIA | Après |
| Effacement complet d'un compte | Fonctionne, testé en conditions réelles | — | — | Fait |
| Néerlandais, anglais | N'existent pas | — | — | Après |
| DPIA | **Non validée** | Prestataire à choisir | C'est la condition d'entrée du pilote, pas une formalité de sortie | Avant, et le plus tôt possible |

---

## Ce qu'il faut faire avant le pilote, dans l'ordre

1. La DPIA, parce que le reste n'a pas le droit de servir sans elle.
2. Les notifications, parce que presque tout en dépend.
3. Les deux demandes qui forment un seul besoin, parce que l'écran
   mentirait sur une place obtenue.
4. L'écran de signalement, parce que de vraies familles entrent.
5. L'invitation de l'autre adulte du foyer, qui ne part pas aujourd'hui.
6. Les vues Jour et Mois.
7. Un fil de discussion par trajet.
8. La passe de finitions visuelles.
9. Le tutoriel dans l'application.

À six jours ouvrables par semaine de travail utile, cela représente
environ trois semaines de développement, hors DPIA, qui ne dépend pas
de moi.

## Les décisions dont j'ai besoin de Stéphane

1. **Notifications** : quels événements méritent de déranger un parent,
   et par quel canal en premier ? Ma proposition : e-mail pour tout,
   plus la notification sur le téléphone pour le trajet du lendemain et
   la demande reçue.
2. **Se parler** : un fil attaché au trajet, qui se ferme avec lui, ou
   une messagerie libre entre familles ? Ma proposition : le fil.
3. **Distance** : calcul d'itinéraire automatique (service externe,
   coût, et l'adresse de départ qui sort de l'application), ou tranche
   déclarée par le parent à la création de l'activité ? Ma proposition :
   la tranche déclarée pour le pilote.
4. **DPIA** : quel prestataire, quel budget, quel délai. Blocage réel.
5. **Trouver un hub sans code** : demande au responsable, ou annuaire
   des hubs ? Ma proposition : la demande, un annuaire expose
   l'existence des groupes.
6. **Le pilote** : combien de familles, quelle école ou quel club,
   quelle date. Tout le découpage avant/après en dépend.
7. **iPhone** : compte développeur Apple et délai de validation, ou
   l'ajout à l'écran d'accueil expliqué dans le tutoriel pour le
   pilote ? Ma proposition : l'écran d'accueil.
8. **Garde alternée** : une famille du pilote est-elle concernée ? Si
   oui, cela devient un chantier avant, pas après.
9. **Niveau de confiance visible** : dans le pilote ou après ?
10. **Famille en bas de l'équilibre** : quel message, de quel ton ?
