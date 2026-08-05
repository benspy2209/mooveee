# MOOVEEE — Instructions projet

Application communautaire de partage de trajets enfants. Client externe.

Documents de référence, par ordre d'autorité :
1. **Note d'arbitrage Mooves v2** (juillet 2026) — fait foi sur tout ce qui
   touche aux Mooves, à la réciprocité et au modèle économique.
2. **Instructions Techniques Partenaire v2** (juillet 2026) — fait foi sur
   la façon d'implémenter.
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

**Point ouvert** : le scaffold builde en SSR. Le Doc1 décrit une app mobile
avec notifications push, ce qui suppose un encapsulage Capacitor et donc un
build SPA. Décision non prise. Éviter d'introduire des dépendances au rendu
serveur au runtime tant que ce n'est pas tranché.

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

## Mooves : gain, dépense, influence

La Note d'arbitrage §5 est la source de vérité. Distinction structurante :
le risque juridique porte sur ce que le conducteur **reçoit**, pas sur la
façon dont le compteur s'incrémente.

**Côté gain — autorisé.** Le barème indexé sur la distance du Doc1 §3.4 est
maintenu par décision du porteur. Un gain proportionnel à la distance est
acceptable parce que les Mooves n'ont aucune valeur : le conducteur ne
reçoit rien de patrimonial.

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

**Solde négatif** : autorisé, non bloquant. Ne jamais ajouter de contrainte
`check (balance >= 0)`.

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

Ne s'applique pas aux noms de tables et colonnes, où `mooves_balance` et
`mooves_ledger` restent appropriés.

---

## RGPD et sécurité

- RLS activée sur toutes les tables, deny by default. Toute nouvelle table
  arrive avec ses policies dans la même migration.
- Utiliser les helpers `auth_household_ids()`, `auth_hub_ids()`,
  `auth_admin_household_ids()` et `auth_household_member_ids()` pour éviter
  la récursion de policies. Ne jamais écrire une policy qui interroge
  directement la table qu'elle protège.
- L'entrée dans un foyer est un acte volontaire. Un admin gère les membres
  existants mais n'en ajoute jamais d'autorité.
- Prénom enfant stocké une seule fois, référencé partout par clé étrangère.
- Photo enfant servie uniquement si `photo_consent = true`.
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

## Git

- `user.email debruijneb@gmail.com`, `user.name benspy2209`.
- Jamais `git add -A` ni `git add .`. Fichiers ajoutés explicitement.
- Jamais de force push sur main.
- Jamais de secret, `.env` ou clé API commitée.
- Migrations versionnées dans `supabase/migrations/`. Rédigées par l'agent,
  **appliquées par Ben uniquement**. Ne jamais lancer `supabase db push`.
- Toute migration doit être idempotente (`drop policy if exists`,
  `create table if not exists`).
- Génération de fichier : toujours `commande > /tmp/x && mv /tmp/x cible`.
  Une redirection simple détruit la cible avant de savoir si la commande
  réussit.

---

## Séquence de développement

1. ~~Modèle de données + RLS de premier niveau~~ — fait
2. ~~Cercle intime : auth, profil, foyer, membres~~ — fait
3. **Enfants et activités** — en cours
4. Trajets internes au foyer, vue Semaine
5. Statuts de hub et transition solo vers active
6. Lien filtré cercle intime vers hub
7. Système Mooves, sans aucune brique de paiement
8. Sécurité enfant : bulletin de trajet, meeting points, fenêtre de confiance
9. Mode Concierge, automatisations de base
10. Métriques institutionnelles, sans facturation automatique
11. Module défraiement, développé non activé
12. RLS complet, seuil de réidentification, test d'effacement

Rien ne va en pilote avec de vraies familles avant l'étape 12 et la
validation de la DPIA.
