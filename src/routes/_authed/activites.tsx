import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HORIZON_DAYS, generateTripsForHousehold } from '@/lib/trips'

import type { FormEvent } from 'react'
import type { Database } from '@/types/database'

interface ChildOption {
  id: string
  first_name: string
}

interface Activity {
  id: string
  child_id: string
  label: string
  location_label: string | null
  distance_band: DistanceBand
  rrule: string | null
  starts_at: string | null
  ends_at: string | null
}

// Tranches de distance (arbitrage porteur, migration 0015) : un menu
// déroulant, jamais de saisie libre, jamais d'adresse ni de
// coordonnées. La tranche se propage aux trajets générés et indexe le
// gain Mooves à l'acceptation.
type DistanceBand = Database['public']['Enums']['distance_band']

const DISTANCE_BANDS: Array<{ value: DistanceBand; label: string }> = [
  { value: 'courte', label: 'Moins de 3 km' },
  { value: 'moyenne', label: 'De 3 à 15 km' },
  { value: 'longue', label: 'Plus de 15 km' },
]

// Jours au format BYDAY d'iCal RRULE, ordre lundi → dimanche.
const WEEKDAYS: Array<{ code: string; label: string; jsDay: number }> = [
  { code: 'MO', label: 'Lundi', jsDay: 1 },
  { code: 'TU', label: 'Mardi', jsDay: 2 },
  { code: 'WE', label: 'Mercredi', jsDay: 3 },
  { code: 'TH', label: 'Jeudi', jsDay: 4 },
  { code: 'FR', label: 'Vendredi', jsDay: 5 },
  { code: 'SA', label: 'Samedi', jsDay: 6 },
  { code: 'SU', label: 'Dimanche', jsDay: 0 },
]

function buildRrule(dayCodes: Array<string>) {
  const ordered = WEEKDAYS.filter((d) => dayCodes.includes(d.code)).map(
    (d) => d.code,
  )
  return `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`
}

function parseRruleDays(rrule: string): Array<string> {
  const byday = rrule.split(';').find((part) => part.startsWith('BYDAY='))
  if (!byday) return []
  return byday
    .slice('BYDAY='.length)
    .split(',')
    .filter((code) => WEEKDAYS.some((d) => d.code === code))
}

function toTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function combine(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

// Prochaine date (aujourd'hui inclus) tombant sur l'un des jours cochés.
// Sert d'ancre DTSTART : starts_at/ends_at portent l'heure de début et
// de fin, rrule porte la récurrence.
function nextAnchorDate(dayCodes: Array<string>): string {
  const jsDays = WEEKDAYS.filter((d) => dayCodes.includes(d.code)).map(
    (d) => d.jsDay,
  )
  const d = new Date()
  for (let i = 0; i < 7; i++) {
    if (jsDays.includes(d.getDay())) break
    d.setDate(d.getDate() + 1)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function describeActivity(activity: Activity): string {
  const start = toTimeInput(activity.starts_at)
  const end = toTimeInput(activity.ends_at)
  const hours = start && end ? ` de ${start} à ${end}` : ''

  if (activity.rrule) {
    const labels = WEEKDAYS.filter((d) =>
      parseRruleDays(activity.rrule ?? '').includes(d.code),
    ).map((d) => d.label)
    return `Chaque ${labels.join(', ')}${hours}`
  }

  if (activity.starts_at) {
    const d = new Date(activity.starts_at)
    const date = d.toLocaleDateString('fr-BE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `Le ${date}${hours}`
  }

  return 'Horaire non renseigné'
}

export const Route = createFileRoute('/_authed/activites')({
  component: ActivitesPage,
})

function ActivitesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [childrenList, setChildrenList] = useState<Array<ChildOption>>([])
  const [activities, setActivities] = useState<Array<Activity>>([])

  const load = useCallback(async () => {
    if (!userId) return
    setLoadError(null)

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      setLoadError(membershipError.message)
      setLoading(false)
      return
    }

    if (!membership) {
      setHouseholdId(null)
      setLoading(false)
      return
    }

    const [childrenResult, activitiesResult] = await Promise.all([
      supabase
        .from('children')
        .select('id, first_name')
        .eq('household_id', membership.household_id)
        .order('created_at'),
      supabase
        .from('activities')
        .select(
          'id, child_id, label, location_label, distance_band, rrule, starts_at, ends_at',
        )
        .eq('household_id', membership.household_id)
        .order('created_at'),
    ])

    const firstError = childrenResult.error ?? activitiesResult.error
    if (firstError || !childrenResult.data || !activitiesResult.data) {
      setLoadError(firstError?.message ?? 'Réponse inattendue du serveur')
      setLoading(false)
      return
    }

    setHouseholdId(membership.household_id)
    setChildrenList(childrenResult.data)
    setActivities(activitiesResult.data)
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
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm island-shell rounded-3xl p-8">
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Une erreur est survenue : {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="mt-4 w-full btn-ghost px-4 py-2 text-sm"
          >
            Réessayer
          </button>
        </div>
      </main>
    )
  }

  if (!householdId) {
    return (
      <MessageScreen
        message="Vous devez d’abord créer ou rejoindre un foyer avant de gérer des activités."
        linkTo="/foyer"
        linkLabel="Aller à mon foyer"
      />
    )
  }

  if (childrenList.length === 0) {
    return (
      <MessageScreen
        message="Ajoutez d’abord un enfant au foyer : les activités sont toujours rattachées à un enfant."
        linkTo="/enfants"
        linkLabel="Gérer les enfants"
      />
    )
  }

  return (
    <ActivitiesScreen
      householdId={householdId}
      childrenList={childrenList}
      activities={activities}
      onChanged={() => void load()}
    />
  )
}

function MessageScreen({
  message,
  linkTo,
  linkLabel,
}: {
  message: string
  linkTo: string
  linkLabel: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm island-shell rounded-3xl p-8">
        <h1 className="display-title text-2xl font-semibold">
          Les activités des enfants
        </h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <Link
          to={linkTo}
          className="mt-6 block w-full btn-lagoon px-4 py-2.5 text-center text-sm font-semibold"
        >
          {linkLabel}
        </Link>
      </div>
    </main>
  )
}

function ActivitiesScreen({
  householdId,
  childrenList,
  activities,
  onChanged,
}: {
  householdId: string
  childrenList: Array<ChildOption>
  activities: Array<Activity>
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Résultat de la génération automatique après enregistrement d'une
  // activité : confirmation ou avertissement, affiché ici car le
  // formulaire se ferme.
  const [notice, setNotice] = useState<{
    kind: 'success' | 'warning'
    text: string
  } | null>(null)

  function handleDone(generationWarning: string | null) {
    setAdding(false)
    setEditingId(null)
    setNotice(
      generationWarning
        ? { kind: 'warning', text: generationWarning }
        : {
            kind: 'success',
            text: 'Activité enregistrée : ses trajets sont prêts jusqu’à trois mois à l’avance. Retrouvez-les dans « La semaine ».',
          },
    )
    onChanged()
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="island-shell rounded-3xl p-8">
          <h1 className="display-title text-2xl font-semibold">
            Les activités des enfants
          </h1>

          {notice && (
            <p
              className={`mt-4 rounded-md p-3 text-sm ${
                notice.kind === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {notice.text}
            </p>
          )}

          {activities.length === 0 && !adding && (
            <p className="mt-4 text-sm text-gray-600">
              Aucune activité pour le moment. Ajoutez les activités régulières
              ou ponctuelles de vos enfants pour préparer les trajets.
            </p>
          )}

          {childrenList.map((child) => {
            const childActivities = activities.filter(
              (a) => a.child_id === child.id,
            )
            if (childActivities.length === 0) return null
            return (
              <div key={child.id} className="mt-6">
                <h2 className="text-sm font-medium text-gray-700">
                  {child.first_name}
                </h2>
                <ul className="mt-2 divide-y divide-gray-100">
                  {childActivities.map((activity) =>
                    editingId === activity.id ? (
                      <li key={activity.id} className="py-4">
                        <ActivityForm
                          householdId={householdId}
                          childrenList={childrenList}
                          activity={activity}
                          onDone={handleDone}
                          onCancel={() => setEditingId(null)}
                        />
                      </li>
                    ) : (
                      <ActivityRow
                        key={activity.id}
                        activity={activity}
                        onEdit={() => {
                          setAdding(false)
                          setEditingId(activity.id)
                        }}
                        onDeleted={onChanged}
                      />
                    ),
                  )}
                </ul>
              </div>
            )
          })}

          {adding ? (
            <div className="mt-6">
              <ActivityForm
                householdId={householdId}
                childrenList={childrenList}
                onDone={handleDone}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setAdding(true)
              }}
              className="mt-6 w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
            >
              Ajouter une activité
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function ActivityRow({
  activity,
  onEdit,
  onDeleted,
}: {
  activity: Activity
  onEdit: () => void
  onDeleted: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('activities')
      .delete()
      .eq('id', activity.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    onDeleted()
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{activity.label}</p>
          <p className="text-sm text-gray-500">
            {describeActivity(activity)}
            {activity.location_label && ` · ${activity.location_label}`}
          </p>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="btn-ghost px-3.5 py-1.5 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Suppression…' : 'Confirmer'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="btn-ghost px-3.5 py-1.5 text-sm"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Supprimer l’activité « {activity.label} » ? Cette action est
          définitive.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}
    </li>
  )
}

function ActivityForm({
  householdId,
  childrenList,
  activity,
  onDone,
  onCancel,
}: {
  householdId: string
  childrenList: Array<ChildOption>
  activity?: Activity
  onDone: (generationWarning: string | null) => void
  onCancel: () => void
}) {
  const [childId, setChildId] = useState(
    activity?.child_id ?? childrenList[0].id,
  )
  const [label, setLabel] = useState(activity?.label ?? '')
  const [location, setLocation] = useState(activity?.location_label ?? '')
  const [distanceBand, setDistanceBand] = useState<DistanceBand>(
    activity?.distance_band ?? 'courte',
  )
  const [weekly, setWeekly] = useState(Boolean(activity?.rrule))
  const [days, setDays] = useState<Array<string>>(
    activity?.rrule ? parseRruleDays(activity.rrule) : [],
  )
  const [date, setDate] = useState(
    activity && !activity.rrule ? toDateInput(activity.starts_at) : '',
  )
  const [startTime, setStartTime] = useState(
    toTimeInput(activity?.starts_at ?? null),
  )
  const [endTime, setEndTime] = useState(toTimeInput(activity?.ends_at ?? null))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(code: string) {
    setDays((current) =>
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (weekly && days.length === 0) {
      setError('Choisissez au moins un jour de la semaine.')
      return
    }
    if (startTime >= endTime) {
      setError('L’heure de fin doit être après l’heure de début.')
      return
    }

    // Hebdomadaire : rrule iCal (FREQ=WEEKLY;BYDAY=…), starts_at/ends_at
    // servent d'ancre DTSTART et portent les heures de début et de fin.
    // Ponctuel : rrule null, starts_at/ends_at datent l'occurrence unique.
    const anchorDate = weekly ? nextAnchorDate(days) : date
    const values = {
      child_id: childId,
      label: label.trim(),
      location_label: location.trim() === '' ? null : location.trim(),
      distance_band: distanceBand,
      rrule: weekly ? buildRrule(days) : null,
      starts_at: combine(anchorDate, startTime).toISOString(),
      ends_at: combine(anchorDate, endTime).toISOString(),
    }

    setSubmitting(true)

    const { error: submitError } = activity
      ? await supabase.from('activities').update(values).eq('id', activity.id)
      : await supabase
          .from('activities')
          .insert({ ...values, household_id: householdId })

    if (submitError) {
      setError(submitError.message)
      setSubmitting(false)
      return
    }

    // Génération automatique : les trajets de l'activité apparaissent
    // sans passer par « Générer les trajets » (retour porteur). Horizon
    // par défaut 3 mois, idempotente : n'ajoute que le manquant, ne
    // touche ni conducteurs ni annulations. Un échec ici ne remet pas
    // en cause l'activité enregistrée : il est signalé, et le bouton de
    // /semaine reste un rattrapage.
    let generationWarning: string | null = null
    try {
      await generateTripsForHousehold(householdId, DEFAULT_HORIZON_DAYS)
    } catch (generationError) {
      generationWarning = `L’activité est enregistrée, mais la création de ses trajets a échoué : ${
        generationError instanceof Error
          ? generationError.message
          : 'réponse inattendue du serveur'
      }. Relancez « Générer les trajets » depuis La semaine.`
    }

    onDone(generationWarning)
  }

  const idPrefix = activity ? `activity-${activity.id}` : 'activity-new'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-sm font-medium text-gray-700">
        {activity ? 'Modifier l’activité' : 'Ajouter une activité'}
      </h2>

      <div>
        <label
          htmlFor={`${idPrefix}-child`}
          className="block text-sm font-medium text-gray-700"
        >
          Enfant concerné
        </label>
        <select
          id={`${idPrefix}-child`}
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        >
          {childrenList.map((child) => (
            <option key={child.id} value={child.id}>
              {child.first_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-label`}
          className="block text-sm font-medium text-gray-700"
        >
          Activité
        </label>
        <input
          id={`${idPrefix}-label`}
          type="text"
          required
          placeholder="Par exemple : football, solfège…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-location`}
          className="block text-sm font-medium text-gray-700"
        >
          Lieu (optionnel)
        </label>
        <input
          id={`${idPrefix}-location`}
          type="text"
          placeholder="Par exemple : hall omnisports de Waterloo"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-distance`}
          className="block text-sm font-medium text-gray-700"
        >
          Distance du trajet depuis le domicile
        </label>
        <select
          id={`${idPrefix}-distance`}
          value={distanceBand}
          onChange={(e) => setDistanceBand(e.target.value as DistanceBand)}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        >
          {DISTANCE_BANDS.map((band) => (
            <option key={band.value} value={band.value}>
              {band.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Une simple tranche, sans adresse : elle sert à reconnaître l’aide
          apportée sur les trajets partagés.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700">
          Récurrence
        </legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name={`${idPrefix}-recurrence`}
              checked={!weekly}
              onChange={() => setWeekly(false)}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Ponctuelle
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name={`${idPrefix}-recurrence`}
              checked={weekly}
              onChange={() => setWeekly(true)}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Chaque semaine
          </label>
        </div>
      </fieldset>

      {weekly ? (
        <div>
          <span className="block text-sm font-medium text-gray-700">
            Jours de la semaine
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.code}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
                  days.includes(day.code)
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={days.includes(day.code)}
                  onChange={() => toggleDay(day.code)}
                  className="sr-only"
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor={`${idPrefix}-date`}
            className="block text-sm font-medium text-gray-700"
          >
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex gap-3">
        <div className="w-full">
          <label
            htmlFor={`${idPrefix}-start`}
            className="block text-sm font-medium text-gray-700"
          >
            Heure de début
          </label>
          <input
            id={`${idPrefix}-start`}
            type="time"
            step={900}
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full">
          <label
            htmlFor={`${idPrefix}-end`}
            className="block text-sm font-medium text-gray-700"
          >
            Heure de fin
          </label>
          <input
            id={`${idPrefix}-end`}
            type="time"
            step={900}
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full btn-ghost px-4 py-2 text-sm"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting || label.trim() === ''}
          className="w-full btn-lagoon px-4 py-2.5 text-sm font-semibold"
        >
          {submitting
            ? 'Enregistrement…'
            : activity
              ? 'Enregistrer'
              : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
