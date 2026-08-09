-- =====================================================================
-- 0017 — Solde initial réellement crédité (mooves_initial_balance)
--
-- Le paramètre vaut 60 depuis 0016 mais personne n'émettait de
-- mouvement solde_initial : la branche « premier mouvement » de
-- mooves_apply_movement (0011) ne se déclenchait qu'au premier trajet
-- accepté, et le paramètre était null quand les premiers mouvements
-- des comptes existants sont passés. Le ledger ne contient que des
-- gain et des usage — vérifié en base.
--
-- Décision : le crédit a lieu à la CRÉATION DU PROFIL (insert dans
-- users, écran /bienvenue), par TRIGGER côté base. Aucun appel depuis
-- le navigateur : les fonctions ci-dessous arrivent révoquées pour
-- public/anon/authenticated dans cette même migration (leçon 0016).
--
-- Idempotence, deux verrous :
--   1. mooves_grant_initial_balance vérifie l'absence d'un mouvement
--      solde_initial existant avant de créditer ;
--   2. un index unique partiel interdit structurellement un second
--      solde_initial pour le même utilisateur (double clic, reprise
--      d'onboarding, course entre trigger et rattrapage).
-- =====================================================================

-- --- verrou structurel : un seul solde_initial par utilisateur -------
-- Sûr à poser : le ledger ne contient aucun solde_initial (vérifié).

create unique index if not exists mooves_ledger_one_solde_initial
  on mooves_ledger (user_id) where movement = 'solde_initial';

-- --- mooves_apply_movement : retrait de la branche « premier
-- mouvement » de 0011 ------------------------------------------------
-- Cette branche insérait ELLE-MÊME un solde_initial au premier
-- mouvement d'un compte : combinée au crédit explicite ci-dessous,
-- elle produirait un double crédit (deux lignes, solde doublé). La
-- responsabilité du solde initial passe entièrement au trigger de
-- création de profil. La fonction devient un pur applicateur :
-- ledger + balance, même transaction, aucune positivité.

create or replace function mooves_apply_movement(
  p_user uuid,
  p_movement moove_movement,
  p_amount integer,
  p_trip uuid default null,
  p_grant uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into mooves_balance (user_id, balance)
  values (p_user, 0)
  on conflict (user_id) do nothing;

  insert into mooves_ledger (user_id, movement, amount, trip_id, grant_id, reason)
  values (p_user, p_movement, p_amount, p_trip, p_grant, p_reason);

  -- Solde négatif autorisé, aucune vérification de positivité.
  update mooves_balance
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user;
end;
$$;

comment on function mooves_apply_movement is
  'Seul chemin d écriture du ledger et de la balance, en une '
  'transaction. Jamais exposée telle quelle au client : appelée par '
  'accept_trip_request, le trigger du fonds de solidarité et '
  'mooves_grant_initial_balance. Aucune contrainte de positivité '
  '(§6.1). Le solde initial est crédité à la création du profil '
  '(0017), plus jamais ici.';

-- Rappel 0011 : create or replace ne réinitialise pas les revoke déjà
-- posés sur mooves_apply_movement — à re-vérifier après application.

-- --- crédit du solde initial -----------------------------------------

create or replace function mooves_grant_initial_balance(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial integer;
begin
  -- Paramètre null (le porteur peut le remettre à null) : rien à
  -- créditer, aucune erreur.
  select (value #>> '{}')::integer into v_initial
  from app_settings where key = 'mooves_initial_balance';
  if v_initial is null then
    return;
  end if;

  -- Un utilisateur ne reçoit son solde initial qu'une seule fois.
  if exists (
    select 1 from mooves_ledger
    where user_id = p_user and movement = 'solde_initial'
  ) then
    return;
  end if;

  begin
    perform mooves_apply_movement(
      p_user, 'solde_initial', v_initial, null, null, 'Dynamique initiale');
  exception
    -- Course résiduelle (deux crédits simultanés) : l'index unique
    -- partiel tranche, le second passage devient un non-événement.
    when unique_violation then null;
  end;
end;
$$;

comment on function mooves_grant_initial_balance is
  'Crédite une seule fois le solde initial (app_settings.'
  'mooves_initial_balance) à un utilisateur. Idempotente : mouvement '
  'solde_initial existant = rien, paramètre null = rien. Appelée par '
  'le trigger de création de profil et le rattrapage 0017, jamais '
  'depuis le client.';

revoke execute on function mooves_grant_initial_balance(uuid)
  from public, anon, authenticated;

-- --- trigger : crédit à la création du profil (/bienvenue) -----------
-- L'insert dans users est l'acte de création de profil (createProfile
-- côté client). Ce trigger ne décide rien d'autre : pas d'acceptation
-- de trajet, pas d'assignation — l'interdit n°4 ne concerne pas un
-- crédit d'accueil.

create or replace function users_grant_initial_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform mooves_grant_initial_balance(new.id);
  return new;
end;
$$;

revoke execute on function users_grant_initial_balance()
  from public, anon, authenticated;

drop trigger if exists users_after_insert_initial_balance on users;
create trigger users_after_insert_initial_balance
  after insert on users
  for each row
  execute function users_grant_initial_balance();

-- --- rattrapage des comptes existants --------------------------------
-- Crédite tous les profils qui n'ont jamais reçu de solde_initial.
-- Modifie les soldes actuels (Benjamin et les deux Stéphane) : attendu
-- et validé par le porteur. Rejouable sans effet la deuxième fois.

do $$
declare
  u record;
begin
  for u in
    select id from users
    where not exists (
      select 1 from mooves_ledger ml
      where ml.user_id = users.id and ml.movement = 'solde_initial'
    )
  loop
    perform mooves_grant_initial_balance(u.id);
  end loop;
end;
$$;
