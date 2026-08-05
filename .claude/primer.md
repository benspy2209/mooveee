# Primer Mooveee

Projet actif : Mooveee (client externe, partage de trajets enfants).
Séquence CLAUDE.md : étape 2 (cercle intime) en cours.

## Fait
- Auth magic link + onboarding profil /bienvenue (étape 1).
- 05/08 : écran Mon Foyer complet (commit b4d10ab) :
  - /foyer : création de foyer si aucun, sinon nom + membres
    (prénom/nom/rôle) + invitations en attente + formulaire d'invitation
    (admin uniquement), déconnexion.
  - Migration 0003 (NON APPLIQUÉE, Ben pousse lui-même) :
    fix récursion hm_admin_write via helper auth_admin_household_ids(),
    policy bootstrap premier membre, select créateur sur households,
    lecture profils co-membres, table household_invitations + RLS.
  - Types database.ts mis à jour à la main (régénérer après application).

## Next step exact
1. Ben applique la migration 0003 sur Supabase.
2. Tester le parcours réel : créer foyer → voir membres → inviter.
3. Puis suite étape 2 : agenda, activités, trajets internes
   (PAS d'écran enfant : arbitrage produit en attente).

## Blockers
- Migration 0003 pas appliquée → /foyer échouera à l'exécution tant
  que non poussée (policies manquantes en base).
- .gitignore modifié non commité (préexistant, pas touché).
