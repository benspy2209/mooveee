# Lessons

[2026-08-02] | Placeholder first_name dérivé de l'email inventé pour satisfaire un NOT NULL | Ne jamais inventer de donnée profil par défaut : si une donnée obligatoire manque, demander à l'utilisateur via un écran d'onboarding dédié.

[2026-08-02] | Commits déplacés sur une branche de feature à tort | Sur ce repo, committer directement sur main en local ; pas de push sans demande explicite de Ben.

[2026-08-05] | Policy users_hub_select écrite pour exposer les noms aux co-membres de hub : une policy RLS filtre les lignes, pas les colonnes — téléphone et code postal devenaient lisibles entre inconnus | Pour exposer un sous-ensemble de colonnes d'une table sensible à un cercle élargi, toujours passer par une fonction security definer (ou une vue) qui ne renvoie que les colonnes voulues, jamais par une policy select sur la table. Côté hub : hub_member_profiles() uniquement, jamais users en direct.
