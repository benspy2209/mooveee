import { supabase } from '@/lib/supabase'

import type { Database } from '@/types/database'

type TripDirection = Database['public']['Enums']['trip_direction']
type DistanceBand = Database['public']['Enums']['distance_band']

// ---------------------------------------------------------------------
// Génération des trajets depuis les activités — partagée entre l'écran
// Semaine (bouton « Générer les trajets ») et le formulaire d'activité
// (génération automatique à l'enregistrement). Une seule implémentation
// pour une logique sensible aux changements d'heure : jamais deux
// copies qui divergent.
//
// Fuseau : les heures sont stockées en UTC mais saisies en heure locale
// belge. Toute l'arithmétique d'occurrences se fait en calendrier
// Europe/Brussels, jamais par addition de sept jours sur un timestamp
// UTC : un tennis à 16h reste à 16h après le changement d'heure.
// ---------------------------------------------------------------------

export const BRUSSELS_TZ = 'Europe/Brussels'

export const HOME_LABEL = 'Domicile'

export const HORIZONS = [
  { days: 28, label: '4 semaines' },
  { days: 91, label: '3 mois' },
  { days: 182, label: '6 mois' },
  { days: 365, label: '1 an' },
]
export const DEFAULT_HORIZON_DAYS = 91 // 3 mois

// Taille des lots d'insertion : sur un an, une activité récurrente
// représente une centaine de trajets — jamais une requête par trajet.
export const INSERT_BATCH_SIZE = 200

export interface WallClock {
  y: number
  m: number // 1-12
  d: number
  hh: number
  mm: number
}

const brusselsParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRUSSELS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function toBrusselsWallClock(date: Date): WallClock {
  const parts: Record<string, number> = {}
  for (const part of brusselsParts.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    y: parts.year,
    m: parts.month,
    d: parts.day,
    hh: parts.hour === 24 ? 0 : parts.hour,
    mm: parts.minute,
  }
}

// Timestamp UTC dont l'affichage en Europe/Brussels correspond au
// mur d'horloge demandé. Ajustement itératif (gère les deux
// changements d'heure sans librairie).
export function fromBrusselsWallClock(w: WallClock): Date {
  let ts = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm)
  for (let i = 0; i < 2; i++) {
    const shown = toBrusselsWallClock(new Date(ts))
    ts +=
      Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm) -
      Date.UTC(shown.y, shown.m - 1, shown.d, shown.hh, shown.mm)
  }
  return new Date(ts)
}

// Arithmétique de dates pures (année/mois/jour), sans heure : sûre
// vis-à-vis des changements d'heure.
export function addDays(w: WallClock, days: number): WallClock {
  const d = new Date(Date.UTC(w.y, w.m - 1, w.d + days))
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    hh: w.hh,
    mm: w.mm,
  }
}

// Jour de semaine calendaire (0 = dimanche … 6 = samedi).
export function weekdayOf(w: WallClock): number {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay()
}

export function sameCalendarDay(a: WallClock, b: WallClock): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d
}

const RRULE_JS_DAYS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

export function parseRruleDays(rrule: string): Array<number> {
  const byday = rrule.split(';').find((part) => part.startsWith('BYDAY='))
  if (!byday) return []
  return byday
    .slice('BYDAY='.length)
    .split(',')
    .map((code) => RRULE_JS_DAYS[code])
    .filter((d) => d !== undefined)
}

interface ActivityForGeneration {
  id: string
  child_id: string
  label: string
  location_label: string | null
  place_id: string | null
  distance_band: DistanceBand
  rrule: string | null
  starts_at: string | null
  ends_at: string | null
}

// Génère les trajets manquants du foyer sur l'horizon donné, rattache
// les enfants et propage les tranches de distance. Idempotente de bout
// en bout : ON CONFLICT DO NOTHING sur l'index unique
// (activity_id, direction, scheduled_at) — conducteurs attribués et
// occurrences annulées ne sont jamais écrasés, une régénération
// n'ajoute que le manquant.
export async function generateTripsForHousehold(
  householdId: string,
  horizonDays: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ insertedCount: number }> {
  const now = new Date()
  const todayBxl = toBrusselsWallClock(now)
  const horizon = fromBrusselsWallClock(
    addDays({ ...todayBxl, hh: 0, mm: 0 }, horizonDays),
  )

  const [activitiesResult, existingResult] = await Promise.all([
    supabase
      .from('activities')
      .select(
        'id, child_id, label, location_label, place_id, distance_band, rrule, starts_at, ends_at',
      )
      .eq('household_id', householdId),
    supabase
      .from('trips')
      .select('activity_id, direction, scheduled_at')
      .eq('household_id', householdId)
      .not('activity_id', 'is', null)
      .gte('scheduled_at', now.toISOString())
      .lt('scheduled_at', horizon.toISOString()),
  ])

  const loadError = activitiesResult.error ?? existingResult.error
  if (loadError || !activitiesResult.data || !existingResult.data) {
    throw new Error(loadError?.message ?? 'Réponse inattendue du serveur')
  }
  const activities: Array<ActivityForGeneration> = activitiesResult.data

  const existingKeys = new Set(
    existingResult.data.map(
      (t) =>
        `${t.activity_id}|${t.direction}|${new Date(t.scheduled_at).toISOString()}`,
    ),
  )

  interface NewTrip {
    household_id: string
    activity_id: string
    direction: TripDirection
    scheduled_at: string
    origin_label: string
    destination_label: string
    origin_place_id: string | null
    destination_place_id: string | null
    distance_band: DistanceBand
  }

  const newTrips: Array<NewTrip> = []

  function pushOccurrence(
    activity: ActivityForGeneration,
    startsAt: Date,
    endsAt: Date,
  ) {
    const place = activity.location_label ?? activity.label
    const occurrences: Array<{
      direction: TripDirection
      at: Date
      origin: string
      destination: string
    }> = [
      {
        direction: 'aller',
        at: startsAt,
        origin: HOME_LABEL,
        destination: place,
      },
      {
        direction: 'retour',
        at: endsAt,
        origin: place,
        destination: HOME_LABEL,
      },
    ]
    for (const occ of occurrences) {
      const iso = occ.at.toISOString()
      const key = `${activity.id}|${occ.direction}|${iso}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      newTrips.push({
        household_id: householdId,
        activity_id: activity.id,
        direction: occ.direction,
        scheduled_at: iso,
        origin_label: occ.origin,
        destination_label: occ.destination,
        // Lieu public normalisé de l'activité (0019). Le domicile n'a
        // jamais de place_id : il reste le label « Domicile ».
        origin_place_id: occ.direction === 'retour' ? activity.place_id : null,
        destination_place_id:
          occ.direction === 'aller' ? activity.place_id : null,
        distance_band: activity.distance_band,
      })
    }
  }

  for (const activity of activities) {
    if (!activity.starts_at) continue
    const endIso = activity.ends_at ?? activity.starts_at

    if (!activity.rrule) {
      const startsAt = new Date(activity.starts_at)
      if (startsAt > now && startsAt < horizon) {
        pushOccurrence(activity, startsAt, new Date(endIso))
      }
      continue
    }

    // Hebdomadaire : heures murales bruxelloises de l'activité,
    // réappliquées à chaque date calendaire du créneau. Jamais de
    // « + 7 jours » sur un timestamp UTC.
    const days = parseRruleDays(activity.rrule)
    if (days.length === 0) continue
    const startWall = toBrusselsWallClock(new Date(activity.starts_at))
    const endWall = toBrusselsWallClock(new Date(endIso))

    for (let i = 0; i < horizonDays; i++) {
      const day = addDays({ ...todayBxl, hh: 0, mm: 0 }, i)
      if (!days.includes(weekdayOf(day))) continue
      const startsAt = fromBrusselsWallClock({
        ...day,
        hh: startWall.hh,
        mm: startWall.mm,
      })
      if (startsAt <= now || startsAt >= horizon) continue
      const endsAt = fromBrusselsWallClock({
        ...day,
        hh: endWall.hh,
        mm: endWall.mm,
      })
      pushOccurrence(activity, startsAt, endsAt)
    }
  }

  // Insertion par lots. upsert + ignoreDuplicates = ON CONFLICT DO
  // NOTHING sur l'index unique : seuls les trajets réellement créés
  // sont renvoyés, les existants ne sont pas touchés.
  let insertedCount = 0
  if (newTrips.length > 0) {
    onProgress?.(0, newTrips.length)
    for (let i = 0; i < newTrips.length; i += INSERT_BATCH_SIZE) {
      const batch = newTrips.slice(i, i + INSERT_BATCH_SIZE)
      const { data: batchInserted, error: insertError } = await supabase
        .from('trips')
        .upsert(batch, {
          onConflict: 'activity_id,direction,scheduled_at',
          ignoreDuplicates: true,
        })
        .select('id')

      if (insertError || !batchInserted) {
        throw new Error(insertError?.message ?? 'Réponse inattendue du serveur')
      }

      insertedCount += batchInserted.length
      onProgress?.(
        Math.min(i + INSERT_BATCH_SIZE, newTrips.length),
        newTrips.length,
      )
    }
  }

  // Rattachement des enfants — rattrapage intégré : chaque génération
  // (re)pose le lien enfant/activité sur TOUS les trajets générés du
  // foyer, nouveaux comme anciens. Idempotent via la clé primaire
  // (trip_id, child_id) : ON CONFLICT DO NOTHING, jamais de doublon.
  const childByActivity = new Map(activities.map((a) => [a.id, a.child_id]))
  const links: Array<{ trip_id: string; child_id: string }> = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: pageError } = await supabase
      .from('trips')
      .select('id, activity_id')
      .eq('household_id', householdId)
      .not('activity_id', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (pageError || !page) {
      throw new Error(pageError?.message ?? 'Réponse inattendue du serveur')
    }
    for (const t of page) {
      const childId = t.activity_id
        ? childByActivity.get(t.activity_id)
        : undefined
      if (childId) links.push({ trip_id: t.id, child_id: childId })
    }
    if (page.length < PAGE_SIZE) break
  }

  for (let i = 0; i < links.length; i += INSERT_BATCH_SIZE) {
    const { error: linkError } = await supabase
      .from('trip_children')
      .upsert(links.slice(i, i + INSERT_BATCH_SIZE), {
        onConflict: 'trip_id,child_id',
        ignoreDuplicates: true,
      })

    if (linkError) {
      throw new Error(linkError.message)
    }
  }

  // Propagation de la tranche de distance — rattrapage intégré, comme
  // pour les enfants (0015) : chaque génération réaligne la tranche de
  // TOUS les trajets générés du foyer sur celle de leur activité.
  // Conducteurs et annulations non touchés.
  const bandGroups = new Map<DistanceBand, Array<string>>()
  for (const a of activities) {
    const group = bandGroups.get(a.distance_band) ?? []
    group.push(a.id)
    bandGroups.set(a.distance_band, group)
  }
  for (const [band, activityIds] of bandGroups) {
    const { error: bandError } = await supabase
      .from('trips')
      .update({ distance_band: band })
      .eq('household_id', householdId)
      .in('activity_id', activityIds)

    if (bandError) {
      throw new Error(bandError.message)
    }
  }

  // Propagation du lieu normalisé (0019) — même logique de rattrapage :
  // chaque génération réaligne le place_id des trajets générés sur celui
  // de leur activité (destination à l'aller, origine au retour).
  for (const a of activities) {
    if (!a.place_id) continue
    const [allerResult, retourResult] = await Promise.all([
      supabase
        .from('trips')
        .update({ destination_place_id: a.place_id })
        .eq('activity_id', a.id)
        .eq('direction', 'aller')
        .is('destination_place_id', null),
      supabase
        .from('trips')
        .update({ origin_place_id: a.place_id })
        .eq('activity_id', a.id)
        .eq('direction', 'retour')
        .is('origin_place_id', null),
    ])
    const placeError = allerResult.error ?? retourResult.error
    if (placeError) {
      throw new Error(placeError.message)
    }
  }

  // Appariement aller<->retour (0019, Doc v4 §4.1) : lien d'AFFICHAGE
  // entre les deux sens d'une même occurrence (même activité, même jour
  // Europe/Brussels). Aucune dépendance fonctionnelle. Idempotent : ne
  // touche que les trajets encore non liés.
  const { data: unlinked, error: unlinkedError } = await supabase
    .from('trips')
    .select('id, activity_id, direction, scheduled_at, linked_trip_id')
    .eq('household_id', householdId)
    .not('activity_id', 'is', null)
    .is('linked_trip_id', null)

  if (unlinkedError) {
    throw new Error(unlinkedError.message)
  }

  const byOccurrence = new Map<string, { aller?: string; retour?: string }>()
  for (const t of unlinked ?? []) {
    const wall = toBrusselsWallClock(new Date(t.scheduled_at))
    const key = `${t.activity_id}|${wall.y}-${wall.m}-${wall.d}`
    const pair = byOccurrence.get(key) ?? {}
    pair[t.direction as TripDirection] = t.id
    byOccurrence.set(key, pair)
  }

  const linkUpdates: Array<{ id: string; linked: string }> = []
  for (const pair of byOccurrence.values()) {
    if (pair.aller && pair.retour) {
      linkUpdates.push({ id: pair.aller, linked: pair.retour })
      linkUpdates.push({ id: pair.retour, linked: pair.aller })
    }
  }
  for (let i = 0; i < linkUpdates.length; i += 10) {
    const chunk = linkUpdates.slice(i, i + 10)
    const results = await Promise.all(
      chunk.map((u) =>
        supabase
          .from('trips')
          .update({ linked_trip_id: u.linked })
          .eq('id', u.id),
      ),
    )
    const linkError = results.find((r) => r.error)?.error
    if (linkError) {
      throw new Error(linkError.message)
    }
  }

  return { insertedCount }
}
