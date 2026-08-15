// Lieux intelligents (Doc v4 §7) — autocomplete Photon (OSM, serveurs UE,
// sans clé) + référentiel partagé `places` + favoris de foyer.
//
// Règle absolue : ne géocoder que des lieux PUBLICS (écoles, clubs,
// salles). Jamais un domicile — le domicile reste le label « Domicile »
// et la zone floue users.postal_code.
import { supabase } from '@/lib/supabase'

export interface PlaceSuggestion {
  externalId: string
  label: string
  detail: string | null
  postalCode: string | null
  municipality: string | null
  lat: number | null
  lng: number | null
}

export interface FavoritePlace {
  placeId: string
  label: string
  municipality: string | null
}

const PHOTON_URL = 'https://photon.komoot.io/api'

// Biais Belgique : centre approximatif du pays. Photon reste mondial,
// le biais remonte simplement les résultats proches.
const BIAS_LAT = 50.7
const BIAS_LNG = 4.5

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    osm_type?: string
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    state?: string
  }
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<Array<PlaceSuggestion>> {
  const url =
    `${PHOTON_URL}?q=${encodeURIComponent(query)}` +
    `&lang=fr&limit=6&lat=${BIAS_LAT}&lon=${BIAS_LNG}`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Recherche de lieu indisponible (${response.status})`)
  }
  const payload = (await response.json()) as { features?: Array<PhotonFeature> }

  const suggestions: Array<PlaceSuggestion> = []
  for (const feature of payload.features ?? []) {
    const props = feature.properties ?? {}
    if (!props.name || !props.osm_type || props.osm_id == null) continue
    const detailParts = [props.postcode, props.city ?? props.state].filter(
      Boolean,
    ) as Array<string>
    const [lng, lat] = feature.geometry?.coordinates ?? [null, null]
    suggestions.push({
      externalId: `${props.osm_type}:${props.osm_id}`,
      label: props.name,
      detail: detailParts.length > 0 ? detailParts.join(' ') : null,
      postalCode: props.postcode ?? null,
      municipality: props.city ?? props.state ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
  }
  return suggestions
}

// Upsert par external_place_id : deux formulations du même lieu pointent
// vers la même ligne (§7.1). Tolère la course entre deux clients.
export async function ensurePlace(
  suggestion: PlaceSuggestion,
): Promise<string> {
  const existing = await supabase
    .from('places')
    .select('id')
    .eq('external_place_id', suggestion.externalId)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) return existing.data.id

  const { data: auth } = await supabase.auth.getUser()
  const inserted = await supabase
    .from('places')
    .insert({
      label: suggestion.label,
      external_place_id: suggestion.externalId,
      lat: suggestion.lat,
      lng: suggestion.lng,
      postal_code: suggestion.postalCode,
      municipality: suggestion.municipality,
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single()

  if (!inserted.error) return inserted.data.id

  // Conflit d'unicité : un autre client a créé le lieu entre-temps.
  const retry = await supabase
    .from('places')
    .select('id')
    .eq('external_place_id', suggestion.externalId)
    .maybeSingle()
  if (retry.data) return retry.data.id
  throw new Error(inserted.error.message)
}

export async function fetchFavoritePlaces(
  householdId: string,
): Promise<Array<FavoritePlace>> {
  const { data, error } = await supabase
    .from('household_places')
    .select('place_id, custom_label, places (label, municipality)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    placeId: row.place_id,
    label: row.custom_label ?? row.places?.label ?? 'Lieu',
    municipality: row.places?.municipality ?? null,
  }))
}

export async function addFavoritePlace(
  householdId: string,
  placeId: string,
): Promise<void> {
  const { error } = await supabase
    .from('household_places')
    .upsert(
      { household_id: householdId, place_id: placeId },
      { onConflict: 'household_id,place_id', ignoreDuplicates: true },
    )
  if (error) throw new Error(error.message)
}

export async function removeFavoritePlace(
  householdId: string,
  placeId: string,
): Promise<void> {
  const { error } = await supabase
    .from('household_places')
    .delete()
    .eq('household_id', householdId)
    .eq('place_id', placeId)
  if (error) throw new Error(error.message)
}
