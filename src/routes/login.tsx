import { useState } from 'react'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { FormEvent } from 'react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type Status = 'idle' | 'sending' | 'sent'

function LoginPage() {
  const { signInWithEmail, verifyEmailOtp, session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Déjà connecté (magic link validé, connexion dev réussie…) : la page
  // de connexion n'a plus de raison d'être, direction le foyer.
  if (!loading && session) {
    return <Navigate to="/foyer" />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setStatus('sending')

    const result = await signInWithEmail(email)
    if (result.error) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setVerifying(true)

    const result = await verifyEmailOtp(email, code.trim())
    setVerifying(false)
    if (result.error) {
      setError(result.error)
    }
    // Succès : la session arrive par onAuthStateChange et le
    // <Navigate to="/foyer" /> ci-dessus prend le relais.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-gray-900">Connexion</h1>
        <p className="mt-2 text-sm text-gray-600">
          Recevez un code de connexion par email. Aucun mot de passe requis.
        </p>

        {status === 'sent' ? (
          <div className="mt-6">
            <p className="rounded-md bg-green-50 p-4 text-sm text-green-800">
              Un email a été envoyé à{' '}
              <span className="font-medium">{email}</span>. Saisissez le code
              reçu, ou cliquez sur le lien dans l'email.
            </p>
            <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="otp-code"
                  className="block text-sm font-medium text-gray-700"
                >
                  Code de connexion
                </label>
                <input
                  id="otp-code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.4em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="000000"
                />
              </div>

              {error && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  Une erreur est survenue : {error}
                </p>
              )}

              <button
                type="submit"
                disabled={verifying || code.trim().length < 6}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? 'Vérification…' : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('idle')
                  setCode('')
                  setError(null)
                }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Changer d'adresse ou renvoyer un email
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="vous@exemple.be"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                Une erreur est survenue : {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending'
                ? 'Envoi en cours…'
                : 'Recevoir le lien de connexion'}
            </button>
          </form>
        )}

        {import.meta.env.DEV && <DevPasswordLogin />}
      </div>
    </main>
  )
}

// Contournement du SMTP Supabase plafonné pour les tests multi-comptes.
// Le mot de passe se définit via `npm run set-dev-password`. Ce bloc est
// gardé par import.meta.env.DEV : il est éliminé du bundle de production,
// où le magic link reste le seul mode de connexion.
function DevPasswordLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setSubmitting(false)

    if (signInError) {
      if (/disabled/i.test(signInError.message)) {
        setError(
          'Connexion par mot de passe désactivée côté Supabase. À activer dans Authentication → Sign In / Providers.',
        )
        return
      }
      setError(signInError.message)
    }
  }

  return (
    <div className="mt-8 border-t border-dashed border-amber-300 pt-6">
      <h2 className="text-sm font-semibold text-amber-700">
        Connexion de développement — indisponible en production
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="dev-email"
            className="block text-sm font-medium text-gray-700"
          >
            Adresse email
          </label>
          <input
            id="dev-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="vous@exemple.be"
          />
        </div>

        <div>
          <label
            htmlFor="dev-password"
            className="block text-sm font-medium text-gray-700"
          >
            Mot de passe
          </label>
          <input
            id="dev-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Connexion en cours…' : 'Se connecter (dev)'}
        </button>
      </form>
    </div>
  )
}
