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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-gray-900">Bienvenue</h1>
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Création en cours…' : 'Continuer'}
          </button>
        </form>
      </div>
    </main>
  )
}
