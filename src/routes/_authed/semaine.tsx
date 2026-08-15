import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  BRUSSELS_TZ,
  DEFAULT_HORIZON_DAYS,
  HOME_LABEL,
  HORIZONS,
  addDays,
  fromBrusselsWallClock,
  generateTripsForHousehold,
  sameCalendarDay,
  toBrusselsWallClock,
  weekdayOf,
} from '@/lib/trips'
import { PlaceField } from '@/components/PlaceField'

import type { FormEvent } from 'react'
import type { PlaceValue } from '@/components/PlaceField'
import type { WallClock } from '@/lib/trips'
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

interface Trip {
  id: string
  activity_id: string | null
  direction: TripDirection
  status: TripStatus
  driver_id: string | null
  scheduled_at: string
  origin_label: string | null
  destination_label: string | null
  hub_id: string | null
  published_to_hub: boolean
  seats_total: number | null
  seats_available: number | null
  meeting_point_id: string | null
  linked_trip_id: string | null
  has_children: boolean
  activities: { label: string } | null
  trip_children: Array<{ child_id: string }>
}

interface HubOption {
  id: string
  name: string
}

// ---------------------------------------------------------------------

const DAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]

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
  const [myHubs, setMyHubs] = useState<Array<HubOption>>([])
  const [trips, setTrips] = useState<Array<Trip>>([])
  // Prochain trajet du foyer, toutes semaines confondues : sert à
  // guider vers la bonne semaine quand la semaine visible est vide.
  const [nextTripAt, setNextTripAt] = useState<string | null>(null)
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

    const [
      childrenResult,
      membersResult,
      hubsResult,
      tripsResult,
      nextTripResult,
    ] = await Promise.all([
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
        .from('hub_members')
        .select('hub_id, hubs(id, name)')
        .eq('user_id', userId)
        .not('validated_at', 'is', null),
      supabase
        .from('trips')
        .select(
          'id, activity_id, direction, status, driver_id, scheduled_at, origin_label, destination_label, hub_id, published_to_hub, seats_total, seats_available, meeting_point_id, linked_trip_id, has_children, activities(label), trip_children(child_id)',
        )
        .eq('household_id', membership.household_id)
        .gte('scheduled_at', from)
        .lt('scheduled_at', to)
        .order('scheduled_at'),
      supabase
        .from('trips')
        .select('scheduled_at')
        .eq('household_id', membership.household_id)
        .neq('status', 'annule')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(1)
        .maybeSingle(),
    ])

    const firstError =
      childrenResult.error ??
      membersResult.error ??
      hubsResult.error ??
      tripsResult.error
    if (
      firstError ||
      !childrenResult.data ||
      !membersResult.data ||
      !hubsResult.data ||
      !tripsResult.data
    ) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setHouseholdId(membership.household_id)
    setChildrenList(childrenResult.data)
    setMembers(membersResult.data)
    setMyHubs(hubsResult.data.flatMap((m) => (m.hubs ? [m.hubs] : [])))
    setTrips(tripsResult.data)
    setNextTripAt(nextTripResult.data?.scheduled_at ?? null)
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
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm island-shell rounded-3xl p-8">
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Une erreur est survenue : {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="mt-4 w-full btn-ghost px-4 py-2 text-sm"
          >
            Réessayer
          </button>
        </div>
      </main>
    )
  }

  if (!householdId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">La semaine</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez d’abord créer ou rejoindre un foyer.
          </p>
          <Link
            to="/foyer"
            className="mt-6 block w-full btn-lagoon px-4 py-2.5 text-center text-sm font-semibold"
          >
            Aller à mon foyer
          </Link>
        </div>
      </main>
    )
  }

  // Saute à la semaine (calendrier bruxellois) où tombe la date visée.
  function goToWeekOf(iso: string) {
    const target = toBrusselsWallClock(new Date(iso))
    const targetMonday = addDays(
      { ...target, hh: 0, mm: 0 },
      -((weekdayOf(target) + 6) % 7),
    )
    const currentMonday = addDays({ ...today, hh: 0, mm: 0 }, -mondayOffset)
    const diffDays = Math.round(
      (Date.UTC(targetMonday.y, targetMonday.m - 1, targetMonday.d) -
        Date.UTC(currentMonday.y, currentMonday.m - 1, currentMonday.d)) /
        86_400_000,
    )
    setLoading(true)
    setWeekOffset(Math.round(diffDays / 7))
  }

  return (
    <WeekScreen
      userId={userId}
      householdId={householdId}
      childrenList={childrenList}
      members={members}
      myHubs={myHubs}
      trips={trips}
      nextTripAt={nextTripAt}
      onGoToNextTrip={() => {
        if (nextTripAt) goToWeekOf(nextTripAt)
      }}
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
      onTripPatched={(tripId, patch) =>
        setTrips((current) =>
          current.map((t) => (t.id === tripId ? { ...t, ...patch } : t)),
        )
      }
    />
  )
}

function WeekScreen({
  userId,
  householdId,
  childrenList,
  members,
  myHubs,
  trips,
  nextTripAt,
  onGoToNextTrip,
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onChanged,
  onTripPatched,
}: {
  userId: string | null
  householdId: string
  childrenList: Array<ChildOption>
  members: Array<Member>
  myHubs: Array<HubOption>
  trips: Array<Trip>
  nextTripAt: string | null
  onGoToNextTrip: () => void
  weekStart: WallClock
  onPreviousWeek: () => void
  onNextWeek: () => void
  onChanged: () => void
  onTripPatched: (tripId: string, patch: Partial<Trip>) => void
}) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [horizonDays, setHorizonDays] = useState(DEFAULT_HORIZON_DAYS)
  const [generationProgress, setGenerationProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [generationMessage, setGenerationMessage] = useState<string | null>(
    null,
  )
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [showPassage, setShowPassage] = useState(false)

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
  // sur l'horizon choisi. Idempotente à deux niveaux : dédup par clé
  // (activité, direction, horaire) côté code, et ON CONFLICT DO NOTHING
  // sur l'index unique trips_activity_occurrence_unique (0007) côté
  // données. Les trajets existants ne sont JAMAIS écrasés : conducteurs
  // attribués et occurrences annulées survivent à toute régénération,
  // un horizon plus long n'ajoute que les occurrences manquantes.
  // -------------------------------------------------------------------
  async function generateTrips() {
    setGenerationError(null)
    setGenerationMessage(null)
    setGenerationProgress(null)
    setGenerating(true)

    try {
      const { insertedCount } = await generateTripsForHousehold(
        householdId,
        horizonDays,
        (done, total) => setGenerationProgress({ done, total }),
      )
      const horizonLabel =
        HORIZONS.find((h) => h.days === horizonDays)?.label ??
        `${horizonDays} jours`
      setGenerationMessage(
        insertedCount === 0
          ? 'Tout est à jour : aucun nouveau trajet à créer. Enfants rattachés vérifiés sur les trajets existants.'
          : `${insertedCount} trajet${insertedCount > 1 ? 's' : ''} créé${insertedCount > 1 ? 's' : ''} sur ${horizonLabel}, enfants rattachés.`,
      )
      onChanged()
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : 'Réponse inattendue du serveur',
      )
    } finally {
      setGenerating(false)
      setGenerationProgress(null)
    }
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
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="island-shell rounded-3xl p-6">
          <h1 className="display-title text-2xl font-semibold">La semaine</h1>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreviousWeek}
                className="btn-ghost px-3.5 py-1.5 text-sm"
              >
                ← Semaine précédente
              </button>
              <button
                type="button"
                onClick={onNextWeek}
                className="btn-ghost px-3.5 py-1.5 text-sm"
              >
                Semaine suivante →
              </button>
            </div>
            <p className="text-sm font-medium text-gray-700">{rangeLabel}</p>
            <div className="flex items-center gap-2">
              <label htmlFor="generation-horizon" className="sr-only">
                Horizon de génération
              </label>
              <select
                id="generation-horizon"
                value={horizonDays}
                disabled={generating}
                onChange={(e) => setHorizonDays(Number(e.target.value))}
                className="field-lagoon px-3 py-2 text-sm"
              >
                {HORIZONS.map((h) => (
                  <option key={h.days} value={h.days}>
                    {h.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void generateTrips()}
                disabled={generating}
                className="btn-lagoon px-4 py-2.5 text-sm font-semibold"
              >
                {generating
                  ? generationProgress
                    ? `Génération… ${generationProgress.done}/${generationProgress.total}`
                    : 'Génération…'
                  : 'Générer les trajets'}
              </button>
              {myHubs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassage(true)}
                  className="btn-ghost px-4 py-2.5 text-sm"
                >
                  Je passe par là
                </button>
              )}
            </div>
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

          {/* Semaine visible vide alors que des trajets existent plus
              loin : guider vers la bonne semaine plutôt que laisser une
              grille muette. */}
          {trips.length === 0 && nextTripAt && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                Aucun trajet cette semaine. Vos prochains trajets commencent le{' '}
                {new Date(nextTripAt).toLocaleDateString('fr-BE', {
                  timeZone: BRUSSELS_TZ,
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                .
              </p>
              <button
                type="button"
                onClick={onGoToNextTrip}
                className="btn-lagoon px-3.5 py-1.5 text-sm font-semibold"
              >
                Afficher cette semaine-là
              </button>
            </div>
          )}

          {/* Aucun trajet nulle part : expliquer quoi faire. */}
          {trips.length === 0 && !nextTripAt && (
            <div className="mt-3 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                Aucun trajet pour le moment.
              </p>
              <p className="mt-1">
                Créez une activité pour un enfant : ses trajets aller-retour
                apparaîtront ici automatiquement, jusqu’à trois mois à l’avance.
              </p>
              <Link
                to="/activites"
                className="mt-2 inline-block btn-lagoon px-3.5 py-1.5 text-sm font-semibold"
              >
                Créer une activité
              </Link>
            </div>
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
                  height:
                    (GRID_HOUR_END - GRID_HOUR_START) * HOUR_HEIGHT_PX + 24,
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
                  const minutes = (wall.hh - GRID_HOUR_START) * 60 + wall.mm
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
                        const colorClass =
                          trip.status === 'annule'
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
              userId={userId}
              members={members}
              myHubs={myHubs}
              childName={
                selectedTrip.trip_children[0]
                  ? (childName.get(selectedTrip.trip_children[0].child_id) ??
                    null)
                  : null
              }
              onChanged={onChanged}
              onPatched={(patch) => onTripPatched(selectedTrip.id, patch)}
              onClose={() => setSelectedTripId(null)}
            />
          )}

          {showPassage && userId && (
            <PassageModal
              userId={userId}
              householdId={householdId}
              myHubs={myHubs}
              onCreated={() => {
                setShowPassage(false)
                onChanged()
              }}
              onClose={() => setShowPassage(false)}
            />
          )}
        </div>
      </div>
    </main>
  )
}

// « Je passe par là » (Doc v4 §4.1) : un parent signale un passage devant
// un lieu du hub, sans enfant à bord (has_children = false). Le trajet
// est publié couvert_ouvert : les autres familles peuvent demander une
// place pour leurs enfants. Vocabulaire UI centré sur les enfants.
function PassageModal({
  userId,
  householdId,
  myHubs,
  onCreated,
  onClose,
}: {
  userId: string
  householdId: string
  myHubs: Array<HubOption>
  onCreated: () => void
  onClose: () => void
}) {
  const [hubId, setHubId] = useState(myHubs[0].id)
  const [place, setPlace] = useState<PlaceValue>({ placeId: null, label: '' })
  const [direction, setDirection] = useState<TripDirection>('aller')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [seats, setSeats] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (place.label.trim() === '') {
      setError('Indiquez le lieu devant lequel vous passez.')
      return
    }

    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    const scheduledAt = fromBrusselsWallClock({ y, m, d, hh, mm })
    if (scheduledAt.getTime() <= Date.now()) {
      setError('Choisissez un moment à venir.')
      return
    }

    const placeLabel = place.label.trim()
    setSubmitting(true)
    const { error: insertError } = await supabase.from('trips').insert({
      household_id: householdId,
      activity_id: null,
      hub_id: hubId,
      direction,
      status: 'couvert_ouvert',
      driver_id: userId,
      scheduled_at: scheduledAt.toISOString(),
      origin_label: direction === 'aller' ? HOME_LABEL : placeLabel,
      destination_label: direction === 'aller' ? placeLabel : HOME_LABEL,
      origin_place_id: direction === 'retour' ? place.placeId : null,
      destination_place_id: direction === 'aller' ? place.placeId : null,
      has_children: false,
      published_to_hub: true,
      seats_total: seats,
      seats_available: seats,
    })
    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }
    onCreated()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Signaler un passage"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto island-shell rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-gray-900">Je passe par là</p>
        <p className="mt-1 text-sm text-gray-600">
          Vous passez devant un lieu du hub ? Proposez des places : des
          enfants d'autres familles peuvent en profiter.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="passage-hub"
              className="block text-sm font-medium text-gray-700"
            >
              Hub
            </label>
            <select
              id="passage-hub"
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            >
              {myHubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="passage-place"
              className="block text-sm font-medium text-gray-700"
            >
              Lieu
            </label>
            <PlaceField
              id="passage-place"
              householdId={householdId}
              value={place}
              onChange={setPlace}
              placeholder="Par exemple : école communale d'Alsemberg"
            />
          </div>

          <div>
            <label
              htmlFor="passage-direction"
              className="block text-sm font-medium text-gray-700"
            >
              Sens du passage
            </label>
            <select
              id="passage-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as TripDirection)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            >
              <option value="aller">Vers le lieu (aller)</option>
              <option value="retour">Depuis le lieu (retour)</option>
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="passage-date"
                className="block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="passage-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="passage-time"
                className="block text-sm font-medium text-gray-700"
              >
                Heure
              </label>
              <input
                id="passage-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="passage-seats"
              className="block text-sm font-medium text-gray-700"
            >
              Places offertes aux autres familles
            </label>
            <select
              id="passage-seats"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-ghost px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-lagoon px-4 py-2.5 text-sm font-semibold"
            >
              {submitting ? 'Publication…' : 'Publier au hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TripDetail({
  trip,
  userId,
  members,
  myHubs,
  childName,
  onChanged,
  onPatched,
  onClose,
}: {
  trip: Trip
  userId: string | null
  members: Array<Member>
  myHubs: Array<HubOption>
  childName: string | null
  onChanged: () => void
  onPatched: (patch: Partial<Trip>) => void
  onClose: () => void
}) {
  const [driverId, setDriverId] = useState(trip.driver_id ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
    // Mise à jour immédiate de la grille, refetch en arrière-plan.
    onPatched({
      driver_id: newDriverId === '' ? null : newDriverId,
      status: newDriverId === '' ? 'non_couvert' : 'couvert',
    })
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
    onPatched({ status })
    onChanged()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Détail du trajet"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto island-shell rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
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
            {trip.linked_trip_id && (
              <p className="mt-1 text-xs" style={{ color: 'var(--lagoon-deep)' }}>
                Aller-retour lié — l'autre sens existe dans la semaine, il
                se couvre indépendamment.
              </p>
            )}
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
              className="mt-1 w-full max-w-xs field-lagoon px-3 py-2 text-sm"
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

        {trip.status !== 'annule' && (
          <PublishSection
            trip={trip}
            myHubs={myHubs}
            onPatched={onPatched}
            onChanged={onChanged}
          />
        )}

        {trip.status !== 'annule' && userId && trip.driver_id === userId && (
          <DropoffSection trip={trip} />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {trip.status === 'annule' ? (
            <button
              type="button"
              onClick={() =>
                void setStatus(trip.driver_id ? 'couvert' : 'non_couvert')
              }
              disabled={saving}
              className="btn-ghost px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
                className="btn-ghost px-3.5 py-1.5 text-sm"
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
    </div>
  )
}

// ---------------------------------------------------------------------
// Publication vers un hub (interdit n°9 : côté hub, ce trajet ne sera
// lu que via hub_trips_view — jamais private_note, prénom d'enfant ou
// contact). La dépublication ramène le trajet dans le cercle intime.
// ---------------------------------------------------------------------
function PublishSection({
  trip,
  myHubs,
  onPatched,
  onChanged,
}: {
  trip: Trip
  myHubs: Array<HubOption>
  onPatched: (patch: Partial<Trip>) => void
  onChanged: () => void
}) {
  const [hubId, setHubId] = useState(myHubs[0]?.id ?? '')
  const [seats, setSeats] = useState('2')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsCount, setNeedsCount] = useState<number | null>(null)
  const [meetingPoints, setMeetingPoints] = useState<
    Array<{ id: string; label: string; is_default: boolean }>
  >([])
  const [meetingPointId, setMeetingPointId] = useState('')

  const publishedHub = myHubs.find((h) => h.id === trip.hub_id)

  // Points de rendez-vous du hub visé (Doc1 §12.1) : le conducteur peut
  // en choisir un à la publication. Préselection du point par défaut.
  const targetHubId = trip.published_to_hub ? trip.hub_id : hubId
  useEffect(() => {
    if (!targetHubId) {
      setMeetingPoints([])
      return
    }
    let cancelled = false
    void supabase
      .from('meeting_points')
      .select('id, label, is_default')
      .eq('hub_id', targetHubId)
      .order('created_at')
      .then(({ data }) => {
        if (cancelled || !data) return
        setMeetingPoints(data)
        setMeetingPointId(
          trip.meeting_point_id ?? data.find((mp) => mp.is_default)?.id ?? '',
        )
      })
    return () => {
      cancelled = true
    }
  }, [targetHubId, trip.meeting_point_id])

  // Combien de familles du hub ont un besoin correspondant ? Un COMPTE,
  // jamais une liste ni un nom (fonction 0012). Purement informatif :
  // rien n'est réservé, chaque famille décide de demander.
  useEffect(() => {
    if (!trip.published_to_hub) {
      setNeedsCount(null)
      return
    }
    let cancelled = false
    void supabase
      .rpc('hub_trip_matching_needs_count', { p_trip: trip.id })
      .then(({ data }) => {
        if (!cancelled && typeof data === 'number') setNeedsCount(data)
      })
    return () => {
      cancelled = true
    }
  }, [trip.id, trip.published_to_hub])

  async function publish() {
    setError(null)
    const seatCount = Number(seats)
    if (!hubId || !Number.isInteger(seatCount) || seatCount < 1) {
      setError('Choisissez un hub et un nombre de places valide.')
      return
    }
    setSubmitting(true)

    const patch = {
      hub_id: hubId,
      published_to_hub: true,
      seats_total: seatCount,
      seats_available: seatCount,
      meeting_point_id: meetingPointId === '' ? null : meetingPointId,
      status: 'couvert_ouvert' as TripStatus,
    }
    const { error: updateError } = await supabase
      .from('trips')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', trip.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onPatched(patch)
    onChanged()
  }

  async function unpublish() {
    setError(null)
    setSubmitting(true)

    const patch = {
      hub_id: null,
      published_to_hub: false,
      seats_total: null,
      seats_available: null,
      meeting_point_id: null,
      status: (trip.driver_id ? 'couvert' : 'non_couvert') as TripStatus,
    }
    const { error: updateError } = await supabase
      .from('trips')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', trip.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onPatched(patch)
    onChanged()
  }

  if (myHubs.length === 0) return null

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="text-sm font-medium text-gray-700">Partage au hub</p>

      {trip.published_to_hub ? (
        <div className="mt-2">
          <p className="text-sm text-gray-600">
            Publié vers « {publishedHub?.name ?? 'un hub'} » —{' '}
            {trip.seats_available ?? 0} place
            {(trip.seats_available ?? 0) > 1 ? 's' : ''} restante
            {(trip.seats_available ?? 0) > 1 ? 's' : ''} sur les{' '}
            {trip.seats_total ?? 0} offertes aux autres familles.
          </p>
          {trip.meeting_point_id && (
            <p className="mt-1 text-sm text-gray-600">
              📍 Rendez-vous :{' '}
              {meetingPoints.find((mp) => mp.id === trip.meeting_point_id)
                ?.label ?? 'point de rendez-vous du hub'}
            </p>
          )}
          {needsCount !== null && needsCount > 0 && (
            <p className="mt-1 text-sm text-blue-700">
              {needsCount} famille{needsCount > 1 ? 's' : ''} du hub{' '}
              {needsCount > 1 ? 'ont' : 'a'} un besoin proche de ce trajet (même
              jour, horaire et lieu similaires). Elles ne sont pas nommées :
              chacune décide d’envoyer une demande.
            </p>
          )}
          <button
            type="button"
            onClick={() => void unpublish()}
            disabled={submitting}
            className="mt-2 btn-ghost px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Dépublication…' : 'Dépublier du hub'}
          </button>
        </div>
      ) : !trip.driver_id ? (
        <p className="mt-2 text-sm text-gray-500">
          Désignez d’abord un conducteur pour pouvoir proposer des places au
          hub.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor={`publish-hub-${trip.id}`}
              className="block text-sm font-medium text-gray-700"
            >
              Hub
            </label>
            <select
              id={`publish-hub-${trip.id}`}
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="mt-1 field-lagoon px-3 py-2 text-sm"
            >
              {myHubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name}
                </option>
              ))}
            </select>
          </div>
          {meetingPoints.length > 0 && (
            <div>
              <label
                htmlFor={`publish-mp-${trip.id}`}
                className="block text-sm font-medium text-gray-700"
              >
                Point de rendez-vous
              </label>
              <select
                id={`publish-mp-${trip.id}`}
                value={meetingPointId}
                onChange={(e) => setMeetingPointId(e.target.value)}
                className="mt-1 field-lagoon px-3 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {meetingPoints.map((mp) => (
                  <option key={mp.id} value={mp.id}>
                    {mp.label}
                    {mp.is_default ? ' (par défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label
              htmlFor={`publish-seats-${trip.id}`}
              className="block text-sm font-medium text-gray-700"
            >
              Places offertes aux autres familles
            </label>
            <input
              id={`publish-seats-${trip.id}`}
              type="number"
              min={1}
              max={8}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="mt-1 w-24 field-lagoon px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={submitting}
            className="btn-lagoon px-4 py-2.5 text-sm font-semibold"
          >
            {submitting ? 'Publication…' : 'Publier'}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Bulletin de trajet (Doc1 §12.2) : le CONDUCTEUR confirme le dépôt de
// chaque enfant à bord. La liste nominative vient du RPC
// trip_children_aboard, réservé au conducteur — seul chemin par lequel
// le prénom d'un enfant d'un autre foyer lui parvient. Le parent de
// l'enfant voit la confirmation de son côté (/demandes), personne
// d'autre (cloisonnement §12.4).
// ---------------------------------------------------------------------
interface AboardChild {
  child_id: string
  first_name: string
  is_own_child: boolean
}

interface DropoffRow {
  child_id: string
  confirmed_at: string
}

function DropoffSection({ trip }: { trip: Trip }) {
  const [aboard, setAboard] = useState<Array<AboardChild>>([])
  const [confirmations, setConfirmations] = useState<Array<DropoffRow>>([])
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyChildId, setBusyChildId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [aboardResult, confirmationsResult, delayResult] = await Promise.all([
      supabase.rpc('trip_children_aboard', { p_trip: trip.id }),
      supabase
        .from('trip_dropoff_confirmations')
        .select('child_id, confirmed_at')
        .eq('trip_id', trip.id),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'dropoff_reminder_minutes')
        .maybeSingle(),
    ])

    const firstError = aboardResult.error ?? confirmationsResult.error
    if (firstError || !aboardResult.data || !confirmationsResult.data) {
      setError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setAboard(aboardResult.data)
    setConfirmations(confirmationsResult.data)
    // Le délai de relance est un paramètre app_settings (Doc1 §12.2),
    // jamais une constante dans le code.
    setReminderMinutes(delayResult.data ? Number(delayResult.data.value) : null)
    setLoading(false)
  }, [trip.id])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDropoff(childId: string) {
    setError(null)
    setBusyChildId(childId)

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      setError('Session expirée, reconnectez-vous.')
      setBusyChildId(null)
      return
    }

    const { error: insertError } = await supabase
      .from('trip_dropoff_confirmations')
      .insert({ trip_id: trip.id, child_id: childId, confirmed_by: uid })

    setBusyChildId(null)
    if (insertError && insertError.code !== '23505') {
      setError(insertError.message)
      return
    }
    // 23505 : déjà confirmé (double clic) — l'état réel est rechargé.
    void load()
  }

  async function undoDropoff(childId: string) {
    setError(null)
    setBusyChildId(childId)

    const { error: deleteError } = await supabase
      .from('trip_dropoff_confirmations')
      .delete()
      .eq('trip_id', trip.id)
      .eq('child_id', childId)

    setBusyChildId(null)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    void load()
  }

  if (loading) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-500">Chargement du bulletin…</p>
      </div>
    )
  }

  if (aboard.length === 0) {
    return null
  }

  const confirmedByChild = new Map(
    confirmations.map((c) => [c.child_id, c.confirmed_at]),
  )
  const unconfirmed = aboard.filter((c) => !confirmedByChild.has(c.child_id))
  const scheduledMs = new Date(trip.scheduled_at).getTime()
  const overdue =
    reminderMinutes !== null &&
    unconfirmed.length > 0 &&
    Date.now() > scheduledMs + reminderMinutes * 60_000

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="text-sm font-medium text-gray-700">Bulletin de trajet</p>
      <p className="mt-1 text-xs text-gray-500">
        Confirmez le dépôt de chaque enfant à bord. Le parent de l’enfant voit
        la confirmation de son côté.
      </p>

      {overdue && (
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          L’heure du trajet est passée depuis plus de {reminderMinutes} minutes
          : merci de confirmer le dépôt des enfants.
        </p>
      )}

      <ul className="mt-2 divide-y divide-gray-100">
        {aboard.map((child) => {
          const confirmedAt = confirmedByChild.get(child.child_id)
          return (
            <li
              key={child.child_id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="text-sm text-gray-900">{child.first_name}</span>
              {confirmedAt ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-green-700">
                    Déposé à{' '}
                    {formatTime(toBrusselsWallClock(new Date(confirmedAt)))}
                  </span>
                  <button
                    type="button"
                    onClick={() => void undoDropoff(child.child_id)}
                    disabled={busyChildId === child.child_id}
                    className="text-xs text-gray-400 underline hover:text-gray-600 disabled:cursor-not-allowed"
                  >
                    Annuler
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void confirmDropoff(child.child_id)}
                  disabled={busyChildId === child.child_id}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Confirmer le dépôt
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </div>
  )
}
