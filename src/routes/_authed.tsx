import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { fetchPendingDropoffReminders } from '@/lib/dropoff-reminders'

import type { DropoffReminder } from '@/lib/dropoff-reminders'

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
})

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
      <DropoffReminderBanner userId={session.user.id} />
      <Outlet />
    </>
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
    <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-3">
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
