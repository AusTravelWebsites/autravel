import { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getTenant, parkStatesFor } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'

export const revalidate = 300
const PARKS_PER_PAGE = 30

type Park = {
  slug: string
  name: string
  park_type: string | null
  region: string | null
  suburb: string | null
  price_from: string | null
  currency: string | null
  star_rating: string | null
  avg_rating: string | null
  review_count: number | null
  cover_image: string | null
  pets_allowed: boolean | null
  big_rig_friendly: boolean | null
  amenities: Record<string, boolean> | null
  site_types: Record<string, boolean> | null
  description_ai: string | null
  description: string | null
}

type Filters = {
  region?: string
  type?: string
  pets?: string
  cabins?: string
  powered?: string
  q?: string
  sort?: string
  page?: string
}

const SORTS: Array<{ slug: string; label: string; orderBy: ReturnType<typeof db> }> = [
  { slug: 'top',       label: 'Top rated',         orderBy: db`featured DESC, avg_rating DESC NULLS LAST, review_count DESC NULLS LAST` },
  { slug: 'reviews',   label: 'Most reviewed',     orderBy: db`review_count DESC NULLS LAST, avg_rating DESC NULLS LAST` },
  { slug: 'price-asc', label: 'Price: low to high',orderBy: db`price_from ASC NULLS LAST, avg_rating DESC NULLS LAST` },
  { slug: 'name',      label: 'A to Z',            orderBy: db`name ASC` },
]
const SORT_BY_SLUG: Record<string, typeof SORTS[number]> = Object.fromEntries(SORTS.map(s => [s.slug, s]))

const PARK_TYPES = [
  { slug: 'caravan',       label: 'Caravan parks' },
  { slug: 'holiday',       label: 'Holiday parks' },
  { slug: 'tourist',       label: 'Tourist parks' },
  { slug: 'bushcamp',      label: 'Bush camps' },
  { slug: 'national_park', label: 'National park camping' },
]

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

// parks is a shared single-tenant table; a tenant may surface more than one
// state's parks (The Australian Explorer aggregates all AU states). This turns a
// park-state list into a WHERE condition (null = aggregator, no filter).
const parksCond = (states: StateCode[] | null) => states === null ? db`true` : db`state_code = ANY(${states})`
const parksKey = (states: StateCode[] | null) => states ? states.join('+') : 'all'

function getRegionsAgg(parkStates: StateCode[] | null) {
  const key = parksKey(parkStates)
  return unstable_cache(
    async () => db<Array<{ region: string; count: number }>>`
      SELECT region, COUNT(*)::int AS count
      FROM parks
      WHERE active = true AND region IS NOT NULL AND region <> ''
        AND ${parksCond(parkStates)}
      GROUP BY region ORDER BY count DESC`,
    ['parks-regions-agg', key],
    { revalidate: 300, tags: ['parks', `parks:${key}`] }
  )()
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const title = `Caravan Parks in ${scope}`
  const desc = `Find caravan parks, holiday parks, tourist parks and campgrounds across ${scope}. Filter by pets allowed, powered sites, cabins and more.`
  const url = `https://${tenant.host}/parks/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: `Caravan parks in ${scope}` }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

// 2026-05-25 — wrapped in unstable_cache; same fix as /tours.
function getParks(f: Filters, page: number, parkStates: StateCode[] | null) {
  const key = JSON.stringify({ f, page, parkStates })
  return unstable_cache(
    () => getParksRaw(f, page, parkStates),
    ['parks-list', key],
    { revalidate: 300, tags: ['parks', `parks:${parksKey(parkStates)}`] }
  )()
}

async function getParksRaw(f: Filters, page: number, parkStates: StateCode[] | null) {
  const region = f.region ?? null
  const type = f.type ?? null
  const pets = f.pets === '1' ? true : null
  const cabins = f.cabins === '1' ? true : null
  const q = f.q?.trim() ? `%${f.q.trim()}%` : null
  const sort = (f.sort && SORT_BY_SLUG[f.sort]) ? SORT_BY_SLUG[f.sort] : SORT_BY_SLUG.top
  const offset = (Math.max(1, page) - 1) * PARKS_PER_PAGE

  try {
    const [rows, totalRows, regions] = await Promise.all([
      db<Park[]>`
        SELECT slug, name, park_type, region, suburb, price_from, currency,
               star_rating, avg_rating, review_count, cover_image,
               pets_allowed, big_rig_friendly, amenities, site_types,
               description_ai, description
        FROM parks
        WHERE active = true
          AND ${parksCond(parkStates)}
          AND (${region}::text IS NULL OR region = ${region}::text)
          AND (${type}::text IS NULL OR park_type = ${type}::text)
          AND (${pets}::boolean IS NULL OR pets_allowed = ${pets}::boolean)
          AND (${cabins}::boolean IS NULL OR (site_types->>'cabins')::boolean = ${cabins}::boolean)
          AND (${q}::text IS NULL OR (name ILIKE ${q}::text OR description ILIKE ${q}::text OR region ILIKE ${q}::text OR suburb ILIKE ${q}::text))
        ORDER BY ${sort.orderBy}
        LIMIT ${PARKS_PER_PAGE} OFFSET ${offset}`,
      db<[{ total: number }]>`
        SELECT COUNT(*)::int AS total FROM parks
        WHERE active = true
          AND ${parksCond(parkStates)}
          AND (${region}::text IS NULL OR region = ${region}::text)
          AND (${type}::text IS NULL OR park_type = ${type}::text)
          AND (${pets}::boolean IS NULL OR pets_allowed = ${pets}::boolean)
          AND (${cabins}::boolean IS NULL OR (site_types->>'cabins')::boolean = ${cabins}::boolean)
          AND (${q}::text IS NULL OR (name ILIKE ${q}::text OR description ILIKE ${q}::text OR region ILIKE ${q}::text OR suburb ILIKE ${q}::text))`,
      getRegionsAgg(parkStates),
    ])
    return { parks: rows, total: totalRows[0]?.total ?? 0, regions }
  } catch (e) {
    console.error('[parks/getParks]', e)
    return { parks: [] as Park[], total: 0, regions: [] as Array<{ region: string; count: number }> }
  }
}

function qs(current: Filters, patch: Partial<Filters>): string {
  const next = { ...current, ...patch }
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export default async function ParksPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const tenant = await getTenant()
  const parkStates = parkStatesFor(tenant)
  const filters: Filters = { region: sp.region, type: sp.type, pets: sp.pets, cabins: sp.cabins, powered: sp.powered, q: sp.q, sort: sp.sort }
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const { parks, total, regions } = await getParks(filters, page, parkStates)
  const totalPages = Math.max(1, Math.ceil(total / PARKS_PER_PAGE))
  const activeSort = (filters.sort && SORT_BY_SLUG[filters.sort]) ? SORT_BY_SLUG[filters.sort] : SORT_BY_SLUG.top
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Caravan Parks in ${scope}`,
    url: `https://${tenant.host}/parks/`,
    isPartOf: { '@type': 'WebSite', name: tenant.name, url: `https://${tenant.host}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: parks.slice(0, 30).map((p: any, i: number) => ({
        '@type': 'ListItem', position: i + 1, name: p.name,
        url: `https://${tenant.host}/parks/${p.slug}/`,
      })),
    },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Caravan Parks', item: `https://${tenant.host}/parks/` },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Caravan &amp; holiday parks</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
            Every caravan park in {scope}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 640 }}>
            Powered sites, cabins, glamping, bush camps and big-rig-friendly grounds — we keep this list current so you don't have to phone around. Beth's been scouting parks across {scope} since the van life thing was just called "going camping."
          </p>
          <div style={{ marginTop: 18 }}>
            <Link href="/caravan-park-finder/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: 'var(--brand-dark)', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}>
              🔍 Open the Caravan Park Finder
            </Link>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 20px 60px' }}>
        {/* Search input — icon-prefixed, full-width, matches the homepage hero affordance */}
        <form method="GET" style={{ display: 'flex', alignItems: 'stretch', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 5, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: C.sub }} aria-hidden>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          </div>
          <input name="q" defaultValue={filters.q || ''} placeholder={`Search parks in ${scope}…`}
            aria-label="Search parks"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: 15, color: C.text, background: 'transparent', fontFamily: 'inherit', minWidth: 0 }}/>
          {filters.region && <input type="hidden" name="region" value={filters.region}/>}
          {filters.type && <input type="hidden" name="type" value={filters.type}/>}
          {filters.pets && <input type="hidden" name="pets" value={filters.pets}/>}
          {filters.cabins && <input type="hidden" name="cabins" value={filters.cabins}/>}
          {filters.sort && <input type="hidden" name="sort" value={filters.sort}/>}
          <button type="submit" style={{ padding: '9px 20px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>Search</button>
        </form>

        {regions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Region</span>
            <Link href={`/parks${qs(filters, { region: undefined })}`} style={chip(!filters.region)}>Any</Link>
            {regions.slice(0, 12).map(r => {
              const active = filters.region === r.region
              return <Link key={r.region} href={`/parks${qs(filters, { region: active ? undefined : r.region })}`} style={chip(active)}>{r.region} ({r.count})</Link>
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Type</span>
          <Link href={`/parks${qs(filters, { type: undefined })}`} style={chip(!filters.type)}>Any</Link>
          {PARK_TYPES.map(pt => {
            const active = filters.type === pt.slug
            return <Link key={pt.slug} href={`/parks${qs(filters, { type: active ? undefined : pt.slug })}`} style={chip(active)}>{pt.label}</Link>
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 18, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Features</span>
          <Link href={`/parks${qs(filters, { pets: filters.pets === '1' ? undefined : '1' })}`} style={chip(filters.pets === '1')}>🐾 Pets allowed</Link>
          <Link href={`/parks${qs(filters, { cabins: filters.cabins === '1' ? undefined : '1' })}`} style={chip(filters.cabins === '1')}>🛖 Cabins</Link>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 14, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: C.sub }}>
            <b style={{ color: C.text }}>{total.toLocaleString()}</b> {total === 1 ? 'park' : 'parks'}
            {filters.region ? <> in <b style={{ color: C.text }}>{filters.region}</b></> : null}
            {filters.q ? <> matching <i>"{filters.q}"</i></> : null}
          </span>
          <div style={{ fontSize: 12, color: C.sub, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {SORTS.map(s => (
              <Link key={s.slug} href={`/parks${qs(filters, { sort: s.slug === 'top' ? undefined : s.slug })}`}
                style={{ ...chip(activeSort.slug === s.slug), padding: '5px 10px', fontSize: 12 }}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {parks.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' as const, color: C.sub }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏕️</div>
            <p style={{ fontSize: 15, color: C.text, fontWeight: 600, margin: '0 0 6px' }}>No parks match your filters</p>
            <Link href="/parks" style={{ display: 'inline-block', background: C.teal, color: '#fff', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none', marginTop: 10 }}>Show all parks</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {parks.map(p => {
              const rating = p.avg_rating ? Number(p.avg_rating) : (p.star_rating ? Number(p.star_rating) : null)
              return (
                <Link key={p.slug} href={`/parks/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, display: 'flex', flexDirection: 'column' as const, height: '100%' }}>
                    <div style={{ position: 'relative' as const, aspectRatio: '4/3', background: '#f1f5f9', overflow: 'hidden' as const }}>
                      {p.cover_image
                        ? <img src={p.cover_image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🏕️</div>}
                      {rating != null && (
                        <div style={{ position: 'absolute' as const, top: 10, left: 10, background: 'rgba(0,0,0,0.72)', color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          ★ {rating.toFixed(1)}{p.review_count ? ` (${Number(p.review_count).toLocaleString()})` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }}>
                        {[p.suburb, p.region].filter(Boolean).join(' · ')}
                      </div>
                      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text, lineHeight: 1.3 }}>{p.name}</h2>
                      {(p.description_ai || p.description) && (
                        <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>
                          {p.description_ai || p.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 'auto' as const, paddingTop: 6 }}>
                        {p.pets_allowed && <span style={badge}>🐾 Pets</span>}
                        {p.site_types?.cabins && <span style={badge}>🛖 Cabins</span>}
                        {p.site_types?.powered_sites && <span style={badge}>⚡ Powered</span>}
                        {p.big_rig_friendly && <span style={badge}>🚐 Big rig</span>}
                      </div>
                      {p.price_from && (
                        <div style={{ paddingTop: 4, fontSize: 13, color: C.text, fontWeight: 700 }}>
                          <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>from </span>
                          {p.currency || 'AUD'} ${Number(p.price_from).toFixed(0)}<span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}> /night</span>
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            {page > 1 && <Link href={`/parks${qs(filters, { page: page > 2 ? String(page - 1) : undefined })}`} style={pageBtn}>← Prev</Link>}
            <span style={{ fontSize: 13, color: C.sub, padding: '0 10px', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            {page < totalPages && <Link href={`/parks${qs(filters, { page: String(page + 1) })}`} style={pageBtn}>Next →</Link>}
          </nav>
        )}
      </div>
    </main>
  )
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none',
    background: active ? C.teal : C.card, color: active ? '#fff' : C.text,
    border: active ? `1px solid ${C.teal}` : `1px solid ${C.border}`, whiteSpace: 'nowrap' as const,
  }
}
const badge: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 999,
  background: C.tealLight, color: 'var(--brand-dark)', fontWeight: 600, border: '1px solid #a7f3d0',
}
const pageBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
  background: C.card, color: C.text, border: `1px solid ${C.border}`,
}
