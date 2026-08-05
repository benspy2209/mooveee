import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

import type { FormEvent } from 'react'

interface Child {
  id: string
  first_name: string
  birth_year: number | null
  photo_url: string | null
  photo_consent: boolean
  booster_seat: boolean
}

const CURRENT_YEAR = new Date().getFullYear()

// Bucket privé (migration 0004). children.photo_url stocke le chemin
// relatif {household_id}/{child_id}.{ext}, jamais une URL publique.
const PHOTO_BUCKET = 'child-photos'
const SIGNED_URL_TTL_SECONDS = 3600 // 1 h maximum

// Validation côté client, par confort uniquement : la validation qui
// fait autorité est côté serveur, via les contraintes du bucket
// (allowed_mime_types jpeg/png/webp, file_size_limit 5 Mo — 0004).
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const PHOTO_MAX_BYTES = 5 * 1024 * 1024

export const Route = createFileRoute('/_authed/enfants')({
  component: EnfantsPage,
})

function EnfantsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [children, setChildren] = useState<Array<Child>>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

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

    const { data: childrenData, error: childrenError } = await supabase
      .from('children')
      .select('id, first_name, birth_year, photo_url, photo_consent, booster_seat')
      .eq('household_id', membership.household_id)
      .order('created_at')

    if (childrenError) {
      setLoadError(childrenError.message)
      setLoading(false)
      return
    }

    // URLs signées de courte durée, demandées UNIQUEMENT pour les
    // enfants dont photo_consent est true. Sans consentement, aucune
    // signature n'est même demandée (§9.2).
    const consented = childrenData.filter(
      (c) => c.photo_consent && c.photo_url,
    )
    const urls: Record<string, string> = {}
    if (consented.length > 0) {
      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(
          consented.map((c) => c.photo_url as string),
          SIGNED_URL_TTL_SECONDS,
        )
      signed?.forEach((entry, index) => {
        if (entry.signedUrl) {
          urls[consented[index].id] = entry.signedUrl
        }
      })
    }

    setHouseholdId(membership.household_id)
    setChildren(childrenData)
    setPhotoUrls(urls)
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

  if (!householdId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-gray-900">
            Les enfants du foyer
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez d’abord créer ou rejoindre un foyer avant d’ajouter des
            enfants.
          </p>
          <Link
            to="/foyer"
            className="mt-6 block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Aller à mon foyer
          </Link>
        </div>
      </main>
    )
  }

  return (
    <ChildrenScreen
      householdId={householdId}
      children={children}
      photoUrls={photoUrls}
      onChanged={() => void load()}
    />
  )
}

function ChildrenScreen({
  householdId,
  children,
  photoUrls,
  onChanged,
}: {
  householdId: string
  children: Array<Child>
  photoUrls: Record<string, string>
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="rounded-lg bg-white p-8 shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              Les enfants du foyer
            </h1>
            <Link to="/foyer" className="text-sm text-blue-600 hover:underline">
              Mon foyer
            </Link>
          </div>

          {children.length === 0 && !adding && (
            <p className="mt-4 text-sm text-gray-600">
              Aucun enfant pour le moment. Ajoutez un premier enfant pour
              préparer vos trajets.
            </p>
          )}

          <ul className="mt-4 divide-y divide-gray-100">
            {children.map((child) =>
              editingId === child.id ? (
                <li key={child.id} className="py-4">
                  <ChildForm
                    householdId={householdId}
                    child={child}
                    onDone={() => {
                      setEditingId(null)
                      onChanged()
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <ChildRow
                  key={child.id}
                  child={child}
                  photoUrl={photoUrls[child.id] ?? null}
                  onEdit={() => {
                    setAdding(false)
                    setEditingId(child.id)
                  }}
                  onDeleted={onChanged}
                />
              ),
            )}
          </ul>

          {adding ? (
            <div className="mt-6">
              <ChildForm
                householdId={householdId}
                onDone={() => {
                  setAdding(false)
                  onChanged()
                }}
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
              className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ajouter un enfant
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function ChildRow({
  child,
  photoUrl,
  onEdit,
  onDeleted,
}: {
  child: Child
  photoUrl: string | null
  onEdit: () => void
  onDeleted: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setDeleting(true)

    // Le cascade SQL ne supprime pas les objets Storage : suppression
    // explicite du fichier AVANT la ligne, pour ne jamais laisser de
    // photo orpheline en cas d'échec partiel.
    if (child.photo_url) {
      const { error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([child.photo_url])

      if (storageError) {
        setError(storageError.message)
        setDeleting(false)
        return
      }
    }

    const { error: deleteError } = await supabase
      .from('children')
      .delete()
      .eq('id', child.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    onDeleted()
  }

  // Le consentement prime : photoUrl (URL signée) n'existe que si
  // photo_consent est true, la signature n'est jamais demandée sinon.
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Photo de ${child.first_name}`}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500">
              {child.first_name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {child.first_name}
            </p>
            <p className="text-sm text-gray-500">
              {child.birth_year
                ? `Né(e) en ${child.birth_year}`
                : 'Année de naissance non renseignée'}
              {child.booster_seat && ' · Rehausseur'}
            </p>
          </div>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
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
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
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
          Supprimer {child.first_name} du foyer ? Sa photo éventuelle sera
          aussi supprimée. Cette action est définitive.
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

function ChildForm({
  householdId,
  child,
  onDone,
  onCancel,
}: {
  householdId: string
  child?: Child
  onDone: () => void
  onCancel: () => void
}) {
  const [firstName, setFirstName] = useState(child?.first_name ?? '')
  const [birthYear, setBirthYear] = useState(
    child?.birth_year ? String(child.birth_year) : '',
  )
  const [boosterSeat, setBoosterSeat] = useState(child?.booster_seat ?? false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoConsent, setPhotoConsent] = useState(child?.photo_consent ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Mémorise l'id créé pour ne pas insérer deux fois si l'upload de la
  // photo échoue et que le formulaire est re-soumis.
  const [createdChildId, setCreatedChildId] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (photoFile) {
      if (!photoConsent) {
        setError(
          'Pour enregistrer une photo, vous devez cocher la case de ' +
            'consentement ci-dessous.',
        )
        return
      }
      if (!(photoFile.type in PHOTO_EXTENSIONS)) {
        setError(
          'Format non accepté. Formats autorisés : JPEG, PNG ou WebP.',
        )
        return
      }
      if (photoFile.size > PHOTO_MAX_BYTES) {
        setError('La photo dépasse la taille maximale de 5 Mo.')
        return
      }
    }

    setSubmitting(true)

    const values = {
      first_name: firstName.trim(),
      birth_year: birthYear === '' ? null : Number(birthYear),
      booster_seat: boosterSeat,
      photo_consent: photoConsent,
    }

    // 1. Ligne enfant (sans photo pour une création : le chemin de
    //    stockage a besoin de l'id).
    let childId = child?.id ?? createdChildId
    if (!childId) {
      const { data: created, error: insertError } = await supabase
        .from('children')
        .insert({ ...values, household_id: householdId })
        .select('id')
        .single()

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }
      childId = created.id
      setCreatedChildId(created.id)
    } else if (child) {
      const { error: updateError } = await supabase
        .from('children')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', child.id)

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
    }

    // 2. Fichier dans Storage. Le cascade SQL ne touche pas aux objets
    //    Storage : remplacement et retrait de consentement suppriment
    //    explicitement l'ancien fichier.
    const oldPath = child?.photo_url ?? null
    let newPath = oldPath

    if (!photoConsent && oldPath) {
      // Consentement retiré : le fichier est supprimé, pas seulement masqué.
      const { error: removeError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([oldPath])

      if (removeError) {
        setError(removeError.message)
        setSubmitting(false)
        return
      }
      newPath = null
    } else if (photoFile) {
      const extension = PHOTO_EXTENSIONS[photoFile.type]
      newPath = `${householdId}/${childId}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(newPath, photoFile, {
          upsert: true,
          contentType: photoFile.type,
        })

      if (uploadError) {
        setError(
          `La photo n’a pas pu être enregistrée : ${uploadError.message}. ` +
            'Les autres informations ont bien été sauvegardées, vous pouvez ' +
            'réessayer.',
        )
        setSubmitting(false)
        return
      }

      // Extension différente = chemin différent : l'ancien fichier ne
      // serait pas écrasé par l'upsert, on le supprime.
      if (oldPath && oldPath !== newPath) {
        await supabase.storage.from(PHOTO_BUCKET).remove([oldPath])
      }
    }

    // 3. Chemin relatif en base (jamais d'URL publique).
    if (newPath !== oldPath || !child) {
      const { error: pathError } = await supabase
        .from('children')
        .update({ photo_url: newPath })
        .eq('id', childId)

      if (pathError) {
        setError(pathError.message)
        setSubmitting(false)
        return
      }
    }

    onDone()
  }

  const idPrefix = child ? `child-${child.id}` : 'child-new'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-sm font-medium text-gray-700">
        {child ? `Modifier ${child.first_name}` : 'Ajouter un enfant'}
      </h2>

      <div>
        <label
          htmlFor={`${idPrefix}-first-name`}
          className="block text-sm font-medium text-gray-700"
        >
          Prénom
        </label>
        <input
          id={`${idPrefix}-first-name`}
          type="text"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-birth-year`}
          className="block text-sm font-medium text-gray-700"
        >
          Année de naissance
        </label>
        <input
          id={`${idPrefix}-birth-year`}
          type="number"
          min={CURRENT_YEAR - 25}
          max={CURRENT_YEAR}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Seule l’année est demandée, jamais la date complète.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={boosterSeat}
          onChange={(e) => setBoosterSeat(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Rehausseur nécessaire en voiture
      </label>

      <div>
        <label
          htmlFor={`${idPrefix}-photo`}
          className="block text-sm font-medium text-gray-700"
        >
          Photo (optionnelle)
        </label>
        <input
          id={`${idPrefix}-photo`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG ou WebP, 5 Mo maximum.
          {child?.photo_url && ' La nouvelle photo remplacera l’actuelle.'}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={photoConsent}
          onChange={(e) => setPhotoConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          J’autorise explicitement l’enregistrement et l’affichage de la photo
          de cet enfant dans l’application. Si je retire cette autorisation, la
          photo est supprimée.
        </span>
      </label>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Une erreur est survenue : {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting || firstName.trim() === ''}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Enregistrement…'
            : child
              ? 'Enregistrer'
              : 'Ajouter'}
        </button>
      </div>
    </form>
  )
}
