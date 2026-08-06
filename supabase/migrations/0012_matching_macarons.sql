-- =====================================================================
-- 0012 — Matching « Macarons » sans distance (Doc1 §7, partiel)
--
-- Les lieux sont des libellés texte, aucune coordonnée en base : la
-- dimension distance du Doc1 §7 est inapplicable. On matche sur les
-- dimensions heure, delta de temps et correspondance de libellé, dans
-- le même hub.
--
-- Le matching PROPOSE, il n'assigne jamais (interdit n°4) : rien ici
-- ne crée de demande ni ne réserve de place. La pertinence côté
-- demandeur se calcule côté client sur des données qu'il voit déjà
-- (ses propres trajets + hub_trips_view). Seul le COMPTE côté
-- conducteur nécessite une fonction : il traverse les foyers.
-- =====================================================================

-- Similarité de libellés : identiques (casse/espaces près) ou l'un
-- contenu dans l'autre. Volontairement simple et prévisible.
create or replace function trip_labels_similar(a text, b text)
returns boolean
language sql
immutable
as $$
  select case
    when a is null or b is null then false
    when btrim(lower(a)) = '' or btrim(lower(b)) = '' then false
    else btrim(lower(a)) = btrim(lower(b))
      or position(btrim(lower(a)) in btrim(lower(b))) > 0
      or position(btrim(lower(b)) in btrim(lower(a))) > 0
  end;
$$;

-- Combien de familles du hub ont un besoin correspondant à ce trajet
-- publié ? Un COMPTE, jamais une liste : aucune identité, aucun
-- libellé, aucun horaire d'autrui ne sort (interdits n°5 et 9).
-- Réservé au foyer conducteur du trajet.
create or replace function hub_trip_matching_needs_count(p_trip uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t       trips%rowtype;
  v_count integer;
begin
  select * into t from trips where id = p_trip;
  if not found then
    return 0;
  end if;

  if not exists (
    select 1 from household_members hm
    where hm.household_id = t.household_id and hm.user_id = auth.uid()
  ) then
    raise exception 'Réservé au foyer conducteur du trajet.';
  end if;

  if not t.published_to_hub or t.hub_id is null then
    return 0;
  end if;

  -- Besoin correspondant : trajet non couvert d'un AUTRE foyer membre
  -- validé du même hub, même direction, à moins de 90 minutes, vers un
  -- lieu au libellé identique ou similaire. Fenêtre alignée sur le
  -- calcul client (MATCH_WINDOW_MINUTES).
  select count(distinct b.household_id) into v_count
  from trips b
  where b.household_id <> t.household_id
    and b.status = 'non_couvert'
    and b.direction = t.direction
    and b.scheduled_at between t.scheduled_at - interval '90 minutes'
                           and t.scheduled_at + interval '90 minutes'
    and trip_labels_similar(
      case when t.direction = 'aller' then b.destination_label else b.origin_label end,
      case when t.direction = 'aller' then t.destination_label else t.origin_label end
    )
    and b.household_id in (
      select hm.household_id from hub_members hm
      where hm.hub_id = t.hub_id and hm.validated_at is not null
    );

  return coalesce(v_count, 0);
end;
$$;

comment on function hub_trip_matching_needs_count is
  'Compte de foyers du hub ayant un besoin correspondant à un trajet '
  'publié. Jamais une liste. Réservé au foyer conducteur. Ne crée '
  'rien, ne réserve rien : le matching propose, il n assigne jamais.';

-- Verrouillage : jamais exécutable anonymement, uniquement par un
-- utilisateur authentifié (et le contrôle foyer se fait dans le corps).
revoke execute on function hub_trip_matching_needs_count(uuid) from public;
revoke execute on function hub_trip_matching_needs_count(uuid) from anon;
grant execute on function hub_trip_matching_needs_count(uuid) to authenticated;
