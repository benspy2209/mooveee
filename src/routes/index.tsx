import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { readInvitation } from '@/lib/invitation'

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

  if (!session) {
    return <Navigate to="/login" />
  }

  // Une invitation à un hub en attente passe devant : la personne vient
  // de cliquer un lien partagé, elle attend l'écran des hubs, pas le sien.
  return <Navigate to={readInvitation() ? '/hubs' : '/foyer'} />
}
