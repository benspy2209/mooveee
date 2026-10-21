import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { prochaineEtape } from '@/lib/parcours'

import type { EtatParcours } from '@/lib/parcours'

// Accompagnement du parent en tête de la Semaine.
//
// Deux visages selon la situation, et un seul calcul derrière
// (`prochaineEtape`, dans lib/parcours) :
//
//  — configuration en cours : « Reprenons où vous en étiez », la
//    progression, l'étape qui manque et un seul bouton principal. Le
//    parent qui veut regarder sa semaine replie le bloc.
//  — tout est en place : un bonjour et le raccourci vers ce qu'il vient
//    probablement faire — examiner une demande reçue, sinon chercher
//    une place.
//
// Ce qui est VOLONTAIREMENT absent : score, série, badge, encouragement
// chiffré. L'interdit 5 proscrit tout score de contribution visible, et
// une barre de progression n'a sa place que sur la configuration, où
// elle mesure un formulaire, jamais sur l'entraide elle-même.
export interface TrajetACouvrir {
  id: string
  scheduled_at: string
  direction: 'aller' | 'retour'
  label: string | null
}

export function Accompagnement({
  etat,
  prenom,
  nbDemandesRecues,
  trajetACouvrir,
}: {
  etat: EtatParcours
  prenom: string | null
  nbDemandesRecues: number
  trajetACouvrir: TrajetACouvrir | null
}) {
  const [replie, setReplie] = useState(false)
  const etape = prochaineEtape(etat)

  if (etape.cle === 'pret') {
    return (
      <section className="island-shell rounded-3xl p-6">
        <h2 className="display-title text-2xl font-semibold">
          {prenom ? `Bonjour ${prenom}` : 'Bonjour'}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          Votre semaine, en un coup d'œil.
        </p>

        {/* Ce qui attend le parent, dans l'ordre où ça le concerne :
            d'abord ce qu'une autre famille lui demande, puis ce que son
            propre calendrier laisse en suspens. */}
        {nbDemandesRecues > 0 && (
          <Link
            to="/demandes"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-left"
          >
            <span className="text-sm text-teal-900">
              <span className="block font-medium">
                {nbDemandesRecues === 1
                  ? 'Une demande reçue'
                  : `${nbDemandesRecues} demandes reçues`}
              </span>
              <span className="mt-0.5 block">
                {nbDemandesRecues === 1
                  ? 'Une famille de votre groupe cherche une place.'
                  : 'Des familles de votre groupe cherchent une place.'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-teal-800">
              Examiner
            </span>
          </Link>
        )}

        {trajetACouvrir && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {trajetACouvrir.label ?? 'Trajet'} ·{' '}
              {trajetACouvrir.direction === 'retour' ? 'retour' : 'aller'}
            </p>
            <p className="mt-0.5 text-sm text-amber-900">
              {formatQuand(trajetACouvrir.scheduled_at)} ·{' '}
              {trajetACouvrir.direction === 'retour'
                ? 'retour à organiser'
                : 'aller à organiser'}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/hubs"
            className="btn-lagoon px-4 py-2.5 text-sm font-semibold"
          >
            Chercher une place
          </Link>
          <Link to="/activites" className="btn-ghost px-4 py-2.5 text-sm">
            Proposer une place
          </Link>
        </div>
      </section>
    )
  }

  if (replie) {
    return (
      <button
        type="button"
        onClick={() => setReplie(false)}
        className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-left text-sm text-teal-900"
      >
        <span className="font-medium">{etape.titre}</span>
        <span className="ml-2 text-teal-700">
          Étape {etape.rang} sur {etape.total} · reprendre
        </span>
      </button>
    )
  }

  const pourcentage = Math.round(((etape.rang - 1) / etape.total) * 100)

  return (
    <section className="island-shell rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={etape.rang}
          aria-valuemin={1}
          aria-valuemax={etape.total}
          aria-label="Progression de la configuration"
        >
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${Math.max(pourcentage, 6)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-500">
          Étape {etape.rang} sur {etape.total}
        </span>
      </div>

      <h2 className="display-title mt-4 text-2xl font-semibold">
        {etape.rang === 1 ? 'Bienvenue' : 'Reprenons où vous en étiez'}
      </h2>

      <div className="mt-4 rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-900">{etape.titre}</p>
        <p className="mt-1 text-sm text-gray-600">{etape.detail}</p>
      </div>

      <div className="mt-4 space-y-2">
        {etape.action ? (
          <Link
            to={etape.action.to}
            className="btn-lagoon block w-full px-4 py-2.5 text-center text-sm font-semibold"
          >
            {etape.action.libelle}
          </Link>
        ) : (
          // Étape qui ne dépend pas du parent : aucun bouton, sinon on
          // lui ferait croire qu'il peut accélérer une décision qui
          // appartient à une autre famille.
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Rien à faire de votre côté pour l'instant.
          </p>
        )}
        <button
          type="button"
          onClick={() => setReplie(true)}
          className="btn-ghost w-full px-4 py-2.5 text-sm"
        >
          Aller à ma semaine
        </button>
      </div>
    </section>
  )
}

// Heure locale belge : la base stocke en UTC, les parents lisent l'heure
// de leur montre (règle du projet sur le fuseau).
function formatQuand(iso: string): string {
  return new Date(iso).toLocaleString('fr-BE', {
    timeZone: 'Europe/Brussels',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
