-- =====================================================================
-- 0027 — Mise à niveau de la dynamique initiale (égalité stricte)
--
-- 0025 a porté app_settings.mooves_initial_balance de 60 à 100 sans
-- rattrapage, en laissant l'arbitrage ouvert (« à trancher avant les
-- premières familles si l'on veut l'égalité stricte »). Tranché :
-- égalité stricte. Sept comptes créés avant le 21/10 portent une
-- ligne solde_initial de 60, deux comptes créés après portent 100 ;
-- à l'arrivée du pilote, deux familles de même ancienneté n'auraient
-- pas eu la même dynamique de départ.
--
-- Principe : on ne réécrit RIEN. La ligne historique de 60 reste au
-- journal ; le complément passe en mouvement `ajustement`, ce qui est
-- exactement son rôle. Une contrainte unique
-- (`mooves_ledger_one_solde_initial`) interdit d'ailleurs une seconde
-- ligne `solde_initial` par utilisateur — garde-fou utile, respecté.
--
-- Idempotence : un utilisateur portant déjà l'ajustement de mise à
-- niveau est ignoré. Rejouable sans effet. Si le paramètre bouge à
-- nouveau plus tard, cette migration ne rattrape pas une deuxième
-- fois : ce serait une nouvelle décision, donc une nouvelle migration.
--
-- Aucune donnée financière : compteur d'équilibre d'entraide, sans
-- valeur ni conversion (interdit n° 1).
-- =====================================================================

do $$
declare
  v_cible  integer;
  v_ligne  record;
  v_faits  integer := 0;
  v_motif  text := 'Mise à niveau de la dynamique initiale';
begin
  select (value #>> '{}')::integer into v_cible
    from app_settings
   where key = 'mooves_initial_balance';

  if v_cible is null then
    raise notice '0027 : mooves_initial_balance absent ou null, rien à faire.';
    return;
  end if;

  for v_ligne in
    select l.user_id, v_cible - l.amount as complement
      from mooves_ledger l
     where l.movement = 'solde_initial'
       and v_cible - l.amount > 0
       and not exists (
             select 1 from mooves_ledger a
              where a.user_id = l.user_id
                and a.movement = 'ajustement'
                and a.reason = v_motif
           )
  loop
    perform mooves_apply_movement(
      v_ligne.user_id,
      'ajustement'::moove_movement,
      v_ligne.complement,
      null,
      null,
      v_motif
    );
    v_faits := v_faits + 1;
  end loop;

  raise notice '0027 : % compte(s) mis à niveau sur % Mooves.', v_faits, v_cible;
end $$;

-- Vérification après application :
--   select user_id, balance from mooves_balance order by balance;
--   select user_id, sum(amount) from mooves_ledger
--    where movement in ('solde_initial', 'ajustement') group by user_id;
--   → la dotation de départ de chaque compte vaut 100
