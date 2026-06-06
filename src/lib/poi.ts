// Helpers for the POI detail pages — slug generation + canonical URL.

export function slugifyName(name: string | null): string {
  if (!name) return 'place'
  return name
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'place'
}

export function poiUrl(osmId: number | string | bigint, name: string | null): string {
  return `/poi/${slugifyName(name)}-${osmId}/`
}

// Parse the dynamic [slug] segment. Slug format is `<slug>-<osm_id>` where
// osm_id is the trailing digits. Return the numeric ID or null if malformed.
export function parsePoiSlug(slug: string): number | null {
  const m = slug.match(/-(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export const POI_ICON: Record<string, string> = {
  attraction: '🎡', museum: '🏛️', family: '🦁', viewpoint: '🔭',
  historic: '🏰', beach: '🏖️', peak: '⛰️', waterfall: '💦',
  cave: '🕳️', nature_reserve: '🌳', culture: '🎭', other: '📍',
}

export const POI_LABEL: Record<string, string> = {
  attraction: 'Attraction', museum: 'Museum or gallery',
  family: 'Family attraction', viewpoint: 'Lookout / viewpoint',
  historic: 'Historic site', beach: 'Beach', peak: 'Peak or summit',
  waterfall: 'Waterfall', cave: 'Cave', nature_reserve: 'Nature reserve / park',
  culture: 'Theatre or cinema or market', other: 'Place of interest',
}
