import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import type { StateCode } from '@/lib/tenants'

export type Train = {
  slug: string
  name: string
  operator: string | null
  operator_url: string | null
  booking_url: string | null
  state_codes: string[]
  is_national: boolean
  is_heritage: boolean
  route_summary: string | null
  from_city: string | null
  to_city: string | null
  key_stations: string[]
  classes: string[]
  frequency: string | null
  duration_label: string | null
  intro: string | null
  body_html: string | null
  cover_image: string | null
  legacy_article_slug: string | null
  seo_title: string | null
  seo_description: string | null
  display_order: number
}

const COLS = db`
  slug, name, operator, operator_url, booking_url, state_codes, is_national, is_heritage,
  route_summary, from_city, to_city, key_stations, classes, frequency, duration_label,
  intro, body_html, cover_image, legacy_article_slug, seo_title, seo_description, display_order`

// List all train services a tenant should surface (state services + national).
// aggregator (aunz) → its state_code 'aunz' is tagged on the national services.
async function listTrainsRaw(state: StateCode | null): Promise<Train[]> {
  try {
    return await db<Train[]>`
      SELECT ${COLS} FROM autravel.trains
      WHERE active
        AND (${state}::text IS NULL OR ${state}::text = ANY(state_codes))
      ORDER BY is_heritage ASC, display_order ASC, name ASC`
  } catch (e) { console.warn('[trains/list]', (e as any)?.code || e); return [] }
}

export function listTrains(state: StateCode | null) {
  const key = state ?? 'all'
  return unstable_cache(() => listTrainsRaw(state), ['trains-list', key], {
    revalidate: 3600, tags: ['trains', `trains:${key}`],
  })()
}

async function getTrainRaw(slug: string, state: StateCode | null): Promise<Train | null> {
  try {
    const [row] = await db<Train[]>`
      SELECT ${COLS} FROM autravel.trains
      WHERE active AND slug = ${slug}
        AND (${state}::text IS NULL OR ${state}::text = ANY(state_codes))
      LIMIT 1`
    return row || null
  } catch (e) { console.warn('[trains/get]', (e as any)?.code || e); return null }
}

export function getTrain(slug: string, state: StateCode | null) {
  const key = state ?? 'all'
  return unstable_cache(() => getTrainRaw(slug, state), ['train-get', key, slug], {
    revalidate: 3600, tags: ['trains', `trains:${key}`, `train:${slug}`],
  })()
}
