import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------
// Relance du bulletin de trajet (Doc1 §12.2) : un trajet dont le
// conducteur est l'utilisateur, passé depuis plus de
// app_settings.dropoff_reminder_minutes, avec au moins un enfant à bord
// sans confirmation de dépôt, doit produire une relance.
//
// POINT D'ACCROCHE PUSH : pour l'instant la relance est une alerte
// affichée à l'ouverture de l'app (DropoffReminderBanner). Le jour où
// les notifications push arrivent, la MÊME détection devra tourner côté
// serveur (cron ou edge function appelant cette logique en SQL) — sans
// introduire de dépendance serveur au runtime de l'app (mode SPA).
// ---------------------------------------------------------------------

// Fenêtre de retour en arrière : au-delà, un trajet non confirmé cesse
// d'alerter (la relance vise le trajet du jour, pas un historique).
const REMINDER_LOOKBACK_HOURS = 24

export interface DropoffReminder {
  tripId: string
  scheduledAt: string
  originLabel: string | null
  destinationLabel: string | null
  unconfirmedCount: number
}

export async function fetchPendingDropoffReminders(
  userId: string,
): Promise<Array<DropoffReminder>> {
  // Le délai est un paramètre app_settings, jamais une constante.
  // Paramètre absent (migration non appliquée) : aucune relance.
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'dropoff_reminder_minutes')
    .maybeSingle()
  if (!setting) return []

  const delayMinutes = Number(setting.value)
  if (!Number.isFinite(delayMinutes)) return []

  const now = Date.now()
  const from = new Date(now - REMINDER_LOOKBACK_HOURS * 3_600_000).toISOString()
  const to = new Date(now - delayMinutes * 60_000).toISOString()
  if (from >= to) return []

  const { data: trips } = await supabase
    .from('trips')
    .select('id, scheduled_at, origin_label, destination_label')
    .eq('driver_id', userId)
    .neq('status', 'annule')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at')
  if (!trips || trips.length === 0) return []

  const tripIds = trips.map((t) => t.id)

  // Les deux lectures passent par la RLS : les trajets appartiennent au
  // foyer du conducteur, trip_children et les confirmations de ses
  // trajets lui sont donc visibles. Aucun prénom ici : des comptes.
  const [aboardResult, confirmedResult] = await Promise.all([
    supabase
      .from('trip_children')
      .select('trip_id, child_id')
      .in('trip_id', tripIds),
    supabase
      .from('trip_dropoff_confirmations')
      .select('trip_id, child_id')
      .in('trip_id', tripIds),
  ])

  const aboardByTrip = new Map<string, number>()
  aboardResult.data?.forEach((row) => {
    aboardByTrip.set(row.trip_id, (aboardByTrip.get(row.trip_id) ?? 0) + 1)
  })
  const confirmedByTrip = new Map<string, number>()
  confirmedResult.data?.forEach((row) => {
    confirmedByTrip.set(
      row.trip_id,
      (confirmedByTrip.get(row.trip_id) ?? 0) + 1,
    )
  })

  return trips.flatMap((trip) => {
    const unconfirmed =
      (aboardByTrip.get(trip.id) ?? 0) - (confirmedByTrip.get(trip.id) ?? 0)
    if (unconfirmed <= 0) return []
    return [
      {
        tripId: trip.id,
        scheduledAt: trip.scheduled_at,
        originLabel: trip.origin_label,
        destinationLabel: trip.destination_label,
        unconfirmedCount: unconfirmed,
      },
    ]
  })
}
