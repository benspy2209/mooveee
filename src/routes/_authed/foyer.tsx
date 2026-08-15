import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Baby, CalendarHeart, Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { FormEvent } from 'react'
import type { Database } from '@/types/database'

type HouseholdRole = Database['public']['Enums']['household_role']

const ROLE_LABELS: Record<HouseholdRole, string> = {
  parent: 'Parent',
  beau_parent: 'Beau-parent',
  grand_parent: 'Grand-parent',
  autre_referent: 'Autre référent',
}

interface Member {
  id: string
  user_id: string
  role: HouseholdRole
  is_admin: boolean
  users: { first_name: string; last_name: string | null } | null
}

interface Invitation {
  id: string
  email: string
  role: HouseholdRole
}

interface HouseholdData {
  id: string
  name: string
  members: Array<Member>
  invitations: Array<Invitation>
}

export const Route = createFileRoute('/_authed/foyer')({
  component: FoyerPage,
})

function FoyerPage() {
  const { user, signOut } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [household, setHousehold] = useState<HouseholdData | null>(null)

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
      setHousehold(null)
      setLoading(false)
      return
    }

    const householdId = membership.household_id

    const [householdResult, membersResult, invitationsResult] =
      await Promise.all([
        supabase
          .from('households')
          .select('id, name')
          .eq('id', householdId)
          .single(),
        supabase
          .from('household_members')
          .select('id, user_id, role, is_admin, users(first_name, last_name)')
          .eq('household_id', householdId)
          .order('joined_at'),
        supabase
          .from('household_invitations')
          .select('id, email, role')
          .eq('household_id', householdId)
          .eq('status', 'en_attente')
          .order('created_at'),
      ])

    const firstError =
      householdResult.error ?? membersResult.error ?? invitationsResult.error
    if (
      firstError ||
      !householdResult.data ||
      !membersResult.data ||
      !invitationsResult.data
    ) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setHousehold({
      id: householdResult.data.id,
      name: householdResult.data.name,
      members: membersResult.data,
      invitations: invitationsResult.data,
    })
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

  if (!household) {
    return <CreateHouseholdScreen onCreated={() => void load()} />
  }

  return (
    <HouseholdScreen
      household={household}
      currentUserId={userId}
      onChanged={() => void load()}
      onSignOut={() => void signOut()}
    />
  )
}

function CreateHouseholdScreen({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)

    const { data: created, error: householdError } = await supabase
      .from('households')
      .insert({ name: name.trim(), created_by: user.id })
      .select('id')
      .single()

    if (householdError) {
      setError(householdError.message)
      setSubmitting(false)
      return
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: created.id,
        user_id: user.id,
        role: 'parent',
        is_admin: true,
      })

    if (memberError) {
      setError(memberError.message)
      setSubmitting(false)
      return
    }

    onCreated()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm island-shell rounded-3xl p-8">
        <h1 className="display-title text-2xl font-semibold">
          Créez votre foyer
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Vous n’appartenez encore à aucun foyer. Donnez-lui un nom pour
          commencer, par exemple le nom de votre famille.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="household-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nom du foyer
            </label>
            <input
              id="household-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || name.trim() === ''}
            className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
          >
            {submitting ? 'Création en cours…' : 'Créer le foyer'}
          </button>
        </form>
      </div>
    </main>
  )
}

function HouseholdScreen({
  household,
  currentUserId,
  onChanged,
  onSignOut,
}: {
  household: HouseholdData
  currentUserId: string | null
  onChanged: () => void
  onSignOut: () => void
}) {
  const isAdmin = household.members.some(
    (m) => m.user_id === currentUserId && m.is_admin,
  )

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="island-shell rise-in rounded-3xl p-8">
          <p className="island-kicker">Mon foyer</p>
          <h1 className="display-title mt-1 text-3xl font-semibold">
            {household.name}
          </h1>

          <ul className="mt-6 space-y-3">
            {household.members.map((member, index) => (
              <li key={member.id} className="flex items-center gap-3">
                <span className={`avatar-dot alt-${index % 3}`}>
                  {(member.users?.first_name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {member.users
                    ? `${member.users.first_name}${member.users.last_name ? ` ${member.users.last_name}` : ''}`
                    : 'Profil non renseigné'}
                  {member.user_id === currentUserId && (
                    <span className="font-normal text-gray-400"> (vous)</span>
                  )}
                </span>
                <span className="btn-ghost px-3 py-1 text-xs">
                  {ROLE_LABELS[member.role]}
                </span>
              </li>
            ))}
            {household.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 opacity-70"
              >
                <span className="avatar-dot" style={{ opacity: 0.45 }}>
                  <Mail size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {invitation.email}
                </span>
                <span className="btn-ghost px-3 py-1 text-xs">Invité·e</span>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <InviteForm householdId={household.id} onInvited={onChanged} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/enfants"
            className="island-shell feature-card rise-in d-1 flex flex-col items-start gap-2 rounded-3xl p-5"
          >
            <span className="avatar-dot alt-1">
              <Baby size={18} aria-hidden />
            </span>
            <span className="text-sm font-semibold">Les enfants</span>
            <span className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              Profils et photos du foyer
            </span>
          </Link>

          <Link
            to="/activites"
            className="island-shell feature-card rise-in d-2 flex flex-col items-start gap-2 rounded-3xl p-5"
          >
            <span className="avatar-dot alt-2">
              <CalendarHeart size={18} aria-hidden />
            </span>
            <span className="text-sm font-semibold">Les activités</span>
            <span className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              Foot, musique, école… et leurs trajets
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="rise-in d-3 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Se déconnecter
        </button>
      </div>
    </main>
  )
}

function InviteForm({
  householdId,
  onInvited,
}: {
  householdId: string
  onInvited: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<HouseholdRole>('parent')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)

    const { error: insertError } = await supabase
      .from('household_invitations')
      .insert({
        household_id: householdId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user.id,
      })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setEmail('')
    setRole('parent')
    setOpen(false)
    setSubmitting(false)
    onInvited()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
      >
        Inviter un adulte responsable
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="invite-email"
          className="block text-sm font-medium text-gray-700"
        >
          Email de l’adulte à inviter
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="invite-role"
          className="block text-sm font-medium text-gray-700"
        >
          Rôle dans le foyer
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as HouseholdRole)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
          disabled={submitting || email.trim() === ''}
          className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
        >
          {submitting ? 'Envoi…' : 'Inviter'}
        </button>
      </div>
    </form>
  )
}
