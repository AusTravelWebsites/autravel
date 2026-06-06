/**
 * Tenant config for the multi-tenant autravel app.
 *
 * Each tenant is one of the 8 Australian travel domains we serve from a single
 * Next.js codebase + DB. The `state_code` is the primary tenant key used to
 * filter rows in tours/places/parks/destinations/articles/redirects/snippets.
 *
 * aunz = national aggregator; queries scoped to this tenant omit the state
 * filter entirely and show cross-state content with a state-picker UI.
 */

// AU state codes + 'aunz' aggregator + 'uk' (New Forest National Park, a
// UK-wide tours/guides tenant served from new-forest-national-park.com — see
// the `uk` entry in TENANTS for why it lives in this AU-shaped config).
export type StateCode = 'qld' | 'nsw' | 'nt' | 'wa' | 'sa' | 'tas' | 'vic' | 'aunz' | 'uk'

export interface TenantConfig {
  state_code: StateCode
  /** Primary public host (no scheme, no trailing slash). */
  host: string
  /** Extra hosts that should resolve to this tenant (www, staging, etc.). */
  aliases?: string[]
  /** Brand name used in <title>, OG tags, header, etc. */
  name: string
  /** Short label for UI chips/menus. */
  shortName: string
  /** Full state name in prose. */
  stateName: string
  /** ISO-like region code used in location queries (AU-QLD, AU-NSW, ...). aunz = null. */
  regionCode: string | null
  /** Viator destination IDs to pull tours from. null on aunz = import everything. */
  viatorDestIds: number[] | null
  /** GA4 measurement ID per site. Fill in via admin/snippets if you prefer. */
  gaId: string | null
  /** Hero / OG image URL. */
  ogImage: string
  /** Homepage hero photo (landscape, 2000×1100, WebP). Served from R2 via media.bugbitten.com — CSP-allowed. Originals on Unsplash, optimised + uploaded by scripts/upload-hero-photos.mjs. */
  heroImage: string
  /** One-line credit for the hero photo (shown in hero corner). */
  heroCredit: string
  /** Default tagline under the hero. */
  tagline: string
  /** Whether this tenant shows the state-picker (aunz does). */
  aggregator: boolean
  /** Inbox where /contact/ form submissions land. */
  contactEmail: string
  /** Verified Resend sender address used as the From: header on outgoing mail
   *  for this tenant. Must be on a domain verified in the Resend dashboard. */
  fromEmail: string
  /** Header/footer logo path. Per-tenant so a non-AU site can ship its own
   *  brand mark. Defaults to the shared '/brand/logo.webp' when omitted. */
  logo?: string
  /** ISO 4217 currency for price formatting fallbacks. Defaults to 'AUD'.
   *  Individual tours/parks carry their own `currency` column; this is only a
   *  fallback + drives the currency symbol shown in prices. */
  currency?: string
  /** BCP-47 locale for date/number formatting + OG `locale`. Defaults 'en-AU'. */
  locale?: string
}

export const TENANTS: Record<StateCode, TenantConfig> = {
  qld: {
    state_code: 'qld',
    host: 'qldtravel.com.au',
    aliases: ['www.qldtravel.com.au'],
    name: 'QLD Travel',
    shortName: 'QLD',
    stateName: 'Queensland',
    regionCode: 'AU-QLD',
    viatorDestIds: [],
    gaId: 'G-6CTMY5J0HL',
    ogImage: 'https://qldtravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/qld.webp',
    heroCredit: 'Whitehaven Beach, Whitsundays',
    tagline: 'Tours, caravan parks & destinations across Queensland.',
    aggregator: false,
    contactEmail: 'info@qldtravel.com.au',
    fromEmail: 'noreply@qldtravel.com.au',
  },
  nsw: {
    state_code: 'nsw',
    host: 'nswtravel.com.au',
    aliases: ['www.nswtravel.com.au'],
    name: 'NSW Travel',
    shortName: 'NSW',
    stateName: 'New South Wales',
    regionCode: 'AU-NSW',
    viatorDestIds: [],
    gaId: 'G-JT4D0HGEX3',
    ogImage: 'https://nswtravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/nsw.webp',
    heroCredit: 'Sydney Opera House & Harbour Bridge',
    tagline: 'Tours, caravan parks & destinations across New South Wales.',
    aggregator: false,
    contactEmail: 'info@nswtravel.com.au',
    fromEmail: 'noreply@nswtravel.com.au',
  },
  nt: {
    state_code: 'nt',
    host: 'nttravel.com.au',
    aliases: ['www.nttravel.com.au'],
    name: 'NT Travel',
    shortName: 'NT',
    stateName: 'Northern Territory',
    regionCode: 'AU-NT',
    viatorDestIds: [],
    gaId: 'G-SK7BVSYLHC',
    ogImage: 'https://nttravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/nt.webp',
    heroCredit: 'Uluru, Red Centre',
    tagline: 'Tours, caravan parks & destinations across the Northern Territory.',
    aggregator: false,
    contactEmail: 'info@nttravel.com.au',
    fromEmail: 'noreply@nttravel.com.au',
  },
  wa: {
    state_code: 'wa',
    host: 'watravel.com.au',
    aliases: ['www.watravel.com.au'],
    name: 'WA Travel',
    shortName: 'WA',
    stateName: 'Western Australia',
    regionCode: 'AU-WA',
    viatorDestIds: [],
    gaId: 'G-0W74RDZF8T',
    ogImage: 'https://watravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/wa.webp',
    heroCredit: 'Rottnest Island lagoon',
    tagline: 'Tours, caravan parks & destinations across Western Australia.',
    aggregator: false,
    contactEmail: 'info@watravel.com.au',
    fromEmail: 'noreply@watravel.com.au',
  },
  sa: {
    state_code: 'sa',
    host: 'satravel.net.au',
    aliases: ['www.satravel.net.au'],
    name: 'SA Travel',
    shortName: 'SA',
    stateName: 'South Australia',
    regionCode: 'AU-SA',
    viatorDestIds: [],
    gaId: 'G-QWFWW5907J',
    ogImage: 'https://satravel.net.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/sa.webp',
    heroCredit: 'Kangaroos on a South Australian beach',
    tagline: 'Tours, caravan parks & destinations across South Australia.',
    aggregator: false,
    contactEmail: 'info@satravel.net.au',
    fromEmail: 'noreply@satravel.net.au',
  },
  tas: {
    state_code: 'tas',
    host: 'tastravel.net.au',
    aliases: ['www.tastravel.net.au'],
    name: 'TAS Travel',
    shortName: 'TAS',
    stateName: 'Tasmania',
    regionCode: 'AU-TAS',
    viatorDestIds: [],
    gaId: 'G-4N9T0172T1',
    ogImage: 'https://tastravel.net.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/tas.webp',
    heroCredit: 'Cradle Mountain, Tasmania',
    tagline: 'Tours, caravan parks & destinations across Tasmania.',
    aggregator: false,
    contactEmail: 'info@tastravel.net.au',
    fromEmail: 'noreply@tastravel.net.au',
  },
  vic: {
    state_code: 'vic',
    host: 'victravel.com.au',
    aliases: ['www.victravel.com.au'],
    name: 'VIC Travel',
    shortName: 'VIC',
    stateName: 'Victoria',
    regionCode: 'AU-VIC',
    viatorDestIds: [],
    gaId: 'G-81MRKJYMSE',
    ogImage: 'https://victravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/vic.webp',
    heroCredit: 'Twelve Apostles, Great Ocean Road',
    tagline: 'Tours, caravan parks & destinations across Victoria.',
    aggregator: false,
    contactEmail: 'info@victravel.com.au',
    fromEmail: 'noreply@victravel.com.au',
  },
  aunz: {
    state_code: 'aunz',
    host: 'aunztravel.com.au',
    aliases: ['www.aunztravel.com.au'],
    name: 'AU & NZ Travel',
    shortName: 'AU/NZ',
    stateName: 'Australia',
    regionCode: null,
    viatorDestIds: null,
    gaId: 'G-Y3H4S6QSMQ',
    ogImage: 'https://aunztravel.com.au/brand/logo.webp?v=2',
    heroImage: 'https://media.bugbitten.com/autravel/hero/aunz.webp',
    heroCredit: 'Outback Australia',
    tagline: 'Tours, caravan parks & destinations right across Australia.',
    aggregator: true,
    contactEmail: 'info@aunztravel.com.au',
    fromEmail: 'noreply@aunztravel.com.au',
  },
  // New Forest National Park — a UK tenant rebuilt from the legacy WordPress
  // site at new-forest-national-park.com. Branded around the New Forest (keeps
  // the domain's existing topical authority + every legacy URL via the
  // articles legacy_path + redirects), but the /tours layer aggregates tours
  // from right across the UK. state_code 'uk' tags all its rows; tours are
  // imported in GBP. Not an aggregator (no state-picker) — it's a single
  // region-scoped tenant like the AU states.
  uk: {
    state_code: 'uk',
    host: 'new-forest-national-park.com',
    aliases: ['www.new-forest-national-park.com'],
    name: 'New Forest National Park',
    shortName: 'New Forest',
    stateName: 'the New Forest & the UK',
    regionCode: 'GB',
    viatorDestIds: [],
    gaId: null,
    ogImage: 'https://new-forest-national-park.com/wp-content/uploads/nfnp-og.webp',
    heroImage: 'https://new-forest-national-park.com/wp-content/uploads/nfnp-hero.webp',
    heroCredit: 'New Forest National Park, Hampshire',
    tagline: 'Walks, wildlife, attractions & tours across the New Forest and the UK.',
    aggregator: false,
    contactEmail: 'info@new-forest-national-park.com',
    fromEmail: 'noreply@new-forest-national-park.com',
    logo: '/brand/uk/logo.webp',
    currency: 'GBP',
    locale: 'en-GB',
  },
}

/** Default tenant used when no host matches (e.g. localhost dev). Switch in env via DEFAULT_TENANT if needed. */
export const DEFAULT_TENANT: StateCode = (process.env.DEFAULT_TENANT as StateCode) || 'qld'

const HOST_INDEX: Record<string, StateCode> = (() => {
  const idx: Record<string, StateCode> = {}
  for (const t of Object.values(TENANTS)) {
    idx[t.host.toLowerCase()] = t.state_code
    for (const a of t.aliases || []) idx[a.toLowerCase()] = t.state_code
  }
  return idx
})()

/** Resolve a request host (e.g. "qldtravel.com.au" or "qldtravel.com.au:443") to a tenant. */
export function tenantForHost(rawHost: string | null | undefined): TenantConfig {
  if (!rawHost) return TENANTS[DEFAULT_TENANT]
  const host = rawHost.toLowerCase().split(':')[0].trim()
  const code = HOST_INDEX[host]
  if (code) return TENANTS[code]
  // Fallback: strip leading "www."
  const stripped = host.startsWith('www.') ? host.slice(4) : host
  const code2 = HOST_INDEX[stripped]
  if (code2) return TENANTS[code2]
  return TENANTS[DEFAULT_TENANT]
}

export function tenantForState(code: StateCode): TenantConfig {
  return TENANTS[code]
}

export const ALL_STATE_CODES: StateCode[] = Object.keys(TENANTS) as StateCode[]
