-- =====================================================================
-- 0016 — Verrou oublie sur mooves_amount_for_band
--
-- La fonction a ete creee en 0015 sans revocation : elle etait donc
-- exposee via PostgREST, contrairement a mooves_amount_for_distance et
-- mooves_apply_movement. Aucune ecriture, donc risque faible, mais la
-- regle du projet ne souffre pas d exception : une fonction interne
-- n est jamais appelable depuis l API.
--
-- Rappel : toute nouvelle fonction security definer doit arriver avec
-- sa revocation dans la meme migration.
-- =====================================================================

revoke execute on function mooves_amount_for_band(distance_band)
  from public, anon, authenticated;

-- --- parametres tranches par le porteur -------------------------------
-- Arbitrage du porteur : solde de depart 60 unites (deux trajets
-- courts, une marge sans dispenser de contribuer vite), et 4 semaines
-- de desequilibre avant intervention du Concierge (rythme scolaire
-- belge, ni nerveux a 2 semaines ni tardif a 8).

update app_settings set value = '60', updated_at = now()
 where key = 'mooves_initial_balance';

update app_settings set value = '4', updated_at = now()
 where key = 'mooves_imbalance_weeks';
