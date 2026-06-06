// Viator Partner API v2 client.
// Docs: https://docs.viator.com/partner-api/technical/
// Auth via `exp-api-key` + versioned Accept header.

const BASE = 'https://api.viator.com/partner'

type Headers = Record<string, string>

function headers(extra?: Headers): Headers {
  const key = process.env.VIATOR_API_KEY
  if (!key) throw new Error('VIATOR_API_KEY not set')
  return {
    'exp-api-key': key,
    'Accept': 'application/json;version=2.0',
    'Accept-Language': 'en-AU',
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { ...headers(), ...(init?.headers as Headers || {}) } })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Viator ${r.status} ${path}: ${text.slice(0, 500)}`)
  }
  return r.json() as Promise<T>
}

// Shape of a destination node from GET /destinations.
export type ViatorDestination = {
  destinationId: number
  name: string
  type: string
  parentDestinationId?: number
  lookupId: string
  defaultCurrencyCode?: string
  timeZone?: string
  center?: { latitude: number; longitude: number }
}

// Single image variant (Viator returns many resolutions).
export type ViatorImageVariant = { url: string; width: number; height: number }
export type ViatorImage = {
  imageSource?: string
  caption?: string
  isCover?: boolean
  variants: ViatorImageVariant[]
}

// Slimmed-down product shape — Viator returns more, we keep the useful fields.
export type ViatorProduct = {
  productCode: string
  title: string
  description?: string
  shortDescription?: string
  images?: ViatorImage[]
  reviews?: { combinedAverageRating?: number; totalReviews?: number; sources?: Array<{ provider: string; totalCount: number; averageRating: number }> }
  duration?: { fixedDurationInMinutes?: number; variableDurationFromMinutes?: number; variableDurationToMinutes?: number }
  confirmationType?: string
  itineraryType?: string
  pricing?: { summary?: { fromPrice?: number; fromPriceBeforeDiscount?: number }; currency?: string }
  productUrl?: string          // affiliate-tracked link — use verbatim
  destinations?: Array<{ ref: string; primary?: boolean }>
  tags?: number[]
  flags?: string[]
  translationInfo?: { containsMachineTranslatedText?: boolean; translationSource?: string }
  inclusions?: Array<{ category?: string; typeDescription?: string; description?: string; otherDescription?: string }>
  exclusions?: Array<{ category?: string; typeDescription?: string; description?: string; otherDescription?: string }>
  additionalInfo?: Array<{ description: string; type?: string }>
  cancellationPolicy?: { type?: string; description?: string; refundEligibility?: any }
}

export async function listDestinations(): Promise<ViatorDestination[]> {
  const d = await call<{ destinations: ViatorDestination[] }>('/destinations')
  return d.destinations || []
}

// POST /products/search — body accepts filtering, sorting, pagination, currency.
export async function searchProducts(params: {
  destinationId: number | string
  currency?: string
  sort?: 'TRAVELER_RATING' | 'PRICE_FROM_A' | 'PRICE_FROM_D' | 'PUBLISHED_DATE_D'
  start?: number
  count?: number // max 50
  minRating?: number
}): Promise<{ products: ViatorProduct[]; totalCount: number }> {
  const body = {
    filtering: { destination: String(params.destinationId), ...(params.minRating ? { rating: { from: params.minRating } } : {}) },
    sorting: { sort: params.sort || 'TRAVELER_RATING', order: 'DESCENDING' },
    pagination: { start: params.start || 1, count: Math.min(params.count || 50, 50) },
    currency: params.currency || 'AUD',
  }
  return call('/products/search', { method: 'POST', body: JSON.stringify(body) })
}

export async function getProduct(productCode: string, currency = 'AUD'): Promise<ViatorProduct> {
  return call(`/products/${encodeURIComponent(productCode)}?currency=${currency}`)
}

// Durations: humanise the various duration shapes Viator returns.
export function durationLabel(d?: ViatorProduct['duration']): { min: number | null; label: string | null } {
  if (!d) return { min: null, label: null }
  const minutes = d.fixedDurationInMinutes ?? d.variableDurationFromMinutes ?? null
  const label = (() => {
    if (d.fixedDurationInMinutes) return humanMinutes(d.fixedDurationInMinutes)
    if (d.variableDurationFromMinutes && d.variableDurationToMinutes) {
      return `${humanMinutes(d.variableDurationFromMinutes)} – ${humanMinutes(d.variableDurationToMinutes)}`
    }
    if (d.variableDurationFromMinutes) return `from ${humanMinutes(d.variableDurationFromMinutes)}`
    return null
  })()
  return { min: minutes, label }
}

function humanMinutes(m: number): string {
  if (m >= 60 * 24) {
    const days = Math.round(m / (60 * 24))
    return `${days} day${days > 1 ? 's' : ''}`
  }
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return mm ? `${h}h ${mm}m` : `${h} hour${h > 1 ? 's' : ''}`
  }
  return `${m} min`
}

// Pick the largest image variant under `maxW` for a sensible cover image.
export function bestImageUrl(imgs?: ViatorImage[], maxW = 800): string | null {
  if (!imgs?.length) return null
  const cover = imgs.find(i => i.isCover) || imgs[0]
  if (!cover?.variants?.length) return null
  const sorted = [...cover.variants].sort((a, b) => b.width - a.width)
  const match = sorted.find(v => v.width <= maxW) || sorted[sorted.length - 1]
  return match.url
}

// Safe slug generator — ASCII, lowercase, hyphenated, bounded length, unique-ish via productCode suffix.
export function slugifyTour(title: string, productCode: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
  // Append a 5-char productCode tail to keep slugs unique even for similarly-titled tours.
  const tail = productCode.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-5)
  return `${base}-${tail}`.slice(0, 80)
}
