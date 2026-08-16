# MOOVEEE — Instructions projet

Application communautaire de partage de trajets enfants. Client externe.

Documents de référence, par ordre d'autorité :
1. **Note d'arbitrage Mooves v2** (juillet 2026) — fait foi sur tout ce qui
   touche aux Mooves, à la réciprocité et au modèle économique.
2. **Instructions Techniques Partenaire v4** (août 2026, étiqueté
   « Version 3 » en page de garde — divergence signalée à Stéphane) — fait
   foi sur la façon d'implémenter. Remplace la v2. Nouveautés : lieux
   intelligents (§7), trajets enrichis (§4.1), détection d'opportunités en
   observation (§12), couches de hub préparées mais gelées (§6).
3. **Doc1 De A à Z v4** (mai 2026) — fait foi sur le fond produit, sauf
   contradiction avec les deux précédents.

Ce projet traite des données d'enfants mineurs. La DPIA n'est pas validée.
Les règles ci-dessous ne sont pas des préférences de style : les violer crée
un risque juridique réel pour le client. Elles contraignent la
fonctionnalité, jamais l'inverse.

---

## Stack

| Couche | Techno |
| --- | --- |
| Frontend | TanStack Start + React + TypeScript |
| Style | Tailwind CSS v4 |
| UI | shadcn/ui + Radix |
| Backend | Supabase (PostgreSQL, région UE) |
| Hébergement | Vercel |
| DNS | Cloudflare |

Variables d'environnement : dashboard Vercel et `.env.local`. Jamais dans le
repo. Ne jamais préfixer une clé `service_role` par `VITE_`.

**Mode SPA — tranché (août 2026)** : `tanstackStart` est configuré en
`spa` (enabled, `maskPath` racine, prerender sans crawl) dans
`vite.config.ts`. Le build produit `.output/public/_shell.html` en plus du
serveur Nitro : l'application tourne validée en statique pur, routage
client compris, encapsulable par Capacitor pour l'App Store.

**Règle** : n'introduire aucune dépendance au rendu serveur au runtime
dans les étapes suivantes. Pas de loader serveur, pas de server function,
pas d'API route nécessaire au fonctionnement : tout passe par Supabase
depuis le client.

---

## Les neuf interdits absolus

Si une fonctionnalité demande d'en contourner un, c'est la fonctionnalité
qu'il faut revoir. Signaler, ne pas contourner.

1. **Aucune donnée financière liée aux Mooves.** Pas de champ prix, montant
   en euros, valeur, taux de conversion. Le compteur est un indicateur
   d'équilibre interne, jamais un portefeuille.

2. **Aucun paiement entre utilisateurs.** Pas de Stripe, Bancontact, SEPA,
   bon d'achat ou avantage matériel entre parents. Aucun endpoint d'achat de
   Mooves. Le partage de frais entre parents est hors modèle de lancement.

3. **Aucune facturation indexée sur le trajet individuel.** La facturation
   institutionnelle se fait par palier d'usage. Jamais de ligne
   "X trajets × Y euros", ni de calcul équivalent en arrière-plan.

4. **Le matching propose, il n'assigne jamais.** Aucun trigger, cron ou
   automatisation ne fait passer une demande en accepté sans action humaine
   explicite du conducteur.

5. **Aucun score de contribution public.** Le solde de Mooves et le niveau
   d'équilibre sont strictement privés. Voir la section confiance progressive
   pour ce qui est autorisé.

6. **Zéro géolocalisation enfant stockée.** Pas de tracking GPS, pas
   d'historique de position, sous aucune forme. Zones domicile floutées au
   code postal.

7. **Aucune donnée enfant vers un service d'IA externe.** Toute
   fonctionnalité IA doit exclure les données mineurs des payloads envoyés à
   des API tierces.

8. **Le hub communautaire a toutes les fonctions familiales.** Aucun plafond
   de trajets, aucun délai artificiel, aucune dégradation pour un hub non
   certifié. La certification n'ajoute que des outils de gestion pour
   l'institution.

9. **Rien ne sort du cercle intime sans filtrage.** Un trajet publié au hub
   passe par `hub_trips_view`, jamais par un select direct sur `trips`.
   Jamais de note privée, de prénom enfant ou de contact côté hub.

---

## Règles de sécurité apprises en construisant

Six failles réelles ont été trouvées et fermées pendant le développement.
Chacune donne une règle générale. Les relire avant d'écrire une policy ou
une fonction.

### Une fonction SECURITY DEFINER est exposée via l'API

`mooves_apply_movement` écrivait dans le ledger en `security definer`, sans
révocation. Toute fonction du schéma `public` étant exposée via PostgREST,
n'importe quel utilisateur authentifié pouvait l'appeler depuis la console
du navigateur avec son propre `user_id` et le montant de son choix. Ce n'est
pas un achat de Mooves, c'est un auto-crédit direct, et il annulait tout le
raisonnement du deny by default.

**Règle** : toute fonction `security definer` qui écrit doit être révoquée
pour `public`, `anon` et `authenticated`, sauf si elle est le point d'entrée
voulu **et** qu'elle vérifie elle-même l'identité de l'appelant. Les
fonctions appelantes, elles-mêmes `security definer`, continuent de
l'appeler sans problème.

```sql
revoke execute on function ma_fonction(types...) from public, anon, authenticated;
```

Vérification :

```sql
select p.proname, has_function_privilege('authenticated', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

Exception assumée : `accept_trip_request` reste appelable par
`authenticated`, c'est le conducteur qui clique, et elle vérifie
l'appartenance au foyer conducteur en première instruction.

### Une RLS filtre les LIGNES, jamais les COLONNES

`users_hub_select` autorisait la lecture de la ligne entière de `users` à
tout co-membre de hub : téléphone et code postal accessibles par un simple
`select *`. Acceptable dans un foyer, jamais dans un hub.

**Règle** : dès qu'une table contient des colonnes sensibles et doit être
lue par un cercle plus large que son propriétaire, passer par une fonction
`security definer` qui choisit ses colonnes. Jamais une policy `select`.

Fonctions existantes de ce type : `hub_member_profiles(hub_id)`,
`hub_user_first_name(user_id)`, `hub_trip_children_count(trip_id)`.

### `security_invoker` sur une vue propage la RLS de l'appelant

`hub_trips_view` comptait les enfants avec un sous-select sur
`trip_children`, exécuté avec les droits de l'appelant, qui ne voit que son
propre foyer. Tous les membres du hub voyaient « 0 enfant à bord ».

**Règle** : dans une vue `security_invoker`, tout sous-select subit la RLS
de l'appelant. Un agrégat qui doit traverser les cercles passe par une
fonction `security definer`. Un COMPTE n'expose aucune identité, contrairement
à un élargissement de policy.

### Une policy d'auto-insertion doit verrouiller les colonnes de privilège

`hub_members_self_insert` permettait de s'insérer avec `is_admin = true` et
`validated_at` rempli : n'importe qui avec un code d'adhésion devenait admin
validé du hub.

**Règle** : toute policy `insert` où l'utilisateur s'inscrit lui-même doit
contraindre explicitement les colonnes de privilège et de validation dans
son `with check`. Le bootstrap du créateur est la seule exception, et elle
se vérifie contre `owner_id`.

### Une contrainte se resserre par élargissement, jamais par suppression

`trip_children_household_match` bloquait l'acceptation d'une demande de hub,
un enfant accepté venant par construction d'un autre foyer. La supprimer
aurait rouvert la faille qu'elle ferme : rattacher n'importe quel enfant à
n'importe quel trajet avec un simple UUID.

**Règle** : quand une contrainte bloque un cas légitime, ajouter une
alternative vérifiée (`or fonction_qui_valide_le_nouveau_cas(...)`), jamais
un `drop`. Voir `trip_child_hub_request_accepted`.

### RLS activée sans policy = table muette

Cinq tables avaient la RLS activée dans le schéma initial sans aucune
policy : `activities`, `trip_children`, `hub_pact_acceptances`, et les
opérations `update`/`delete` sur `hub_members`. Comportement deny by default
correct, mais fonctionnalité invisible jusqu'au premier test.

**Règle** : toute nouvelle table arrive avec ses policies dans la même
migration. Avant de livrer un écran, vérifier que chaque table touchée a bien
une policy pour chaque opération utilisée.

### Récursion de policy

Utiliser les helpers `security definer` : `auth_household_ids()`,
`auth_hub_ids()`, `auth_admin_household_ids()`, `auth_household_member_ids()`,
`auth_hub_admin_ids()`, `auth_hub_member_user_ids()`. Ne jamais écrire une
policy qui interroge directement la table qu'elle protège.

---

## Écriture d'opérations composées

Toute opération qui touche plusieurs tables passe par un RPC en une seule
transaction. Deux règles apprises sur `accept_trip_request` :

**Idempotence.** Un insert sec échoue sur `duplicate key` dès qu'une
opération est rejouée (demande refusée puis redemandée, double clic,
enfant déjà rattaché). Utiliser `on conflict do nothing`.

**Effets conditionnés à l'insertion réelle.** Après un
`on conflict do nothing`, capturer `get diagnostics v = row_count`
**immédiatement**, sans aucune instruction intermédiaire — `ROW_COUNT`
reflète la dernière commande exécutée. Ne déclencher les effets de bord
(décrément de places, mouvements Mooves) que si `v > 0`. Sans cela, un
double clic crédite deux fois et fausse l'indicateur d'équilibre de tout le
hub.

**Pas d'état optimiste sur échec.** Après un échec de RPC, l'interface doit
recharger depuis la base : le rollback a tout annulé, afficher « Acceptée »
en vert à côté d'un message d'erreur ment sur l'état réel.

---

## Mooves : gain, dépense, influence

La Note d'arbitrage §5 est la source de vérité. Distinction structurante :
le risque juridique porte sur ce que le conducteur **reçoit**, pas sur la
façon dont le compteur s'incrémente.

**Côté gain — autorisé.** Barème indexé sur la distance (Doc1 §3.4, maintenu
par arbitrage porteur) : 30 unités jusqu'à 3 km, 40 jusqu'à 6, 50 jusqu'à 10,
60 jusqu'à 15, 70 au-delà. Stocké dans `app_settings.mooves_distance_scale`,
jamais en dur.

**Côté dépense — strictement interdit.** Les Mooves ne doivent jamais être :
achetables, convertibles, transférables entre utilisateurs, exigibles comme
une créance, assortis d'une valeur fixe, cumulables contre des cadeaux, ni
donner un droit automatique à un trajet. La règle type
"40 Mooves = un trajet de 5 km" est l'exemple explicitement proscrit.

**Côté influence — autorisé mais borné.** Le niveau de contribution peut
départager deux demandes de compatibilité comparable, proposer certaines
demandes en priorité, déclencher un accompagnement Concierge privé, ou
identifier une situation relevant du fonds de solidarité. C'est un signal
**secondaire** de tri, jamais un filtre d'accès.

Il ne doit jamais bloquer une urgence, sanctionner publiquement, exclure
automatiquement une famille vulnérable, obliger un parent à conduire, ni
se transformer en droit à un trajet précis.

**Architecture d'écriture.** `mooves_ledger`, `mooves_balance` et
`solidarity_fund_grants` n'ont **aucune policy d'écriture côté client**. Le
deny by default rend l'achat et le transfert structurellement impossibles,
pas seulement absents de l'interface. Seule `mooves_apply_movement`, révoquée
pour les rôles clients, écrit — appelée par `accept_trip_request` et par le
trigger de solidarité. Ne jamais ajouter de policy insert/update sur ces
tables.

**Solde négatif** : autorisé, non bloquant. Ne jamais ajouter de contrainte
`check (balance >= 0)`, ni de vérification de solde avant une demande.

---

## Confiance progressive

Décision du porteur : les quatre niveaux du Doc1 §12.5 sont implémentés et
**visibles** par les autres familles.

Deux conditions non négociables :

- Le niveau ne doit **jamais** être dérivé du solde de Mooves. C'est un
  signal de vérification et de sécurité, pas un score de contribution.
- Aucun chiffre n'est exposé. Ni solde, ni nombre de trajets, ni classement.
  Un libellé qualitatif seulement.

C'est ce qui rend cette visibilité compatible avec l'interdit numéro 5 :
un badge de vérification n'est pas une notation de contribution.

---

## Ce qu'il ne faut PAS coder

**Champ allergies / santé enfant.** Décision du porteur : pas maintenant.
Ne pas ajouter la colonne, ne pas prévoir le formulaire. Donnée article 9
RGPD, à rouvrir plus tard avec consentement séparé et accès restreint.

**Solde Mooves initial et seuil de déséquilibre durable.** Paramètres à
`null` dans `app_settings`. Ne pas inventer de valeur.

---

## Module défraiement bénévole

Développable, **jamais activable en production**. Les quatre vecteurs
(club ASBL, PO école libre, commune, association de parents) doivent être
validés juridiquement vecteur par vecteur avant toute communication.
`volunteer_recognitions.is_active` reste à `false`.

Système strictement **parallèle** aux Mooves, jamais fusionné. Un trajet
peut produire un mouvement Mooves et un enregistrement de défraiement, ce
sont deux logiques indépendantes.

L'argent vient de l'organisation, jamais de la famille demandeuse. Mooveee
**documente** (note de défraiement, lettre de mission, registre des
trajets), l'organisation **paie** sur son propre budget. Aucun flux de
paiement dans le code.

Barème kilométrique : paramètre par institution, jamais codé en dur.
Plafonds légaux 2026 : 0,4761 €/km, 44,02 €/jour, 1 760,83 €/an par
volontaire. Stockés dans `app_settings`, indexés annuellement. Alerte à
destination de l'institution quand un volontaire approche le plafond.

---

## Vocabulaire imposé dans l'interface

Contrainte juridique et perceptuelle, pas cosmétique. S'applique à tous les
libellés UI et messages visibles.

**Interdit** : portefeuille, crédit, débit, prix, coût, achat, dette, solde,
gagner, dépenser.

**À utiliser** : niveau de contribution, équilibre d'entraide, aide
apportée, aide reçue, dynamique de participation.

Vocabulaire retenu et à conserver : « En démarrage » pour un hub solo,
« Places offertes aux autres familles » pour `seats_available`.

Ne s'applique pas aux noms de tables et colonnes, où `mooves_balance` et
`mooves_ledger` restent appropriés.

---

## Sémantique métier tranchée

**`seats_available`** = places offertes aux autres familles. Le parent
déclare ce qu'il offre. L'application ne connaît pas la capacité de sa
voiture et ne fait aucune soustraction. Les enfants du conducteur sont
comptés séparément dans `children_count`.

**Génération de trajets.** Idempotente par index unique
`(activity_id, direction, scheduled_at)` + `ON CONFLICT DO NOTHING`. Une
régénération n'ajoute que le manquant : conducteurs attribués et occurrences
annulées ne sont jamais écrasés. Le rattachement de l'enfant de l'activité
dans `trip_children` est refait à chaque génération, ce qui sert aussi de
rattrapage.

**Fuseau horaire.** Les heures sont en UTC en base, saisies en heure locale
belge. Le calcul des occurrences récurrentes se fait en `Europe/Brussels`,
jamais par addition de 7 jours sur un timestamp UTC. Testé aux deux
changements d'heure : un tennis à 16h reste à 16h toute l'année.

---

## RGPD et sécurité

- RLS activée sur toutes les tables, deny by default.
- L'entrée dans un foyer est un acte volontaire. Un admin gère les membres
  existants mais n'en ajoute jamais d'autorité.
- Prénom enfant stocké une seule fois, référencé partout par clé étrangère.
- Photos enfants : bucket `child-photos` **privé**, jamais public. Chemin
  `{household_id}/{child_id}.{ext}`, policies Storage sur le premier segment.
  Affichage par URL signée d'une heure maximum, générée uniquement si
  `photo_consent = true`. La suppression du fichier est **explicite** côté
  application au retrait du consentement, au remplacement et à la suppression
  de l'enfant : le cascade SQL ne supprime pas les objets Storage.
- Rapport agrégé jamais généré sous
  `app_settings.reidentification_min_families`.
- Institutions : accès aux vues agrégées uniquement, jamais au nominatif.
- Suppression en cascade : à tester en conditions réelles avant le premier
  utilisateur du pilote. Test automatisé, pas une supposition.
- Signalement impliquant un mineur : escalade humaine obligatoire, jamais de
  résolution automatisée.

---

## Mode Concierge

Automatisable : rappels, suggestions d'invitation, détection de hub inactif,
détection de déséquilibre durable, génération de rapports, relances
institutionnelles.

Humain obligatoire, jamais automatisé de bout en bout : conflit entre
familles, signalement d'abus, incident de sécurité, exclusion d'un membre,
situation personnelle sensible, tout incident impliquant un enfant.

Ne pas coder de pourcentage fixe d'automatisation.

---

## Git et migrations

- `user.email debruijneb@gmail.com`, `user.name benspy2209`.
- Jamais `git add -A` ni `git add .`. Fichiers ajoutés explicitement.
- Jamais de force push sur main.
- Jamais de secret, `.env` ou clé API commitée.
- Migrations versionnées dans `supabase/migrations/`. Rédigées par l'agent,
  **appliquées par Ben uniquement**. Ne jamais lancer `supabase db push`.
- **Numérotation** : exécuter `ls supabase/migrations/` avant de nommer un
  nouveau fichier. Trois collisions de numéro ont eu lieu en deux jours, et
  deux fichiers portant le même numéro cassent `supabase migration list`.
  Le nom doit reprendre l'étape réelle, pas une supposition.
- Toute migration doit être idempotente (`drop policy if exists`,
  `create table if not exists`, `create or replace function`).
- Un `create or replace function` ne réinitialise pas les `revoke` posés
  précédemment, mais le vérifier après application sur les fonctions
  sensibles.
- Génération de fichier : toujours `commande > /tmp/x && mv /tmp/x cible`.
  Une redirection simple détruit la cible avant de savoir si la commande
  réussit.
- Régénérer les types après chaque migration appliquée.

---

## Séquence de développement

1. ~~Modèle de données + RLS de premier niveau~~
2. ~~Cercle intime : auth magic link, profil, foyer, membres, invitations~~
3. ~~Enfants (photos Storage privé) et activités (rrule)~~
4. ~~Trajets, génération jusqu'à 1 an, vue Semaine, attribution, annulation~~
5. ~~Hubs : création, code, adhésion, pacte, publication, demandes de place~~
6. ~~Mooves : ledger, solde, écran équilibre privé, fonds de solidarité~~
7. ~~Matching Macarons 3D~~ **ABANDONNÉ** (décision Ben, 15/08/2026) :
   remplacé par la détection d'opportunités du doc v4 §12. La migration
   0013 (`trip_labels_similar`, `hub_trip_matching_needs_count`) reste en
   base et sert de brique à `detect_opportunities()`.
8. ~~Sécurité enfant : bulletin de trajet, meeting points, fenêtre de confiance~~
9. ~~Mode Concierge, automatisations de base~~
7bis. **Chantier v4** (en cours) : lieux intelligents (places, Photon/OSM,
   favoris), trajets enrichis (linked_trip_id, has_children),
   hub_relations gelé `prepared`, opportunity_matches en observation pure,
   notification_preferences non calibrées. Migrations 0019-0020.
   **Arbitrage : `places` = lieux publics uniquement, jamais un domicile.**
10. ~~Métriques institutionnelles, sans facturation automatique~~
    (migration 0023, 16/08 : calculs mensuels + cron, seuil de
    réidentification appliqué, testé)
11. ~~Module défraiement : schéma seulement~~ (clos le 16/08 : le schéma
    0001 est déjà conforme v4 §9 — 4 vecteurs, barème par reconnaissance
    jamais en dur, is_active false par défaut, plafonds dans
    app_settings, policies lecture seule, AUCUNE logique métier codée —
    et il n'y en aura pas avant validation juridique)
12. ~~Audit RLS et droits d'exécution complets, seuil de réidentification,
    test d'effacement~~ (migrations 0021-0022, 15-16/08 : voir section
    Dette ; restent AIPD externe et seuil désormais actif via 0023)

Rien ne va en pilote avec de vraies familles avant l'étape 12 et la
validation de la DPIA.

---

## Dette identifiée

Audit étape 12 passé le 15/08/2026 (migration 0021). Résolus :
- ~~`private_note` lisible côté hub~~ → colonne supprimée de `trips`,
  table dédiée `trip_private_notes` (RLS foyer). 0 donnée migrée (aucune
  note n'existait).
- ~~Demandes acceptées en double~~ → doublons purgés + index unique
  partiel `trip_requests_accepted_unique` (status = 'accepte').
- ~~Audit systématique~~ → fait : 5 tables muettes = les 4
  institutionnelles (étape 10) + `opportunity_matches` (voulu) ;
  `anon` ne peut plus exécuter AUCUNE fonction (leçon : anon hérite du
  grant implicite à PUBLIC — révoquer PUBLIC puis granter explicitement
  `authenticated`, y compris pour les futures fonctions via
  `alter default privileges`).
- **Effacement RGPD** : `erase_user(uuid)` (0021), révoquée pour tous les
  rôles clients, exécutée par l'opérateur via SQL. Testée en conditions
  réelles le 15/08 : utilisateur complet (foyer, enfant, activité, hub
  possédé, trajets, ledger, consentements, note privée) effacé à zéro ;
  trajet d'un autre foyer où il conduisait proprement détaché
  (driver null + non_couvert) ; l'autre foyer intact. Les objets Storage
  (photos) se purgent côté application AVANT l'appel.

Encore ouverts :
- **Aucune distance sur les trajets.** Le barème Mooves par tranche (0015)
  s'applique ; `distance_km` reste `null`. Les coordonnées `places` (0019)
  permettraient désormais un calcul — arbitrage porteur toujours requis.
- **Invitations de foyer** : créent une ligne mais n'envoient aucun email et
  n'ont pas de parcours d'acceptation.
- **Garde alternée** : un enfant ne peut appartenir qu'à un seul foyer. Le
  Doc1 évoque le cas, le schéma ne le permet pas.
- **Seuil de réidentification** : le paramètre existe, il ne contraint
  encore rien (aucun rapport agrégé généré — étape 10).
- **AIPD** : validation professionnelle en attente, y compris le nouveau
  traitement de détection d'opportunités (v4 §11.3).
