import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------
// Mode Concierge (étape 9) — détections AUTOMATISABLES uniquement :
// rappels de trajet, hub en démarrage qui stagne, hub inactif,
// déséquilibre durable. Tout le reste (conflit entre familles,
// signalement, incident, exclusion, situation personnelle sensible,
// tout incident impliquant un enfant) est humain de bout en bout et
// n'a RIEN à faire dans ce fichier.
//
// Le Concierge ne crée aucune demande, n'assigne aucun trajet,
// n'exclut personne : ces fonctions LISENT et renvoient de quoi
// afficher une notification. Aucune écriture.
//
// POINT D'ACCROCHE CRON/PUSH : chaque détection est une fonction
// autonome, paramétrée par app_settings. Le jour du passage en tâche
// planifiée ou en notification push, la même logique sera portée côté
// serveur (cron ou edge function) — rien n'est câblé ici, et aucune
// dépendance au rendu serveur n'est introduite (mode SPA).
// ---------------------------------------------------------------------

export type ConciergeSettingKey =
  | 'concierge_trip_reminder_hours'
  | 'concierge_hub_solo_weeks'
  | 'concierge_hub_inactive_weeks'
  | 'mooves_imbalance_weeks'

export type ConciergeSettings = Partial<Record<ConciergeSettingKey, number>>

// Lecture groupée des paramètres Concierge. Un paramètre absent
// (migration non appliquée) désactive la détection correspondante.
export async function fetchConciergeSettings(): Promise<ConciergeSettings> {
  const keys: Array<ConciergeSettingKey> = [
    'concierge_trip_reminder_hours',
    'concierge_hub_solo_weeks',
    'concierge_hub_inactive_weeks',
    'mooves_imbalance_weeks',
  ]
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', keys)

  const settings: ConciergeSettings = {}
  data?.forEach((row) => {
    const value = Number(row.value)
    if (Number.isFinite(value)) {
      settings[row.key as ConciergeSettingKey] = value
    }
  })
  return settings
}

// --- 1. Rappel avant un trajet à venir --------------------------------
// Deux rôles : le CONDUCTEUR (ses propres trajets), et les familles
// dont un ENFANT EST À BORD d'un trajet d'un autre foyer (demande
// acceptée, détails relus via hub_trips_view — jamais de select direct
// sur les trips d'autrui, interdit n°9).

export interface TripReminder {
  tripId: string
  scheduledAt: string
  originLabel: string | null
  destinationLabel: string | null
  role: 'conducteur' | 'enfant_a_bord'
  childFirstName: string | null
}

export async function fetchUpcomingTripReminders(
  userId: string,
  householdId: string,
): Promise<Array<TripReminder>> {
  const settings = await fetchConciergeSettings()
  const hours = settings.concierge_trip_reminder_hours
  if (hours === undefined) return []

  const now = new Date()
  const until = new Date(now.getTime() + hours * 3_600_000)

  const [drivingResult, acceptedResult] = await Promise.all([
    supabase
      .from('trips')
      .select('id, scheduled_at, origin_label, destination_label')
      .eq('driver_id', userId)
      .neq('status', 'annule')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', until.toISOString())
      .order('scheduled_at'),
    supabase
      .from('trip_requests')
      .select('trip_id, children(first_name)')
      .eq('requester_household_id', householdId)
      .eq('status', 'accepte'),
  ])

  const reminders: Array<TripReminder> = []
  const drivingIds = new Set<string>()

  drivingResult.data?.forEach((trip) => {
    drivingIds.add(trip.id)
    reminders.push({
      tripId: trip.id,
      scheduledAt: trip.scheduled_at,
      originLabel: trip.origin_label,
      destinationLabel: trip.destination_label,
      role: 'conducteur',
      childFirstName: null,
    })
  })

  const acceptedTripIds = [
    ...new Set(
      (acceptedResult.data ?? [])
        .map((r) => r.trip_id)
        .filter((id) => !drivingIds.has(id)),
    ),
  ]
  if (acceptedTripIds.length > 0) {
    const { data: viewRows } = await supabase
      .from('hub_trips_view')
      .select('id, scheduled_at, origin_label, destination_label')
      .in('id', acceptedTripIds)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', until.toISOString())

    const childByTrip = new Map(
      (acceptedResult.data ?? []).map((r) => [
        r.trip_id,
        r.children.first_name,
      ]),
    )
    viewRows?.forEach((row) => {
      if (!row.id || !row.scheduled_at) return
      reminders.push({
        tripId: row.id,
        scheduledAt: row.scheduled_at,
        originLabel: row.origin_label,
        destinationLabel: row.destination_label,
        role: 'enfant_a_bord',
        childFirstName: childByTrip.get(row.id) ?? null,
      })
    })
  }

  reminders.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  return reminders
}

// --- 2 et 3. Hubs : stagnation en démarrage, inactivité ---------------
// Helpers PURS : l'écran /hubs possède déjà les données (statut,
// membres validés via hub_member_profiles, trajets via hub_trips_view).

// Hub en démarrage qui stagne : toujours solo, et aucun membre validé
// depuis le délai. Suggestion d'invitation à l'admin, avec le code
// d'adhésion à portée de main — jamais d'invitation automatique.
export function hubSoloIsStagnant(
  status: string,
  validatedAtDates: Array<string>,
  weeks: number | undefined,
  now: Date,
): boolean {
  if (weeks === undefined || status !== 'solo') return false
  if (validatedAtDates.length === 0) return false
  const latest = validatedAtDates.reduce((a, b) => (a > b ? a : b))
  return new Date(latest).getTime() < now.getTime() - weeks * 7 * 24 * 3_600_000
}

// --- 4. Déséquilibre durable ------------------------------------------
// Aide reçue durablement supérieure à l'aide apportée : indicateur
// négatif SANS INTERRUPTION depuis mooves_imbalance_weeks semaines.
// Reconstruction en marche arrière depuis l'indicateur courant avec le
// ledger (strictement privé, RLS self). Le message associé est une
// PROPOSITION D'AIDE affichée uniquement à la famille concernée —
// jamais un reproche, jamais visible d'un autre membre.

export interface LedgerEntryForImbalance {
  amount: number
  created_at: string
}

export function imbalanceIsDurable(
  currentBalance: number,
  entriesNewestFirst: Array<LedgerEntryForImbalance>,
  weeks: number | undefined,
  now: Date,
): boolean {
  if (weeks === undefined || currentBalance >= 0) return false

  const windowStart = now.getTime() - weeks * 7 * 24 * 3_600_000
  let balance = currentBalance

  for (const entry of entriesNewestFirst) {
    if (new Date(entry.created_at).getTime() < windowStart) break
    // Indicateur juste avant ce mouvement : s'il repassait à
    // l'équilibre à un moment de la fenêtre, rien à signaler.
    balance -= entry.amount
    if (balance >= 0) return false
  }

  // Indicateur au début de la fenêtre : déjà négatif, sans remontée
  // depuis — le déséquilibre est durable. (Le ledger chargé est borné
  // à 200 mouvements : largement au-delà de 4 semaines d'usage réel.)
  return balance < 0
}
