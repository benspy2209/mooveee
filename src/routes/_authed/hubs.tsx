import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchConciergeSettings, hubSoloIsStagnant } from '@/lib/concierge'

import type { ConciergeSettings } from '@/lib/concierge'
import type { FormEvent } from 'react'
import type { Database } from '@/types/database'

type HubKind = Database['public']['Enums']['hub_kind']
type HubStatus = Database['public']['Enums']['hub_status']

const KIND_LABELS: Record<HubKind, string> = {
  ecole: 'École',
  club: 'Club',
  quartier: 'Quartier',
  conservatoire: 'Conservatoire',
  autre: 'Autre',
}

const STATUS_LABELS: Record<HubStatus, string> = {
  solo: 'En démarrage',
  active: 'Actif',
  structured: 'Structuré',
}

// ---------------------------------------------------------------------
// Pacte de Hub — version 1.0, texte en dur pour l'instant.
// L'acceptation est enregistrée dans hub_pact_acceptances avec la
// version : un membre qui n'a pas accepté la version courante ne peut
// pas accéder au hub.
// ---------------------------------------------------------------------
const PACT_VERSION = '1.0'
const PACT_TEXT = [
  'Je rejoins ce hub pour organiser des trajets d’enfants dans un esprit d’entraide entre familles, sans contrepartie financière.',
  'Je m’engage à respecter les horaires convenus, à prévenir au plus tôt en cas d’imprévu, et à ne confier un enfant qu’aux adultes convenus.',
  'Je respecte les règles de sécurité en voiture : sièges et rehausseurs adaptés, ceinture pour chacun.',
  'Ce que j’apprends des familles du hub reste dans le hub : je ne partage ni coordonnées, ni informations sur les enfants à l’extérieur.',
  'Je préviens un administrateur du hub en cas de difficulté ou de situation anormale impliquant un enfant.',
]

interface Membership {
  id: string
  hub_id: string
  is_admin: boolean
  validated_at: string | null
  hubs: {
    id: string
    name: string
    kind: HubKind
    status: HubStatus
    municipality: string
  } | null
}

interface Acceptance {
  hub_id: string
  pact_version: string
}

// Profils côté hub : UNIQUEMENT via le RPC hub_member_profiles (0008).
// Jamais de lecture directe de la table users dans un contexte hub :
// une policy RLS filtre les lignes, pas les colonnes.
interface HubMemberProfile {
  user_id: string
  first_name: string
  last_name: string | null
  is_admin: boolean
  validated_at: string | null
}

// Ligne de hub_trips_view : le SEUL chemin de lecture des trajets côté
// hub. Ni note privée, ni prénom d'enfant, ni contact — children_count
// est un compte, pas une liste.
interface HubTripRow {
  id: string | null
  direction: Database['public']['Enums']['trip_direction'] | null
  status: Database['public']['Enums']['trip_status'] | null
  scheduled_at: string | null
  origin_label: string | null
  destination_label: string | null
  meeting_point_id: string | null
  seats_available: number | null
  driver_id: string | null
  driver_first_name: string | null
  children_count: number | null
}

// Meeting Points (Doc1 §12.1) : des lieux publics de rendez-vous, pas
// des domiciles. Photos dans le bucket privé meeting-point-photos,
// chemin {hub_id}/{meeting_point_id}.{ext}, URL signée de courte durée.
interface MeetingPoint {
  id: string
  label: string
  description: string | null
  photo_url: string | null
  is_default: boolean
}

const MP_PHOTO_BUCKET = 'meeting-point-photos'
const MP_SIGNED_URL_TTL_SECONDS = 3600

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-BE', {
    timeZone: 'Europe/Brussels',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------
// Matching « Macarons » sans distance (Doc1 §7 partiel) : les lieux
// sont des libellés texte, la dimension distance est inapplicable.
// Dimensions retenues : même jour, fenêtre horaire, correspondance de
// libellé, même hub. Le matching PROPOSE, il n'assigne jamais
// (interdit n°4) : aucune demande créée, aucune place réservée.
// Fenêtre alignée sur hub_trip_matching_needs_count (0012).
// ---------------------------------------------------------------------
const MATCH_WINDOW_MINUTES = 90

function normalizeLabel(value: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelMatch(
  a: string | null,
  b: string | null,
): 'identique' | 'similaire' | null {
  const na = normalizeLabel(a)
  const nb = normalizeLabel(b)
  if (!na || !nb) return null
  if (na === nb) return 'identique'
  if (na.includes(nb) || nb.includes(na)) return 'similaire'
  const ta = new Set(na.split(' ').filter((w) => w.length > 2))
  const tb = new Set(nb.split(' ').filter((w) => w.length > 2))
  const overlap = [...ta].filter((w) => tb.has(w)).length
  if (overlap > 0 && overlap >= Math.min(ta.size, tb.size) / 2) {
    return 'similaire'
  }
  return null
}

function brusselsDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'Europe/Brussels',
  })
}

function brusselsTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', {
    timeZone: 'Europe/Brussels',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Trajet non couvert de MON foyer : le besoin auquel une suggestion
// répond. Lecture directe de trips légitime (cercle intime).
interface MyNeed {
  id: string
  direction: Database['public']['Enums']['trip_direction']
  scheduled_at: string
  origin_label: string | null
  destination_label: string | null
}

interface Suggestion {
  trip: HubTripRow
  need: MyNeed
  delta: number
  match: 'identique' | 'similaire'
}

function compareSuggestions(a: Suggestion, b: Suggestion): number {
  // 1. Correspondance de lieu (identique avant similaire),
  // 2. écart de temps croissant.
  // Signal secondaire Mooves (Note d'arbitrage §5.5) : il ne peut que
  // départager deux suggestions COMPARABLES, jamais filtrer ni masquer.
  // Pour un même demandeur, son niveau de contribution est constant :
  // à compatibilité égale l'ordre reste chronologique. Aucun chiffre
  // de Mooves n'apparaît nulle part.
  if (a.match !== b.match) return a.match === 'identique' ? -1 : 1
  if (a.delta !== b.delta) return a.delta - b.delta
  return (a.trip.scheduled_at ?? '').localeCompare(b.trip.scheduled_at ?? '')
}

// Trois points d'explication, pas de score chiffré affiché.
function suggestionReasons(s: Suggestion): Array<string> {
  const placeTrip =
    s.trip.direction === 'aller'
      ? s.trip.destination_label
      : s.trip.origin_label
  const placeNeed =
    s.trip.direction === 'aller'
      ? s.need.destination_label
      : s.need.origin_label
  const kind = s.trip.direction === 'aller' ? 'Destination' : 'Lieu de départ'
  return [
    `Même jour que votre trajet non couvert : départ à ${brusselsTime(s.trip.scheduled_at ?? s.need.scheduled_at)}, votre besoin à ${brusselsTime(s.need.scheduled_at)}`,
    s.match === 'identique'
      ? `${kind} identique : « ${placeTrip} »`
      : `${kind} proche : « ${placeTrip} » et « ${placeNeed} »`,
    s.delta === 0
      ? 'Aucun écart d’horaire avec votre besoin'
      : `Écart de ${s.delta} minute${s.delta > 1 ? 's' : ''} par rapport à votre besoin`,
  ]
}

interface HubDetailData {
  id: string
  name: string
  kind: HubKind
  status: HubStatus
  join_code: string
  place_label: string
  municipality: string
}

function memberDisplayName(row: HubMemberProfile): string {
  return `${row.first_name}${row.last_name ? ` ${row.last_name}` : ''}`
}

// Code court lisible : 3 lettres + 3 chiffres, sans caractères ambigus.
function generateJoinCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const random = new Uint32Array(6)
  crypto.getRandomValues(random)
  let code = ''
  for (let i = 0; i < 3; i++) code += letters[random[i] % letters.length]
  for (let i = 3; i < 6; i++) code += digits[random[i] % digits.length]
  return code
}

export const Route = createFileRoute('/_authed/hubs')({
  component: HubsPage,
})

function HubsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<Array<Membership>>([])
  const [acceptances, setAcceptances] = useState<Array<Acceptance>>([])
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null)

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

    const [membershipsResult, acceptancesResult] = await Promise.all([
      supabase
        .from('hub_members')
        .select(
          'id, hub_id, is_admin, validated_at, hubs(id, name, kind, status, municipality)',
        )
        .eq('user_id', userId)
        .order('joined_at'),
      supabase
        .from('hub_pact_acceptances')
        .select('hub_id, pact_version')
        .eq('user_id', userId),
    ])

    const firstError = membershipsResult.error ?? acceptancesResult.error
    if (firstError || !membershipsResult.data || !acceptancesResult.data) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setHouseholdId(membership.household_id)
    setMemberships(membershipsResult.data)
    setAcceptances(acceptancesResult.data)
    setLoading(false)
  }, [userId])

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

  if (!householdId || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">Les hubs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez d’abord créer ou rejoindre un foyer avant de participer à
            un hub.
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

  const validated = memberships.filter((m) => m.validated_at && m.hubs)
  const pending = memberships.filter((m) => !m.validated_at)
  const selectedMembership =
    validated.find((m) => m.hub_id === selectedHubId) ?? null
  const selectedHasPact = acceptances.some(
    (a) => a.hub_id === selectedHubId && a.pact_version === PACT_VERSION,
  )

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">Les hubs</h1>

          <p className="mt-2 text-sm text-gray-600">
            Un hub relie plusieurs familles autour d’une école, d’un club ou
            d’un quartier pour organiser les trajets ensemble.
          </p>

          {validated.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-medium text-gray-700">
                Mes hubs
              </h2>
              <ul className="mt-2 divide-y divide-gray-100">
                {validated.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedHubId(
                          selectedHubId === m.hub_id ? null : m.hub_id,
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-md px-2 py-3 text-left hover:bg-gray-50 ${
                        selectedHubId === m.hub_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span>
                        <span className="text-sm font-medium text-gray-900">
                          {m.hubs?.name}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {m.hubs ? KIND_LABELS[m.hubs.kind] : ''} ·{' '}
                          {m.hubs?.municipality}
                          {m.is_admin && ' · Admin'}
                        </span>
                      </span>
                      <span className="text-sm text-gray-500">
                        {m.hubs ? STATUS_LABELS[m.hubs.status] : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pending.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-medium text-gray-700">
                Demandes en attente
              </h2>
              <ul className="mt-2 divide-y divide-gray-100">
                {pending.map((m) => (
                  <li key={m.id} className="py-3 text-sm text-gray-600">
                    Demande d’adhésion en attente de validation par un
                    administrateur du hub.
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {selectedMembership &&
          (selectedHasPact ? (
            <HubDetail
              key={selectedMembership.hub_id}
              hubId={selectedMembership.hub_id}
              isAdmin={selectedMembership.is_admin}
              userId={userId}
              householdId={householdId}
            />
          ) : (
            <PactGate
              hubId={selectedMembership.hub_id}
              userId={userId}
              hubName={selectedMembership.hubs?.name ?? 'ce hub'}
              onAccepted={() => void load()}
            />
          ))}

        <JoinHubForm
          userId={userId}
          householdId={householdId}
          alreadyMemberHubIds={memberships.map((m) => m.hub_id)}
          onJoined={() => void load()}
        />

        <CreateHubForm
          userId={userId}
          householdId={householdId}
          onCreated={(hubId) => {
            setSelectedHubId(hubId)
            void load()
          }}
        />
      </div>
    </main>
  )
}

function PactText() {
  return (
    <ul className="mt-3 space-y-2 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
      {PACT_TEXT.map((line, i) => (
        <li key={i}>• {line}</li>
      ))}
      <li className="text-xs text-gray-500">
        Pacte de Hub, version {PACT_VERSION}
      </li>
    </ul>
  )
}

// Gate : membre validé mais pacte (version courante) non accepté.
function PactGate({
  hubId,
  userId,
  hubName,
  onAccepted,
}: {
  hubId: string
  userId: string
  hubName: string
  onAccepted: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setError(null)
    setSubmitting(true)

    const { error: insertError } = await supabase
      .from('hub_pact_acceptances')
      .insert({ hub_id: hubId, user_id: userId, pact_version: PACT_VERSION })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    onAccepted()
  }

  return (
    <div className="island-shell rounded-3xl p-8">
      <h2 className="text-lg font-semibold text-gray-900">
        Le Pacte de Hub — {hubName}
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Pour accéder à ce hub, vous devez d’abord accepter son pacte.
      </p>
      <PactText />
      <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        J’ai lu le Pacte de Hub et je m’engage à le respecter.
      </label>
      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
      <button
        type="button"
        disabled={!accepted || submitting}
        onClick={() => void handleAccept()}
        className="mt-4 w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
      >
        {submitting ? 'Enregistrement…' : 'Accepter le pacte'}
      </button>
    </div>
  )
}

function HubDetail({
  hubId,
  isAdmin,
  userId,
  householdId,
}: {
  hubId: string
  isAdmin: boolean
  userId: string
  householdId: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hub, setHub] = useState<HubDetailData | null>(null)
  const [members, setMembers] = useState<Array<HubMemberProfile>>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [openTrips, setOpenTrips] = useState<Array<HubTripRow>>([])
  const [myNeeds, setMyNeeds] = useState<Array<MyNeed>>([])
  const [myUserIds, setMyUserIds] = useState<Array<string>>([])
  const [myChildren, setMyChildren] = useState<
    Array<{ id: string; first_name: string }>
  >([])
  const [meetingPoints, setMeetingPoints] = useState<Array<MeetingPoint>>([])
  const [mpPhotoUrls, setMpPhotoUrls] = useState<Record<string, string>>({})
  const [conciergeSettings, setConciergeSettings] = useState<ConciergeSettings>(
    {},
  )
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null)
  const [activationBanner, setActivationBanner] = useState(false)
  const previousStatus = useRef<HubStatus | null>(null)

  const load = useCallback(async () => {
    setError(null)

    const [
      hubResult,
      membersResult,
      thresholdResult,
      openTripsResult,
      myNeedsResult,
      myMembersResult,
      myChildrenResult,
      meetingPointsResult,
      settingsResult,
      lastPublishedResult,
    ] = await Promise.all([
      supabase
        .from('hubs')
        .select('id, name, kind, status, join_code, place_label, municipality')
        .eq('id', hubId)
        .single(),
      supabase.rpc('hub_member_profiles', { p_hub: hubId }),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'hub_activation_member_count')
        .single(),
      // Interdit n°9 : côté hub, les trajets se lisent EXCLUSIVEMENT via
      // hub_trips_view. Jamais de select direct sur trips ici.
      supabase
        .from('hub_trips_view')
        .select(
          'id, direction, status, scheduled_at, origin_label, destination_label, meeting_point_id, seats_available, driver_id, driver_first_name, children_count',
        )
        .eq('hub_id', hubId)
        .eq('status', 'couvert_ouvert')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at'),
      // Mes propres trajets non couverts (cercle intime, lecture
      // directe légitime) : les besoins que les suggestions comparent.
      supabase
        .from('trips')
        .select('id, direction, scheduled_at, origin_label, destination_label')
        .eq('household_id', householdId)
        .eq('status', 'non_couvert')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at'),
      supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId),
      supabase
        .from('children')
        .select('id, first_name')
        .eq('household_id', householdId)
        .order('created_at'),
      supabase
        .from('meeting_points')
        .select('id, label, description, photo_url, is_default')
        .eq('hub_id', hubId)
        .order('created_at'),
      fetchConciergeSettings(),
      // Concierge : dernier trajet publié du hub (passé ou à venir),
      // toujours via hub_trips_view (interdit n°9).
      supabase
        .from('hub_trips_view')
        .select('scheduled_at')
        .eq('hub_id', hubId)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const firstError =
      hubResult.error ??
      membersResult.error ??
      thresholdResult.error ??
      openTripsResult.error ??
      myNeedsResult.error ??
      myMembersResult.error ??
      myChildrenResult.error ??
      meetingPointsResult.error
    if (
      firstError ||
      !hubResult.data ||
      !membersResult.data ||
      !openTripsResult.data ||
      !myNeedsResult.data ||
      !myMembersResult.data ||
      !myChildrenResult.data ||
      !meetingPointsResult.data
    ) {
      setError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    // La bascule solo -> active est automatique en base (trigger) : elle
    // doit produire un message VISIBLE, pas un changement silencieux.
    if (
      previousStatus.current === 'solo' &&
      hubResult.data.status === 'active'
    ) {
      setActivationBanner(true)
    }
    previousStatus.current = hubResult.data.status

    // URLs signées de courte durée pour les photos des points de
    // rendez-vous (bucket privé, pas de donnée enfant).
    const withPhoto = meetingPointsResult.data.filter((mp) => mp.photo_url)
    const mpUrls: Record<string, string> = {}
    if (withPhoto.length > 0) {
      const { data: signed } = await supabase.storage
        .from(MP_PHOTO_BUCKET)
        .createSignedUrls(
          withPhoto.map((mp) => mp.photo_url as string),
          MP_SIGNED_URL_TTL_SECONDS,
        )
      signed?.forEach((entry, index) => {
        if (entry.signedUrl) {
          mpUrls[withPhoto[index].id] = entry.signedUrl
        }
      })
    }

    setHub(hubResult.data)
    setMeetingPoints(meetingPointsResult.data)
    setMpPhotoUrls(mpUrls)
    setConciergeSettings(settingsResult)
    setLastPublishedAt(lastPublishedResult.data?.scheduled_at ?? null)
    setMembers(membersResult.data)
    setThreshold(
      thresholdResult.data ? Number(thresholdResult.data.value) : null,
    )
    setOpenTrips(openTripsResult.data)
    setMyNeeds(myNeedsResult.data)
    setMyUserIds(myMembersResult.data.map((m) => m.user_id))
    setMyChildren(myChildrenResult.data)
    setLoading(false)
  }, [hubId, householdId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="island-shell rounded-3xl p-8">
        <p className="text-sm text-gray-500">Chargement du hub…</p>
      </div>
    )
  }

  if (error || !hub) {
    return (
      <div className="island-shell rounded-3xl p-8">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error ?? 'hub introuvable'}
        </p>
      </div>
    )
  }

  const validatedMembers = members.filter((m) => m.validated_at)
  const pendingMembers = members.filter((m) => !m.validated_at)
  const missing =
    threshold !== null ? Math.max(0, threshold - validatedMembers.length) : null

  // Concierge (étape 9) : détections en lecture, suggestions aux
  // admins. Rien d'automatique au-delà de l'affichage — le Concierge
  // n'invite personne, ne publie rien, n'exclut personne.
  const soloStagnant =
    isAdmin &&
    hubSoloIsStagnant(
      hub.status,
      validatedMembers.flatMap((m) => (m.validated_at ? [m.validated_at] : [])),
      conciergeSettings.concierge_hub_solo_weeks,
      new Date(),
    )
  const inactiveWeeks = conciergeSettings.concierge_hub_inactive_weeks
  const hubInactive =
    isAdmin &&
    hub.status !== 'solo' &&
    inactiveWeeks !== undefined &&
    (!lastPublishedAt ||
      new Date(lastPublishedAt).getTime() <
        Date.now() - inactiveWeeks * 7 * 24 * 3_600_000)

  const mpLabelById = new Map(meetingPoints.map((mp) => [mp.id, mp.label]))

  // « Par les autres familles » : les trajets de mon propre foyer
  // (conducteur dans mon foyer) sont exclus.
  const otherTrips = openTrips.filter(
    (t) => !t.driver_id || !myUserIds.includes(t.driver_id),
  )

  // Suggestions : meilleur besoin du foyer pour chaque trajet ouvert.
  const suggestions: Array<Suggestion> = []
  for (const t of otherTrips) {
    if (!t.scheduled_at || !t.direction) continue
    let best: Suggestion | null = null
    for (const need of myNeeds) {
      if (need.direction !== t.direction) continue
      if (brusselsDay(need.scheduled_at) !== brusselsDay(t.scheduled_at)) {
        continue
      }
      const delta = Math.round(
        Math.abs(
          new Date(t.scheduled_at).getTime() -
            new Date(need.scheduled_at).getTime(),
        ) / 60000,
      )
      if (delta > MATCH_WINDOW_MINUTES) continue
      const match = labelMatch(
        t.direction === 'aller' ? t.destination_label : t.origin_label,
        t.direction === 'aller' ? need.destination_label : need.origin_label,
      )
      if (!match) continue
      const candidate: Suggestion = { trip: t, need, delta, match }
      if (!best || compareSuggestions(candidate, best) < 0) best = candidate
    }
    if (best) suggestions.push(best)
  }
  suggestions.sort(compareSuggestions)

  return (
    <div className="island-shell rounded-3xl p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{hub.name}</h2>
          <p className="text-sm text-gray-500">
            {KIND_LABELS[hub.kind]} · {hub.place_label} · {hub.municipality}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            hub.status === 'solo'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          {STATUS_LABELS[hub.status]}
        </span>
      </div>

      {activationBanner && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm font-medium text-green-800">
          🎉 Le seuil est atteint : le hub est maintenant actif !
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        {validatedMembers.length} membre
        {validatedMembers.length > 1 ? 's' : ''} validé
        {validatedMembers.length > 1 ? 's' : ''}
        {hub.status === 'solo' &&
          missing !== null &&
          (missing > 0
            ? ` — encore ${missing} pour activer le hub.`
            : ' — le seuil d’activation est atteint.')}
      </p>

      {isAdmin && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            Code d’adhésion à partager avec les familles :{' '}
            <span className="font-mono text-base font-semibold tracking-widest">
              {hub.join_code}
            </span>
          </p>
        </div>
      )}

      {soloStagnant && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            Votre hub est en démarrage depuis un moment sans nouvelle famille.
          </p>
          <p className="mt-1">
            Quelques invitations suffisent souvent à le faire décoller :
            partagez le code{' '}
            <span className="font-mono font-semibold tracking-widest">
              {hub.join_code}
            </span>{' '}
            aux familles de l’école, du club ou du quartier.
          </p>
        </div>
      )}

      {hubInactive && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">
            Aucun trajet n’a été proposé dans ce hub depuis plusieurs semaines.
          </p>
          <p className="mt-1">
            Proposer des places sur un prochain trajet relance la dynamique :
            les autres familles voient que le hub vit et osent proposer à leur
            tour.
          </p>
        </div>
      )}

      <h3 className="mt-6 text-sm font-medium text-gray-700">Membres</h3>
      <ul className="mt-2 divide-y divide-gray-100">
        {validatedMembers.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center justify-between py-3 text-sm"
          >
            <span className="text-gray-900">{memberDisplayName(m)}</span>
            <span className="text-gray-500">{m.is_admin ? 'Admin' : ''}</span>
          </li>
        ))}
      </ul>

      {isAdmin && pendingMembers.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-gray-700">
            Demandes d’adhésion à traiter
          </h3>
          <ul className="mt-2 divide-y divide-gray-100">
            {pendingMembers.map((m) => (
              <PendingMemberRow
                key={m.user_id}
                hubId={hubId}
                member={m}
                onChanged={load}
              />
            ))}
          </ul>
        </>
      )}

      <MeetingPointsSection
        hubId={hubId}
        isAdmin={isAdmin}
        meetingPoints={meetingPoints}
        photoUrls={mpPhotoUrls}
        onChanged={load}
      />

      {suggestions.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-gray-700">
            Suggestions pour votre foyer
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Ces trajets correspondent à un besoin réel de votre foyer. Rien
            n’est réservé automatiquement : vous choisissez de demander, le
            conducteur choisit d’accepter.
          </p>
          <ul className="mt-2 divide-y divide-gray-100">
            {suggestions.map((s) => (
              <HubTripCard
                key={`suggestion-${s.trip.id}`}
                trip={s.trip}
                userId={userId}
                householdId={householdId}
                myChildren={myChildren}
                meetingPointLabel={
                  s.trip.meeting_point_id
                    ? mpLabelById.get(s.trip.meeting_point_id)
                    : undefined
                }
                reasons={suggestionReasons(s)}
                onRequested={load}
              />
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-6 text-sm font-medium text-gray-700">
        Trajets ouverts des autres familles
      </h3>
      {otherTrips.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          Aucun trajet ouvert pour le moment. Les trajets publiés par les autres
          familles du hub apparaîtront ici.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {otherTrips.map((t) => (
            <HubTripCard
              key={t.id}
              trip={t}
              userId={userId}
              householdId={householdId}
              myChildren={myChildren}
              meetingPointLabel={
                t.meeting_point_id
                  ? mpLabelById.get(t.meeting_point_id)
                  : undefined
              }
              onRequested={load}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function HubTripCard({
  trip,
  userId,
  householdId,
  myChildren,
  meetingPointLabel,
  reasons,
  onRequested,
}: {
  trip: HubTripRow
  userId: string
  householdId: string
  myChildren: Array<{ id: string; first_name: string }>
  meetingPointLabel?: string
  reasons?: Array<string>
  onRequested: () => void
}) {
  const [open, setOpen] = useState(false)
  const [childId, setChildId] = useState(myChildren[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Demande de place : crée une entrée en_attente. Le matching propose,
  // seul le foyer conducteur accepte (interdit n°4).
  async function request() {
    if (!trip.id || !childId) return
    setError(null)
    setSubmitting(true)

    const { error: insertError } = await supabase.from('trip_requests').insert({
      trip_id: trip.id,
      requester_id: userId,
      requester_household_id: householdId,
      child_id: childId,
      message: message.trim() === '' ? null : message.trim(),
    })

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'Une demande est déjà en attente pour cet enfant sur ce trajet.'
          : insertError.message,
      )
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSent(true)
    setOpen(false)
    onRequested()
  }

  const seats = trip.seats_available ?? 0

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {trip.scheduled_at ? formatTripDate(trip.scheduled_at) : ''} ·{' '}
            {trip.direction === 'aller' ? 'aller' : 'retour'}
          </p>
          <p className="text-sm text-gray-500">
            {trip.origin_label} → {trip.destination_label}
          </p>
          <p className="text-sm text-gray-500">
            {trip.driver_first_name
              ? `Conduit par ${trip.driver_first_name}`
              : 'Conducteur non renseigné'}
            {' · '}
            {seats} place{seats > 1 ? 's' : ''} offerte{seats > 1 ? 's' : ''}
            {' · '}
            {trip.children_count ?? 0} enfant
            {(trip.children_count ?? 0) > 1 ? 's' : ''} à bord
          </p>
          {meetingPointLabel && (
            <p className="text-sm text-gray-500">
              📍 Rendez-vous : {meetingPointLabel}
            </p>
          )}
          {reasons && (
            <ul className="mt-2 space-y-0.5 rounded-md bg-blue-50 p-2 text-xs text-blue-900">
              {reasons.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>
        {!open && !sent && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 btn-lagoon px-3.5 py-1.5 text-sm font-semibold"
          >
            Demander une place
          </button>
        )}
      </div>

      {sent && (
        <p className="mt-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Demande envoyée. Le conducteur doit maintenant l’accepter — suivez son
          état dans « Mes demandes ».
        </p>
      )}

      {open &&
        (myChildren.length === 0 ? (
          <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Ajoutez d’abord un enfant à votre foyer pour demander une place.
          </p>
        ) : (
          <div className="mt-3 space-y-3 rounded-md border border-gray-200 p-4">
            <div>
              <label
                htmlFor={`request-child-${trip.id}`}
                className="block text-sm font-medium text-gray-700"
              >
                Pour quel enfant ?
              </label>
              <select
                id={`request-child-${trip.id}`}
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
              >
                {myChildren.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`request-message-${trip.id}`}
                className="block text-sm font-medium text-gray-700"
              >
                Message (optionnel)
              </label>
              <textarea
                id={`request-message-${trip.id}`}
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full btn-ghost px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void request()}
                disabled={submitting || !childId}
                className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
              >
                {submitting ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        ))}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Meeting Points (Doc1 §12.1) : définis par les admins du hub, visibles
// par tous les membres validés. Le conducteur peut en choisir un à la
// publication d'un trajet (modale de /semaine). Un seul point par
// défaut par hub, garanti par un index partiel en base.
// ---------------------------------------------------------------------
function MeetingPointsSection({
  hubId,
  isAdmin,
  meetingPoints,
  photoUrls,
  onChanged,
}: {
  hubId: string
  isAdmin: boolean
  meetingPoints: Array<MeetingPoint>
  photoUrls: Record<string, string>
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function addPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
      setError('La photo dépasse 5 Mo.')
      return
    }
    setSubmitting(true)

    // Le premier point du hub devient le point par défaut.
    const { data: created, error: insertError } = await supabase
      .from('meeting_points')
      .insert({
        hub_id: hubId,
        label: label.trim(),
        description: description.trim() === '' ? null : description.trim(),
        is_default: meetingPoints.length === 0,
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${hubId}/${created.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(MP_PHOTO_BUCKET)
        .upload(path, photoFile, { upsert: true })

      if (uploadError) {
        setError(
          `Le point est créé mais la photo n’a pas pu être enregistrée : ${uploadError.message}`,
        )
      } else {
        const { error: updateError } = await supabase
          .from('meeting_points')
          .update({ photo_url: path })
          .eq('id', created.id)
        if (updateError) {
          setError(
            `Le point est créé mais la photo n’a pas pu être liée : ${updateError.message}`,
          )
        }
      }
    }

    setSubmitting(false)
    setAdding(false)
    setLabel('')
    setDescription('')
    setPhotoFile(null)
    onChanged()
  }

  async function setDefault(id: string) {
    setError(null)
    const { error: rpcError } = await supabase.rpc(
      'meeting_point_set_default',
      {
        p_meeting_point: id,
      },
    )
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onChanged()
  }

  async function deletePoint(mp: MeetingPoint) {
    setError(null)
    // Suppression Storage EXPLICITE avant la ligne : le cascade SQL ne
    // supprime jamais les objets Storage (même règle que les photos
    // d'enfants).
    if (mp.photo_url) {
      const { error: removeError } = await supabase.storage
        .from(MP_PHOTO_BUCKET)
        .remove([mp.photo_url])
      if (removeError) {
        setError(`La photo n’a pas pu être supprimée : ${removeError.message}`)
        return
      }
    }
    const { error: deleteError } = await supabase
      .from('meeting_points')
      .delete()
      .eq('id', mp.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setConfirmDeleteId(null)
    onChanged()
  }

  if (!isAdmin && meetingPoints.length === 0) {
    return null
  }

  return (
    <>
      <h3 className="mt-6 text-sm font-medium text-gray-700">
        Points de rendez-vous
      </h3>
      {meetingPoints.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          Aucun point de rendez-vous défini. Un lieu connu de tous simplifie les
          dépôts et les récupérations.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {meetingPoints.map((mp) => (
            <li key={mp.id} className="flex items-start gap-3 py-3">
              {photoUrls[mp.id] && (
                <img
                  src={photoUrls[mp.id]}
                  alt={`Photo du point de rendez-vous ${mp.label}`}
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {mp.label}
                  {mp.is_default && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                      Par défaut
                    </span>
                  )}
                </p>
                {mp.description && (
                  <p className="text-sm text-gray-500">{mp.description}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  {!mp.is_default && (
                    <button
                      type="button"
                      onClick={() => void setDefault(mp.id)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Définir par défaut
                    </button>
                  )}
                  {confirmDeleteId === mp.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void deletePoint(mp)}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(mp.id)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 btn-ghost px-3.5 py-1.5 text-sm"
        >
          Ajouter un point de rendez-vous
        </button>
      )}

      {isAdmin && adding && (
        <form
          onSubmit={(e) => void addPoint(e)}
          className="mt-3 space-y-3 rounded-md border border-gray-200 p-4"
        >
          <div>
            <label
              htmlFor="mp-label"
              className="block text-sm font-medium text-gray-700"
            >
              Libellé
            </label>
            <input
              id="mp-label"
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
              placeholder="Parking de l’école, entrée rue des Tilleuls"
            />
          </div>
          <div>
            <label
              htmlFor="mp-description"
              className="block text-sm font-medium text-gray-700"
            >
              Description (optionnelle)
            </label>
            <textarea
              id="mp-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="mp-photo"
              className="block text-sm font-medium text-gray-700"
            >
              Photo (optionnelle)
            </label>
            <input
              id="mp-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm text-gray-700"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="w-full btn-ghost px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || label.trim() === ''}
              className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
            >
              {submitting ? 'Enregistrement…' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </>
  )
}

function PendingMemberRow({
  hubId,
  member,
  onChanged,
}: {
  hubId: string
  member: HubMemberProfile
  onChanged: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validation et refus : actes HUMAINS d'un admin, jamais automatisés.
  async function validate() {
    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase
      .from('hub_members')
      .update({ validated_at: new Date().toISOString() })
      .eq('hub_id', hubId)
      .eq('user_id', member.user_id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    onChanged()
  }

  async function refuse() {
    setError(null)
    setSubmitting(true)

    const { error: deleteError } = await supabase
      .from('hub_members')
      .delete()
      .eq('hub_id', hubId)
      .eq('user_id', member.user_id)

    if (deleteError) {
      setError(deleteError.message)
      setSubmitting(false)
      return
    }

    onChanged()
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-900">
          {memberDisplayName(member)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refuse()}
            disabled={submitting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => void validate()}
            disabled={submitting}
            className="btn-lagoon px-3.5 py-1.5 text-sm font-semibold"
          >
            Valider
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </li>
  )
}

function JoinHubForm({
  userId,
  householdId,
  alreadyMemberHubIds,
  onJoined,
}: {
  userId: string
  householdId: string
  alreadyMemberHubIds: Array<string>
  onJoined: () => void
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundHub, setFoundHub] = useState<{
    id: string
    name: string
    kind: HubKind
    municipality: string
  } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [pactAccepted, setPactAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotFound(false)
    setFoundHub(null)
    setSearching(true)

    const { data, error: rpcError } = await supabase.rpc('hub_for_join_code', {
      p_code: code,
    })

    setSearching(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const hub = data?.[0] ?? null
    if (!hub) {
      setNotFound(true)
      return
    }
    setFoundHub(hub)
  }

  async function join() {
    if (!foundHub) return
    setError(null)
    setSubmitting(true)

    // Entrée non validée : un admin du hub valide ou refuse ensuite.
    const { error: memberError } = await supabase.from('hub_members').insert({
      hub_id: foundHub.id,
      user_id: userId,
      household_id: householdId,
    })

    if (memberError) {
      setError(memberError.message)
      setSubmitting(false)
      return
    }

    const { error: pactError } = await supabase
      .from('hub_pact_acceptances')
      .insert({
        hub_id: foundHub.id,
        user_id: userId,
        pact_version: PACT_VERSION,
      })

    if (pactError) {
      setError(pactError.message)
      setSubmitting(false)
      return
    }

    setMessage(
      `Demande envoyée pour « ${foundHub.name} ». Un administrateur du hub doit maintenant la valider.`,
    )
    setFoundHub(null)
    setCode('')
    setPactAccepted(false)
    setSubmitting(false)
    setOpen(false)
    onJoined()
  }

  return (
    <div className="island-shell rounded-3xl p-8">
      <h2 className="text-lg font-semibold text-gray-900">Rejoindre un hub</h2>

      {message && (
        <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setMessage(null)
          }}
          className="mt-4 w-full btn-ghost px-4 py-2 text-sm"
        >
          Saisir un code d’adhésion
        </button>
      ) : (
        <>
          <form onSubmit={search} className="mt-4 flex gap-3">
            <input
              type="text"
              required
              placeholder="Par exemple : ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm uppercase tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={searching || code.trim().length < 6}
              className="shrink-0 btn-lagoon px-4 py-2.5 text-sm font-semibold"
            >
              {searching ? 'Recherche…' : 'Chercher'}
            </button>
          </form>

          {notFound && (
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Aucun hub ne correspond à ce code. Vérifiez-le avec la personne
              qui vous l’a transmis.
            </p>
          )}

          {foundHub && (
            <div className="mt-4 rounded-md border border-gray-200 p-4">
              {alreadyMemberHubIds.includes(foundHub.id) ? (
                <p className="text-sm text-gray-600">
                  Vous êtes déjà membre de « {foundHub.name} », ou votre demande
                  est déjà en attente.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {foundHub.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {KIND_LABELS[foundHub.kind]} · {foundHub.municipality}
                  </p>

                  <PactText />
                  <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={pactAccepted}
                      onChange={(e) => setPactAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    J’ai lu le Pacte de Hub et je m’engage à le respecter.
                  </label>

                  <button
                    type="button"
                    disabled={!pactAccepted || submitting}
                    onClick={() => void join()}
                    className="mt-4 w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
                  >
                    {submitting
                      ? 'Envoi de la demande…'
                      : 'Demander à rejoindre ce hub'}
                  </button>
                </>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function CreateHubForm({
  userId,
  householdId,
  onCreated,
}: {
  userId: string
  householdId: string
  onCreated: (hubId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<HubKind>('ecole')
  const [placeLabel, setPlaceLabel] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [pactAccepted, setPactAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    // Le code doit être unique : en cas de collision (contrainte unique
    // en base), on retire un nouveau code, quelques tentatives suffisent.
    let hubId: string | null = null
    for (let attempt = 0; attempt < 5 && hubId === null; attempt++) {
      const { data: created, error: hubError } = await supabase
        .from('hubs')
        .insert({
          name: name.trim(),
          kind,
          place_label: placeLabel.trim(),
          municipality: municipality.trim(),
          owner_id: userId,
          join_code: generateJoinCode(),
        })
        .select('id')
        .single()

      if (hubError) {
        if (hubError.code === '23505' && attempt < 4) continue
        setError(hubError.message)
        setSubmitting(false)
        return
      }
      hubId = created.id
    }

    if (!hubId) {
      setError('Impossible de générer un code d’adhésion unique.')
      setSubmitting(false)
      return
    }

    // Le créateur est owner et premier membre validé et admin. Le hub
    // démarre en statut solo (défaut en base).
    const { error: memberError } = await supabase.from('hub_members').insert({
      hub_id: hubId,
      user_id: userId,
      household_id: householdId,
      is_admin: true,
      validated_at: new Date().toISOString(),
    })

    if (memberError) {
      setError(memberError.message)
      setSubmitting(false)
      return
    }

    const { error: pactError } = await supabase
      .from('hub_pact_acceptances')
      .insert({ hub_id: hubId, user_id: userId, pact_version: PACT_VERSION })

    if (pactError) {
      setError(pactError.message)
      setSubmitting(false)
      return
    }

    setOpen(false)
    setSubmitting(false)
    setName('')
    setPlaceLabel('')
    setMunicipality('')
    setPactAccepted(false)
    onCreated(hubId)
  }

  return (
    <div className="island-shell rounded-3xl p-8">
      <h2 className="text-lg font-semibold text-gray-900">Créer un hub</h2>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full btn-ghost px-4 py-2 text-sm"
        >
          Créer un nouveau hub
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="hub-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nom du hub
            </label>
            <input
              id="hub-name"
              type="text"
              required
              placeholder="Par exemple : École Saint-Joseph — primaires"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="hub-kind"
              className="block text-sm font-medium text-gray-700"
            >
              Type
            </label>
            <select
              id="hub-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as HubKind)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hub-place"
              className="block text-sm font-medium text-gray-700"
            >
              Lieu
            </label>
            <input
              id="hub-place"
              type="text"
              required
              placeholder="Par exemple : rue de l’Église 12"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="hub-municipality"
              className="block text-sm font-medium text-gray-700"
            >
              Commune
            </label>
            <input
              id="hub-municipality"
              type="text"
              required
              placeholder="Par exemple : Waterloo"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          <PactText />
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={pactAccepted}
              onChange={(e) => setPactAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            J’ai lu le Pacte de Hub et je m’engage à le respecter.
          </label>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className="w-full btn-ghost px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !pactAccepted || name.trim() === ''}
              className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
            >
              {submitting ? 'Création…' : 'Créer le hub'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
