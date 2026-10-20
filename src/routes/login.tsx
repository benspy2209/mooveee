import { useState } from 'react'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { readInvitation } from '@/lib/invitation'

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
    // Même règle qu'à la racine : une invitation en attente mène aux hubs.
    return <Navigate to={readInvitation() ? '/hubs' : '/foyer'} />
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="island-shell rise-in w-full max-w-sm rounded-3xl p-8">
        <p className="island-kicker">Trajets partagés entre familles</p>
        <h1 className="app-wordmark mt-1 text-4xl">
          Moov<em>eee</em>
        </h1>

        {mode === 'code' ? (
          <>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              Entrez votre code d'accès.
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
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              Recevez un code de connexion par email. Aucun mot de passe requis.
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
            Un email a été envoyé à <span className="font-medium">{email}</span>
            . Saisissez le code reçu, ou cliquez sur le lien dans l'email.
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
                className="field-lagoon mt-1 w-full px-3 py-3 text-center text-lg tracking-[0.4em]"
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
              className="btn-lagoon w-full px-4 py-2.5 text-sm font-semibold"
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
              className="field-lagoon mt-1 w-full px-3 py-3 text-sm"
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
            className="btn-lagoon w-full px-4 py-2.5 text-sm font-semibold"
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
// que l'envoi d'email (SMTP Brevo, décision D2 du 11/10) n'est pas branché.
// La correspondance préfixe → compte vit dans le secret ACCESS_CODE_EMAILS
// de l'Edge Function `access-code-login` : plus aucun email dans le bundle
// (rétro cadrage du 11/10/2026, trou B.1). Le client ne fait que poser la
// session renvoyée.
function AccessCodeLogin() {
  const [accessCode, setAccessCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const code = accessCode.trim().toLowerCase()
    if (!code.includes('-')) {
      setError('Code d’accès invalide.')
      return
    }

    setSubmitting(true)
    const { data, error: invokeError } = await supabase.functions.invoke<{
      access_token?: string
      refresh_token?: string
      error?: string
    }>('access-code-login', { body: { code } })

    if (invokeError || !data?.access_token || !data.refresh_token) {
      setSubmitting(false)
      // La fonction renvoie un JSON { error } avec un statut 4xx/5xx ;
      // le client functions-js l'expose via le contexte de l'erreur.
      let message = 'Code d’accès invalide.'
      if (invokeError && 'context' in invokeError) {
        const ctx = (invokeError as { context?: Response }).context
        try {
          const body = ctx ? await ctx.clone().json() : null
          if (body?.error) message = String(body.error)
        } catch {
          // corps non JSON : message par défaut
        }
      } else if (data?.error) {
        message = data.error
      }
      setError(message)
      return
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    setSubmitting(false)
    if (sessionError) {
      setError(sessionError.message)
    }
    // Succès : onAuthStateChange pose la session, <Navigate to="/foyer" />
    // prend le relais.
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="access-code"
          className="block text-sm font-medium text-gray-700"
        >
          Code d'accès
        </label>
        <input
          id="access-code"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          className="field-lagoon mt-1 w-full px-3 py-3 text-center text-base tracking-wide"
          placeholder="ex. ben-12345678"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn-lagoon w-full px-4 py-2.5 text-sm font-semibold"
      >
        {submitting ? 'Connexion en cours…' : 'Se connecter'}
      </button>
    </form>
  )
}
