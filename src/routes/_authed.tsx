import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchPendingDropoffReminders } from '@/lib/dropoff-reminders'
import { fetchUpcomingTripReminders } from '@/lib/concierge'

import type { DropoffReminder } from '@/lib/dropoff-reminders'
import type { TripReminder } from '@/lib/concierge'

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
})

const NAV_ITEMS = [
  { to: '/foyer', label: 'Mon foyer' },
  { to: '/enfants', label: 'Les enfants' },
  { to: '/activites', label: 'Les activités' },
  { to: '/semaine', label: 'La semaine' },
  { to: '/hubs', label: 'Les hubs' },
  { to: '/demandes', label: 'Les demandes' },
  { to: '/equilibre', label: 'Mon équilibre' },
] as const

function AuthedLayout() {
  const { session, loading, profile, profileLoading } = useAuth()
  const { pathname } = useLocation()

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" />
  }

  if (!profile && pathname !== '/bienvenue') {
    return <Navigate to="/bienvenue" />
  }

  return (
    <>
      <AppHeader pathname={pathname} />
      <DropoffReminderBanner userId={session.user.id} />
      <TripReminderBanner userId={session.user.id} />
      <Outlet />
    </>
  )
}

// Navigation principale : un hamburger accessible partout, pensé
// mobile d'abord (encapsulage iOS prévu) — zones de clic confortables,
// aucune interaction au survol seul.
function AppHeader({ pathname }: { pathname: string }) {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2">
        <span className="text-base font-semibold text-gray-900">Mooveee</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="-mr-2 rounded-md p-3 text-gray-700 hover:bg-gray-100"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <nav
            aria-label="Navigation principale"
            className="ml-auto flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-base font-semibold text-gray-900">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="-mr-2 rounded-md p-3 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.to
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-5 py-3.5 text-base ${
                        active
                          ? 'border-l-4 border-blue-600 bg-blue-50 font-semibold text-blue-700'
                          : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void signOut()
                }}
                className="w-full rounded-md border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                Se déconnecter
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

// Relance du bulletin de trajet (Doc1 §12.2) : affichée à l'ouverture
// de l'app pour le conducteur concerné. Pas de push pour l'instant —
// le point d'accroche est documenté dans lib/dropoff-reminders.ts.
function DropoffReminderBanner({ userId }: { userId: string }) {
  const [reminders, setReminders] = useState<Array<DropoffReminder>>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchPendingDropoffReminders(userId).then((result) => {
      if (!cancelled) setReminders(result)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (dismissed || reminders.length === 0) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-3">
        <div className="text-sm text-amber-900">
          <p className="font-medium">
            Des dépôts d’enfants attendent votre confirmation.
          </p>
          <ul className="mt-1 space-y-0.5">
            {reminders.map((r) => (
              <li key={r.tripId}>
                Trajet de{' '}
                {new Date(r.scheduledAt).toLocaleString('fr-BE', {
                  timeZone: 'Europe/Brussels',
                  weekday: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ({r.originLabel} → {r.destinationLabel}) : {r.unconfirmedCount}{' '}
                dépôt
                {r.unconfirmedCount > 1 ? 's' : ''} à confirmer.
              </li>
            ))}
          </ul>
          <Link
            to="/semaine"
            className="mt-1 inline-block font-medium underline hover:text-amber-700"
          >
            Ouvrir la semaine pour confirmer
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-sm text-amber-700 hover:text-amber-900"
        >
          Masquer
        </button>
      </div>
    </div>
  )
}

// Concierge (étape 9) : rappel avant un trajet à venir, pour le
// conducteur comme pour les familles dont un enfant est à bord.
// Détection au chargement, fenêtre app_settings
// (concierge_trip_reminder_hours). Accroche push : lib/concierge.ts.
function TripReminderBanner({ userId }: { userId: string }) {
  const [reminders, setReminders] = useState<Array<TripReminder>>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
      .then(async ({ data: membership }) => {
        if (!membership) return
        const result = await fetchUpcomingTripReminders(
          userId,
          membership.household_id,
        )
        if (!cancelled) setReminders(result)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (dismissed || reminders.length === 0) return null

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
      <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-3">
        <div className="text-sm text-blue-900">
          <p className="font-medium">
            Trajet{reminders.length > 1 ? 's' : ''} à venir prochainement.
          </p>
          <ul className="mt-1 space-y-0.5">
            {reminders.map((r) => (
              <li key={`${r.tripId}-${r.role}`}>
                {new Date(r.scheduledAt).toLocaleString('fr-BE', {
                  timeZone: 'Europe/Brussels',
                  weekday: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ({r.originLabel} → {r.destinationLabel}) —{' '}
                {r.role === 'conducteur'
                  ? 'vous conduisez'
                  : r.childFirstName
                    ? `${r.childFirstName} est à bord`
                    : 'votre enfant est à bord'}
                .
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-sm text-blue-700 hover:text-blue-900"
        >
          Masquer
        </button>
      </div>
    </div>
  )
}
