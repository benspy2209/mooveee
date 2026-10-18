-- =====================================================================
-- 0025 — Solde initial 100 Mooves (décision du porteur, 11/10/2026)
--
-- Stéphane, réponse à la question 4 : « Chaque famille commence avec
-- 100 Mooves ». Remplace la valeur 60 posée en 0016 (arbitrage d'août).
-- Référence : docs/07-DECISIONS-PORTEUR-2026-10.md, P12.
--
-- Portée : la valeur du paramètre seulement. Le mécanisme de crédit
-- (trigger à la création du profil, 0017) ne change pas. Les comptes
-- déjà crédités à 60 gardent leur ligne solde_initial : aucun
-- rattrapage (comptes de test uniquement à ce jour ; à trancher par
-- Ben avant les premières familles si l'on veut l'égalité stricte).
-- Rien de ce qui touche au volet financier (recharges, avantages)
-- n'est concerné : voir partie C du doc 07, sous réserve d'examen.
-- =====================================================================

update app_settings
   set value = '100', updated_at = now()
 where key = 'mooves_initial_balance'
   and value is distinct from '100'::jsonb;

-- Vérification après application :
--   select value from app_settings where key = 'mooves_initial_balance';
--   → 100
