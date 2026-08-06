-- =====================================================================
-- 0010 — Système Mooves (étape 7). Note d'arbitrage §5 : le gain est
-- autorisé, la dépense est interdite, l'influence est bornée.
--
-- Écritures ledger/balance UNIQUEMENT via les fonctions SECURITY
-- DEFINER ci-dessous. Aucune policy insert/update/delete côté client :
-- deny by default = aucun endpoint d'achat, aucun transfert entre
-- utilisateurs, structurellement impossibles (interdits n°1 et 2).
-- Les policies select self de 0001 (mooves_balance_self,
-- mooves_ledger_self, solidarity_self) suffisent : strictement privé.
--
-- Solde négatif AUTORISÉ et NON BLOQUANT : aucune contrainte de
-- positivité, aucune vérification de solde nulle part.
-- =====================================================================

-- --- 1. Barème de gain indexé distance (Doc1 §3.4) -------------------
-- Dans app_settings, JAMAIS en dur dans le code. max_km null = au-delà
-- du dernier seuil. on conflict do nothing : ne jamais écraser une
-- valeur ajustée par le porteur.

insert into app_settings (key, value, description) values
  ('mooves_distance_scale',
   '[{"max_km": 3,  "amount": 30},
     {"max_km": 6,  "amount": 40},
     {"max_km": 10, "amount": 50},
     {"max_km": 15, "amount": 60},
     {"max_km": null, "amount": 70}]',
   'Barème de gain Mooves indexé sur la distance (Doc1 §3.4, maintenu par arbitrage porteur). max_km null = dernier palier.')
on conflict (key) do nothing;

create or replace function mooves_amount_for_distance(p_km numeric)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount integer;
begin
  -- Premier palier dont le plafond couvre la distance ; distance null
  -- (non renseignée) = premier palier, noté par l'appelant.
  select (tier->>'amount')::integer into v_amount
  from app_settings s,
       jsonb_array_elements(s.value) with ordinality as t(tier, ord)
  where s.key = 'mooves_distance_scale'
    and (
      (p_km is null and ord = 1)
      or (p_km is not null
          and ((tier->>'max_km') is null or p_km <= (tier->>'max_km')::numeric))
    )
  order by ord
  limit 1;

  if v_amount is null then
    raise exception 'Barème mooves_distance_scale absent de app_settings.';
  end if;
  return v_amount;
end;
$$;

-- --- 2. Application d'un mouvement : ledger + balance ensemble -------

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
declare
  v_initial integer;
begin
  -- Premier mouvement de cet utilisateur : app_settings peut définir
  -- une dynamique initiale (mooves_initial_balance). Le paramètre est
  -- à null tant que le porteur n'a pas arbitré : dans ce cas, rien.
  if not exists (select 1 from mooves_balance where user_id = p_user) then
    select (value #>> '{}')::integer into v_initial
    from app_settings where key = 'mooves_initial_balance';

    if v_initial is not null then
      insert into mooves_ledger (user_id, movement, amount, reason)
      values (p_user, 'solde_initial', v_initial, 'Dynamique initiale');
    end if;

    insert into mooves_balance (user_id, balance)
    values (p_user, coalesce(v_initial, 0));
  end if;

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
  'accept_trip_request et le trigger du fonds de solidarité. Aucune '
  'contrainte de positivité (§6.1).';

-- --- 3. Mouvements à l'acceptation (dans le RPC, pas un trigger) -----

create or replace function accept_trip_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req      trip_requests%rowtype;
  trip     trips%rowtype;
  v_amount integer;
  v_note   text;
begin
  select * into req from trip_requests where id = p_request for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if req.status <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  select * into trip from trips where id = req.trip_id for update;

  -- Seul le foyer conducteur accepte. L'appel vient d'un clic explicite
  -- du conducteur : cette fonction n'est jamais appelée par un trigger.
  if not exists (
    select 1 from household_members hm
    where hm.household_id = trip.household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'Seul le foyer conducteur peut accepter cette demande.';
  end if;

  if not trip.published_to_hub or coalesce(trip.seats_available, 0) < 1 then
    raise exception 'Plus de place disponible sur ce trajet.';
  end if;

  update trip_requests
     set status = 'accepte', responded_at = now()
   where id = p_request;

  insert into trip_children (trip_id, child_id)
  values (req.trip_id, req.child_id);

  update trips
     set seats_available = seats_available - 1,
         status = case
           when seats_available - 1 <= 0 then 'couvert'::trip_status
           else status
         end,
         updated_at = now()
   where id = req.trip_id;

  -- Mouvements Mooves, dans la MÊME transaction que l'acceptation :
  -- gain pour le conducteur, usage pour la famille demandeuse, tous
  -- deux rattachés au trajet. Barème lu dans app_settings.
  v_amount := mooves_amount_for_distance(trip.distance_km);
  v_note := case
    when trip.distance_km is null
      then 'Premier palier appliqué : distance du trajet non renseignée'
    else null
  end;

  if trip.driver_id is not null then
    perform mooves_apply_movement(
      trip.driver_id, 'gain', v_amount, trip.id, null, v_note);
  end if;
  perform mooves_apply_movement(
    req.requester_id, 'usage', -v_amount, trip.id, null, v_note);
end;
$$;

comment on function accept_trip_request is
  'Acceptation d une demande de place par le foyer conducteur, en une '
  'transaction : statut accepte, enfant dans trip_children, décrément '
  'des places, couvert si plein, mouvements Mooves (gain conducteur, '
  'usage demandeur). Appelée uniquement sur clic humain — le matching '
  'propose, il n assigne jamais (interdit n°4).';

-- --- 4. Fonds de solidarité : mécanique base uniquement --------------
-- Une entrée dans solidarity_fund_grants (institution ou sponsor,
-- jamais un parent — check de 0001) crée le mouvement correspondant.
-- Pas d'interface pour l'instant.

create or replace function solidarity_grant_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform mooves_apply_movement(
    new.beneficiary_id, 'fonds_solidarite', new.amount, null, new.id,
    new.reason);
  return new;
end;
$$;

drop trigger if exists trg_solidarity_grant_apply on solidarity_fund_grants;
create trigger trg_solidarity_grant_apply
after insert on solidarity_fund_grants
for each row execute function solidarity_grant_apply();

-- --- 5. VERROU : fonctions internes non appelables par un client -----
-- Toute fonction du schema public est exposee via PostgREST. Une
-- fonction SECURITY DEFINER qui ecrit dans le ledger et que n importe
-- quel utilisateur authentifie peut appeler avec son propre user_id et
-- le montant de son choix annule tout le raisonnement du deny by
-- default : ce n est pas un achat, c est un auto-credit direct.
--
-- Ces fonctions restent appelables par accept_trip_request et par le
-- trigger de solidarite, eux-memes SECURITY DEFINER : la revocation
-- ne concerne que l appel depuis l API.

revoke execute on function mooves_apply_movement(
  uuid, moove_movement, integer, uuid, uuid, text)
  from public, anon, authenticated;

revoke execute on function mooves_amount_for_distance(numeric)
  from public, anon, authenticated;

revoke execute on function solidarity_grant_apply()
  from public, anon, authenticated;

-- Les helpers RLS n ont pas non plus a etre appelables directement.
revoke execute on function hub_trip_children_count(uuid)
  from public, anon;
