-- 0020 — Couches de hub préparées, préférences de notification, détection
-- d'opportunités en mode observation (Instructions Techniques v4, §6 et §12)

-- ---------------------------------------------------------------------------
-- 1. hub_relations — architecture élargie, GELÉE par défaut (§6)
-- ---------------------------------------------------------------------------

create table if not exists hub_relations (
  id                uuid primary key default gen_random_uuid(),
  hub_a_id          uuid not null references hubs(id) on delete cascade,
  hub_b_id          uuid not null references hubs(id) on delete cascade,
  relation_type     text not null check (relation_type in ('proximite', 'chemin')),
  activation_status text not null default 'prepared'
                    check (activation_status in ('prepared', 'active')),
  created_at        timestamptz not null default now(),
  check (hub_a_id <> hub_b_id),
  unique (hub_a_id, hub_b_id, relation_type)
);

comment on table hub_relations is
  'Couches de hub (§6) : proximite (geographique) et chemin (corridor). '
  'activation_status reste prepared pour tout le pilote — le passage a '
  'active est une action manuelle et explicite du porteur, hub par hub, '
  'JAMAIS un comportement par defaut ni un seuil automatique (§6.3). '
  'Aucune ecriture cote client : creation par le porteur via le dashboard.';

alter table hub_relations enable row level security;

-- Lecture réservée aux admins des hubs concernés. Aucune policy
-- d'écriture : deny by default voulu (création côté porteur uniquement).
drop policy if exists hub_relations_admin_select on hub_relations;
create policy hub_relations_admin_select on hub_relations
  for select to authenticated
  using (
    hub_a_id in (select auth_hub_admin_ids())
    or hub_b_id in (select auth_hub_admin_ids())
  );

-- ---------------------------------------------------------------------------
-- 2. notification_preferences — deux curseurs, non calibrés (§12.4)
-- ---------------------------------------------------------------------------

create table if not exists notification_preferences (
  user_id           uuid primary key references users(id) on delete cascade,
  max_per_day       smallint check (max_per_day is null or max_per_day >= 0),
  max_per_week      smallint check (max_per_week is null or max_per_week >= 0),
  quiet_hours_start time,
  quiet_hours_end   time,
  channel           text check (channel is null or channel in ('push', 'email', 'aucune')),
  updated_at        timestamptz not null default now()
);

comment on table notification_preferences is
  'Plafond DUR fixe par le conducteur lui-meme (§12.4) : rien ne le '
  'depasse, quelle que soit l''urgence du demandeur. La priorite d''un '
  'besoin remonte une correspondance DANS le plafond, jamais au-dela. '
  'Valeurs par defaut volontairement absentes : calibrees apres le pilote.';

alter table notification_preferences enable row level security;

drop policy if exists notification_preferences_select on notification_preferences;
create policy notification_preferences_select on notification_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_preferences_insert on notification_preferences;
create policy notification_preferences_insert on notification_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists notification_preferences_update on notification_preferences;
create policy notification_preferences_update on notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. opportunity_matches — journal d'observation (§12.2, §12.3)
-- ---------------------------------------------------------------------------

create table if not exists opportunity_matches (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id) on delete cascade,
  request_trip_id     uuid not null references trips(id) on delete cascade,
  driver_user_id      uuid not null references users(id) on delete cascade,
  hub_id              uuid references hubs(id) on delete set null,
  via_hub_relation_id uuid references hub_relations(id) on delete set null,
  status              text not null default 'detecte_silencieux'
                      check (status in ('detecte_silencieux', 'signal_envoye',
                                        'ouvert_par_utilisateur', 'accepte',
                                        'refuse', 'expire')),
  detected_at         timestamptz not null default now(),
  updated_at          timestamptz,
  unique (trip_id, request_trip_id)
);

comment on table opportunity_matches is
  'Correspondances besoin <-> opportunite conducteur (§12.2). Pendant la '
  'phase d''observation (§12.3), tout reste en detecte_silencieux : AUCUNE '
  'notification envoyee, AUCUNE visibilite cote client. Revue des logs par '
  'le porteur avant toute activation progressive. Jamais un trajet assigne '
  '— uniquement une proposition future au conducteur.';

-- RLS activée SANS policy : table volontairement muette côté client
-- pendant l'observation (dérogation assumée à la règle « toute table
-- arrive avec ses policies » — c'est ici le comportement voulu).
-- L'écriture passe par detect_opportunities() ci-dessous (revoquée),
-- la lecture par le dashboard du porteur.
alter table opportunity_matches enable row level security;

-- ---------------------------------------------------------------------------
-- 4. detect_opportunities() — moteur en mode observation
-- ---------------------------------------------------------------------------

create or replace function detect_opportunities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  -- Besoin = trajet publié au hub, non couvert, à venir.
  -- Opportunité = trajet d'un AUTRE foyer du même hub, même direction,
  -- fenêtre ±90 min, avec conducteur attribué, allant au même lieu
  -- (place_id identique, sinon libellés similaires — 0013), et soit des
  -- places offertes, soit un passage adulte sans enfant (has_children=false).
  insert into opportunity_matches (trip_id, request_trip_id, driver_user_id, hub_id)
  select
    d.id,
    b.id,
    d.driver_id,
    b.hub_id
  from trips b
  join trips d
    on d.hub_id = b.hub_id
   and d.id <> b.id
   and d.household_id <> b.household_id
   and d.direction = b.direction
   and d.driver_id is not null
   and d.status <> 'annule'
   and d.scheduled_at between b.scheduled_at - interval '90 minutes'
                          and b.scheduled_at + interval '90 minutes'
   and (
     (d.destination_place_id is not null
      and d.destination_place_id = b.destination_place_id)
     or trip_labels_similar(d.destination_label, b.destination_label)
   )
   and (coalesce(d.seats_available, 0) > 0 or d.has_children = false)
  where b.published_to_hub
    and b.hub_id is not null
    and b.status = 'non_couvert'
    and b.scheduled_at > now()
  on conflict (trip_id, request_trip_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function detect_opportunities() is
  'Mode observation (§12.3) : enregistre les correspondances en '
  'detecte_silencieux sans JAMAIS notifier. L''envoi effectif de '
  'notifications est une phase ulterieure, activee progressivement apres '
  'revue des logs avec le porteur.';

-- Fonction d'écriture security definer : révoquée pour les rôles clients
-- dans la MÊME migration (règle du repo, leçon 0015/0016).
revoke execute on function detect_opportunities()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Planification quotidienne — pg_cron si disponible, sinon manuel
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible : lancer "select detect_opportunities();" manuellement (ou via le dashboard) pendant le pilote.';
    return;
  end;

  -- cron.schedule est un upsert par nom de job.
  perform cron.schedule(
    'detect-opportunities',
    '15 3 * * *',
    'select detect_opportunities()'
  );
exception when others then
  raise notice 'Planification pg_cron impossible (%) : lancer detect_opportunities() manuellement.', sqlerrm;
end $$;
