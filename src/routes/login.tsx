import { useState } from 'react'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { FormEvent } from 'react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type Status = 'idle' | 'sending' | 'sent'
type Mode = 'code' | 'email'

function LoginPage() {
  const { signInWithEmail, verifyEmailOtp, session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('code')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Déjà connecté (magic link validé, connexion par code réussie…) : la
  // page de connexion n'a plus de raison d'être, direction le foyer.
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

        {mode === 'code' ? (
          <>
            <p className="mt-2 text-sm text-gray-600">
              Entrez votre adresse email et votre code d'accès.
            </p>
            <AccessCodeLogin />
            <button
              type="button"
              onClick={() => setMode('email')}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Pas de code d'accès ? Recevoir un code par email
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600">
              Recevez un code de connexion par email. Aucun mot de passe
              requis.
            </p>
            <EmailOtpLogin
              email={email}
              setEmail={setEmail}
              status={status}
              error={error}
              code={code}
              setCode={setCode}
              verifying={verifying}
              onSend={handleSubmit}
              onVerify={handleVerifyCode}
              onReset={() => {
                setStatus('idle')
                setCode('')
                setError(null)
              }}
            />
            <button
              type="button"
              onClick={() => setMode('code')}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              J'ai un code d'accès
            </button>
          </>
        )}
      </div>
    </main>
  )
}

function EmailOtpLogin({
  email,
  setEmail,
  status,
  error,
  code,
  setCode,
  verifying,
  onSend,
  onVerify,
  onReset,
}: {
  email: string
  setEmail: (v: string) => void
  status: Status
  error: string | null
  code: string
  setCode: (v: string) => void
  verifying: boolean
  onSend: (e: FormEvent<HTMLFormElement>) => void
  onVerify: (e: FormEvent<HTMLFormElement>) => void
  onReset: () => void
}) {
  return (
    <>
      {status === 'sent' ? (
          <div className="mt-6">
            <p className="rounded-md bg-green-50 p-4 text-sm text-green-800">
              Un email a été envoyé à{' '}
              <span className="font-medium">{email}</span>. Saisissez le code
              reçu, ou cliquez sur le lien dans l'email.
            </p>
            <form onSubmit={onVerify} className="mt-4 space-y-4">
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
                onClick={onReset}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Changer d'adresse ou renvoyer un email
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={onSend} className="mt-6 space-y-4">
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
                : 'Recevoir le code de connexion'}
            </button>
          </form>
        )}
    </>
  )
}

// Connexion par code d'accès : mot de passe Supabase posé par
// l'administrateur via `npm run set-dev-password`. Mode principal tant
// que l'envoi d'email (SMTP plafonné) n'est pas branché.
function AccessCodeLogin() {
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
          'Connexion par code désactivée côté Supabase. À activer dans Authentication → Sign In / Providers.',
        )
        return
      }
      if (/invalid login credentials/i.test(signInError.message)) {
        setError('Email ou code d’accès incorrect.')
        return
      }
      setError(signInError.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="code-email"
          className="block text-sm font-medium text-gray-700"
        >
          Adresse email
        </label>
        <input
          id="code-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="vous@exemple.be"
        />
      </div>

      <div>
        <label
          htmlFor="access-code"
          className="block text-sm font-medium text-gray-700"
        >
          Code d'accès
        </label>
        <input
          id="access-code"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Connexion en cours…' : 'Se connecter'}
      </button>
    </form>
  )
}
