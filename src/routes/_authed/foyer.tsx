import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/_authed/foyer')({
  component: FoyerPage,
})

function FoyerPage() {
  const { user, signOut } = useAuth()

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-gray-900">Votre foyer</h1>
        <p className="mt-2 text-sm text-gray-600">
          Vous êtes connecté en tant que{' '}
          <span className="font-medium">{user?.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Se déconnecter
        </button>
      </div>
    </main>
  )
}
