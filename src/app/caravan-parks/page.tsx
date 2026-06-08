// Dedicated caravan park finder — narrower scope than /parks/ which also lists
// bush camps and national-park camping. This route only surfaces commercial
// caravan / holiday / tourist parks, with star ratings + "what people love"
// review pulls front and centre.
import { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'

export const revalidate = 300
const PER_PAGE = 24
const CARAVAN_TYPES = ['caravan', 'holiday', 'tourist'] as const

type Park = {
  slug: string
  name: string
  park_type: string | null
  region: string | null
  suburb: string | null
  price_from: string | null
  currency: string | null
  avg_rating: string | null
  review_count: number | null
  cover_image: string | null
  pets_allowed: boolean | null
  big_rig_friendly: boolean | null
  site_types: Record<string, boolean> | null
  ai_pros: string[] | null
  ai_review_summary: string | null
}

type Filters = { region?: string; type?: string; pets?: string; cabins?: string; q?: string; sort?: string; page?: string }

const C = { bg: '#f8fafc', card: '#fff', border: '#e5e7eb', text: '#0f172a', sub: '#64748b', teal: '#0d9488', tealDark: '#0f766e', tealLight: '#f0fdfa', amber: '#fbbf24', emerald: '#10b981' }

const SORTS = [
  { slug: 'top',     label: 'Top rated',     orderBy: db`featured DESC, avg_rating DESC NULLS LAST, review_count DESC NULLS LAST` },
  { slug: 'reviews', label: 'Most reviewed', orderBy: db`review_count DESC NULLS LAST, avg_rating DESC NULLS LAST` },
  { slug: 'name',    label: 'A to Z',        orderBy: db`name ASC` },
] as const
const SORT_BY_SLUG = Object.fromEntries(SORTS.map(s => [s.slug, s]))

const TYPE_LABELS: Record<string, string> = { caravan: 'Caravan park', holiday: 'Holiday park', tourist: 'Tourist park' }

function chip(active: boolean) {
  return {
    display: 'inline-block', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? C.teal : C.border}`, background: active ? C.tealLight : C.card,
    color: active ? C.tealDark : C.text, textDecoration: 'none', whiteSpace: 'nowrap' as const,
  }
}

function getParks(f: Filters, page: number, state: StateCode | null) {
  const key = JSON.stringify({ f, page, state, v: 'caravan-only' })
  return unstable_cache(
    () => getParksRaw(f, page, state),
    ['caravan-parks-list', key],
    { revalidate: 300, tags: ['parks', `parks:${state ?? 'all'}`] }
  )()
}

async function getParksRaw(f: Filters, page: number, state: StateCode | null) {
  const region = f.region ?? null
  const type = (f.type && (CARAVAN_TYPES as readonly string[]).includes(f.type)) ? f.type : null
  const pets = f.pets === '1' ? true : null
  const cabins = f.cabins === '1' ? true : null
  const q = f.q?.trim() ? `%${f.q.trim()}%` : null
  const sort = (f.sort && SORT_BY_SLUG[f.sort]) ? SORT_BY_SLUG[f.sort] : SORT_BY_SLUG.top
  const offset = (Math.max(1, page) - 1) * PER_PAGE

  try {
    const [rows, totalRows, regions] = await Promise.all([
      db<Park[]>`
        SELECT slug, name, park_type, region, suburb, price_from, currency,
               avg_rating, review_count, cover_image, pets_allowed, big_rig_friendly,
               site_types, ai_pros, ai_review_summary
        FROM parks
        WHERE active = true
          AND park_type IN ('caravan','holiday','tourist')
          AND (${state}::text IS NULL OR state_code = ${state}::text)
          AND (${region}::text IS NULL OR region = ${region}::text)
          AND (${type}::text IS NULL OR park_type = ${type}::text)
          AND (${pets}::boolean IS NULL OR pets_allowed = ${pets}::boolean)
          AND (${cabins}::boolean IS NULL OR (site_types->>'cabins')::boolean = ${cabins}::boolean)
          AND (${q}::text IS NULL OR (name ILIKE ${q}::text OR description ILIKE ${q}::text OR region ILIKE ${q}::text OR suburb ILIKE ${q}::text))
        ORDER BY ${sort.orderBy}
        LIMIT ${PER_PAGE} OFFSET ${offset}`,
      db<[{ total: number }]>`
        SELECT COUNT(*)::int AS total FROM parks
        WHERE active = true AND park_type IN ('caravan','holiday','tourist')
          AND (${state}::text IS NULL OR state_code = ${state}::text)
          AND (${region}::text IS NULL OR region = ${region}::text)
          AND (${type}::text IS NULL OR park_type = ${type}::text)
          AND (${pets}::boolean IS NULL OR pets_allowed = ${pets}::boolean)
          AND (${cabins}::boolean IS NULL OR (site_types->>'cabins')::boolean = ${cabins}::boolean)
          AND (${q}::text IS NULL OR (name ILIKE ${q}::text OR description ILIKE ${q}::text OR region ILIKE ${q}::text OR suburb ILIKE ${q}::text))`,
      db<Array<{ region: string; count: number }>>`
        SELECT region, COUNT(*)::int AS count FROM parks
        WHERE active=true AND park_type IN ('caravan','holiday','tourist') AND region IS NOT NULL AND region <> ''
          AND (${state}::text IS NULL OR state_code = ${state}::text)
        GROUP BY region ORDER BY count DESC`,
    ])
    return { parks: rows, total: totalRows[0]?.total ?? 0, regions }
  } catch (e) {
    console.error('[caravan-parks/getParks]', e)
    return { parks: [] as Park[], total: 0, regions: [] as Array<{ region: string; count: number }> }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const title = `Caravan Parks in ${scope} — finder with reviews & ratings`
  const desc  = `Find caravan, holiday and tourist parks across ${scope}. Filter by region, pets, cabins. Real Google review summaries — what guests love and what could be better.`
  const url   = `https://${tenant.host}/caravan-parks/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: `Caravan parks in ${scope}` }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

function qs(current: Filters, patch: Partial<Filters>): string {
  const next = { ...current, ...patch }
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating)
  return (
    <span aria-hidden style={{ color: C.amber, letterSpacing: 1, fontSize: 14 }}>
      {'★'.repeat(r)}{'☆'.repeat(5 - r)}
    </span>
  )
}

export default async function CaravanParksPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const filters: Filters = { region: sp.region, type: sp.type, pets: sp.pets, cabins: sp.cabins, q: sp.q, sort: sp.sort }
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const { parks, total, regions } = await getParks(filters, page, state)
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const activeSort = (filters.sort && SORT_BY_SLUG[filters.sort]) ? SORT_BY_SLUG[filters.sort] : SORT_BY_SLUG.top
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName

  const collectionLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `Caravan Parks in ${scope}`,
    url: `https://${tenant.host}/caravan-parks/`,
    isPartOf: { '@type': 'WebSite', name: tenant.name, url: `https://${tenant.host}/` },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: total,
      itemListElement: parks.slice(0, 30).map((p, i) => ({
        '@type': 'ListItem', position: i + 1, name: p.name,
        url: `https://${tenant.host}/parks/${p.slug}/`,
      })),
    },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Caravan Parks', item: `https://${tenant.host}/caravan-parks/` },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>

      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '40px 20px 30px', textAlign: 'center' as const, color: '#fff' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', letterSpacing: 2.5, textTransform: 'uppercase' as const, marginBottom: 12 }}>The caravan park finder</div>
          <h1 style={{ fontSize: 'clamp(28px,5.5vw,44px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.1, fontFamily: 'Georgia, serif' }}>
            Caravan parks in {scope}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, margin: '0 auto', lineHeight: 1.55, maxWidth: 640 }}>
            Powered sites, en-suite cabins, family pools and pet-friendly grounds — with what guests love (and what could be better) summarised from real Google reviews.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
        <form method="GET" style={{ display: 'flex', alignItems: 'stretch', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 5, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: C.sub }} aria-hidden>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          </div>
          <input name="q" defaultValue={filters.q || ''} placeholder={`Search caravan parks in ${scope}…`} aria-label="Search caravan parks"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: 15, color: C.text, background: 'transparent', fontFamily: 'inherit', minWidth: 0 }}/>
          {filters.region && <input type="hidden" name="region" value={filters.region}/>}
          {filters.type && <input type="hidden" name="type" value={filters.type}/>}
          {filters.pets && <input type="hidden" name="pets" value={filters.pets}/>}
          {filters.cabins && <input type="hidden" name="cabins" value={filters.cabins}/>}
          {filters.sort && <input type="hidden" name="sort" value={filters.sort}/>}
          <button type="submit" style={{ padding: '9px 22px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>Search</button>
        </form>

        {regions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Region</span>
            <Link href={`/caravan-parks${qs(filters, { region: undefined })}`} style={chip(!filters.region)}>Any</Link>
            {regions.slice(0, 12).map(r => {
              const active = filters.region === r.region
              return <Link key={r.region} href={`/caravan-parks${qs(filters, { region: active ? undefined : r.region })}`} style={chip(active)}>{r.region} ({r.count})</Link>
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Type</span>
          <Link href={`/caravan-parks${qs(filters, { type: undefined })}`} style={chip(!filters.type)}>Any</Link>
          {(['caravan','holiday','tourist'] as const).map(t => {
            const active = filters.type === t
            return <Link key={t} href={`/caravan-parks${qs(filters, { type: active ? undefined : t })}`} style={chip(active)}>{TYPE_LABELS[t]}</Link>
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 18, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginRight: 4 }}>Features</span>
          <Link href={`/caravan-parks${qs(filters, { pets: filters.pets === '1' ? undefined : '1' })}`} style={chip(filters.pets === '1')}>🐾 Pets allowed</Link>
          <Link href={`/caravan-parks${qs(filters, { cabins: filters.cabins === '1' ? undefined : '1' })}`} style={chip(filters.cabins === '1')}>🛖 Cabins</Link>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 14, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: C.sub }}>
            <b style={{ color: C.text }}>{total.toLocaleString()}</b> {total === 1 ? 'park' : 'parks'}
            {filters.region ? <> in <b style={{ color: C.text }}>{filters.region}</b></> : null}
            {filters.q ? <> matching <i>&ldquo;{filters.q}&rdquo;</i></> : null}
          </span>
          <div style={{ fontSize: 12, color: C.sub, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {SORTS.map(s => (
              <Link key={s.slug} href={`/caravan-parks${qs(filters, { sort: s.slug === 'top' ? undefined : s.slug })}`}
                style={{ ...chip(activeSort.slug === s.slug), padding: '5px 10px', fontSize: 12 }}>{s.label}</Link>
            ))}
          </div>
        </div>

        {parks.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' as const, color: C.sub }}>
            No caravan parks match those filters. Try widening the search.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {parks.map(p => {
              const rating = p.avg_rating ? Number(p.avg_rating) : null
              const reviews = p.review_count || 0
              const typeLabel = p.park_type ? (TYPE_LABELS[p.park_type] || p.park_type) : null
              return (
                <Link key={p.slug} href={`/parks/${p.slug}/`} style={{ textDecoration: 'none', color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, display: 'flex', flexDirection: 'column' as const, transition: 'transform .15s, box-shadow .15s, border-color .15s' }}>
                  {p.cover_image ? (
                    <div style={{ aspectRatio: '4/3', background: '#e5e7eb', position: 'relative' as const }}>
                      <img src={p.cover_image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }}/>
                      {rating != null && (
                        <div style={{ position: 'absolute' as const, top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(2px)' }}>
                          <span style={{ color: C.amber }}>★</span> {rating.toFixed(1)}
                          {reviews > 0 ? <span style={{ opacity: 0.8, fontWeight: 500 }}>({reviews})</span> : null}
                        </div>
                      )}
                      {typeLabel && (
                        <div style={{ position: 'absolute' as const, top: 10, left: 10, background: 'rgba(13,148,136,0.92)', color: '#fff', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{typeLabel}</div>
                      )}
                    </div>
                  ) : null}
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.3, fontFamily: 'Georgia, serif' }}>{p.name}</h3>
                    <div style={{ fontSize: 12, color: C.sub }}>
                      {[p.suburb, p.region].filter(Boolean).join(' · ')}
                    </div>
                    {rating != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
                        <Stars rating={rating}/>
                        <span><b>{rating.toFixed(1)}</b>{reviews > 0 ? <span style={{ color: C.sub }}> ({reviews.toLocaleString()})</span> : null}</span>
                      </div>
                    )}
                    {Array.isArray(p.ai_pros) && p.ai_pros.length > 0 && (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 12, color: '#065f46', lineHeight: 1.45 }}>
                        {p.ai_pros.slice(0, 2).map((pro, i) => (
                          <li key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                            <span aria-hidden style={{ color: C.emerald, flexShrink: 0 }}>✓</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.price_from && (
                      <div style={{ marginTop: 'auto', paddingTop: 6, fontSize: 13, color: C.text }}>
                        From <b>{p.currency || 'AUD'} ${Number(p.price_from).toFixed(0)}</b>/night
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {page > 1 && <Link href={`/caravan-parks${qs(filters, { page: String(page - 1) })}`} style={chip(false)}>← Prev</Link>}
            <span style={{ padding: '6px 12px', fontSize: 13, color: C.sub }}>Page {page} of {totalPages}</span>
            {page < totalPages && <Link href={`/caravan-parks${qs(filters, { page: String(page + 1) })}`} style={chip(false)}>Next →</Link>}
          </div>
        )}
      </div>
    </main>
  )
}
