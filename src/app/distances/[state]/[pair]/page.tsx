import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { TENANTS } from '@/lib/tenants'

export const revalidate = 86400

type Pair = {
  state_code: string
  from_slug: string
  to_slug: string
  from_name: string
  to_name: string
  distance_km: string
  duration_min: number
}

type Dest = {
  slug: string
  name: string
  region: string | null
  intro: string | null
  hero_image: string | null
  lat: string | null
  lng: string | null
}

function parsePair(pairStr: string): { fromSlug: string; toSlug: string; reversed: boolean } | null {
  // Pattern: <from-slug>-to-<to-slug>
  const m = pairStr.match(/^(.+?)-to-(.+)$/)
  if (!m) return null
  return { fromSlug: m[1], toSlug: m[2], reversed: false }
}

async function loadPair(state: string, fromSlug: string, toSlug: string): Promise<{ pair: Pair; reversed: boolean } | null> {
  // distance_pairs is keyed canonically (from_slug < to_slug). Resolve direction.
  const [a, b] = [fromSlug, toSlug].sort()
  try {
    const rows = await db<Pair[]>`
      SELECT state_code, from_slug, to_slug, from_name, to_name, distance_km::text, duration_min
      FROM distance_pairs
      WHERE state_code = ${state} AND from_slug = ${a} AND to_slug = ${b}
      LIMIT 1`
    if (!rows[0]) return null
    return { pair: rows[0], reversed: rows[0].from_slug !== fromSlug }
  } catch { return null }
}

async function loadDest(state: string, slug: string): Promise<Dest | null> {
  try {
    const [row] = await db<Dest[]>`
      SELECT slug, name, region, intro, hero_image, lat::text, lng::text
      FROM destinations WHERE state_code = ${state} AND slug = ${slug} AND active LIMIT 1`
    return row || null
  } catch { return null }
}

async function loadEnRouteHighlights(state: string, fromSlug: string, toSlug: string): Promise<{ tours: any[]; parks: any[]; otherDests: Dest[] }> {
  // Tours / parks at either end + other destinations between them (rough bbox)
  const ends = await db`
    SELECT lat::text, lng::text, slug FROM destinations WHERE state_code = ${state} AND slug = ANY(${[fromSlug, toSlug]})`
  if (ends.length !== 2) return { tours: [], parks: [], otherDests: [] }
  const [a, b] = ends as any[]
  const minLat = Math.min(Number(a.lat), Number(b.lat)) - 0.5
  const maxLat = Math.max(Number(a.lat), Number(b.lat)) + 0.5
  const minLng = Math.min(Number(a.lng), Number(b.lng)) - 0.5
  const maxLng = Math.max(Number(a.lng), Number(b.lng)) + 0.5

  const [tours, parks, otherDests] = await Promise.all([
    db`SELECT slug, title, cover_image, rating, price_from, currency FROM tours
       WHERE active = true AND state_code = ${state} AND rating IS NOT NULL
       ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 6`,
    db`SELECT slug, name, region, suburb, cover_image FROM parks
       WHERE active = true AND state_code = ${state}
         AND lat BETWEEN ${minLat} AND ${maxLat}
         AND lng BETWEEN ${minLng} AND ${maxLng}
       ORDER BY featured DESC, avg_rating DESC NULLS LAST LIMIT 6`,
    db<Dest[]>`SELECT slug, name, region, intro, hero_image, lat::text, lng::text FROM destinations
       WHERE active = true AND state_code = ${state}
         AND slug NOT IN (${fromSlug}, ${toSlug})
         AND lat BETWEEN ${minLat} AND ${maxLat}
         AND lng BETWEEN ${minLng} AND ${maxLng}
       LIMIT 6`,
  ])
  return { tours: tours as any[], parks: parks as any[], otherDests }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; pair: string }> }): Promise<Metadata> {
  const { state, pair } = await params
  const tenant = await getTenant()
  const parsed = parsePair(pair)
  if (!parsed) return {}
  const data = await loadPair(state, parsed.fromSlug, parsed.toSlug)
  if (!data) return {}
  const fromName = parsed.reversed ? data.pair.to_name : data.pair.from_name
  const toName = parsed.reversed ? data.pair.from_name : data.pair.to_name
  const km = Number(data.pair.distance_km).toFixed(0)
  const hh = Math.floor(data.pair.duration_min / 60)
  const mm = data.pair.duration_min % 60
  const title = `${fromName} to ${toName} — drive distance & time`
  const desc = `${fromName} to ${toName} is about ${km} km by road, roughly ${hh} h ${mm} m driving. Suggested stops, caravan parks and tours along the way.`
  const url = `https://${tenant.host}/distances/${state}/${pair}/`
  return {
    title: title.length > 60 ? title.slice(0, 57) + '…' : title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

export default async function DistancePairPage({ params }: { params: Promise<{ state: string; pair: string }> }) {
  const { state, pair } = await params
  const tenant = await getTenant()
  const tenantState = stateFilterValue(tenant)
  // Tenants only show their state's pairs (aunz shows all)
  if (tenantState && tenantState !== state) notFound()
  if (!Object.keys(TENANTS).includes(state)) notFound()
  const parsed = parsePair(pair)
  if (!parsed) notFound()
  const data = await loadPair(state, parsed.fromSlug, parsed.toSlug)
  if (!data) notFound()

  const fromSlug = parsed.fromSlug, toSlug = parsed.toSlug
  const fromName = parsed.reversed ? data.pair.to_name : data.pair.from_name
  const toName = parsed.reversed ? data.pair.from_name : data.pair.to_name
  const [from, to] = await Promise.all([loadDest(state, fromSlug), loadDest(state, toSlug)])
  const { tours, parks, otherDests } = await loadEnRouteHighlights(state, fromSlug, toSlug)

  const km = Number(data.pair.distance_km)
  const hh = Math.floor(data.pair.duration_min / 60)
  const mm = data.pair.duration_min % 60
  const fuelLitres = (km / 100) * 9 // ~9L/100km caravan-tow estimate
  const fuelCost = fuelLitres * 1.95 // typical AU regional unleaded mid-2026
  const longDrive = data.pair.duration_min > 5 * 60
  const canonical = `https://${tenant.host}/distances/${state}/${fromSlug}-to-${toSlug}/`

  // Reverse-direction sister page link
  const reverseUrl = `/distances/${state}/${toSlug}-to-${fromSlug}/`

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Distances', item: `https://${tenant.host}/distances/` },
      { '@type': 'ListItem', position: 3, name: `${fromName} to ${toName}`, item: canonical },
    ],
  }
  const tripLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: `Drive from ${fromName} to ${toName}`,
    description: `${km.toFixed(0)} km road trip in ${TENANTS[state as keyof typeof TENANTS].stateName}, approximately ${hh}h ${mm}m driving.`,
    touristType: 'Self-drive road trip',
    itinerary: [
      { '@type': 'Place', name: fromName, geo: from?.lat ? { '@type': 'GeoCoordinates', latitude: Number(from.lat), longitude: Number(from.lng) } : undefined },
      { '@type': 'Place', name: toName,   geo: to?.lat   ? { '@type': 'GeoCoordinates', latitude: Number(to.lat),   longitude: Number(to.lng)   } : undefined },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Drive distance &amp; time</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,38px)', fontWeight: 800, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>{fromName} → {toName}</h1>
          <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: 18, fontWeight: 700 }}>~{km.toFixed(0)} km · {hh} h {mm} m driving</div>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 12px', color: C.text }}>Quick numbers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
            <Stat label="Road distance" value={`${km.toFixed(0)} km`}/>
            <Stat label="Drive time (no stops)" value={`${hh} h ${mm} m`}/>
            <Stat label="Average speed" value={`${Math.round(km / (data.pair.duration_min / 60))} km/h`}/>
            <Stat label="Fuel (caravan tow)" value={`~${fuelLitres.toFixed(0)} L · $${fuelCost.toFixed(0)}`}/>
          </div>
          <p style={{ fontSize: 12, color: C.sub, margin: '12px 0 0', lineHeight: 1.5 }}>
            Drive time and distance from <a href="https://project-osrm.org/" target="_blank" rel="noopener" style={{ color: C.teal }}>OSRM</a> using OpenStreetMap road data. Fuel estimate assumes 9 L/100 km (a typical 4WD with caravan) at $1.95/L regional unleaded — your actual cost will vary with vehicle, load, and driving style.
          </p>
        </section>

        {longDrive && (
          <section style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 14, padding: '20px 24px', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 8px', color: '#065f46' }}>Plan an overnight stop</h2>
            <p style={{ fontSize: 14, color: '#047857', margin: 0, lineHeight: 1.6 }}>
              At {hh} h {mm} m, this is a long single day — most travellers split it across two days. Pick a destination roughly halfway from the list below, or scan the caravan parks within 30&nbsp;km of either end.
            </p>
          </section>
        )}

        {otherDests.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: C.text }}>Stops along the way</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {otherDests.map(d => (
                <Link key={d.slug} href={`/${d.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
                    <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
                      {d.hero_image && <img src={d.hero_image} alt={d.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{d.name}</div>
                      {d.region && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{d.region}</div>}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}

        {parks.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: C.text }}>Caravan parks along the route</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {parks.map((p: any) => (
                <Link key={p.slug} href={`/parks/${p.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
                    <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
                      {p.cover_image && <img src={p.cover_image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{p.name}</div>
                      {(p.suburb || p.region) && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{p.suburb || p.region}</div>}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tours.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: C.text }}>Tours either end</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {tours.map((t: any) => (
                <Link key={t.slug} href={`/tours/${t.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
                    <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
                      {t.cover_image && <img src={t.cover_image} alt={t.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                        {t.rating && <>★ {Number(t.rating).toFixed(1)}</>}
                        {t.price_from && <> · from {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</>}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px', color: C.text }}>More distance pages</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: C.text }}>
            <li><Link href={reverseUrl} style={{ color: C.teal }}>{toName} → {fromName} (reverse direction)</Link></li>
            {from && <li><Link href={`/${from.slug}/`} style={{ color: C.teal }}>About {from.name}</Link></li>}
            {to && <li><Link href={`/${to.slug}/`} style={{ color: C.teal }}>About {to.name}</Link></li>}
            <li><Link href="/distances/" style={{ color: C.teal }}>All distance pages on {tenant.name}</Link></li>
          </ul>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{value}</div>
    </div>
  )
}
