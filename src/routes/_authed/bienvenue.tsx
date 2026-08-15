import { useState } from 'react'
import { Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

import type { FormEvent } from 'react'

export const Route = createFileRoute('/_authed/bienvenue')({
  component: BienvenuePage,
})

function BienvenuePage() {
  const { profile, createProfile } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (profile) {
    return <Navigate to="/foyer" />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await createProfile(firstName, lastName)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    void navigate({ to: '/foyer' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm island-shell rounded-3xl p-8">
        <h1 className="display-title text-2xl font-semibold">Bienvenue</h1>
        <p className="mt-2 text-sm text-gray-600">
          Pour terminer votre inscription, indiquez votre prénom.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="first-name"
              className="block text-sm font-medium text-gray-700"
            >
              Prénom
            </label>
            <input
              id="first-name"
              type="text"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="last-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nom <span className="text-gray-400">(optionnel)</span>
            </label>
            <input
              id="last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              Une erreur est survenue : {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || firstName.trim() === ''}
            className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
          >
            {submitting ? 'Création en cours…' : 'Continuer'}
          </button>
        </form>
      </div>
    </main>
  )
}
