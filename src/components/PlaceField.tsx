// Champ lieu avec autocomplete Photon et favoris du foyer (Doc v4 §7).
// Le texte libre reste possible : si Photon ne répond pas ou que le lieu
// n'existe pas dans OSM, le label saisi est conservé sans place_id —
// aucune régression par rapport au champ texte historique.
import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import {
  addFavoritePlace,
  ensurePlace,
  fetchFavoritePlaces,
  removeFavoritePlace,
  searchPlaces,
} from '@/lib/places'

import type { FavoritePlace, PlaceSuggestion } from '@/lib/places'

export interface PlaceValue {
  placeId: string | null
  label: string
}

export function PlaceField({
  id,
  householdId,
  value,
  onChange,
  placeholder,
}: {
  id: string
  householdId: string
  value: PlaceValue
  onChange: (next: PlaceValue) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<Array<PlaceSuggestion>>([])
  const [favorites, setFavorites] = useState<Array<FavoritePlace>>([])
  const [open, setOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchFavoritePlaces(householdId)
      .then(setFavorites)
      .catch(() => setFavorites([]))
  }, [householdId])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function scheduleSearch(query: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    if (query.trim().length < 3) {
      setSuggestions([])
      return
    }
    debounceRef.current = window.setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      searchPlaces(query, controller.signal)
        .then(setSuggestions)
        .catch(() => {
          // Photon indisponible : le texte libre suffit, pas d'erreur bloquante.
        })
    }, 300)
  }

  async function pickSuggestion(suggestion: PlaceSuggestion) {
    setOpen(false)
    setResolving(true)
    try {
      const placeId = await ensurePlace(suggestion)
      onChange({ placeId, label: suggestion.label })
    } catch {
      onChange({ placeId: null, label: suggestion.label })
    } finally {
      setResolving(false)
    }
  }

  function pickFavorite(favorite: FavoritePlace) {
    setOpen(false)
    onChange({ placeId: favorite.placeId, label: favorite.label })
  }

  const isFavorite =
    value.placeId != null && favorites.some((f) => f.placeId === value.placeId)

  async function toggleFavorite() {
    if (!value.placeId) return
    if (isFavorite) {
      await removeFavoritePlace(householdId, value.placeId)
    } else {
      await addFavoritePlace(householdId, value.placeId)
    }
    setFavorites(await fetchFavoritePlaces(householdId))
  }

  const matchingFavorites = favorites.filter((f) =>
    f.label.toLowerCase().includes(value.label.trim().toLowerCase()),
  )

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          value={value.label}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ placeId: null, label: e.target.value })
            scheduleSearch(e.target.value)
            setOpen(true)
          }}
          className="mt-1 w-full field-lagoon px-3 py-2 text-sm"
        />
        {value.placeId && (
          <button
            type="button"
            onClick={() => void toggleFavorite()}
            aria-label={
              isFavorite ? 'Retirer des lieux favoris' : 'Garder en favori'
            }
            aria-pressed={isFavorite}
            className="mt-1 shrink-0 p-2"
            style={{ color: isFavorite ? '#c98a2e' : 'var(--sea-ink-soft)' }}
          >
            <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {open && (matchingFavorites.length > 0 || suggestions.length > 0) && (
        <ul
          role="listbox"
          className="island-shell absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl py-1"
        >
          {matchingFavorites.map((favorite) => (
            <li key={`fav-${favorite.placeId}`}>
              <button
                type="button"
                onClick={() => pickFavorite(favorite)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <Star
                  size={14}
                  fill="currentColor"
                  style={{ color: '#c98a2e' }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {favorite.label}
                  {favorite.municipality && (
                    <span className="text-gray-400">
                      {' '}
                      · {favorite.municipality}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {suggestions
            .filter(
              (s) => !matchingFavorites.some((f) => f.label === s.label),
            )
            .map((suggestion) => (
              <li key={suggestion.externalId}>
                <button
                  type="button"
                  onClick={() => void pickSuggestion(suggestion)}
                  disabled={resolving}
                  className="w-full px-3 py-2 text-left text-sm"
                >
                  {suggestion.label}
                  {suggestion.detail && (
                    <span className="text-gray-400"> · {suggestion.detail}</span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Le lieu de l'activité (école, club, salle) — jamais votre domicile.
      </p>
    </div>
  )
}
