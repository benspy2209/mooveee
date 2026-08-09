-- =====================================================================
-- 0015 — Tranches de distance (arbitrage porteur)
--
-- Décision : le parent choisit une TRANCHE dans un menu déroulant,
-- jamais une saisie libre, jamais d'adresse ni de coordonnées. Aucune
-- donnée géographique supplémentaire n'est stockée : une tranche à
-- trois valeurs, c'est tout. trips.distance_km reste inutilisé (null).
--
-- Tranches : courte (< 3 km), moyenne (3 à 15 km), longue (> 15 km).
--
-- CHOIX DOCUMENTÉ — barème : mooves_distance_scale (Doc1 §3.4, cinq
-- paliers, maintenu par arbitrage porteur) est CONSERVÉ tel quel.
-- Chaque tranche correspond à un palier :
--   courte  → palier 1 (max_km 3)    : 30
--   moyenne → palier 3 (max_km 10)   : 50 — la tranche couvre les
--             paliers 40/50/60, on retient le palier CENTRAL
--   longue  → palier 5 (max_km null) : 70
-- La correspondance se fait par max_km (3 / 10 / null) : ajuster les
-- montants du barème reste sans effet sur ce code ; en changer les
-- SEUILS demanderait de revoir mooves_amount_for_band.
-- =====================================================================

-- --- type et colonnes -------------------------------------------------

do $$
begin
  create type distance_band as enum ('courte', 'moyenne', 'longue');
exception
  when duplicate_object then null;
end;
$$;

-- Défaut « courte » : les activités existantes basculent sur la
-- tranche courte, soit le comportement actuel (premier palier, 30).
alter table activities
  add column if not exists distance_band distance_band
  not null default 'courte';

-- Sur trips, nullable et sans défaut : la tranche se propage depuis
-- l'activité à la génération. Null = comportement d'avant (premier
-- palier, noté en reason).
alter table trips
  add column if not exists distance_band distance_band;

comment on column activities.distance_band is
  'Tranche déclarée par le parent (menu déroulant, jamais de saisie '
  'libre). Aucune adresse, aucune coordonnée, aucun km précis.';

-- Rattrapage des trajets déjà générés : même logique que le
-- rattachement des enfants. La génération côté client entretient
-- ensuite la propagation à chaque exécution.
update trips t
   set distance_band = a.distance_band
  from activities a
 where t.activity_id = a.id
   and t.distance_band is null;

-- --- gain Mooves par tranche -----------------------------------------

create or replace function mooves_amount_for_band(p_band distance_band)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount integer;
begin
  -- Correspondance tranche → palier par max_km (voir en-tête).
  select (tier->>'amount')::integer into v_amount
  from app_settings s,
       jsonb_array_elements(s.value) as tier
  where s.key = 'mooves_distance_scale'
    and case p_band
          when 'courte'  then (tier->>'max_km')::numeric = 3
          when 'moyenne' then (tier->>'max_km')::numeric = 10
          when 'longue'  then (tier->>'max_km') is null
        end
  limit 1;

  if v_amount is null then
    raise exception
      'Palier introuvable dans mooves_distance_scale pour la tranche %.',
      p_band;
  end if;
  return v_amount;
end;
$$;

comment on function mooves_amount_for_band is
  'Gain Mooves d une tranche de distance : courte → palier max_km 3, '
  'moyenne → palier max_km 10 (central), longue → dernier palier. '
  'Le barème cinq paliers du Doc1 §3.4 reste la source unique.';

-- --- acceptation : la tranche prime -----------------------------------
-- Reprise intégrale de 0012 (idempotence trip_children, effets
-- conditionnés à l'insertion réelle). Seul le calcul du gain change :
-- tranche du trajet d'abord, sinon distance_km (toujours null
-- aujourd'hui), sinon premier palier noté en reason.
-- Rappel post-application : create or replace ne touche pas aux
-- grants — vérifier que accept_trip_request reste bien l'exception
-- assumée exécutable par authenticated, et rien de plus.

create or replace function accept_trip_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req        trip_requests%rowtype;
  trip       trips%rowtype;
  v_amount   integer;
  v_note     text;
  v_inserted integer;
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

  -- Idempotent : si l'enfant est déjà à bord, aucune ligne insérée.
  insert into trip_children (trip_id, child_id)
  values (req.trip_id, req.child_id)
  on conflict (trip_id, child_id) do nothing;
  get diagnostics v_inserted = row_count;

  -- Place et Mouvements Mooves UNIQUEMENT si l'enfant vient réellement
  -- d'être ajouté : jamais de décrément ni de gain en double.
  if v_inserted > 0 then
    update trips
       set seats_available = seats_available - 1,
           status = case
             when seats_available - 1 <= 0 then 'couvert'::trip_status
             else status
           end,
           updated_at = now()
     where id = req.trip_id;

    -- Gain indexé sur la tranche déclarée (0015). Sans tranche ni
    -- distance : premier palier, noté.
    if trip.distance_band is not null then
      v_amount := mooves_amount_for_band(trip.distance_band);
      v_note := null;
    else
      v_amount := mooves_amount_for_distance(trip.distance_km);
      v_note := case
        when trip.distance_km is null
          then 'Premier palier appliqué : distance du trajet non renseignée'
        else null
      end;
    end if;

    if trip.driver_id is not null then
      perform mooves_apply_movement(
        trip.driver_id, 'gain', v_amount, trip.id, null, v_note);
    end if;
    perform mooves_apply_movement(
      req.requester_id, 'usage', -v_amount, trip.id, null, v_note);
  end if;
end;
$$;

comment on function accept_trip_request is
  'Acceptation d une demande de place par le foyer conducteur, en une '
  'transaction : statut accepte, enfant dans trip_children (ON CONFLICT '
  'DO NOTHING), décrément des places et mouvements Mooves uniquement si '
  'l enfant vient d être ajouté — gain indexé sur la tranche de '
  'distance (0015). Appelée uniquement sur clic humain — le matching '
  'propose, il n assigne jamais (interdit n°4).';
