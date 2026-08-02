-- =====================================================================
-- MOOVEEE — Migration 0001 — Schéma initial
-- Conforme à : Instructions Techniques Partenaire v2 (juillet 2026)
--              Document 1 De A à Z v4 (mai 2026)
--
-- Règles structurantes appliquées ici :
--   * Aucune colonne monétaire sur les tables Mooves (principe §3)
--   * Aucune géolocalisation enfant, sous aucune forme (principe §3)
--   * Champ allergies/santé NON implémenté (arbitrage en attente, §12)
--   * Tous les seuils sont des paramètres, jamais des valeurs codées
--   * RLS activée sur toutes les tables, deny by default
--
-- NE PAS APPLIQUER SANS RELECTURE. Voir les blocs ARBITRAGE en fin de
-- fichier pour les points qui restent ouverts.
-- =====================================================================

begin;

create extension if not exists "pgcrypto";

-- =====================================================================
-- 0. PARAMÈTRES CONFIGURABLES
-- Le document interdit explicitement de coder en dur les seuils.
-- Tout ce qui est ajustable vit ici.
-- =====================================================================

create table app_settings (
  key           text primary key,
  value         jsonb not null,
  description   text,
  updated_at    timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('hub_activation_member_count', '5',
   'Nombre de membres déclenchant la transition solo -> active (Doc1 §5.2)'),
  ('mooves_initial_balance', 'null',
   'ARBITRAGE OUVERT : solde offert à l inscription, à définir avec le porteur (§12)'),
  ('mooves_imbalance_weeks', 'null',
   'ARBITRAGE OUVERT : nb de semaines en solde négatif déclenchant le Concierge (§12)'),
  ('reidentification_min_families', '12',
   'Seuil minimal de familles avant génération d un rapport agrégé (AIPD §5.4, proposition 10-15)'),
  ('volunteer_daily_cap_eur', '44.02',
   'Plafond légal journalier volontariat 2026, indexé, à revérifier annuellement'),
  ('volunteer_annual_cap_eur', '1760.83',
   'Plafond légal annuel volontariat 2026, indexé, à revérifier annuellement'),
  ('erasure_delay_days', '30',
   'Délai maximal du droit à l effacement (§9.2)');

-- =====================================================================
-- 1. IDENTITÉ ET FOYER (cercle intime)
-- =====================================================================

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  first_name    text not null,
  last_name     text,
  phone         text,
  avatar_url    text,
  postal_code   text,          -- zone volontairement floue (Doc1 §12.4)
  locale        text not null default 'fr-BE',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column users.postal_code is
  'Granularité maximale autorisée pour la zone domicile. Jamais d adresse exacte exposée.';

create table households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type household_role as enum (
  'parent', 'beau_parent', 'grand_parent', 'autre_referent'
);

create table household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          household_role not null,
  is_admin      boolean not null default false,
  joined_at     timestamptz not null default now(),
  unique (household_id, user_id)
);

create index on household_members (user_id);
create index on household_members (household_id);

create table children (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  first_name    text not null,
  birth_year    integer,
  photo_url     text,
  photo_consent boolean not null default false,
  booster_seat  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table children is
  'Prénom stocké une seule fois, référencé partout ailleurs par FK (§9.2). '
  'AUCUNE colonne allergies/santé : arbitrage en attente, donnée art. 9 RGPD (§3, §12). '
  'AUCUNE géolocalisation, sous aucune forme (§3).';

comment on column children.birth_year is
  'Année seulement, pas de date complète. Minimisation.';

comment on column children.photo_consent is
  'Consentement explicite et séparé du consentement général (§9.2). '
  'photo_url ne doit jamais être servie si false.';

-- =====================================================================
-- 2. HUBS (cercle communautaire)
-- =====================================================================

create type hub_status as enum ('solo', 'active', 'structured');
create type hub_kind   as enum ('ecole', 'club', 'quartier', 'conservatoire', 'autre');

create table institutions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null,   -- ecole / club / commune / entreprise / association_parents
  tier          text,            -- essentiel / pro / reseau (null tant que non client)
  contact_email text,
  vat_number    text,
  created_at    timestamptz not null default now()
);

create table hubs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            hub_kind not null,
  status          hub_status not null default 'solo',
  join_code       text not null unique,
  place_label     text not null,
  place_lat       numeric(9,6),
  place_lng       numeric(9,6),
  municipality    text not null,
  owner_id        uuid not null references users(id),
  institution_id  uuid references institutions(id),
  activated_at    timestamptz,
  certified_at    timestamptz,
  created_at      timestamptz not null default now()
);

comment on column hubs.place_lat is
  'Coordonnées du LIEU du hub (école, club), jamais du domicile d une famille.';

comment on column hubs.status is
  'solo -> active à app_settings.hub_activation_member_count membres. '
  'Transition automatique, mais doit produire un événement UI visible (§5).';

create table hub_members (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references hubs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  is_admin      boolean not null default false,
  validated_at  timestamptz,
  joined_at     timestamptz not null default now(),
  unique (hub_id, user_id)
);

create index on hub_members (user_id);
create index on hub_members (hub_id);

-- Pacte de Hub (Doc1 §13.1) — absent du modèle des Instructions, ajouté ici
create table hub_pact_acceptances (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references hubs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  pact_version  text not null,
  accepted_at   timestamptz not null default now(),
  unique (hub_id, user_id, pact_version)
);

-- Meeting Point Moovi (Doc1 §12.1) — absent du modèle des Instructions
create table meeting_points (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references hubs(id) on delete cascade,
  label         text not null,
  description   text,
  photo_url     text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Ponts de proximité (Doc1 §9.1) — absent du modèle des Instructions
create table hub_bridges (
  id              uuid primary key default gen_random_uuid(),
  source_hub_id   uuid not null references hubs(id) on delete cascade,
  target_hub_id   uuid not null references hubs(id) on delete cascade,
  bridge_type     text not null,   -- ecole_ecole / ecole_club / club_quartier
  is_active       boolean not null default false,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (source_hub_id <> target_hub_id),
  unique (source_hub_id, target_hub_id)
);

comment on table hub_bridges is
  'Doc1 §9.1 : à travers un pont, les trajets sont visibles mais les profils '
  'des membres sont ANONYMISÉS jusqu à acceptation mutuelle. '
  'Cette règle doit être portée par les vues/RLS, pas seulement par l UI.';

-- =====================================================================
-- 3. ACTIVITÉS ET TRAJETS
-- =====================================================================

create table activities (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  hub_id        uuid references hubs(id),
  label         text not null,
  location_label text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  rrule         text,            -- récurrence iCal, null si ponctuel
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

create type trip_direction as enum ('aller', 'retour');
create type trip_status as enum (
  'couvert', 'couvert_ouvert', 'partiellement_couvert',
  'conditionnel', 'non_couvert', 'annule'
);

create table trips (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  activity_id       uuid references activities(id) on delete set null,
  hub_id            uuid references hubs(id),
  direction         trip_direction not null,
  status            trip_status not null default 'non_couvert',
  driver_id         uuid references users(id),
  scheduled_at      timestamptz not null,
  origin_label      text,
  origin_lat        numeric(9,6),
  origin_lng        numeric(9,6),
  destination_label text,
  destination_lat   numeric(9,6),
  destination_lng   numeric(9,6),
  meeting_point_id  uuid references meeting_points(id),
  seats_total       smallint,
  seats_available   smallint,
  distance_km       numeric(6,2),
  published_to_hub  boolean not null default false,
  private_note      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (seats_available is null or seats_total is null
         or seats_available <= seats_total)
);

comment on column trips.private_note is
  'Cercle intime UNIQUEMENT. Ne doit jamais apparaître dans une vue hub (§3).';

comment on column trips.published_to_hub is
  'Le passage au hub se fait via la vue normalisée hub_trips_view, '
  'jamais par un select direct sur trips (§3, dernier principe).';

create index on trips (hub_id, scheduled_at);
create index on trips (household_id, scheduled_at);
create index on trips (driver_id);

create table trip_children (
  trip_id   uuid not null references trips(id) on delete cascade,
  child_id  uuid not null references children(id) on delete cascade,
  primary key (trip_id, child_id)
);

create type trip_request_status as enum (
  'en_attente', 'accepte', 'refuse', 'annule', 'expire'
);

create table trip_requests (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references trips(id) on delete cascade,
  requester_id      uuid not null references users(id) on delete cascade,
  requester_household_id uuid not null references households(id) on delete cascade,
  child_id          uuid not null references children(id) on delete cascade,
  status            trip_request_status not null default 'en_attente',
  message           text,
  responded_at      timestamptz,
  created_at        timestamptz not null default now()
);

comment on table trip_requests is
  'Le matching PROPOSE, il n ASSIGNE jamais (§3). Aucun trigger, aucune tâche '
  'planifiée ne doit faire passer une demande en accepte sans action du conducteur.';

create index on trip_requests (trip_id);
create index on trip_requests (requester_id);

-- Bulletin de trajet (Doc1 §12.2) — absent du modèle des Instructions
create table trip_dropoff_confirmations (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references trips(id) on delete cascade,
  child_id          uuid not null references children(id) on delete cascade,
  confirmed_by      uuid not null references users(id),
  confirmed_at      timestamptz not null default now(),
  unique (trip_id, child_id)
);

comment on table trip_dropoff_confirmations is
  'Brique de sécurité enfant. Relance automatique au conducteur si aucune '
  'confirmation 20 min après scheduled_at (Doc1 §12.2). '
  'Le délai doit être un paramètre app_settings, pas une constante.';

-- =====================================================================
-- 4. MOOVES
-- AUCUNE colonne monétaire dans cette section. Aucune.
-- =====================================================================

create type moove_movement as enum (
  'gain', 'usage', 'ajustement', 'fonds_solidarite', 'solde_initial'
);

create table mooves_balance (
  user_id       uuid primary key references users(id) on delete cascade,
  balance       integer not null default 0,
  updated_at    timestamptz not null default now()
);

comment on table mooves_balance is
  'Indicateur d équilibre interne. JAMAIS un portefeuille. '
  'Solde négatif AUTORISÉ et NON BLOQUANT (§6.1). '
  'Aucune contrainte check(balance >= 0) ne doit être ajoutée ici.';

create table mooves_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  movement      moove_movement not null,
  amount        integer not null,
  trip_id       uuid references trips(id) on delete set null,
  grant_id      uuid,
  reason        text,
  created_at    timestamptz not null default now()
);

comment on column mooves_ledger.amount is
  'Unités Mooves, entier signé. AUCUNE équivalence EUR, aucun taux de change, '
  'ni stocké ni calculé en arrière-plan (§6.2).';

create index on mooves_ledger (user_id, created_at desc);

create table solidarity_fund_grants (
  id              uuid primary key default gen_random_uuid(),
  beneficiary_id  uuid not null references users(id) on delete cascade,
  institution_id  uuid references institutions(id),
  sponsor_label   text,
  amount          integer not null,
  granted_by      uuid references users(id),
  reason          text,
  created_at      timestamptz not null default now(),
  check (institution_id is not null or sponsor_label is not null)
);

comment on table solidarity_fund_grants is
  'Alimenté par une institution ou un sponsor, JAMAIS par un autre parent (§6.1). '
  'Aucune FK vers un users comme payeur.';

-- =====================================================================
-- 5. VOLONTARIAT ET DÉFRAIEMENT
-- Système strictement PARALLÈLE aux Mooves. Jamais fusionné (§7.2).
-- =====================================================================

create type volunteer_vector as enum (
  'club', 'po_ecole', 'commune', 'association_parents'
);

create table volunteer_recognitions (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  vector_type     volunteer_vector not null,
  rate_eur_per_km numeric(5,3) not null,
  valid_from      date not null,
  valid_until     date,
  is_active       boolean not null default false,
  created_at      timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);

comment on column volunteer_recognitions.rate_eur_per_km is
  'Barème PAR INSTITUTION, jamais codé en dur (§7.1). '
  'Chaque institution choisit son taux dans la limite légale.';

comment on table volunteer_recognitions is
  'MODULE NON ACTIVABLE EN PRODUCTION avant validation juridique des quatre '
  'vecteurs (§7.3, §12). is_active doit rester false.';

create table defraiement_records (
  id                        uuid primary key default gen_random_uuid(),
  volunteer_recognition_id  uuid not null references volunteer_recognitions(id) on delete cascade,
  trip_id                   uuid not null references trips(id) on delete cascade,
  distance_km               numeric(6,2) not null,
  amount_eur                numeric(8,2) not null,
  performed_on              date not null,
  exported_at               timestamptz,
  created_at                timestamptz not null default now(),
  unique (volunteer_recognition_id, trip_id)
);

comment on table defraiement_records is
  'Mooveee DOCUMENTE, l institution PAIE sur son propre budget (§7.2). '
  'Aucun statut paid, aucun flux de paiement dans cette table.';

-- =====================================================================
-- 6. RGPD, MESSAGERIE, SIGNALEMENTS
-- =====================================================================

create type consent_type as enum (
  'inscription', 'cercle_intime', 'hub', 'communications_institutionnelles',
  'photo_enfant'
);

create table consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  type          consent_type not null,
  granted       boolean not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  policy_version text not null
);

create index on consents (user_id, type);

create type channel_type as enum ('cercle_intime', 'hub', 'broadcast_institutionnel');

create table messages (
  id            uuid primary key default gen_random_uuid(),
  channel       channel_type not null,
  household_id  uuid references households(id) on delete cascade,
  hub_id        uuid references hubs(id) on delete cascade,
  trip_id       uuid references trips(id) on delete set null,
  author_id     uuid not null references users(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  check (
    (channel = 'cercle_intime' and household_id is not null) or
    (channel <> 'cercle_intime' and hub_id is not null)
  )
);

create table institutional_messages (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  hub_id          uuid not null references hubs(id) on delete cascade,
  author_id       uuid not null references users(id),
  title           text not null,
  body            text not null,
  published_at    timestamptz not null default now()
);

create type report_status as enum ('ouvert', 'en_cours', 'resolu', 'clos');

create table reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references users(id) on delete cascade,
  hub_id        uuid references hubs(id) on delete set null,
  trip_id       uuid references trips(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  category      text not null,
  body          text not null,
  status        report_status not null default 'ouvert',
  involves_minor boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on column reports.involves_minor is
  'Si true : escalade humaine obligatoire, jamais de résolution automatisée (§10).';

-- =====================================================================
-- 7. MÉTRIQUES INSTITUTIONNELLES
-- Le volume influence le PALIER, il ne génère jamais de ligne de facture (§8).
-- =====================================================================

create table institution_usage_metrics (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references institutions(id) on delete cascade,
  period_month        date not null,
  active_families     integer not null default 0,
  hubs_count          integer not null default 0,
  trips_volume        integer not null default 0,
  features_enabled    jsonb not null default '{}'::jsonb,
  computed_at         timestamptz not null default now(),
  unique (institution_id, period_month)
);

comment on table institution_usage_metrics is
  'Recalcul mensuel par tâche planifiée. AUCUN déclenchement de facturation '
  'par événement individuel (§8).';

create table impact_snapshots (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid references hubs(id) on delete cascade,
  municipality  text,
  period_month  date not null,
  families_count integer not null,
  trips_shared  integer not null,
  km_saved      numeric(10,2),
  co2_saved_kg  numeric(10,2),
  computed_at   timestamptz not null default now()
);

comment on table impact_snapshots is
  'Agrégé et anonymisé. Ne jamais générer si families_count < '
  'app_settings.reidentification_min_families (AIPD §5.4).';

-- =====================================================================
-- 8. HELPERS RLS
-- SECURITY DEFINER pour éviter la récursion de policies.
-- =====================================================================

create or replace function auth_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid();
$$;

create or replace function auth_hub_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hub_id from hub_members
  where user_id = auth.uid() and validated_at is not null;
$$;

-- =====================================================================
-- 9. ROW LEVEL SECURITY
-- Activée partout. Deny by default : toute table sans policy est fermée.
-- =====================================================================

alter table app_settings                enable row level security;
alter table users                       enable row level security;
alter table households                  enable row level security;
alter table household_members           enable row level security;
alter table children                    enable row level security;
alter table institutions                enable row level security;
alter table hubs                        enable row level security;
alter table hub_members                 enable row level security;
alter table hub_pact_acceptances        enable row level security;
alter table meeting_points              enable row level security;
alter table hub_bridges                 enable row level security;
alter table activities                  enable row level security;
alter table trips                       enable row level security;
alter table trip_children               enable row level security;
alter table trip_requests               enable row level security;
alter table trip_dropoff_confirmations  enable row level security;
alter table mooves_balance              enable row level security;
alter table mooves_ledger               enable row level security;
alter table solidarity_fund_grants      enable row level security;
alter table volunteer_recognitions      enable row level security;
alter table defraiement_records         enable row level security;
alter table consents                    enable row level security;
alter table messages                    enable row level security;
alter table institutional_messages      enable row level security;
alter table reports                     enable row level security;
alter table institution_usage_metrics   enable row level security;
alter table impact_snapshots            enable row level security;

-- --- users -----------------------------------------------------------
create policy users_self_select on users for select
  using (id = auth.uid());
create policy users_self_update on users for update
  using (id = auth.uid());

-- --- households ------------------------------------------------------
create policy households_member_select on households for select
  using (id in (select auth_household_ids()));
create policy households_member_update on households for update
  using (id in (select auth_household_ids()));
create policy households_insert on households for insert
  with check (created_by = auth.uid());

-- --- household_members -----------------------------------------------
create policy hm_member_select on household_members for select
  using (household_id in (select auth_household_ids()));
create policy hm_admin_write on household_members for all
  using (exists (
    select 1 from household_members m
    where m.household_id = household_members.household_id
      and m.user_id = auth.uid() and m.is_admin
  ));

-- --- children --------------------------------------------------------
-- Aucune exposition hors du foyer. Les données enfant ne transitent
-- vers le hub que par la vue normalisée, jamais par cette table.
create policy children_household_all on children for all
  using (household_id in (select auth_household_ids()))
  with check (household_id in (select auth_household_ids()));

-- --- hubs ------------------------------------------------------------
create policy hubs_member_select on hubs for select
  using (id in (select auth_hub_ids()) or owner_id = auth.uid());
create policy hubs_owner_update on hubs for update
  using (owner_id = auth.uid() or exists (
    select 1 from hub_members hm
    where hm.hub_id = hubs.id and hm.user_id = auth.uid() and hm.is_admin
  ));
create policy hubs_insert on hubs for insert
  with check (owner_id = auth.uid());

-- --- hub_members -----------------------------------------------------
create policy hub_members_select on hub_members for select
  using (hub_id in (select auth_hub_ids()) or user_id = auth.uid());
create policy hub_members_self_insert on hub_members for insert
  with check (user_id = auth.uid());

-- --- trips -----------------------------------------------------------
-- Deux chemins de lecture : mon foyer (tout), ou mon hub (publié seulement).
-- private_note reste exposée par cette policy : le filtrage se fait par la
-- vue hub_trips_view, JAMAIS par un select direct côté hub.
create policy trips_household_all on trips for all
  using (household_id in (select auth_household_ids()))
  with check (household_id in (select auth_household_ids()));

create policy trips_hub_select on trips for select
  using (published_to_hub and hub_id in (select auth_hub_ids()));

-- --- trip_requests ---------------------------------------------------
create policy trip_requests_visible on trip_requests for select
  using (
    requester_household_id in (select auth_household_ids())
    or exists (
      select 1 from trips t
      where t.id = trip_requests.trip_id
        and t.household_id in (select auth_household_ids())
    )
  );
create policy trip_requests_insert on trip_requests for insert
  with check (requester_id = auth.uid());
-- Seul le foyer conducteur répond. Le matching propose, il n assigne pas.
create policy trip_requests_driver_update on trip_requests for update
  using (exists (
    select 1 from trips t
    where t.id = trip_requests.trip_id
      and t.household_id in (select auth_household_ids())
  ));

-- --- mooves ----------------------------------------------------------
-- Strictement privé à l utilisateur. Zéro notation publique (§3).
create policy mooves_balance_self on mooves_balance for select
  using (user_id = auth.uid());
create policy mooves_ledger_self on mooves_ledger for select
  using (user_id = auth.uid());
create policy solidarity_self on solidarity_fund_grants for select
  using (beneficiary_id = auth.uid());

-- --- consents --------------------------------------------------------
create policy consents_self on consents for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- messages --------------------------------------------------------
create policy messages_scope on messages for select
  using (
    (channel = 'cercle_intime' and household_id in (select auth_household_ids()))
    or (channel <> 'cercle_intime' and hub_id in (select auth_hub_ids()))
  );
create policy messages_author_insert on messages for insert
  with check (author_id = auth.uid());

-- --- reports ---------------------------------------------------------
create policy reports_self_select on reports for select
  using (reporter_id = auth.uid());
create policy reports_insert on reports for insert
  with check (reporter_id = auth.uid());

-- --- volontariat / défraiement ---------------------------------------
create policy vr_self_select on volunteer_recognitions for select
  using (user_id = auth.uid());
create policy dr_self_select on defraiement_records for select
  using (exists (
    select 1 from volunteer_recognitions vr
    where vr.id = defraiement_records.volunteer_recognition_id
      and vr.user_id = auth.uid()
  ));

-- --- métriques institutionnelles -------------------------------------
-- Aucune policy pour le rôle authenticated : accès service_role uniquement,
-- via des vues agrégées. Les institutions n accèdent JAMAIS au nominatif (§9.1).

-- --- app_settings ----------------------------------------------------
create policy settings_read on app_settings for select using (true);

-- =====================================================================
-- 10. VUE NORMALISÉE CERCLE INTIME -> HUB
-- C est le seul chemin autorisé pour exposer un trajet au hub (§3).
-- Ni private_note, ni prénom enfant, ni contact.
-- =====================================================================

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
  t.meeting_point_id,
  t.seats_available,
  t.driver_id,
  u.first_name as driver_first_name,
  (select count(*) from trip_children tc where tc.trip_id = t.id) as children_count
from trips t
left join users u on u.id = t.driver_id
where t.published_to_hub
  and t.hub_id in (select auth_hub_ids());

comment on view hub_trips_view is
  'Version normalisée : heure, lieu, statut, places. '
  'Jamais private_note, jamais children.first_name, jamais de contact. '
  'children_count est un compte, pas une liste.';

-- =====================================================================
-- 11. TRANSITION SOLO -> ACTIVE
-- Automatique côté données, mais doit produire un événement UI visible (§5).
-- =====================================================================

create or replace function hub_check_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer;
  member_count integer;
begin
  select (value #>> '{}')::integer into threshold
  from app_settings where key = 'hub_activation_member_count';

  select count(*) into member_count
  from hub_members where hub_id = new.hub_id and validated_at is not null;

  if member_count >= threshold then
    update hubs
       set status = 'active', activated_at = coalesce(activated_at, now())
     where id = new.hub_id and status = 'solo';
  end if;

  return new;
end;
$$;

create trigger trg_hub_activation
after insert or update of validated_at on hub_members
for each row execute function hub_check_activation();

commit;

-- =====================================================================
-- ARBITRAGES OUVERTS — À TRANCHER AVANT D ALLER PLUS LOIN
-- =====================================================================
--
-- 1. BARÈME MOOVES KILOMÉTRIQUE
--    Doc1 §3.4 publie une grille de gain indexée sur la distance
--    (30 Mooves 0-3 km, jusqu à 70 au-delà de 15 km).
--    Instructions §6.2 et §7.2 interdisent toute logique "X Mooves = Y km"
--    et exigent la séparation stricte Mooves / défraiement kilométrique.
--    Une unité gagnée proportionnellement à la distance EST structurellement
--    un barème kilométrique. C est le risque de requalification que tout le
--    reste du dispositif cherche à éviter.
--    -> Grille volontairement NON implémentée ici. Décision porteur + juriste.
--
-- 2. CHAMP ALLERGIES / SANTÉ ENFANT
--    Doc1 §15.1 le prescrit à l inscription.
--    Instructions §3 et §12 l interdisent tant que l arbitrage n est pas fait.
--    -> Non implémenté. Si retenu : art. 9 RGPD, consentement séparé,
--       accès restreint au strict besoin, jamais transmis au hub.
--
-- 3. CONFIANCE PROGRESSIVE
--    Doc1 §12.5 prévoit 4 niveaux (créé / vérifié / recommandé / historique
--    positif). Instructions §3 imposent zéro notation publique.
--    "Recommandé" et "historique positif" sont visibles par autrui.
--    -> Non implémenté. À arbitrer.
--
-- 4. SOLDE MOOVES INITIAL et SEUIL DE DÉSÉQUILIBRE
--    Paramètres à null dans app_settings. À définir avec le porteur.
--
-- 5. MODULE DÉFRAIEMENT
--    Les 4 vecteurs ne sont pas juridiquement validés (§7.3).
--    Tables créées, is_active reste false. Ne pas activer en production.
--
-- 6. SUPPRESSION EN CASCADE
--    Les ON DELETE CASCADE couvrent le graphe applicatif, mais l AIPD exige
--    un TEST EN CONDITIONS RÉELLES avant le premier utilisateur du pilote,
--    y compris sur la politique de rétention des backups Supabase.
--    À écrire comme un test automatisé, pas comme une supposition.
--
-- 7. NON COUVERT PAR CE SCHÉMA
--    Macarons / matching 3D (Doc1 §7) : calcul, pas stockage. À spécifier.
--    Hubs miroirs (Doc1 §9.2) : suggestion dérivée, pas de table dédiée.
--    weekly_schedules : vue agrégée, à construire une fois l UI figée.
-- =====================================================================
