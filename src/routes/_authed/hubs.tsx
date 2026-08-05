import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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

  if (!householdId || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-gray-900">Les hubs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez d’abord créer ou rejoindre un foyer avant de participer
            à un hub.
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

  const validated = memberships.filter((m) => m.validated_at && m.hubs)
  const pending = memberships.filter((m) => !m.validated_at)
  const selectedMembership =
    validated.find((m) => m.hub_id === selectedHubId) ?? null
  const selectedHasPact = acceptances.some(
    (a) => a.hub_id === selectedHubId && a.pact_version === PACT_VERSION,
  )

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="rounded-lg bg-white p-8 shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Les hubs</h1>
            <div className="flex gap-3">
              <Link
                to="/semaine"
                className="text-sm text-blue-600 hover:underline"
              >
                Semaine
              </Link>
              <Link
                to="/foyer"
                className="text-sm text-blue-600 hover:underline"
              >
                Mon foyer
              </Link>
            </div>
          </div>

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
      <li className="text-xs text-gray-500">Pacte de Hub, version {PACT_VERSION}</li>
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
    <div className="rounded-lg bg-white p-8 shadow">
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
        className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Enregistrement…' : 'Accepter le pacte'}
      </button>
    </div>
  )
}

function HubDetail({ hubId, isAdmin }: { hubId: string; isAdmin: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hub, setHub] = useState<HubDetailData | null>(null)
  const [members, setMembers] = useState<Array<HubMemberProfile>>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [activationBanner, setActivationBanner] = useState(false)
  const previousStatus = useRef<HubStatus | null>(null)

  const load = useCallback(async () => {
    setError(null)

    const [hubResult, membersResult, thresholdResult] = await Promise.all([
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
    ])

    const firstError =
      hubResult.error ?? membersResult.error ?? thresholdResult.error
    if (firstError || !hubResult.data || !membersResult.data) {
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

    setHub(hubResult.data)
    setMembers(membersResult.data)
    setThreshold(
      thresholdResult.data ? Number(thresholdResult.data.value) : null,
    )
    setLoading(false)
  }, [hubId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-8 shadow">
        <p className="text-sm text-gray-500">Chargement du hub…</p>
      </div>
    )
  }

  if (error || !hub) {
    return (
      <div className="rounded-lg bg-white p-8 shadow">
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

  return (
    <div className="rounded-lg bg-white p-8 shadow">
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
    </div>
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
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="rounded-lg bg-white p-8 shadow">
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
          className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
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
              className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  Vous êtes déjà membre de « {foundHub.name} », ou votre
                  demande est déjà en attente.
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
                    className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Créer un hub</h2>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !pactAccepted || name.trim() === ''}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Création…' : 'Créer le hub'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
