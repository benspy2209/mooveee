import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { Database } from '@/types/database'

type Movement = Database['public']['Enums']['moove_movement']

// Vocabulaire imposé (CLAUDE.md) : aide apportée, aide reçue, dynamique
// de participation. Jamais solde, crédit, gagner, dépenser. Aucun euro.
const MOVEMENT_LABELS: Record<Movement, string> = {
  gain: 'Aide apportée — trajet conduit',
  usage: 'Aide reçue — place sur un trajet',
  ajustement: 'Ajustement',
  fonds_solidarite: 'Fonds de solidarité',
  solde_initial: 'Dynamique initiale',
}

interface LedgerEntry {
  id: string
  movement: Movement
  amount: number
  reason: string | null
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-BE', {
    timeZone: 'Europe/Brussels',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatAmount(amount: number): string {
  return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${Math.abs(amount)}`
}

export const Route = createFileRoute('/_authed/equilibre')({
  component: EquilibrePage,
})

function EquilibrePage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [entries, setEntries] = useState<Array<LedgerEntry>>([])

  const load = useCallback(async () => {
    if (!userId) return
    setLoadError(null)

    const [balanceResult, ledgerResult, imbalanceResult] = await Promise.all([
      supabase
        .from('mooves_balance')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('mooves_ledger')
        .select('id, movement, amount, reason, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      // mooves_imbalance_weeks : paramètre à null tant que le porteur
      // n'a pas arbitré. Lu ici pour être prêt, sans effet tant que
      // null (le déclenchement Concierge viendra plus tard).
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'mooves_imbalance_weeks')
        .maybeSingle(),
    ])

    const firstError =
      balanceResult.error ?? ledgerResult.error ?? imbalanceResult.error
    if (firstError || !ledgerResult.data) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setBalance(balanceResult.data?.balance ?? 0)
    setEntries(ledgerResult.data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Chargement…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Une erreur est survenue : {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Réessayer
          </button>
        </div>
      </main>
    )
  }

  const helpGiven = entries
    .filter((e) => e.movement === 'gain')
    .reduce((sum, e) => sum + e.amount, 0)
  const helpReceived = Math.abs(
    entries
      .filter((e) => e.movement === 'usage')
      .reduce((sum, e) => sum + e.amount, 0),
  )

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-gray-900">
            Mon équilibre d’entraide
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Ces informations sont strictement privées. Personne d’autre ne les
            voit : ni les familles du hub, ni à côté d’un trajet, ni sur un
            profil.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-2xl font-semibold text-green-800">
                {helpGiven}
              </p>
              <p className="mt-1 text-xs text-green-800">Aide apportée</p>
            </div>
            <div className="rounded-md bg-blue-50 p-4">
              <p className="text-2xl font-semibold text-blue-800">
                {helpReceived}
              </p>
              <p className="mt-1 text-xs text-blue-800">Aide reçue</p>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-2xl font-semibold text-gray-800">
                {formatAmount(balance)}
              </p>
              <p className="mt-1 text-xs text-gray-700">
                Dynamique de participation
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {balance > 0 &&
              'Vous apportez en ce moment plus d’aide que vous n’en recevez. Merci pour la communauté.'}
            {balance === 0 &&
              'Votre participation est à l’équilibre entre aide apportée et aide reçue.'}
            {balance < 0 &&
              'Vous recevez en ce moment plus d’aide que vous n’en apportez. C’est exactement à ça que sert l’entraide : rien n’est bloqué, demandez des places comme d’habitude.'}
          </p>

          <h2 className="mt-8 text-sm font-medium text-gray-700">
            Historique de participation
          </h2>
          {entries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Aucun mouvement pour le moment. Conduisez ou demandez une place
              via votre hub : chaque trajet accepté apparaîtra ici.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm text-gray-900">
                      {MOVEMENT_LABELS[entry.movement]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(entry.created_at)}
                      {entry.reason && ` · ${entry.reason}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      entry.amount >= 0 ? 'text-green-700' : 'text-blue-700'
                    }`}
                  >
                    {formatAmount(entry.amount)} Mooves
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
