import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  createFileRoute,
  useSearch,
} from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { normalizeJoinCode, rememberInvitation } from '@/lib/invitation'

export const Route = createFileRoute('/rejoindre')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  component: RejoindrePage,
})

// Atterrissage d'un lien d'invitation partagé par WhatsApp, SMS ou email.
//
// Cette page ne fait rien d'autre que mémoriser le code et envoyer la
// personne au bon endroit : la demande d'adhésion elle-même reste dans
// l'écran Hubs, avec son Pacte de Hub et sa validation par un
// responsable. Une seule implémentation du parcours d'adhésion, donc
// aucun risque qu'un raccourci oublie le pacte ou la validation.
//
// Route publique : un visiteur non connecté doit pouvoir ouvrir le lien.
// Le code ne lui apprend rien — le rôle anon ne peut résoudre aucun hub,
// le nom n'apparaît qu'une fois connecté.
function RejoindrePage() {
  const { code } = useSearch({ from: '/rejoindre' })
  const { session, loading } = useAuth()
  const [remembered, setRemembered] = useState(false)

  const valid = normalizeJoinCode(code)

  useEffect(() => {
    if (valid) {
      rememberInvitation(valid)
    }
    setRemembered(true)
  }, [valid])

  if (!valid) {
    return (
      <Shell>
        <p className="mt-4 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          Ce lien d'invitation est incomplet ou périmé. Demandez à la personne
          qui vous l'a envoyé de le partager à nouveau, ou saisissez le code
          d'adhésion directement dans l'application.
        </p>
      </Shell>
    )
  }

  if (loading || !remembered) {
    return (
      <Shell>
        <p className="mt-4 text-sm text-gray-500">Un instant…</p>
      </Shell>
    )
  }

  // Connecté : l'écran Hubs reprend l'invitation, ouvre le formulaire et
  // pré-remplit le code. S'il manque le profil ou le foyer, la garde du
  // groupe authentifié renvoie d'abord vers l'inscription, et la
  // bannière ramène ensuite ici.
  if (session) {
    return <Navigate to="/hubs" />
  }

  return (
    <Shell>
      <p className="mt-4 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
        Vous êtes invité à rejoindre un groupe de familles qui partagent les
        trajets de leurs enfants.
      </p>
      <p className="mt-3 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
        Connectez-vous avec votre adresse email, ou créez votre compte : nous
        garderons cette invitation de côté. Un responsable du groupe devra
        accepter votre demande avant que vous ne voyiez les trajets.
      </p>

      <p className="mt-6 text-center font-mono text-2xl tracking-[0.3em] text-gray-900">
        {valid}
      </p>

      <Link
        to="/login"
        className="btn-lagoon mt-6 block w-full px-4 py-2.5 text-center text-sm font-semibold"
      >
        Continuer
      </Link>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="island-shell rise-in w-full max-w-sm rounded-3xl p-8">
        <p className="island-kicker">Invitation</p>
        <h1 className="app-wordmark mt-1 text-4xl">
          Moov<em>eee</em>
        </h1>
        {children}
      </div>
    </main>
  )
}
