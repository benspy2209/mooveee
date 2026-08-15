import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import {
  CalendarDays,
  HeartHandshake,
  House,
  Inbox,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchPendingDropoffReminders } from '@/lib/dropoff-reminders'
import { fetchUpcomingTripReminders } from '@/lib/concierge'

import type { DropoffReminder } from '@/lib/dropoff-reminders'
import type { TripReminder } from '@/lib/concierge'

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
})

// Enfants et Activités se rejoignent depuis Mon foyer : la barre reste
// à cinq entrées, le standard mobile.
const TAB_ITEMS = [
  { to: '/semaine', label: 'Semaine', icon: CalendarDays },
  { to: '/demandes', label: 'Demandes', icon: Inbox },
  { to: '/hubs', label: 'Hubs', icon: UsersRound },
  { to: '/equilibre', label: 'Équilibre', icon: HeartHandshake },
  { to: '/foyer', label: 'Foyer', icon: House },
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
    <div className="with-tabbar">
      <AppHeader />
      <DropoffReminderBanner userId={session.user.id} />
      <TripReminderBanner userId={session.user.id} />
      <Outlet />
      <AppTabBar pathname={pathname} />
    </div>
  )
}

// Chrome translucide : header en verre, le contenu défile dessous.
function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <span className="app-wordmark text-lg">
          Moov<em>eee</em>
        </span>
      </div>
    </header>
  )
}

// Navigation principale : barre d'onglets fixe en bas, pensée pouce
// (encapsulage iOS prévu, safe-area gérée en CSS).
function AppTabBar({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Navigation principale" className="app-tabbar">
      <ul className="mx-auto grid w-full max-w-md grid-cols-5">
        {TAB_ITEMS.map((item) => {
          const active = pathname === item.to
          const Icon = item.icon
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`tab-item flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] font-semibold ${
                  active ? 'is-active' : ''
                }`}
              >
                <span className="tab-glyph">
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
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
