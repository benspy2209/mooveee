import {
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

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

  return <Outlet />
}
