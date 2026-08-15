-- 0019 — Lieux intelligents et trajets enrichis (Instructions Techniques v4, §4.1 et §7)
--
-- ARBITRAGE COORDONNÉES (bloc requis : ce chantier touche au principe
-- « jamais d'adresse ni de coordonnées » affiché en tête de 0015).
-- La table places ne contient QUE des lieux publics : écoles, clubs,
-- salles, points de rendez-vous. Le domicile d'un foyer n'y entre
-- JAMAIS : il reste le label « Domicile » côté trajets et la zone
-- floue users.postal_code. Les 4 niveaux d'exposition d'adresse du §7.3
-- sont donc satisfaits par construction (aucune adresse privée en base,
-- niveau 4 couvert par les meeting_points existants de 0014).
-- Le geocoding est fourni par Photon (OSM, serveurs UE, sans clé) ;
-- external_place_id est agnostique du fournisseur (clé "osm_type:osm_id",
-- remplaçable par un place_id Google sans changer le schéma).

-- ---------------------------------------------------------------------------
-- 1. places — référentiel partagé de lieux publics (§7.1)
-- ---------------------------------------------------------------------------

create table if not exists places (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,
  external_place_id text unique,
  lat               numeric(9,6),
  lng               numeric(9,6),
  postal_code       text,
  municipality      text,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table places is
  'Lieux publics normalises (ecoles, clubs, salles). JAMAIS un domicile. '
  'Alimente par autocomplete Photon/OSM, deduplique par external_place_id.';

alter table places enable row level security;

-- Référentiel partagé : lisible par tout utilisateur authentifié.
-- Un lieu public ne porte aucune donnée personnelle.
drop policy if exists places_select on places;
create policy places_select on places
  for select to authenticated using (true);

-- Insertion par tout authentifié (l'autocomplete crée le lieu à la volée),
-- créateur verrouillé. Ni update ni delete côté client : un lieu partagé
-- ne se modifie pas unilatéralement (deny by default).
drop policy if exists places_insert on places;
create policy places_insert on places
  for insert to authenticated
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. household_places — favoris de lieux par foyer (§7.2)
-- ---------------------------------------------------------------------------

create table if not exists household_places (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  place_id     uuid not null references places(id) on delete cascade,
  custom_label text,
  created_at   timestamptz not null default now(),
  unique (household_id, place_id)
);

comment on table household_places is
  'Lieux favoris d''un foyer, reutilisables a la creation d''activite '
  'sans ressaisie (Doc v4 §7.2).';

alter table household_places enable row level security;

drop policy if exists household_places_all on household_places;
create policy household_places_all on household_places
  for all to authenticated
  using (household_id in (select auth_household_ids()))
  with check (household_id in (select auth_household_ids()));

-- ---------------------------------------------------------------------------
-- 3. Colonnes lieux + trajets enrichis (§4.1)
-- ---------------------------------------------------------------------------

alter table activities
  add column if not exists place_id uuid references places(id) on delete set null;

alter table trips
  add column if not exists origin_place_id      uuid references places(id) on delete set null,
  add column if not exists destination_place_id uuid references places(id) on delete set null,
  add column if not exists linked_trip_id       uuid references trips(id) on delete set null,
  add column if not exists has_children         boolean not null default true;

comment on column trips.linked_trip_id is
  'Lien optionnel aller<->retour de la meme occurrence, pour l''affichage '
  'uniquement (§4.1) : aucune dependance fonctionnelle, un parent peut '
  'couvrir l''aller sans le retour.';

comment on column trips.has_children is
  'false = trajet adulte autonome (§4.1) : un parent passe devant le lieu '
  'sans enfant a bord. Concept de modelisation interne pour la detection '
  'd''opportunites — le vocabulaire UI reste centre sur les enfants.';

-- Note statuts : trip_status existant (couvert / couvert_ouvert /
-- partiellement_couvert / conditionnel / non_couvert / annule) est un
-- sur-ensemble du triptyque v4 couvert / ouvert / non_couvert.
-- Mapping : « ouvert » v4 = couvert_ouvert | partiellement_couvert |
-- conditionnel. Aucune nouvelle colonne.

create index if not exists trips_destination_place_idx
  on trips (destination_place_id) where destination_place_id is not null;

-- ---------------------------------------------------------------------------
-- 4. hub_trips_view v4 — expose le lieu public normalisé
-- ---------------------------------------------------------------------------

drop view if exists hub_trips_view;

create view hub_trips_view
with (security_invoker = true)
as
select
  t.id,
  t.hub_id,
  t.direction,
  t.status,
  t.scheduled_at,
  t.origin_label,
  t.destination_label,
  t.destination_place_id,
  t.meeting_point_id,
  t.seats_available,
  t.driver_id,
  hub_user_first_name(t.driver_id) as driver_first_name,
  hub_trip_children_count(t.id) as children_count
from trips t
where t.published_to_hub
  and t.hub_id in (select auth_hub_ids());

comment on view hub_trips_view is
  'Version normalisee : heure, lieu, statut, places. '
  'Jamais private_note, jamais children.first_name, jamais de contact. '
  'destination_place_id reference un lieu PUBLIC (places), jamais un domicile. '
  'children_count est un compte, pas une liste. '
  'driver_first_name et children_count via fonctions security definer, '
  'jamais de join direct sur users ou trip_children.';
