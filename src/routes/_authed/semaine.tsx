import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { Database } from '@/types/database'

type TripStatus = Database['public']['Enums']['trip_status']
type TripDirection = Database['public']['Enums']['trip_direction']

interface ChildOption {
  id: string
  first_name: string
}

interface Member {
  user_id: string
  users: { first_name: string; last_name: string | null } | null
}

interface ActivityRecord {
  id: string
  child_id: string
  label: string
  location_label: string | null
  rrule: string | null
  starts_at: string | null
  ends_at: string | null
}

interface Trip {
  id: string
  activity_id: string | null
  direction: TripDirection
  status: TripStatus
  driver_id: string | null
  scheduled_at: string
  origin_label: string | null
  destination_label: string | null
  activities: { label: string } | null
  trip_children: Array<{ child_id: string }>
}

const HOME_LABEL = 'Domicile'
const GENERATION_WEEKS = 4

// ---------------------------------------------------------------------
// Fuseau : les heures sont stockées en UTC mais saisies en heure locale
// belge. Toute l'arithmétique d'occurrences se fait en calendrier
// Europe/Brussels, jamais par addition de sept jours sur un timestamp
// UTC : un tennis à 16h reste à 16h après le changement d'heure.
// ---------------------------------------------------------------------

const BRUSSELS_TZ = 'Europe/Brussels'

interface WallClock {
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

function toBrusselsWallClock(date: Date): WallClock {
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
function fromBrusselsWallClock(w: WallClock): Date {
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
function addDays(w: WallClock, days: number): WallClock {
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
function weekdayOf(w: WallClock): number {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay()
}

function sameCalendarDay(a: WallClock, b: WallClock): boolean {
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

function parseRruleDays(rrule: string): Array<number> {
  const byday = rrule.split(';').find((part) => part.startsWith('BYDAY='))
  if (!byday) return []
  return byday
    .slice('BYDAY='.length)
    .split(',')
    .map((code) => RRULE_JS_DAYS[code])
    .filter((d) => d !== undefined)
}

// ---------------------------------------------------------------------

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const CHILD_COLORS = [
  'border-blue-300 bg-blue-50 text-blue-900',
  'border-green-300 bg-green-50 text-green-900',
  'border-amber-300 bg-amber-50 text-amber-900',
  'border-purple-300 bg-purple-50 text-purple-900',
  'border-pink-300 bg-pink-50 text-pink-900',
  'border-teal-300 bg-teal-50 text-teal-900',
]

const GRID_HOUR_START = 6
const GRID_HOUR_END = 22
const HOUR_HEIGHT_PX = 44
const CARD_HEIGHT_PX = 40

function formatTime(w: WallClock): string {
  return `${String(w.hh).padStart(2, '0')}:${String(w.mm).padStart(2, '0')}`
}

function memberName(member: Member): string {
  if (!member.users) return 'Profil non renseigné'
  return `${member.users.first_name}${member.users.last_name ? ` ${member.users.last_name}` : ''}`
}

export const Route = createFileRoute('/_authed/semaine')({
  component: SemainePage,
})

function SemainePage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [childrenList, setChildrenList] = useState<Array<ChildOption>>([])
  const [members, setMembers] = useState<Array<Member>>([])
  const [trips, setTrips] = useState<Array<Trip>>([])
  const [weekOffset, setWeekOffset] = useState(0)

  // Lundi (calendrier bruxellois) de la semaine affichée.
  const today = toBrusselsWallClock(new Date())
  const mondayOffset = (weekdayOf(today) + 6) % 7
  const weekStart = addDays(
    { ...today, hh: 0, mm: 0 },
    -mondayOffset + weekOffset * 7,
  )
  const weekEnd = addDays(weekStart, 7)

  const load = useCallback(async () => {
    if (!userId) return
    setLoadError(null)

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      setLoadError(membershipError.message)
      setLoading(false)
      return
    }

    if (!membership) {
      setHouseholdId(null)
      setLoading(false)
      return
    }

    const from = fromBrusselsWallClock(weekStart).toISOString()
    const to = fromBrusselsWallClock(weekEnd).toISOString()

    const [childrenResult, membersResult, tripsResult] = await Promise.all([
      supabase
        .from('children')
        .select('id, first_name')
        .eq('household_id', membership.household_id)
        .order('created_at'),
      supabase
        .from('household_members')
        .select('user_id, users(first_name, last_name)')
        .eq('household_id', membership.household_id)
        .order('joined_at'),
      supabase
        .from('trips')
        .select(
          'id, activity_id, direction, status, driver_id, scheduled_at, origin_label, destination_label, activities(label), trip_children(child_id)',
        )
        .eq('household_id', membership.household_id)
        .gte('scheduled_at', from)
        .lt('scheduled_at', to)
        .order('scheduled_at'),
    ])

    const firstError =
      childrenResult.error ?? membersResult.error ?? tripsResult.error
    if (
      firstError ||
      !childrenResult.data ||
      !membersResult.data ||
      !tripsResult.data
    ) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setHouseholdId(membership.household_id)
    setChildrenList(childrenResult.data)
    setMembers(membersResult.data)
    setTrips(tripsResult.data)
    setLoading(false)
    // weekStart dérive de weekOffset : la dépendance utile est weekOffset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekOffset])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Une erreur est survenue : {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Réessayer
          </button>
        </div>
      </main>
    )
  }

  if (!householdId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-gray-900">La semaine</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez d’abord créer ou rejoindre un foyer.
          </p>
          <Link
            to="/foyer"
            className="mt-6 block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Aller à mon foyer
          </Link>
        </div>
      </main>
    )
  }

  return (
    <WeekScreen
      householdId={householdId}
      childrenList={childrenList}
      members={members}
      trips={trips}
      weekStart={weekStart}
      onPreviousWeek={() => {
        setLoading(true)
        setWeekOffset((o) => o - 1)
      }}
      onNextWeek={() => {
        setLoading(true)
        setWeekOffset((o) => o + 1)
      }}
      onChanged={() => void load()}
    />
  )
}

function WeekScreen({
  householdId,
  childrenList,
  members,
  trips,
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onChanged,
}: {
  householdId: string
  childrenList: Array<ChildOption>
  members: Array<Member>
  trips: Array<Trip>
  weekStart: WallClock
  onPreviousWeek: () => void
  onNextWeek: () => void
  onChanged: () => void
}) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const childIndex = new Map(childrenList.map((c, i) => [c.id, i]))
  const childName = new Map(childrenList.map((c) => [c.id, c.first_name]))
  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null

  const weekStartDate = fromBrusselsWallClock(weekStart)
  const weekEndDate = fromBrusselsWallClock(addDays(weekStart, 6))
  const rangeLabel = `${weekStartDate.toLocaleDateString('fr-BE', {
    timeZone: BRUSSELS_TZ,
    day: 'numeric',
    month: 'long',
  })} – ${weekEndDate.toLocaleDateString('fr-BE', {
    timeZone: BRUSSELS_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`

  // -------------------------------------------------------------------
  // Génération des trajets : aller + retour par occurrence d'activité
  // sur les quatre prochaines semaines. Les trajets déjà existants
  // (même activité, même direction, même horaire) ne sont pas recréés :
  // les annulations et attributions survivent à une régénération.
  // -------------------------------------------------------------------
  async function generateTrips() {
    setGenerationError(null)
    setGenerationMessage(null)
    setGenerating(true)

    const now = new Date()
    const todayBxl = toBrusselsWallClock(now)
    const horizon = fromBrusselsWallClock(
      addDays({ ...todayBxl, hh: 0, mm: 0 }, GENERATION_WEEKS * 7),
    )

    const [activitiesResult, existingResult] = await Promise.all([
      supabase
        .from('activities')
        .select('id, child_id, label, location_label, rrule, starts_at, ends_at')
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
      setGenerationError(loadError?.message ?? 'Réponse inattendue du serveur')
      setGenerating(false)
      return
    }

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
    }

    const newTrips: Array<NewTrip> = []
    const childByKey = new Map<string, string>()

    function pushOccurrence(
      activity: ActivityRecord,
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
        { direction: 'aller', at: startsAt, origin: HOME_LABEL, destination: place },
        { direction: 'retour', at: endsAt, origin: place, destination: HOME_LABEL },
      ]
      for (const occ of occurrences) {
        const iso = occ.at.toISOString()
        const key = `${activity.id}|${occ.direction}|${iso}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        childByKey.set(key, activity.child_id)
        newTrips.push({
          household_id: householdId,
          activity_id: activity.id,
          direction: occ.direction,
          scheduled_at: iso,
          origin_label: occ.origin,
          destination_label: occ.destination,
        })
      }
    }

    for (const activity of activitiesResult.data) {
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

      for (let i = 0; i < GENERATION_WEEKS * 7; i++) {
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

    if (newTrips.length === 0) {
      setGenerationMessage('Tout est à jour : aucun nouveau trajet à créer.')
      setGenerating(false)
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('trips')
      .insert(newTrips)
      .select('id, activity_id, direction, scheduled_at')

    if (insertError || !inserted) {
      setGenerationError(insertError?.message ?? 'Réponse inattendue du serveur')
      setGenerating(false)
      return
    }

    const links = inserted.flatMap((trip) => {
      const key = `${trip.activity_id}|${trip.direction}|${new Date(trip.scheduled_at).toISOString()}`
      const childId = childByKey.get(key)
      return childId ? [{ trip_id: trip.id, child_id: childId }] : []
    })

    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from('trip_children')
        .insert(links)

      if (linkError) {
        setGenerationError(linkError.message)
        setGenerating(false)
        return
      }
    }

    setGenerationMessage(
      `${inserted.length} trajet${inserted.length > 1 ? 's' : ''} créé${inserted.length > 1 ? 's' : ''} sur les ${GENERATION_WEEKS} prochaines semaines.`,
    )
    setGenerating(false)
    onChanged()
  }

  // Trajets groupés par jour calendaire bruxellois.
  const dayColumns = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i)
    const dayTrips = trips.filter((t) =>
      sameCalendarDay(toBrusselsWallClock(new Date(t.scheduled_at)), day),
    )
    return { day, dayTrips }
  })

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-gray-900">La semaine</h1>
            <div className="flex gap-3">
              <Link
                to="/activites"
                className="text-sm text-blue-600 hover:underline"
              >
                Activités
              </Link>
              <Link
                to="/enfants"
                className="text-sm text-blue-600 hover:underline"
              >
                Enfants
              </Link>
              <Link
                to="/foyer"
                className="text-sm text-blue-600 hover:underline"
              >
                Mon foyer
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreviousWeek}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ← Semaine précédente
              </button>
              <button
                type="button"
                onClick={onNextWeek}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Semaine suivante →
              </button>
            </div>
            <p className="text-sm font-medium text-gray-700">{rangeLabel}</p>
            <button
              type="button"
              onClick={() => void generateTrips()}
              disabled={generating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating
                ? 'Génération…'
                : 'Générer les trajets (4 semaines)'}
            </button>
          </div>

          {generationMessage && (
            <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
              {generationMessage}
            </p>
          )}
          {generationError && (
            <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {generationError}
            </p>
          )}

          {childrenList.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {childrenList.map((child, i) => (
                <span
                  key={child.id}
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${CHILD_COLORS[i % CHILD_COLORS.length]}`}
                >
                  {child.first_name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-[56rem]">
              {/* Axe des heures */}
              <div
                className="relative w-12 shrink-0"
                style={{
                  height: (GRID_HOUR_END - GRID_HOUR_START) * HOUR_HEIGHT_PX + 24,
                }}
              >
                {Array.from(
                  { length: GRID_HOUR_END - GRID_HOUR_START },
                  (_, i) => (
                    <span
                      key={i}
                      className="absolute right-2 text-xs text-gray-400"
                      style={{ top: i * HOUR_HEIGHT_PX + 20 }}
                    >
                      {GRID_HOUR_START + i}h
                    </span>
                  ),
                )}
              </div>

              {dayColumns.map(({ day, dayTrips }, dayIdx) => {
                // Position par heure ; en cas de chevauchement, la carte
                // suivante est poussée juste sous la précédente.
                let previousBottom = -Infinity
                const positioned = dayTrips.map((trip) => {
                  const wall = toBrusselsWallClock(new Date(trip.scheduled_at))
                  const minutes =
                    (wall.hh - GRID_HOUR_START) * 60 + wall.mm
                  let top = Math.max(
                    0,
                    Math.min(
                      (minutes / 60) * HOUR_HEIGHT_PX,
                      (GRID_HOUR_END - GRID_HOUR_START) * HOUR_HEIGHT_PX -
                        CARD_HEIGHT_PX,
                    ),
                  )
                  if (top < previousBottom) top = previousBottom
                  previousBottom = top + CARD_HEIGHT_PX + 2
                  return { trip, wall, top }
                })

                return (
                  <div
                    key={dayIdx}
                    className="min-w-0 flex-1 border-l border-gray-100"
                  >
                    <p className="px-1 text-center text-xs font-medium text-gray-700">
                      {DAY_LABELS[dayIdx]}{' '}
                      <span className="text-gray-400">
                        {String(day.d).padStart(2, '0')}/
                        {String(day.m).padStart(2, '0')}
                      </span>
                    </p>
                    <div
                      className="relative mt-1"
                      style={{
                        height:
                          (GRID_HOUR_END - GRID_HOUR_START) * HOUR_HEIGHT_PX,
                      }}
                    >
                      {Array.from(
                        { length: GRID_HOUR_END - GRID_HOUR_START },
                        (_, i) => (
                          <div
                            key={i}
                            className="absolute inset-x-0 border-t border-gray-100"
                            style={{ top: i * HOUR_HEIGHT_PX }}
                          />
                        ),
                      )}

                      {positioned.map(({ trip, wall, top }) => {
                        const childId = trip.trip_children[0]?.child_id
                        const colorClass = trip.status === 'annule'
                          ? 'border-gray-300 bg-gray-100 text-gray-400 line-through'
                          : CHILD_COLORS[
                              (childIndex.get(childId ?? '') ?? 0) %
                                CHILD_COLORS.length
                            ]
                        const driver = members.find(
                          (m) => m.user_id === trip.driver_id,
                        )
                        return (
                          <button
                            key={trip.id}
                            type="button"
                            onClick={() =>
                              setSelectedTripId(
                                selectedTripId === trip.id ? null : trip.id,
                              )
                            }
                            className={`absolute inset-x-0.5 overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] leading-tight ${colorClass} ${
                              selectedTripId === trip.id
                                ? 'ring-2 ring-blue-500'
                                : ''
                            }`}
                            style={{ top, height: CARD_HEIGHT_PX }}
                          >
                            <span className="font-semibold">
                              {formatTime(wall)}
                            </span>{' '}
                            {trip.direction === 'aller' ? '→' : '←'}{' '}
                            {trip.activities?.label ?? 'Trajet'}
                            <br />
                            {childId ? childName.get(childId) : ''}
                            {trip.status !== 'annule' &&
                              (driver
                                ? ` · ${driver.users?.first_name ?? 'Conducteur'}`
                                : ' · À couvrir')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {selectedTrip && (
            <TripDetail
              key={selectedTrip.id}
              trip={selectedTrip}
              members={members}
              childName={
                selectedTrip.trip_children[0]
                  ? (childName.get(selectedTrip.trip_children[0].child_id) ??
                    null)
                  : null
              }
              onChanged={onChanged}
              onClose={() => setSelectedTripId(null)}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function TripDetail({
  trip,
  members,
  childName,
  onChanged,
  onClose,
}: {
  trip: Trip
  members: Array<Member>
  childName: string | null
  onChanged: () => void
  onClose: () => void
}) {
  const [driverId, setDriverId] = useState(trip.driver_id ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wall = toBrusselsWallClock(new Date(trip.scheduled_at))
  const dateLabel = new Date(trip.scheduled_at).toLocaleDateString('fr-BE', {
    timeZone: BRUSSELS_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Attribution HUMAINE uniquement : le conducteur est choisi ici par un
  // membre du foyer, jamais assigné automatiquement.
  async function saveDriver(newDriverId: string) {
    setError(null)
    setSaving(true)
    setDriverId(newDriverId)

    const { error: updateError } = await supabase
      .from('trips')
      .update({
        driver_id: newDriverId === '' ? null : newDriverId,
        status: newDriverId === '' ? 'non_couvert' : 'couvert',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onChanged()
  }

  // Exception ponctuelle : on annule CE trajet, l'activité récurrente
  // n'est pas touchée. Le trajet annulé n'est pas recréé par la
  // génération (même clé activité/direction/horaire).
  async function setStatus(status: TripStatus) {
    setError(null)
    setSaving(true)

    const { error: updateError } = await supabase
      .from('trips')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', trip.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setConfirmingCancel(false)
    onChanged()
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {trip.activities?.label ?? 'Trajet'} —{' '}
            {trip.direction === 'aller' ? 'aller' : 'retour'}
            {trip.status === 'annule' && ' (annulé)'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {dateLabel} à {formatTime(wall)}
            {childName && ` · ${childName}`}
          </p>
          <p className="text-sm text-gray-500">
            {trip.origin_label} → {trip.destination_label}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Fermer
        </button>
      </div>

      {trip.status !== 'annule' && (
        <div className="mt-3">
          <label
            htmlFor={`driver-${trip.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Conducteur
          </label>
          <select
            id={`driver-${trip.id}`}
            value={driverId}
            disabled={saving}
            onChange={(e) => void saveDriver(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Personne pour le moment (à couvrir)</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {memberName(member)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {trip.status === 'annule' ? (
          <button
            type="button"
            onClick={() =>
              void setStatus(trip.driver_id ? 'couvert' : 'non_couvert')
            }
            disabled={saving}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Rétablir ce trajet
          </button>
        ) : confirmingCancel ? (
          <>
            <span className="text-sm text-red-800">
              Annuler ce trajet uniquement ? L’activité n’est pas modifiée.
            </span>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Non
            </button>
            <button
              type="button"
              onClick={() => void setStatus('annule')}
              disabled={saving}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Oui, annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Annuler ce trajet
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </div>
  )
}
