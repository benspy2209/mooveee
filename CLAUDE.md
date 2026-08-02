# MOOVEEE — Instructions projet

Application communautaire de partage de trajets enfants. Client externe.
Documents de référence : Doc1 De A à Z (produit), Instructions Techniques v2
(implémentation). En cas de divergence, Doc1 fait foi sur le fond,
Instructions v2 sur la façon d'implémenter.

Ce projet traite des données d'enfants mineurs. L'AIPD n'est pas validée.
Plusieurs points juridiques sont ouverts. Les règles ci-dessous ne sont pas
des préférences de style : les violer crée un risque juridique réel pour le
client. Elles contraignent la fonctionnalité, jamais l'inverse.

---

## Stack

| Couche | Techno |
| --- | --- |
| Frontend | TanStack Start (mode SPA) + React + TypeScript |
| Style | Tailwind CSS v4 |
| UI | shadcn/ui + Radix |
| Backend | Supabase (PostgreSQL, région UE) |
| Hébergement | Vercel |
| DNS | Cloudflare |

**Mode SPA obligatoire.** Le produit doit rester encapsulable en Capacitor
pour livrer un binaire App Store avec push natif. Ne jamais introduire de
dépendance à un rendu serveur au runtime sans validation explicite.

Variables d'environnement : dashboard Vercel uniquement. Jamais dans le repo.

---

## Les neuf interdits absolus

Si une fonctionnalité demande d'en contourner un, c'est la fonctionnalité
qu'il faut revoir. Signaler, ne pas contourner.

1. **Aucune donnée financière liée aux Mooves.** Pas de champ prix, montant
   en euros, solde, taux de change. Le compteur Mooves est un indicateur
   d'équilibre interne, jamais un portefeuille.

2. **Aucun paiement entre utilisateurs.** Pas de Stripe, Bancontact, SEPA,
   bon d'achat individuel ou avantage matériel entre parents. Aucun endpoint
   d'achat de Mooves. Les anciens documents mentionnaient Stripe : abandonné.

3. **Aucune facturation indexée sur le trajet individuel.** La facturation
   institutionnelle se fait par palier d'usage. Jamais de ligne
   "X trajets × Y euros".

4. **Le matching propose, il n'assigne jamais.** Aucun trigger, cron ou
   automatisation ne fait passer une demande en accepté sans action humaine
   explicite du conducteur.

5. **Zéro notation publique.** Aucun score, classement ou badge de
   contribution visible par une autre famille. L'indice d'équilibre est
   strictement privé.

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

## Ce qu'il ne faut PAS coder tant que l'arbitrage n'est pas rendu

Ces trois points sont des contradictions non résolues entre le Doc1 et les
Instructions v2. Ne pas les implémenter. Si une tâche les demande, le
signaler comme arbitrage manquant.

- **Champ allergies / santé enfant.** Doc1 §15.1 le prescrit, Instructions §3
  l'interdisent. Donnée article 9 RGPD. Non implémenté.

- **Barème Mooves kilométrique.** Doc1 §3.4 publie une grille de gain
  indexée sur la distance. Instructions §6.2 interdisent toute logique
  "X Mooves = Y km". Un gain proportionnel à la distance est structurellement
  un barème kilométrique, exactement le risque de requalification que le
  dispositif cherche à éviter. Non implémenté.

- **Confiance progressive à 4 niveaux.** Doc1 §12.5 prévoit
  créé / vérifié / recommandé / historique positif. Instructions §3 imposent
  zéro notation publique. Non implémenté.

Également en attente : solde Mooves initial, seuil de déséquilibre durable.
Paramètres à `null` dans `app_settings`, ne pas inventer de valeur.

---

## Module défraiement bénévole

Développable, **jamais activable en production**. Les quatre vecteurs
(club, PO école, commune, association de parents) ne sont pas juridiquement
validés. `volunteer_recognitions.is_active` reste à `false`.

Système strictement parallèle aux Mooves. Un trajet peut générer un
mouvement Mooves et un enregistrement de défraiement, ce sont deux logiques
indépendantes, jamais fusionnées.

Mooveee documente, l'institution paie sur son budget. Aucun flux de
paiement dans le code.

Barème kilométrique : paramètre par institution, jamais codé en dur.
Plafonds légaux : paramètres indexés dans `app_settings`, alerte à
destination de l'institution quand un volontaire s'en approche.

---

## Vocabulaire imposé dans l'interface

Contrainte produit, s'applique à tous les libellés UI et messages visibles.

**Interdit** : portefeuille, crédit, débit, prix, coût, achat, dette, solde.

**À utiliser** : niveau de contribution, équilibre d'entraide, aide apportée,
aide reçue, dynamique de participation.

Ne s'applique pas aux noms de tables et colonnes, où `mooves_balance` et
`mooves_ledger` restent appropriés.

---

## RGPD et sécurité

- RLS activée sur toutes les tables, deny by default. Toute nouvelle table
  arrive avec ses policies dans la même migration.
- Utiliser les helpers `auth_household_ids()` et `auth_hub_ids()` pour
  éviter la récursion de policies. Ne pas écrire de policy qui interroge
  directement `household_members` ou `hub_members` sans passer par eux.
- Prénom enfant stocké une seule fois, référencé partout par clé étrangère.
- Photo enfant servie uniquement si `photo_consent = true`.
- Rapport agrégé jamais généré sous
  `app_settings.reidentification_min_families`.
- Institutions : accès aux vues agrégées uniquement, jamais au nominatif.
- Suppression en cascade : à tester en conditions réelles avant le premier
  utilisateur du pilote. Écrire un test automatisé, pas une supposition.
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

- `git config user.email debruijneb@gmail.com` et
  `user.name benspy2209` sur ce repo.
- Jamais `git add -A` ni `git add .`. Ajouter les fichiers explicitement.
- Jamais de force push sur main.
- Jamais de secret, `.env` ou clé API commitée.
- Migrations Supabase versionnées dans `supabase/migrations/`, jamais
  appliquées à la main via le dashboard.

---

## Séquence de développement

1. Modèle de données + RLS de premier niveau
2. Cercle intime : agenda, activités, trajets internes
3. Statuts de hub et transition solo vers active
4. Lien filtré cercle intime vers hub
5. Système Mooves, sans aucune brique de paiement
6. Sécurité enfant : bulletin de trajet, meeting points, fenêtre de confiance
7. Mode Concierge, automatisations de base
8. Métriques institutionnelles, sans facturation automatique
9. Module défraiement, développé non activé
10. RLS complet, seuil de réidentification, test d'effacement

Rien de tout cela ne va en pilote avec de vraies familles avant l'étape 10.
