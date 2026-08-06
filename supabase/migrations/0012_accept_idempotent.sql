-- =====================================================================
-- 0011 — accept_trip_request : insert trip_children idempotent
--
-- Bug : l'insert sec dans trip_children échouait en duplicate key dès
-- que l'enfant était déjà à bord du trajet (demande refusée puis
-- redemandée, ou enfant déjà rattaché), et faisait échouer toute la
-- transaction d'acceptation.
--
-- Correctif : ON CONFLICT DO NOTHING sur la clé primaire
-- (trip_id, child_id), et le décrément des places comme les mouvements
-- Mooves ne s'exécutent QUE si l'insertion a réellement eu lieu
-- (GET DIAGNOSTICS). Sinon on décrémenterait une place pour un enfant
-- déjà présent et on créditerait des Mooves en double.
-- La demande passe en accepte dans tous les cas : l'enfant est à bord.
-- =====================================================================

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
  end if;
end;
$$;

comment on function accept_trip_request is
  'Acceptation d une demande de place par le foyer conducteur, en une '
  'transaction : statut accepte, enfant dans trip_children (ON CONFLICT '
  'DO NOTHING), décrément des places et mouvements Mooves uniquement si '
  'l enfant vient d être ajouté. Appelée uniquement sur clic humain — '
  'le matching propose, il n assigne jamais (interdit n°4).';
