import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/')({ component: Home })

// La racine ne montre rien : connecté → /foyer, anonyme → /login.
// C'est aussi ici qu'atterrit le magic link (redirection vers
// l'origine) : on attend la fin du chargement de session — le client
// Supabase traite le hash d'authentification avant de la résoudre.
function Home() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    )
  }

  return <Navigate to={session ? '/foyer' : '/login'} />
}
