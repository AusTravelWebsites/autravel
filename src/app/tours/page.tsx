import { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { TOUR_CATEGORIES, CATEGORY_BY_SLUG } from '@/lib/tour-categories'
import SortSelect from './SortSelect'
import FilterSelect from './FilterSelect'
import { ToursCountrySearch } from '@/components/features/ToursCountrySearch'
import { ToursLocationSearch } from '@/components/features/ToursLocationSearch'
import { getTenant, stateFilterValue, tourStatesFor } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'

// tours is a shared single-tenant table; a tenant may surface more than one
// state's tours (e.g. perth reads its own + 'wa'). This fragment turns the
// tour-state list into a WHERE condition (null = no filter, for the aggregator).
const toursStateCond = (states: StateCode[] | null) => states === null ? db`true` : db`state_code = ANY(${states})`
const toursKey = (states: StateCode[] | null) => states ? states.join('+') : 'all'

// Aggregates are per-tenant. Cache key includes the tour states so each tenant
// gets its own cached aggregate and invalidation is isolated.
function getCountriesAgg(tourStates: StateCode[] | null) {
  const key = toursKey(tourStates)
  return unstable_cache(
    async () => {
      try {
        return await db<Array<{ country: string; count: number }>>`
          SELECT country, COUNT(*)::int AS count
          FROM tours
          WHERE active = true AND country IS NOT NULL AND country <> ''
            AND ${toursStateCond(tourStates)}
          GROUP BY country ORDER BY count DESC`
      } catch (e: any) {
        console.warn('[tours/countries] aggregation failed, returning empty:', e?.code || e?.message)
        return [] as Array<{ country: string; count: number }>
      }
    },
    ['tours-countries-agg', key],
    { revalidate: 300, tags: ['tours', `tours:${key}`] }
  )()
}
// State-scoped destinations are used by the location autocomplete on tours page.
function getDestinationsAgg(state: StateCode | null) {
  const key = state ?? 'all'
  return unstable_cache(
    async () => {
      try {
        return await db<Array<{ name: string; slug: string }>>`
          SELECT name, slug FROM destinations
          WHERE (${state}::text IS NULL OR state_code = ${state}::text)
          ORDER BY name`
      } catch (e: any) {
        console.warn('[tours/destinations] aggregation failed, returning empty:', e?.code || e?.message)
        return [] as Array<{ name: string; slug: string }>
      }
    },
    ['tours-destinations-agg', key],
    { revalidate: 600, tags: ['destinations', `destinations:${key}`] }
  )()
}
function getCategoriesAgg(tourStates: StateCode[] | null) {
  const key = toursKey(tourStates)
  return unstable_cache(
    async () => {
      // public.tours has 43k rows / 800MB and lacks a (state_code, active, category)
      // composite index — full GROUP BY can take 60s+ on the pooler. Cap with
      // statement_timeout on the connection level at 8s so we never block the
      // page render. Returns empty array on timeout/error → filter chips just
      // hide rather than blowing up the page. Re-add an index in the DB and
      // this becomes sub-100ms.
      try {
        const rows = await db<Array<{ slug: string; count: number }>>`
          /*+ tours-categories-agg */
          SELECT category AS slug, COUNT(*)::int AS count
          FROM tours
          WHERE active = true AND category IS NOT NULL
            AND ${toursStateCond(tourStates)}
          GROUP BY category ORDER BY count DESC`
        return rows
      } catch (e: any) {
        console.warn('[tours/categories] aggregation failed, returning empty:', e?.code || e?.message)
        return [] as Array<{ slug: string; count: number }>
      }
    },
    ['tours-categories-agg', key],
    // Bump to 24h — categories change rarely. Stale-while-revalidate via tag
    // bust if you re-import tours.
    { revalidate: 86400, tags: ['tours', `tours:${key}`] }
  )()
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  return {
    title: 'Tours & Experiences',
    description: `Small-group tours, day trips, cooking classes and multi-day adventures in ${scope} — hand-picked and reviewed by real travellers.`,
    alternates: { canonical: `https://${tenant.host}/tours/` },
    openGraph: {
      title: `Tours & Experiences | ${tenant.name}`,
      description: `Book tours and experiences across ${scope}.`,
      type: 'website',
      url: `https://${tenant.host}/tours/`,
      images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: `Tours in ${scope}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Tours & Experiences | ${tenant.name}`,
      description: `Book tours and experiences across ${scope}.`,
      images: [tenant.ogImage],
    },
  }
}

// ISR: regenerate every 5 min; LiteSpeed + CDN can cache the HTML between regenerations.
export const revalidate = 300

const TOURS_PER_PAGE = 40

type Tour = {
  slug: string
  title: string
  country: string | null
  city: string | null
  category: string | null
  duration_label: string | null
  price_from: string | null
  currency: string | null
  rating: string | null
  review_count: number | null
  cover_image: string | null
  summary_ai: string | null
  source: string
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' }

type Filters = { country?: string; city?: string; loc?: string; category?: string; q?: string; duration?: string; rating?: string; price?: string; sort?: string; page?: string }

// ORDER BY fragments are db-tagged so postgres.js embeds them safely, not as user-injectable strings.
const SORTS: Array<{ slug: string; label: string; orderBy: ReturnType<typeof db> }> = [
  { slug: 'top',           label: 'Top rated',          orderBy: db`featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST` },
  { slug: 'reviews',       label: 'Most reviewed',      orderBy: db`review_count DESC NULLS LAST, rating DESC NULLS LAST` },
  { slug: 'price-asc',     label: 'Price: low to high', orderBy: db`price_from ASC NULLS LAST, rating DESC NULLS LAST` },
  { slug: 'price-desc',    label: 'Price: high to low', orderBy: db`price_from DESC NULLS LAST, rating DESC NULLS LAST` },
  { slug: 'duration-asc',  label: 'Shortest first',     orderBy: db`duration_min ASC NULLS LAST, rating DESC NULLS LAST` },
  { slug: 'duration-desc', label: 'Longest first',      orderBy: db`duration_min DESC NULLS LAST, rating DESC NULLS LAST` },
]
const SORT_BY_SLUG: Record<string, (typeof SORTS)[number]> = Object.fromEntries(SORTS.map(s => [s.slug, s]))

// Duration buckets — matching Viator's own filter UX (quick/half-day/full-day/multi-day)
const DURATIONS: Array<{ slug: string; label: string; emoji: string; minLo: number | null; minHi: number | null }> = [
  { slug: 'quick',     label: 'Under 1 hour',   emoji: '⏱',  minLo: null, minHi: 60 },
  { slug: 'half-day',  label: '1–4 hours',      emoji: '🕓', minLo: 60,  minHi: 240 },
  { slug: 'full-day',  label: '4 h – 1 day',    emoji: '🌞', minLo: 240, minHi: 1440 },
  { slug: 'multi-day', label: 'Multi-day',      emoji: '🗓',  minLo: 1440, minHi: null },
]
const DURATION_BY_SLUG: Record<string, (typeof DURATIONS)[number]> = Object.fromEntries(DURATIONS.map(d => [d.slug, d]))

const RATINGS: Array<{ slug: string; label: string; min: number }> = [
  { slug: '5',   label: '★ 5.0',        min: 5 },
  { slug: '4.5', label: '★ 4.5 and up', min: 4.5 },
  { slug: '4',   label: '★ 4.0 and up', min: 4 },
]
const RATING_BY_SLUG: Record<string, (typeof RATINGS)[number]> = Object.fromEntries(RATINGS.map(r => [r.slug, r]))

const PRICES: Array<{ slug: string; label: string; lo: number | null; hi: number | null }> = [
  { slug: 'lt50',   label: 'Under $50',     lo: null, hi: 50 },
  { slug: '50-100', label: '$50–$100',      lo: 50,   hi: 100 },
  { slug: '100-200',label: '$100–$200',     lo: 100,  hi: 200 },
  { slug: 'gt200',  label: '$200+',         lo: 200,  hi: null },
]
const PRICE_BY_SLUG: Record<string, (typeof PRICES)[number]> = Object.fromEntries(PRICES.map(p => [p.slug, p]))

// 2026-05-25 — wrapped in unstable_cache so the common /tours paths (no filter,
// or single popular filter) hit cache instead of running 4 parallel DB queries
// per request. Cache key is built from (filters, page, state); 5-min revalidate.
// Aggregates (countries/categories) are already cached separately for longer.
function getTours(f: Filters, page: number, tourStates: StateCode[] | null) {
  const key = JSON.stringify({ f, page, tourStates })
  return unstable_cache(
    () => getToursRaw(f, page, tourStates),
    ['tours-list', key],
    { revalidate: 300, tags: ['tours', `tours:${toursKey(tourStates)}`] }
  )()
}

async function getToursRaw(f: Filters, page: number, tourStates: StateCode[] | null): Promise<{ tours: Tour[]; total: number; countries: Array<{ country: string; count: number }>; categories: Array<{ slug: string; count: number }> }> {
  try {
    const country = f.country ?? null
    const city = f.city ?? null
    const loc = f.loc?.trim() ? `%${f.loc.trim()}%` : null
    const category = f.category ?? null
    const q = f.q?.trim() ? `%${f.q.trim()}%` : null
    const dur = f.duration ? DURATION_BY_SLUG[f.duration] : null
    const rat = f.rating ? RATING_BY_SLUG[f.rating] : null
    const pr = f.price ? PRICE_BY_SLUG[f.price] : null

    const durLo = dur?.minLo ?? null
    const durHi = dur?.minHi ?? null
    const priceLo = pr?.lo ?? null
    const priceHi = pr?.hi ?? null
    const minRating = rat?.min ?? null

    const sort = (f.sort && SORT_BY_SLUG[f.sort]) ? SORT_BY_SLUG[f.sort] : SORT_BY_SLUG.top
    const offset = (Math.max(1, page) - 1) * TOURS_PER_PAGE

    const [tours, totalRows, countries, categoryRows] = await Promise.all([
      db<Tour[]>`
        SELECT slug, title, country, city, category, duration_label, price_from, currency,
               rating, review_count, cover_image, summary_ai, source
        FROM tours
        WHERE active = true
          AND ${toursStateCond(tourStates)}
          AND (${country}::text IS NULL OR country = ${country}::text)
          AND (${city}::text IS NULL OR city = ${city}::text)
          AND (${category}::text IS NULL OR category = ${category}::text)
          AND (${q}::text IS NULL OR (title ILIKE ${q}::text OR summary_ai ILIKE ${q}::text OR city ILIKE ${q}::text))
          AND (${loc}::text IS NULL OR (title ILIKE ${loc}::text OR summary_ai ILIKE ${loc}::text OR city ILIKE ${loc}::text))
          AND (${durLo}::int IS NULL OR duration_min >= ${durLo}::int)
          AND (${durHi}::int IS NULL OR duration_min < ${durHi}::int)
          AND (${minRating}::numeric IS NULL OR rating >= ${minRating}::numeric)
          AND (${priceLo}::numeric IS NULL OR price_from >= ${priceLo}::numeric)
          AND (${priceHi}::numeric IS NULL OR price_from < ${priceHi}::numeric)
        ORDER BY ${sort.orderBy}
        LIMIT ${TOURS_PER_PAGE} OFFSET ${offset}`,
      db<[{ total: number }]>`
        SELECT COUNT(*)::int AS total
        FROM tours
        WHERE active = true
          AND ${toursStateCond(tourStates)}
          AND (${country}::text IS NULL OR country = ${country}::text)
          AND (${city}::text IS NULL OR city = ${city}::text)
          AND (${category}::text IS NULL OR category = ${category}::text)
          AND (${q}::text IS NULL OR (title ILIKE ${q}::text OR summary_ai ILIKE ${q}::text OR city ILIKE ${q}::text))
          AND (${loc}::text IS NULL OR (title ILIKE ${loc}::text OR summary_ai ILIKE ${loc}::text OR city ILIKE ${loc}::text))
          AND (${durLo}::int IS NULL OR duration_min >= ${durLo}::int)
          AND (${durHi}::int IS NULL OR duration_min < ${durHi}::int)
          AND (${minRating}::numeric IS NULL OR rating >= ${minRating}::numeric)
          AND (${priceLo}::numeric IS NULL OR price_from >= ${priceLo}::numeric)
          AND (${priceHi}::numeric IS NULL OR price_from < ${priceHi}::numeric)`,
      getCountriesAgg(tourStates),
      getCategoriesAgg(tourStates),
    ])
    const total = totalRows[0]?.total ?? 0
    return { tours, total, countries, categories: categoryRows }
  } catch (e) {
    console.error('[tours/getTours]', e)
    return { tours: [], total: 0, countries: [], categories: [] }
  }
}

function buildQuery(current: Filters, patch: Partial<Filters>): string {
  const next = { ...current, ...patch }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, String(v))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export default async function ToursPage({ searchParams }: { searchParams: Promise<{ country?: string; city?: string; loc?: string; category?: string; q?: string; duration?: string; rating?: string; price?: string; sort?: string; page?: string }> }) {
  const sp = await searchParams
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const tourStates = tourStatesFor(tenant)
  const filters: Filters = { country: sp.country, city: sp.city, loc: sp.loc, category: sp.category, q: sp.q, duration: sp.duration, rating: sp.rating, price: sp.price, sort: sp.sort }
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const [{ tours, total, countries, categories }, destinations] = await Promise.all([
    getTours(filters, page, tourStates),
    tenant.aggregator ? Promise.resolve([] as Array<{ name: string; slug: string }>) : getDestinationsAgg(state),
  ])
  const totalPages = Math.max(1, Math.ceil(total / TOURS_PER_PAGE))
  const activeCategory = filters.category ? CATEGORY_BY_SLUG[filters.category] : null
  const activeSort = (filters.sort && SORT_BY_SLUG[filters.sort]) ? SORT_BY_SLUG[filters.sort] : SORT_BY_SLUG.top
  const scopeLabel = tenant.aggregator ? 'Australia' : tenant.stateName
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Tours in ${scopeLabel}`,
    url: `https://${tenant.host}/tours/`,
    isPartOf: { '@type': 'WebSite', name: tenant.name, url: `https://${tenant.host}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: tours.slice(0, 30).map((t: any, i: number) => ({
        '@type': 'ListItem', position: i + 1, name: t.title,
        url: `https://${tenant.host}/tours/${t.slug}/`,
      })),
    },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Tours', item: `https://${tenant.host}/tours/` },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Tours &amp; experiences</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
            {activeCategory ? `${activeCategory.emoji} ${activeCategory.label}${filters.city ? ` in ${filters.city}` : ` in ${scopeLabel}`}` :
             filters.city ? `Tours in ${filters.city}` :
             `Hand-picked tours across ${scopeLabel}`}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 600 }}>
            Our team has been pulling together the best small-group tours, day trips and multi-day adventures around {scopeLabel} for years. Mick reads the traveller reviews before any tour earns a spot on this page — if a tour's a dud, it doesn't get listed.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 20px 60px' }}>
        {/* 1. Location — country search for the aggregator, suburb/place search for state-scoped tenants */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>
            {tenant.aggregator ? 'Start with a country' : 'Search by location'}
          </label>
          <div style={{ maxWidth: 520 }}>
            {tenant.aggregator ? (
              <ToursCountrySearch
                currentCountry={filters.country}
                preserveParams={{
                  category: filters.category,
                  duration: filters.duration,
                  rating: filters.rating,
                  price: filters.price,
                  sort: filters.sort,
                }}
              />
            ) : (
              <ToursLocationSearch
                state={state || ''}
                stateName={tenant.stateName}
                currentLocation={filters.loc}
                preserveParams={{
                  category: filters.category,
                  duration: filters.duration,
                  rating: filters.rating,
                  price: filters.price,
                  sort: filters.sort,
                }}
              />
            )}
          </div>
          {tenant.aggregator && countries.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.sub }}>Popular:</span>
              {countries.slice(0, 6).map(c => {
                const active = filters.country === c.country
                return (
                  <Link key={c.country} href={`/tours${buildQuery(filters, { country: active ? undefined : c.country })}`}
                    style={chipStyle(active)}>
                    {c.country} ({c.count})
                  </Link>
                )
              })}
            </div>
          )}
          {!tenant.aggregator && destinations.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.sub }}>Popular:</span>
              {destinations.slice(0, 6).map(d => {
                const active = (filters.loc || '').toLowerCase() === d.name.toLowerCase()
                return (
                  <Link key={d.slug} href={`/tours${buildQuery(filters, { loc: active ? undefined : d.name })}`}
                    style={chipStyle(active)}>
                    {d.name}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Filter row — Category / Duration / Rating / Price as dropdowns */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 22, alignItems: 'flex-end' }}>
          <FilterSelect
            param="category"
            label="Category"
            current={filters.category || ''}
            anyLabel="All categories"
            anyCount={categories.reduce((s, c) => s + c.count, 0)}
            options={TOUR_CATEGORIES.filter(c => categories.some(r => r.slug === c.slug)).map(cat => ({
              value: cat.slug,
              label: cat.label,
              count: categories.find(r => r.slug === cat.slug)?.count ?? 0,
            }))}
            minWidth={200}
          />
          <FilterSelect
            param="duration"
            label="Duration"
            current={filters.duration || ''}
            anyLabel="Any duration"
            options={DURATIONS.map(d => ({ value: d.slug, label: `${d.emoji} ${d.label}` }))}
            minWidth={170}
          />
          <FilterSelect
            param="rating"
            label="Rating"
            current={filters.rating || ''}
            anyLabel="Any rating"
            options={RATINGS.map(r => ({ value: r.slug, label: r.label }))}
            minWidth={150}
          />
          <FilterSelect
            param="price"
            label="Price (AUD)"
            current={filters.price || ''}
            anyLabel="Any price"
            options={PRICES.map(p => ({ value: p.slug, label: p.label }))}
            minWidth={150}
          />
        </div>

        {/* Results count + sort + clear */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 14, justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: C.sub, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <span><b style={{ color: C.text }}>{total.toLocaleString()}</b> {total === 1 ? 'tour' : 'tours'}
              {filters.q ? <> matching <i>"{filters.q}"</i></> : null}
              {activeCategory ? <> in <b style={{ color: C.text }}>{activeCategory.label}</b></> : null}
              {filters.loc ? <> in <b style={{ color: C.text }}>{filters.loc}</b></> : null}
              {filters.country ? <> in <b style={{ color: C.text }}>{filters.country}</b></> : null}
              {filters.duration ? <> · <b style={{ color: C.text }}>{DURATION_BY_SLUG[filters.duration]?.label}</b></> : null}
              {filters.rating ? <> · <b style={{ color: C.text }}>{RATING_BY_SLUG[filters.rating]?.label}</b></> : null}
              {filters.price ? <> · <b style={{ color: C.text }}>{PRICE_BY_SLUG[filters.price]?.label}</b></> : null}
            </span>
            {(filters.q || filters.category || filters.loc || filters.country || filters.duration || filters.rating || filters.price) && (
              <Link href={`/tours${filters.sort && filters.sort !== 'top' ? `?sort=${filters.sort}` : ''}`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>Clear filters</Link>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>Sort by:</label>
            <SortSelect options={SORTS.map(s => ({ slug: s.slug, label: s.label }))} current={activeSort.slug}/>
          </div>
        </div>

        {tours.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' as const, color: C.sub }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌏</div>
            <p style={{ fontSize: 15, color: C.text, fontWeight: 600, margin: '0 0 6px' }}>No tours match your filters</p>
            <p style={{ fontSize: 13, margin: '0 0 14px' }}>Try a different category or clear your search.</p>
            <Link href="/tours" style={{ display: 'inline-block', background: C.teal, color: '#fff', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Show all tours</Link>
          </div>
        ) : (
          <div className="bb-row-grid" style={{ gap: 18 }}>
            {tours.map(t => {
              const cat = t.category ? CATEGORY_BY_SLUG[t.category] : null
              return (
                <Link key={t.slug} href={`/tours/${t.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, display: 'flex', flexDirection: 'column' as const, height: '100%' }}>
                    <div style={{ position: 'relative' as const, aspectRatio: '4/3', background: '#f1f5f9', overflow: 'hidden' as const }}>
                      {t.cover_image
                        ? <img src={t.cover_image} alt={t.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🌏</div>}
                      {t.rating && (
                        <div style={{ position: 'absolute' as const, top: 10, left: 10, background: 'rgba(0,0,0,0.72)', color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          ★ {Number(t.rating).toFixed(1)}{t.review_count ? ` (${Number(t.review_count).toLocaleString()})` : ''}
                        </div>
                      )}
                      {cat && (
                        <div style={{ position: 'absolute' as const, top: 10, right: 10, background: 'rgba(255,255,255,0.92)', color: C.text, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          {cat.emoji} {cat.label}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }}>
                        {[t.city, t.country].filter(Boolean).join(' · ')}
                      </div>
                      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>
                        {t.title}
                      </h2>
                      {t.summary_ai && (
                        <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>
                          {t.summary_ai}
                        </p>
                      )}
                      <div style={{ marginTop: 'auto' as const, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 12, color: C.sub }}>{t.duration_label || ''}</span>
                        {t.price_from && (
                          <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
                            <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>from </span>
                            {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav style={{ marginTop: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }} aria-label="Tours pagination">
            {page > 1 && (
              <Link href={`/tours${buildQuery(filters, { page: page > 2 ? String(page - 1) : undefined })}`}
                style={pageBtn(false)} rel="prev">← Prev</Link>
            )}
            <span style={{ fontSize: 13, color: C.sub, padding: '0 10px' }}>Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={`/tours${buildQuery(filters, { page: String(page + 1) })}`}
                style={pageBtn(false)} rel="next">Next →</Link>
            )}
          </nav>
        )}

        <div style={{ marginTop: 28, textAlign: 'center' as const, fontSize: 11, color: C.sub }}>
          Some tours listed with{' '}
          <a href="https://www.viator.com" target="_blank" rel="noopener noreferrer" style={{ color: C.sub, textDecoration: 'underline' }}>Viator</a>,
          a Tripadvisor company. Prices and availability confirmed at checkout.
        </div>
      </div>
    </main>
  )
}

function pageBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
    background: active ? C.teal : C.card, color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.teal : C.border}`,
  }
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    background: active ? C.teal : C.card,
    color: active ? '#fff' : C.text,
    border: active ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
    whiteSpace: 'nowrap' as const,
  }
}
