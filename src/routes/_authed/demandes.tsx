import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { Database } from '@/types/database'

type RequestStatus = Database['public']['Enums']['trip_request_status']
type TripDirection = Database['public']['Enums']['trip_direction']

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  en_attente: 'En attente',
  accepte: 'Acceptée',
  refuse: 'Refusée',
  annule: 'Annulée',
  expire: 'Expirée',
}

const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  en_attente: 'bg-amber-50 text-amber-800',
  accepte: 'bg-green-50 text-green-800',
  refuse: 'bg-red-50 text-red-800',
  annule: 'bg-gray-100 text-gray-500',
  expire: 'bg-gray-100 text-gray-500',
}

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

// Demande envoyée : les détails du trajet d'un autre foyer se lisent
// via hub_trips_view uniquement (interdit n°9).
interface SentRequest {
  id: string
  trip_id: string
  child_id: string
  status: RequestStatus
  message: string | null
  created_at: string
  children: { first_name: string } | null
}

interface SentTripInfo {
  id: string | null
  direction: TripDirection | null
  scheduled_at: string | null
  origin_label: string | null
  destination_label: string | null
  driver_first_name: string | null
}

// Demande reçue : le trajet appartient à MON foyer (cercle intime), la
// lecture directe de trips est ici légitime. Aucun prénom d'enfant du
// foyer demandeur n'est accessible ni affiché : seul le parent
// demandeur est nommé, via hub_member_profiles.
interface ReceivedRequest {
  id: string
  trip_id: string
  status: RequestStatus
  message: string | null
  created_at: string
  requester_id: string
  trips: {
    direction: TripDirection
    scheduled_at: string
    origin_label: string | null
    destination_label: string | null
    seats_available: number | null
    hub_id: string | null
    activities: { label: string } | null
  }
}

export const Route = createFileRoute('/_authed/demandes')({
  component: DemandesPage,
})

function DemandesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [sent, setSent] = useState<Array<SentRequest>>([])
  const [sentTrips, setSentTrips] = useState<Map<string, SentTripInfo>>(
    new Map(),
  )
  const [received, setReceived] = useState<Array<ReceivedRequest>>([])
  const [requesterNames, setRequesterNames] = useState<Map<string, string>>(
    new Map(),
  )
  // Fenêtre de confiance (Doc1 §12.3) : demandes reçues dont le foyer
  // demandeur n'a encore jamais partagé de trajet avec le nôtre.
  const [firstContactIds, setFirstContactIds] = useState<Set<string>>(new Set())
  // Bulletin de trajet (Doc1 §12.2), côté parent : confirmations de
  // dépôt de MES enfants, clé `${trip_id}|${child_id}`. La RLS ne
  // renvoie que les enfants du foyer.
  const [dropoffs, setDropoffs] = useState<Map<string, string>>(new Map())

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

    const [sentResult, receivedResult] = await Promise.all([
      supabase
        .from('trip_requests')
        .select(
          'id, trip_id, child_id, status, message, created_at, children(first_name)',
        )
        .eq('requester_household_id', membership.household_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('trip_requests')
        .select(
          'id, trip_id, status, message, created_at, requester_id, trips!inner(household_id, direction, scheduled_at, origin_label, destination_label, seats_available, hub_id, activities(label))',
        )
        .eq('trips.household_id', membership.household_id)
        .order('created_at', { ascending: false }),
    ])

    const firstError = sentResult.error ?? receivedResult.error
    if (firstError || !sentResult.data || !receivedResult.data) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    // Détails des trajets demandés, via la vue filtrée uniquement.
    const sentTripIds = [...new Set(sentResult.data.map((r) => r.trip_id))]
    const tripInfos = new Map<string, SentTripInfo>()
    if (sentTripIds.length > 0) {
      const { data: viewRows } = await supabase
        .from('hub_trips_view')
        .select(
          'id, direction, scheduled_at, origin_label, destination_label, driver_first_name',
        )
        .in('id', sentTripIds)
      viewRows?.forEach((row) => {
        if (row.id) tripInfos.set(row.id, row)
      })
    }

    // Nom du parent demandeur : via hub_member_profiles, jamais users.
    const hubIds = [
      ...new Set(
        receivedResult.data.flatMap((r) =>
          r.trips.hub_id ? [r.trips.hub_id] : [],
        ),
      ),
    ]
    const names = new Map<string, string>()
    if (hubIds.length > 0) {
      const profileResults = await Promise.all(
        hubIds.map((hubId) =>
          supabase.rpc('hub_member_profiles', { p_hub: hubId }),
        ),
      )
      for (const result of profileResults) {
        result.data?.forEach((p) => {
          names.set(
            p.user_id,
            `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`,
          )
        })
      }
    }

    // Fenêtre de confiance : uniquement pour les demandes en attente
    // (c'est avant d'accepter que le contact préalable a un sens). La
    // fonction est réservée au foyer conducteur, ce que nous sommes ici.
    const pending = receivedResult.data.filter((r) => r.status === 'en_attente')
    const firstContacts = new Set<string>()
    if (pending.length > 0) {
      const results = await Promise.all(
        pending.map((r) =>
          supabase.rpc('trip_request_first_contact', { p_request: r.id }),
        ),
      )
      results.forEach((result, index) => {
        if (result.data === true) firstContacts.add(pending[index].id)
      })
    }

    // Statut de dépôt de mes enfants sur les trajets demandés : la RLS
    // de trip_dropoff_confirmations ne renvoie ici que mes enfants.
    const acceptedSent = sentResult.data.filter((r) => r.status === 'accepte')
    const dropoffMap = new Map<string, string>()
    if (acceptedSent.length > 0) {
      const { data: dropoffRows } = await supabase
        .from('trip_dropoff_confirmations')
        .select('trip_id, child_id, confirmed_at')
        .in('trip_id', [...new Set(acceptedSent.map((r) => r.trip_id))])
      dropoffRows?.forEach((row) => {
        dropoffMap.set(`${row.trip_id}|${row.child_id}`, row.confirmed_at)
      })
    }

    setHouseholdId(membership.household_id)
    setSent(sentResult.data)
    setSentTrips(tripInfos)
    setReceived(receivedResult.data)
    setRequesterNames(names)
    setFirstContactIds(firstContacts)
    setDropoffs(dropoffMap)
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

  if (!householdId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">Les demandes</h1>
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

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">
            Les demandes de place
          </h1>

          <h2 className="mt-6 text-sm font-medium text-gray-700">
            Demandes reçues sur mes trajets
          </h2>
          {received.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Aucune demande reçue pour le moment.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {received.map((request) => (
                <ReceivedRequestRow
                  key={request.id}
                  request={request}
                  requesterName={
                    requesterNames.get(request.requester_id) ??
                    'Un parent du hub'
                  }
                  firstContact={firstContactIds.has(request.id)}
                  onChanged={() => void load()}
                />
              ))}
            </ul>
          )}

          <h2 className="mt-8 text-sm font-medium text-gray-700">
            Mes demandes envoyées
          </h2>
          {sent.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Aucune demande envoyée. Trouvez un trajet ouvert sur l’écran de
              votre hub.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {sent.map((request) => {
                const trip = sentTrips.get(request.trip_id)
                return (
                  <li key={request.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {trip?.scheduled_at
                            ? `${formatTripDate(trip.scheduled_at)} · ${trip.direction === 'aller' ? 'aller' : 'retour'}`
                            : 'Trajet plus disponible dans le hub'}
                        </p>
                        {trip && (
                          <p className="text-sm text-gray-500">
                            {trip.origin_label} → {trip.destination_label}
                            {trip.driver_first_name &&
                              ` · Conduit par ${trip.driver_first_name}`}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Pour {request.children?.first_name ?? 'un enfant'}
                        </p>
                        {request.status === 'accepte' &&
                          (dropoffs.has(
                            `${request.trip_id}|${request.child_id}`,
                          ) ? (
                            <p className="mt-1 text-sm font-medium text-green-700">
                              Dépôt confirmé par le conducteur à{' '}
                              {new Date(
                                dropoffs.get(
                                  `${request.trip_id}|${request.child_id}`,
                                ) as string,
                              ).toLocaleTimeString('fr-BE', {
                                timeZone: 'Europe/Brussels',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">
                              Dépôt : en attente de confirmation du conducteur.
                            </p>
                          ))}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${REQUEST_STATUS_STYLES[request.status]}`}
                      >
                        {REQUEST_STATUS_LABELS[request.status]}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

function ReceivedRequestRow({
  request,
  requesterName,
  firstContact,
  onChanged,
}: {
  request: ReceivedRequest
  requesterName: string
  firstContact: boolean
  onChanged: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Acceptation : clic explicite du conducteur, transaction atomique
  // côté base (accept_trip_request). Rien ne passe en accepté sans ce
  // clic — interdit n°4.
  async function accept() {
    setError(null)
    setSubmitting(true)

    const { error: rpcError } = await supabase.rpc('accept_trip_request', {
      p_request: request.id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      // La transaction a été annulée côté base : on recharge pour
      // afficher l'état réel, jamais un état optimiste.
      onChanged()
      return
    }

    setSubmitting(false)
    onChanged()
  }

  async function refuse() {
    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase
      .from('trip_requests')
      .update({ status: 'refuse', responded_at: new Date().toISOString() })
      .eq('id', request.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      onChanged()
      return
    }

    setSubmitting(false)
    onChanged()
  }

  const trip = request.trips

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {formatTripDate(trip.scheduled_at)} ·{' '}
            {trip.direction === 'aller' ? 'aller' : 'retour'}
            {trip.activities?.label && ` · ${trip.activities.label}`}
          </p>
          <p className="text-sm text-gray-500">
            {trip.origin_label} → {trip.destination_label}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            {requesterName} demande une place pour un enfant.
          </p>
          {request.message && (
            <p className="mt-1 rounded-md bg-gray-50 p-2 text-sm text-gray-600">
              « {request.message} »
            </p>
          )}
        </div>
        {request.status !== 'en_attente' && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${REQUEST_STATUS_STYLES[request.status]}`}
          >
            {REQUEST_STATUS_LABELS[request.status]}
          </span>
        )}
      </div>

      {request.status === 'en_attente' && firstContact && (
        <p className="mt-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          Ce serait le premier trajet entre votre foyer et celui de{' '}
          {requesterName}. Prenez contact avant le trajet pour faire
          connaissance et convenir des détails — rien ne presse, vous restez
          libre d’accepter ou non.
        </p>
      )}

      {request.status === 'en_attente' && (
        <div className="mt-2 flex gap-2">
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
            onClick={() => void accept()}
            disabled={submitting}
            className="btn-lagoon px-3.5 py-1.5 text-sm font-semibold"
          >
            {submitting ? 'Traitement…' : 'Accepter'}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </li>
  )
}
