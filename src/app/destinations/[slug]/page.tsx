import { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue, tourStatesFor, parkStatesFor } from '@/lib/get-tenant'
import { StateCode, TENANTS } from '@/lib/tenants'
import { SaveButton } from '@/components/features/SaveButton'
import { DestinationWeather } from '@/components/features/DestinationWeather'
import { DestinationSubMenu, DestinationHubGrid } from '@/components/features/DestinationSubMenu'
import { DestinationMiniMenu } from '@/components/features/DestinationMiniMenu'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { poiUrl } from '@/lib/poi'
import { getDestinationSubMenu } from '@/lib/destination-submenu'

export const revalidate = 600

type Destination = {
  id: string
  slug: string
  state_code: string
  name: string
  region: string | null
  intro: string | null
  body: string | null
  lat: string | null
  lng: string | null
  radius_km: string | null
  hero_image: string | null
  gallery: string[] | null
  tags: string[] | null
  seo_title: string | null
  seo_description: string | null
}

async function getDestination(slug: string, state: StateCode | null): Promise<Destination | null> {
  try {
    const [row] = await db<Destination[]>`
      SELECT * FROM destinations
      WHERE slug = ${slug} AND active = true
        AND (${state}::text IS NULL OR state_code = ${state}::text)
      LIMIT 1`
    return row || null
  } catch { return null }
}

type Tour = { slug: string; title: string; city: string | null; cover_image: string | null; rating: string | null; review_count: number | null; price_from: string | null; currency: string | null; category: string | null; summary_ai: string | null }
type Park = { slug: string; name: string; region: string | null; suburb: string | null; cover_image: string | null; avg_rating: string | null; review_count: number | null; price_from: string | null; currency: string | null; pets_allowed: boolean | null; site_types: Record<string, boolean> | null }
type Place = { slug: string; name: string; category: string | null; cover_image: string | null; description: string | null }
type Article = { slug: string; legacy_path: string | null; title: string; excerpt: string | null; cover_image: string | null; published_at: string | null }

async function aggregate(d: Destination) {
  const state = d.state_code
  // tours is shared single-tenant; a tenant may surface more than one state's
  // tours (perth reads its own + 'wa'). Parks/places/articles stay state-only.
  const tcfg = TENANTS[state as StateCode]
  const tourStates = tcfg ? tourStatesFor(tcfg) : [state as StateCode]
  const parkStates = tcfg ? parkStatesFor(tcfg) : [state as StateCode]
  const lat = d.lat, lng = d.lng
  const radius = d.radius_km ? Number(d.radius_km) : 25
  // Rough degrees-per-km at mid-AU latitude (~0.009 deg/km)
  const degRadius = radius * 0.012
  const city = d.name
  const tags = d.tags || []

  // Tours' city column is often NULL (Viator importer doesn't populate it),
  // so we match by title/summary containing the destination name too.
  const cityPat = `%${city}%`
  const [tours, parks, places, articles, stateTopTours, popularDests] = await Promise.all([
    db<Tour[]>`
      SELECT slug, title, city, cover_image, rating, review_count, price_from, currency, category, summary_ai, duration_label
      FROM tours
      WHERE active = true
        AND state_code = ANY(${tourStates})
        AND (
          city ILIKE ${city}
          OR city ILIKE ${cityPat}
          OR title ILIKE ${cityPat}
          OR summary_ai ILIKE ${cityPat}
        )
      ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST
      LIMIT 8`,
    lat && lng
      ? db<Park[]>`
        SELECT slug, name, region, suburb, cover_image, avg_rating, review_count, price_from, currency, pets_allowed, site_types
        FROM parks
        WHERE active = true AND state_code = ANY(${parkStates})
          AND lat BETWEEN (${lat}::numeric - ${degRadius}::numeric) AND (${lat}::numeric + ${degRadius}::numeric)
          AND lng BETWEEN (${lng}::numeric - ${degRadius}::numeric) AND (${lng}::numeric + ${degRadius}::numeric)
        ORDER BY featured DESC, avg_rating DESC NULLS LAST, review_count DESC NULLS LAST
        LIMIT 8`
      : db<Park[]>`
        SELECT slug, name, region, suburb, cover_image, avg_rating, review_count, price_from, currency, pets_allowed, site_types
        FROM parks
        WHERE active = true AND state_code = ANY(${parkStates})
          AND (region ILIKE ${'%' + city + '%'} OR suburb ILIKE ${'%' + city + '%'})
        ORDER BY featured DESC, avg_rating DESC NULLS LAST
        LIMIT 8`,
    db<Place[]>`
      SELECT slug, name, category, cover_image, description
      FROM places
      WHERE state_code = ${state}
        AND (city ILIKE ${city} OR city ILIKE ${'%' + city + '%'})
      ORDER BY COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id), 0) DESC NULLS LAST
      LIMIT 12`,
    db<Article[]>`
      SELECT slug, legacy_path, title, excerpt, cover_image, published_at
      FROM articles
      WHERE state_code = ${state} AND status = 'published'
        AND (
          destination_slug = ${d.slug}
          OR title ILIKE ${'%' + city + '%'}
          OR excerpt ILIKE ${'%' + city + '%'}
        )
      ORDER BY destination_slug = ${d.slug} DESC, published_at DESC NULLS LAST
      LIMIT 8`,
    // Sidebar: top tours across the whole state (not just this destination) — surfaces something the body grid usually doesn't
    db<Tour[]>`
      SELECT slug, title, city, cover_image, rating, review_count, price_from, currency, category, summary_ai, duration_label
      FROM tours
      WHERE active = true AND state_code = ANY(${tourStates})
      ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST
      LIMIT 6`.catch(() => [] as Tour[]),
    // Sidebar: popular other destinations in the same state (or anywhere if state-thin)
    db<{ slug: string; name: string; region: string | null; hero_image: string | null }[]>`
      SELECT slug, name, region, hero_image
      FROM destinations
      WHERE active = true
        AND slug <> ${d.slug}
        AND (state_code = ${state} OR ${state}::text IS NULL)
      ORDER BY is_featured DESC, display_order ASC
      LIMIT 6`.catch(() => [] as any[]),
  ])

  // Partition places into rough buckets
  const attractions = places.filter(p => ['attraction', 'attractions', 'tourist_attraction', 'sight'].includes((p.category || '').toLowerCase()))
  const landmarks  = places.filter(p => ['landmark', 'landmarks', 'monument'].includes((p.category || '').toLowerCase()))
  const nature     = places.filter(p => ['nature', 'park', 'beach', 'forest'].includes((p.category || '').toLowerCase()))
  const food       = places.filter(p => ['food', 'restaurant', 'cafe', 'food_drink'].includes((p.category || '').toLowerCase()))
  const other      = places.filter(p => !attractions.includes(p) && !landmarks.includes(p) && !nature.includes(p) && !food.includes(p))

  // Nearby destinations within ~250km (great-circle box approximation)
  const nearbyDests = lat && lng
    ? await db<{ slug: string; name: string; region: string | null; hero_image: string | null; intro: string | null; lat: string | null; lng: string | null }[]>`
        SELECT slug, name, region, hero_image, intro, lat, lng
        FROM destinations
        WHERE active = true AND state_code = ${state}
          AND slug <> ${d.slug}
          AND lat IS NOT NULL AND lng IS NOT NULL
          AND lat BETWEEN (${lat}::numeric - 2.3) AND (${lat}::numeric + 2.3)
          AND lng BETWEEN (${lng}::numeric - 2.3) AND (${lng}::numeric + 2.3)
        ORDER BY (
          (lat - ${lat}::numeric) * (lat - ${lat}::numeric) +
          (lng - ${lng}::numeric) * (lng - ${lng}::numeric)
        ) ASC
        LIMIT 6`
    : []

  // Photo gallery — collect cover_images from all related content for visual interest.
  // Order: own gallery, hero (already shown), parks, articles, places. Dedupe.
  const photoSet = new Set<string>()
  const photos: { url: string; source: 'park' | 'article' | 'place' | 'gallery'; label: string; href?: string }[] = []
  for (const url of (d.gallery || [])) {
    if (url && !photoSet.has(url)) { photoSet.add(url); photos.push({ url, source: 'gallery', label: d.name }) }
  }
  for (const p of parks) {
    if (p.cover_image && !photoSet.has(p.cover_image)) {
      photoSet.add(p.cover_image); photos.push({ url: p.cover_image, source: 'park', label: p.name, href: `/parks/${p.slug}` })
    }
  }
  for (const a of articles) {
    if (a.cover_image && !photoSet.has(a.cover_image)) {
      photoSet.add(a.cover_image); photos.push({ url: a.cover_image, source: 'article', label: a.title, href: a.legacy_path || `/articles/${a.slug}` })
    }
  }
  for (const p of places) {
    if (p.cover_image && !photoSet.has(p.cover_image)) {
      photoSet.add(p.cover_image); photos.push({ url: p.cover_image, source: 'place', label: p.name, href: `/places/${p.slug}` })
    }
  }

  return { tours, parks, attractions, landmarks, nature, food, other, articles, nearbyDests, stateTopTours, popularDests, photos }
}

// 2026-06-24 URL flatten: destination canonical is now `/<slug>/`, served by the
// [username] catch-all route. `/destinations/<slug>/` 301-redirects there. The
// metadata + page logic below stays exported so the catch-all can call it.
export async function generateDestinationMetadata(slug: string): Promise<Metadata> {
  const tenant = await getTenant()
  const d = await getDestination(slug, stateFilterValue(tenant))
  if (!d) return { title: 'Destination not found' }
  const rawTitle = d.seo_title || `${d.name} — things to do, tours & caravan parks`
  const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
  const rawDesc = d.seo_description || d.intro || `Everything to see and do in ${d.name}, ${tenant.stateName}: tours, attractions, activities, caravan parks and landmarks.`
  const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
  const url = `https://${tenant.host}/${d.slug}/`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: d.hero_image ? [d.hero_image] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: d.hero_image ? [d.hero_image] : [] },
  }
}

// /destinations/<slug>/ → 301 → /<slug>/ — single source of truth at the short URL.
export async function generateMetadata(_: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return { robots: { index: false, follow: true } }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

const STATE_TZ = {
  qld: 'Australia/Brisbane', nsw: 'Australia/Sydney', vic: 'Australia/Melbourne',
  wa: 'Australia/Perth', sa: 'Australia/Adelaide', tas: 'Australia/Hobart',
  nt: 'Australia/Darwin', aunz: 'Australia/Sydney',
} as const

type ClimateMonth = {
  month: number
  temp_max_mean: string | null
  temp_min_mean: string | null
  rain_mm: string | null
  rain_days: string | null
  sunny_days: string | null
  sample_years: number | null
}

async function getClimate(destinationId: string): Promise<ClimateMonth[]> {
  try {
    return await db<ClimateMonth[]>`SELECT month, temp_max_mean, temp_min_mean, rain_mm, rain_days, sunny_days, sample_years FROM destination_climate WHERE destination_id = ${destinationId} ORDER BY month`
  } catch { return [] }
}

type Marine = { is_coastal: boolean; sea_temp_summer: string | null; sea_temp_winter: string | null; avg_wave_height_m: string | null }
async function getMarine(destinationId: string): Promise<Marine | null> {
  try {
    const [row] = await db<Marine[]>`SELECT is_coastal, sea_temp_summer::text, sea_temp_winter::text, avg_wave_height_m::text FROM destination_marine WHERE destination_id = ${destinationId} AND is_coastal = true LIMIT 1`
    return row || null
  } catch { return null }
}

type DestNearby = { category: string; name: string | null; distance_km: string | null; osm_id: string | null }
async function getDestNearby(destinationId: string): Promise<DestNearby[]> {
  try {
    return await db<DestNearby[]>`SELECT category, name, distance_km::text, osm_id::text FROM destination_nearby WHERE destination_id = ${destinationId} ORDER BY distance_km ASC LIMIT 200`
  } catch { return [] }
}

type DriveTime = { from_slug: string; to_slug: string; from_name: string; to_name: string; distance_km: string; duration_min: number }
async function getDriveTimes(state: string, slug: string): Promise<DriveTime[]> {
  try {
    return await db<DriveTime[]>`
      SELECT from_slug, to_slug, from_name, to_name, distance_km::text, duration_min
      FROM distance_pairs
      WHERE state_code = ${state}
        AND (${slug} IN (from_slug, to_slug))
      ORDER BY duration_min ASC
      LIMIT 8`
  } catch { return [] }
}

// Default export now redirects /destinations/<slug>/ → /<slug>/.
// The actual rendering lives in `DestinationPageContent` below, which the
// [username] catch-all route imports + calls when a single-segment URL
// resolves to a destination slug.
export default async function RedirectDestination({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  permanentRedirect(`/${slug}/`)
}

export async function DestinationPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenant()
  const d = await getDestination(slug, stateFilterValue(tenant))
  if (!d) notFound()
  const data = await aggregate(d)
  const [climate, marine, driveTimes, destNearby, subMenuGroups] = await Promise.all([
    getClimate(d.id),
    getMarine(d.id),
    getDriveTimes(d.state_code, d.slug),
    getDestNearby(d.id),
    getDestinationSubMenu(d.slug, stateFilterValue(tenant)),
  ])
  const canonical = `https://${tenant.host}/${d.slug}/`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: d.name,
    description: d.intro || undefined,
    url: canonical,
    image: d.hero_image || undefined,
    containedInPlace: { '@type': 'AdministrativeArea', name: tenant.stateName, address: { '@type': 'PostalAddress', addressCountry: 'AU' } },
    geo: d.lat && d.lng ? { '@type': 'GeoCoordinates', latitude: Number(d.lat), longitude: Number(d.lng) } : undefined,
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',         item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Destinations', item: `https://${tenant.host}/destinations/` },
      { '@type': 'ListItem', position: 3, name: d.name,         item: canonical },
    ],
  }

  // Google Maps URL for the "View on Google Maps →" CTA
  const mapsUrl = d.lat && d.lng
    ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.name, tenant.stateName, 'Australia'].filter(Boolean).join(', '))}`

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}/>
      <style>{`
        /* 2-column desktop: main · right rail (sticky). Right rail collapses on narrow viewports. */
        @media (max-width: 1100px) {
          .bb-dest-grid { grid-template-columns: 1fr !important; }
          .bb-dest-right { display: none !important; }
        }
      `}</style>

      {d.hero_image && (
        <div style={{ width: '100%', height: 'clamp(90px,13vw,155px)', background: '#0b1420', overflow: 'hidden' as const, position: 'relative' as const }}>
          <img src={d.hero_image} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.88 }}/>
          <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.7) 100%)' }}/>
          <div style={{ position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: '12px 20px' }}>
            <div style={{ maxWidth: 1240, margin: '0 auto' }}>
              <div style={{ marginBottom: 4 }}>
                <Breadcrumbs crumbs={[
                  { href: '/', label: 'Home' },
                  { href: '/destinations/', label: 'Destinations' },
                  ...(d.region ? [{ label: d.region }] : []),
                  { label: d.name },
                ]}/>
              </div>
              <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(20px,3.4vw,30px)', margin: 0, lineHeight: 1.15, textShadow: '0 2px 14px rgba(0,0,0,0.4)' }}>
                {d.name}
              </h1>
            </div>
          </div>
        </div>
      )}
      {d.hero_image && d.intro && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 20px' }}>
            <p style={{ color: '#374151', fontSize: 16, margin: 0, lineHeight: 1.5, maxWidth: 820 }}>{d.intro}</p>
          </div>
        </div>
      )}

      {/* Compact destination sub-nav — category chips with click-to-expand
          dropdowns. Replaces the old grouped mega-nav (DestinationSubMenu)
          which was fine for small destinations but dominated the page on
          ones with 60-70+ subpages. Same place + always shows per Craig. */}
      <DestinationMiniMenu destinationName={d.name} groups={subMenuGroups} currentPath={`/${d.slug}/`} />

      <div className="bb-dest-grid" style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 16px 60px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' as const }}>
        <div>
          {/* Hero stats bar — counts + Google Maps link, like bugbitten's place page */}
          <div style={{ display: 'flex', gap: 22, fontSize: 14, color: C.sub, marginBottom: 18, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {data.tours.length > 0   && <div><b style={{ color: C.text }}>{data.tours.length}</b> tour{data.tours.length === 1 ? '' : 's'}</div>}
            {data.parks.length > 0   && <div><b style={{ color: C.text }}>{data.parks.length}</b> caravan park{data.parks.length === 1 ? '' : 's'}</div>}
            {data.articles.length > 0 && <div><b style={{ color: C.text }}>{data.articles.length}</b> article{data.articles.length === 1 ? '' : 's'}</div>}
            {data.photos.length > 0  && <div>📷 <b style={{ color: C.text }}>{data.photos.length}</b> photo{data.photos.length === 1 ? '' : 's'}</div>}
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>View on Google Maps →</a>
            <div style={{ marginLeft: 'auto' as const }}>
              <SaveButton type="destination" slug={d.slug} name={d.name} href={`/${d.slug}/`} image={d.hero_image} state_code={d.state_code} region={d.region}/>
            </div>
          </div>

          {/* Top 3 related tours — lead-conversion rail above the body (page-setup rule) */}
          {data.tours.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' as const }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, margin: 0, color: C.text }}>Tours in {d.name}</h2>
                <Link href={`/tours?loc=${encodeURIComponent(d.name)}`} style={{ color: C.teal, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>See all {data.tours.length} tours →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {data.tours.slice(0, 3).map(t => (
                  <Link key={t.slug} href={`/tours/${t.slug}`} style={{ textDecoration: 'none' }}>
                    <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' as const }}>
                      {t.cover_image && <img src={t.cover_image} alt={t.title} loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover' as const, display: 'block' }}/>}
                      <div style={{ padding: '10px 12px' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 4px', lineHeight: 1.3, display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{t.title}</h3>
                        <div style={{ fontSize: 12, color: C.sub }}>{t.city ? `${t.city} · ` : ''}{t.duration_label || ''}</div>
                        {t.price_from && <div style={{ fontSize: 13, color: C.teal, fontWeight: 700, marginTop: 4 }}>From {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</div>}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Jump nav */}
          <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 24, fontSize: 13 }}>
            {data.tours.length > 0      && <a href="#tours" style={anchor}>Tours ({data.tours.length})</a>}
            {data.attractions.length > 0 && <a href="#attractions" style={anchor}>Attractions ({data.attractions.length})</a>}
            {data.parks.length > 0      && <a href="#parks" style={anchor}>Caravan parks ({data.parks.length})</a>}
            {data.nature.length > 0     && <a href="#nature" style={anchor}>Nature ({data.nature.length})</a>}
            {data.landmarks.length > 0  && <a href="#landmarks" style={anchor}>Landmarks ({data.landmarks.length})</a>}
            {data.food.length > 0       && <a href="#food" style={anchor}>Food &amp; drink ({data.food.length})</a>}
            {data.photos.length > 0     && <a href="#photos" style={anchor}>Photos ({data.photos.length})</a>}
            {data.articles.length > 0   && <a href="#articles" style={anchor}>Articles ({data.articles.length})</a>}
          </nav>

          {d.body && (
            <>
              <style>{`
                .bb-dest-body { font-size: 16px; line-height: 1.75; color: #1f2937; }
                .bb-dest-body p { margin: 0 0 16px; }
                .bb-dest-body p:last-child { margin-bottom: 0; }
                .bb-dest-body h2 { font-family: Georgia, serif; font-size: 24px; font-weight: 800; color: #111827; margin: 32px 0 12px; line-height: 1.3; }
                .bb-dest-body h2:first-child { margin-top: 0; }
                .bb-dest-body h3 { font-family: Georgia, serif; font-size: 19px; font-weight: 800; color: #111827; margin: 24px 0 10px; line-height: 1.35; }
                .bb-dest-body ul, .bb-dest-body ol { margin: 0 0 18px; padding-left: 22px; }
                .bb-dest-body li { margin-bottom: 6px; line-height: 1.65; }
                .bb-dest-body a { color: var(--brand); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; transition: color 0.15s; }
                .bb-dest-body a:hover { color: var(--brand-dark); text-decoration-thickness: 2px; }
                .bb-dest-body strong { color: #111827; font-weight: 700; }
                .bb-dest-body blockquote { margin: 18px 0; padding: 10px 18px; border-left: 3px solid var(--brand); background: var(--brand-light); color: #134e4a; font-style: italic; border-radius: 0 6px 6px 0; }
                .bb-dest-body em { color: #374151; }
              `}</style>
              <section className="bb-dest-body" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '26px 32px 22px', marginBottom: 24 }} dangerouslySetInnerHTML={{ __html: d.body }}/>
            </>
          )}

          {d.lat && d.lng && <DestinationWeather name={d.name} lat={Number(d.lat)} lng={Number(d.lng)} timezone={STATE_TZ[d.state_code as keyof typeof STATE_TZ] || 'Australia/Sydney'}/>}
          {climate.length === 12 && <ClimatePanel name={d.name} months={climate}/>}
          {marine?.is_coastal && <MarinePanel name={d.name} marine={marine}/>}
          {destNearby.length >= 5 && <DestNearbyPanel name={d.name} nearby={destNearby}/>}
          {driveTimes.length > 0 && <DriveTimesPanel state={d.state_code} slug={d.slug} name={d.name} pairs={driveTimes}/>}

          {/* Photos gallery — pulled from related parks/articles/places cover_images */}
          {data.photos.length > 0 && (
            <section id="photos" style={{ scrollMarginTop: 80, marginBottom: 32 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: C.text }}>Photos from around {d.name}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {data.photos.slice(0, 24).map((p, i) => {
                  const inner = (
                    <>
                      <img src={p.url} alt={p.label} loading="lazy" style={{ position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                      <div style={{ position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: '14px 10px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))' }}>
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.6)', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.label}</div>
                      </div>
                      <span style={{ position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, textTransform: 'capitalize' as const }}>{p.source}</span>
                    </>
                  )
                  const cellStyle: React.CSSProperties = { position: 'relative', display: 'block', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#e5e7eb', textDecoration: 'none' }
                  return p.href
                    ? <Link key={i} href={p.href} style={cellStyle}>{inner}</Link>
                    : <div key={i} style={cellStyle}>{inner}</div>
                })}
              </div>
            </section>
          )}

          <FaqPanel d={d} climate={climate} marine={marine} tenantStateName={tenant.stateName} content={data} driveTimes={driveTimes} nearby={destNearby}/>

          {/* Pillar hub — links to every sub-topic article for this destination */}
          <DestinationHubGrid destinationName={d.name} groups={subMenuGroups}/>

          <Section id="tours" title={`All tours in ${d.name}`} empty="No tours matched to this destination yet.">
            {data.tours.length > 0 && (
              <div style={grid}>
                {data.tours.map(t => (
                  <Link key={t.slug} href={`/tours/${t.slug}`} style={cardLink}>
                    <Card img={t.cover_image} title={t.title} subtitle={t.city || ''}
                      meta={[t.rating ? `★ ${Number(t.rating).toFixed(1)}` : '', t.price_from ? `from ${t.currency || 'AUD'} $${Number(t.price_from).toFixed(0)}` : ''].filter(Boolean).join(' · ')}/>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section id="attractions" title="Attractions" empty="">
            {data.attractions.length > 0 && (
              <div style={grid}>{data.attractions.map(p => <Link key={p.slug} href={`/places/${p.slug}`} style={cardLink}><Card img={p.cover_image} title={p.name} subtitle={p.category || ''}/></Link>)}</div>
            )}
          </Section>

          <Section id="parks" title="Caravan parks nearby" empty="">
            {data.parks.length > 0 && (
              <div style={grid}>{data.parks.map(p => {
                const rating = p.avg_rating ? Number(p.avg_rating) : null
                return (
                  <Link key={p.slug} href={`/parks/${p.slug}`} style={cardLink}>
                    <Card img={p.cover_image} title={p.name} subtitle={[p.suburb, p.region].filter(Boolean).join(' · ')}
                      meta={[rating != null ? `★ ${rating.toFixed(1)}` : '', p.price_from ? `from ${p.currency || 'AUD'} $${Number(p.price_from).toFixed(0)}` : '', p.pets_allowed ? '🐾' : ''].filter(Boolean).join(' · ')}/>
                  </Link>
                )
              })}</div>
            )}
          </Section>

          <Section id="nature" title="Parks, beaches &amp; nature" empty="">
            {data.nature.length > 0 && <div style={grid}>{data.nature.map(p => <Link key={p.slug} href={`/places/${p.slug}`} style={cardLink}><Card img={p.cover_image} title={p.name} subtitle={p.category || ''}/></Link>)}</div>}
          </Section>

          <Section id="landmarks" title="Landmarks" empty="">
            {data.landmarks.length > 0 && <div style={grid}>{data.landmarks.map(p => <Link key={p.slug} href={`/places/${p.slug}`} style={cardLink}><Card img={p.cover_image} title={p.name} subtitle={p.category || ''}/></Link>)}</div>}
          </Section>

          <Section id="food" title="Food &amp; drink" empty="">
            {data.food.length > 0 && <div style={grid}>{data.food.map(p => <Link key={p.slug} href={`/places/${p.slug}`} style={cardLink}><Card img={p.cover_image} title={p.name} subtitle={p.category || ''}/></Link>)}</div>}
          </Section>

          {data.nearbyDests && data.nearbyDests.length > 0 && (
            <section id="nearby-dests" style={{ scrollMarginTop: 80, marginBottom: 32 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: '#111827' }}>Nearby destinations</h2>
              <div style={grid}>
                {data.nearbyDests.map(n => (
                  <Link key={n.slug} href={`/${n.slug}/`} style={cardLink}>
                    <Card img={n.hero_image} title={n.name} subtitle={n.region || ''}/>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Section id="articles" title={`${d.name} travel articles`} empty="">
            {data.articles.length > 0 && (
              <div style={grid}>
                {data.articles.map(a => {
                  const href = a.legacy_path || `/articles/${a.slug}`
                  return (
                    <Link key={a.slug} href={href} style={cardLink}>
                      <Card img={a.cover_image} title={a.title} subtitle={a.excerpt || ''}/>
                    </Link>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right rail — sticky sidebar mirroring the bugbitten place template */}
        <aside className="bb-dest-right" style={{ display: 'flex', flexDirection: 'column' as const, gap: 14, position: 'sticky' as const, top: 16, alignSelf: 'start' as const }}>
          {data.parks.length > 0 && (
            <RightRailCard title={`Top caravan parks ${d.region ? 'in ' + d.region : 'here'}`} more={{ href: `/parks?state=${d.state_code}`, label: 'See all parks →' }}>
              {data.parks.slice(0, 4).map(p => (
                <MiniRow key={p.slug} href={`/parks/${p.slug}`} img={p.cover_image} title={p.name}
                  subtitle={p.avg_rating ? `★ ${Number(p.avg_rating).toFixed(1)} · ${p.suburb || p.region || ''}` : (p.suburb || p.region || '')}/>
              ))}
            </RightRailCard>
          )}

          {data.stateTopTours.length > 0 && (
            <RightRailCard title={`Top tours in ${tenant.stateName}`} more={{ href: `/tours?state=${d.state_code}`, label: 'See all tours →' }}>
              {data.stateTopTours.slice(0, 5).map((t: Tour) => (
                <MiniRow key={t.slug} href={`/tours/${t.slug}`} img={t.cover_image} title={t.title}
                  subtitle={t.price_from ? `From ${t.currency || 'AUD'} $${Number(t.price_from).toFixed(0)}` : (t.duration_label || '')}/>
              ))}
            </RightRailCard>
          )}

          {data.popularDests.length > 0 && (
            <RightRailCard title={`More ${tenant.stateName} destinations`} more={{ href: '/destinations', label: 'See all destinations →' }}>
              {data.popularDests.slice(0, 5).map((p: any) => (
                <MiniRow key={p.slug} href={`/${p.slug}/`} img={p.hero_image} title={p.name} subtitle={p.region || ''}/>
              ))}
            </RightRailCard>
          )}
        </aside>
      </div>
    </main>
  )
}

function RightRailCard({ title, more, children }: { title: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px', paddingBottom: 8, borderBottom: '2px solid var(--brand)' }}>{title}</div>
      {children}
      {more && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
          <Link href={more.href} style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>{more.label}</Link>
        </div>
      )}
    </div>
  )
}

function MiniRow({ href, img, title, subtitle }: { href: string; img: string | null; title: string; subtitle: string }) {
  return (
    <Link href={href} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #e5e7eb', textDecoration: 'none', alignItems: 'center' }}>
      {img
        ? <img src={img} alt="" loading="lazy" style={{ width: 56, height: 42, objectFit: 'cover' as const, borderRadius: 6, flexShrink: 0 }}/>
        : <div style={{ width: 56, height: 42, background: 'var(--brand-light)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 22, flexShrink: 0 }}>📍</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', lineHeight: 1.3, display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{subtitle}</div>}
      </div>
    </Link>
  )
}

function Section({ id, title, empty, children }: { id: string; title: string; empty: string; children: React.ReactNode }) {
  const has = !!(children && (Array.isArray(children) ? children.length : true))
  if (!has && !empty) return null
  return (
    <section id={id} style={{ scrollMarginTop: 80, marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: '#111827' }}>{title}</h2>
      {children || <div style={{ color: '#6b7280', fontSize: 14 }}>{empty}</div>}
    </section>
  )
}

function Card({ img, title, subtitle, meta }: { img: string | null; title: string; subtitle: string; meta?: string }) {
  return (
    <article style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
        {img ? <img src={img} alt={title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
             : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📍</div>}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{subtitle}</div>}
        {meta && <div style={{ fontSize: 11, color: '#374151', marginTop: 6, fontWeight: 600 }}>{meta}</div>}
      </div>
    </article>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }
const cardLink: React.CSSProperties = { textDecoration: 'none', color: 'inherit' }
const anchor: React.CSSProperties = { padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1px solid #e5e7eb', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, fontSize: 13 }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function ClimatePanel({ name, months }: { name: string; months: ClimateMonth[] }) {
  // Score each month: warm-not-hot bonus, low-rain bonus, sunny bonus
  const scored = months.map(m => {
    const tmax = Number(m.temp_max_mean ?? 0)
    const rain = Number(m.rain_mm ?? 0)
    const sun = Number(m.sunny_days ?? 0)
    // Sweet spot 18–27°C, penalise rain >100mm, reward sunny days
    const tempScore = -Math.abs(tmax - 22) * 1.2
    const rainScore = -rain * 0.05
    const sunScore = sun * 0.6
    return { ...m, score: tempScore + rainScore + sunScore }
  })
  const sorted = [...scored].sort((a, b) => b.score - a.score)
  const best = sorted.slice(0, 3).map(m => m.month).sort((a, b) => a - b)
  const worst = sorted.slice(-2).map(m => m.month).sort((a, b) => a - b)
  const maxRain = Math.max(...months.map(m => Number(m.rain_mm ?? 0)))
  const fmtRange = (mm: number[]) => mm.map(m => MONTH_NAMES[m - 1]).join(', ')
  const sample = months[0]?.sample_years || 30
  return (
    <section id="climate" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 6px', color: '#111827' }}>Best time to visit {name}</h2>
      <p style={{ fontSize: 14, color: '#374151', margin: '0 0 16px', lineHeight: 1.6 }}>
        Based on {sample} years of weather data. <b>Sweet spot: {fmtRange(best)}</b> — mild temperatures, low rainfall and plenty of sun. Avoid <b>{fmtRange(worst)}</b> if you can — typically the wettest or hottest stretch of the year.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 4, fontSize: 11, color: '#374151' }}>
        {months.map(m => {
          const tmax = Number(m.temp_max_mean ?? 0)
          const tmin = Number(m.temp_min_mean ?? 0)
          const rain = Number(m.rain_mm ?? 0)
          const isBest = best.includes(m.month)
          const isWorst = worst.includes(m.month)
          const rainPct = maxRain > 0 ? Math.min(1, rain / maxRain) : 0
          const bg = isBest ? '#ecfdf5' : isWorst ? '#fef2f2' : '#f9fafb'
          const border = isBest ? '#a7f3d0' : isWorst ? '#fecaca' : '#e5e7eb'
          return (
            <div key={m.month} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 4px', textAlign: 'center' as const, lineHeight: 1.3 }}>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: 12 }}>{MONTH_NAMES[m.month - 1]}</div>
              <div style={{ fontSize: 14, color: 'var(--brand)', fontWeight: 700, marginTop: 4 }}>{Math.round(tmax)}°</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{Math.round(tmin)}° low</div>
              <div style={{ marginTop: 6, height: 4, background: '#e0f2fe', borderRadius: 2, position: 'relative' as const, overflow: 'hidden' as const }}>
                <div style={{ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${rainPct * 100}%`, background: '#0284c7' }}/>
              </div>
              <div style={{ fontSize: 10, color: '#0284c7', marginTop: 2 }}>{Math.round(rain)}mm</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 12, lineHeight: 1.5 }}>
        Daytime high (large) · overnight low (small) · monthly rainfall (blue bar). Climate normals: 1991–2020 from Open-Meteo's ERA5 reanalysis.
      </div>
    </section>
  )
}

function MarinePanel({ name, marine }: { name: string; marine: { sea_temp_summer: string | null; sea_temp_winter: string | null; avg_wave_height_m: string | null } }) {
  const summer = marine.sea_temp_summer ? Number(marine.sea_temp_summer) : null
  const winter = marine.sea_temp_winter ? Number(marine.sea_temp_winter) : null
  const wave = marine.avg_wave_height_m ? Number(marine.avg_wave_height_m) : null
  const swimmableSummer = summer !== null && summer >= 22
  const swimmableWinter = winter !== null && winter >= 20
  return (
    <section id="marine" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 6px', color: '#111827' }}>Beach &amp; ocean conditions at {name}</h2>
      <p style={{ fontSize: 14, color: '#374151', margin: '0 0 14px', lineHeight: 1.6 }}>
        {summer !== null && winter !== null && (
          <>Average sea temperature ranges from <b>{winter}°C in winter</b> to <b>{summer}°C in summer</b>. </>
        )}
        {wave !== null && <>Typical wave height around <b>{wave.toFixed(1)} m</b> over the next two weeks. </>}
        {swimmableSummer && 'Comfortable for swimming through summer; '}
        {swimmableWinter ? 'still warm enough for a dip in winter for the brave.' : 'a wetsuit makes winter swims much more pleasant.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10, fontSize: 13 }}>
        {summer !== null && <Stat label="Sea temp · summer" value={`${summer}°C`}/>}
        {winter !== null && <Stat label="Sea temp · winter" value={`${winter}°C`}/>}
        {wave !== null && <Stat label="Avg wave height" value={`${wave.toFixed(1)} m`}/>}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 12, lineHeight: 1.5 }}>
        Sea-surface temperatures from Open-Meteo's ERA5 reanalysis. Wave forecast from the GFS Wave model — check official sources before swimming, paddling or boating.
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>{value}</div>
    </div>
  )
}

function DriveTimesPanel({ state, slug, name, pairs }: { state: string; slug: string; name: string; pairs: DriveTime[] }) {
  return (
    <section id="drive-times" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 6px', color: '#111827' }}>Drive times to and from {name}</h2>
      <p style={{ fontSize: 14, color: '#374151', margin: '0 0 14px', lineHeight: 1.6 }}>Real road distance and driving time to other destinations in the state. Click through for fuel estimates, suggested overnight stops, and tours along the way.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {pairs.map((p) => {
          const otherSlug = p.from_slug === slug ? p.to_slug : p.from_slug
          const otherName = p.from_slug === slug ? p.to_name : p.from_name
          const km = Number(p.distance_km).toFixed(0)
          const hh = Math.floor(p.duration_min / 60)
          const mm = p.duration_min % 60
          return (
            <Link key={otherSlug} href={`/distances/${state}/${slug}-to-${otherSlug}/`} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>To {otherName}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{km} km · {hh}h {mm}m</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function FaqPanel({ d, climate, marine, tenantStateName, content, driveTimes, nearby }: {
  d: { name: string; region: string | null; state_code: string };
  climate: ClimateMonth[];
  marine: { is_coastal: boolean; sea_temp_summer: string | null; sea_temp_winter: string | null } | null;
  tenantStateName: string;
  content: { tours: any[]; parks: any[]; attractions: any[]; landmarks: any[]; nature: any[]; food: any[]; other: any[]; articles: any[] };
  driveTimes: DriveTime[];
  nearby: DestNearby[];
}) {
  const faqs: Array<{ q: string; a: string }> = []
  const name = d.name
  const region = d.region ? `${d.region}, ` : ''
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // 1 — Where is it?
  faqs.push({
    q: `Where is ${name}?`,
    a: `${name} is in ${region}${tenantStateName}, Australia. The destination guide above maps the area; the drive-times panel further down lists distances to other ${tenantStateName} destinations so you can pencil it into a longer itinerary.`,
  })

  // 2 — Best time + 3 — Weather
  if (climate.length === 12) {
    const scored = climate.map((m) => {
      const tmax = Number(m.temp_max_mean ?? 0); const rain = Number(m.rain_mm ?? 0); const sun = Number(m.sunny_days ?? 0)
      return { month: m.month, score: -Math.abs(tmax - 22) * 1.2 - rain * 0.05 + sun * 0.6 }
    }).sort((a, b) => b.score - a.score)
    const best = scored.slice(0, 3).map(s => monthNames[s.month - 1])
    const worstMonth = monthNames[scored[scored.length - 1].month - 1]
    faqs.push({
      q: `When is the best time to visit ${name}?`,
      a: `Based on 30 years of climate data, the most comfortable months at ${name} are typically ${best.join(', ')} — milder temperatures, lower rainfall, and longer sunshine hours. ${worstMonth} tends to be the trickiest month weather-wise. School holiday weeks (Easter, late June–early July, late September, mid-December–late January) get busy and prices rise, so shoulder season is usually the sweet spot if you're flexible.`,
    })
    const summerMax = Math.max(...climate.filter(m => [12, 1, 2].includes(m.month)).map(m => Number(m.temp_max_mean) || 0))
    const winterMin = Math.min(...climate.filter(m => [6, 7, 8].includes(m.month)).map(m => Number(m.temp_min_mean) || 99))
    const annualRain = climate.reduce((sum, m) => sum + (Number(m.rain_mm) || 0), 0)
    if (summerMax > 0 && winterMin < 99) {
      faqs.push({
        q: `What's the weather like in ${name}?`,
        a: `Summer daytime highs average around ${Math.round(summerMax)}°C and winter overnight lows can drop to about ${Math.round(winterMin)}°C. Annual rainfall sits at roughly ${Math.round(annualRain)} mm spread across the year. The climate panel above breaks every month down — daytime high, overnight low, monthly rain, sunny days — so you can match the trip to the weather you want.`,
      })
    }
  }

  // 4 — Beach / swim
  if (marine?.is_coastal && marine.sea_temp_summer && marine.sea_temp_winter) {
    faqs.push({
      q: `Can you swim at ${name}?`,
      a: `Yes — ${name} is on the coast. Sea-surface temperature ranges from about ${Number(marine.sea_temp_winter).toFixed(0)}°C in winter to ${Number(marine.sea_temp_summer).toFixed(0)}°C in summer. Stick to patrolled beaches between the red-and-yellow flags, check the surf-life-saving conditions before entering, and never swim alone. The beach & ocean conditions panel above has the current wave forecast.`,
    })
  }

  // 5 — How to get there
  if (driveTimes.length > 0) {
    const closest = [...driveTimes].sort((a, b) => a.duration_min - b.duration_min)[0]
    const otherName = closest.from_name === name ? closest.to_name : closest.from_name
    const hh = Math.floor(closest.duration_min / 60); const mm = closest.duration_min % 60
    faqs.push({
      q: `How do I get to ${name}?`,
      a: `Most travellers arrive by road. From ${otherName} it's about ${Number(closest.distance_km).toFixed(0)} km — roughly ${hh}h ${mm}m of driving via the main highway, conditions permitting. The drive-times panel above lists travel time and distance to every other ${tenantStateName} destination so you can sketch out a road-trip route. Check road conditions in winter if your route crosses high country, and plan for breaks every ~2 hours.`,
    })
  }

  // 6 — Top attractions
  const namedTopPois = nearby.filter(n => n.name && n.osm_id && n.name.toLowerCase() !== 'unnamed').slice(0, 5)
  if (namedTopPois.length >= 3) {
    faqs.push({
      q: `What are the top things to see in ${name}?`,
      a: `Well-known spots within day-trip range include ${namedTopPois.map(n => n.name).join(', ')}. The "What else is around" panel above lists every named point of interest by category — lookouts, peaks, waterfalls, museums, beaches — pulled straight from OpenStreetMap. Click any name for the location, opening hours and directions.`,
    })
  }

  // 7 — Where to stay / caravan parks
  if (content.parks?.length > 0) {
    faqs.push({
      q: `Where can I stay near ${name}?`,
      a: `We list ${content.parks.length} caravan and holiday park${content.parks.length === 1 ? '' : 's'} in and around ${name} above — powered sites, cabins, glamping, and big-rig-friendly options. Pet rules, dump points and shaded sites are noted on each park's page. For hotel-style stays, the Drive Times panel makes it easy to base yourself in a nearby town and day-trip in.`,
    })
  }

  // 8 — How many days
  const activityCount = (content.tours?.length || 0) + (content.attractions?.length || 0) + namedTopPois.length
  if (activityCount > 0) {
    const days = activityCount > 30 ? '3–5 days' : activityCount > 15 ? '2–3 days' : activityCount > 5 ? '1–2 days' : 'a day'
    faqs.push({
      q: `How many days should I spend at ${name}?`,
      a: `Most travellers spend ${days} at ${name} to cover the highlights without rushing. There are ${content.tours?.length || 0} bookable tours and experiences, ${content.attractions?.length || 0} attractions and ${namedTopPois.length}+ named viewpoints/landmarks listed for the area on this page — plenty to fill a weekend, more if you slow down and explore the outer reaches.`,
    })
  }

  // 9 — Family friendly
  const familyTags = nearby.filter(n => ['family', 'museum', 'attraction'].includes(n.category)).length
  if (familyTags > 0) {
    faqs.push({
      q: `Is ${name} good for families with kids?`,
      a: `Yes — there are ${familyTags} family-friendly attractions, museums and family destinations within easy reach (zoos, aquariums, interactive museums, family-friendly theme parks). The caravan parks section above flags parks with playgrounds, kids' pools and family cabins.`,
    })
  } else {
    faqs.push({
      q: `Is ${name} good for families with kids?`,
      a: `${name} is generally suited to families — outdoor space, accommodation options for all budgets, and a slower pace away from the major cities. The "What else is around" panel above lists everything nearby; if a museum, aquarium or wildlife park is what your kids want, check the closest larger town for those.`,
    })
  }

  // 10 — Day trips
  const dayTripCandidates = driveTimes.filter(p => p.duration_min <= 150)
  if (dayTripCandidates.length >= 2) {
    const dayTripNames = dayTripCandidates.slice(0, 4).map(p => p.from_name === name ? p.to_name : p.from_name)
    faqs.push({
      q: `What day trips can I do from ${name}?`,
      a: `Within ~2.5 hours' drive: ${dayTripNames.join(', ')}. The drive-times panel above lists every nearby destination with road distance and travel time — pick one, drive across in the morning, and you're back for dinner.`,
    })
  }

  // 11 — Public transport
  faqs.push({
    q: `Is there public transport at ${name}?`,
    a: `Coverage varies — major destinations have train and bus links from the closest capital, but smaller regional towns rely on infrequent coach services. The most reliable way to explore the wider area is a hire car or your own vehicle. If you're using public transport, plan around the timetables and check the night before you travel; rural routes are often once or twice a day.`,
  })

  // 12 — Local food
  if ((content.food?.length || 0) > 0) {
    faqs.push({
      q: `What's the food like in ${name}?`,
      a: `${name} has ${content.food.length} restaurants, cafés and food experiences listed — local cellar doors, regional pub meals, and (where the coast is involved) fresh seafood straight off the boat. For a longer dive, see the articles section below; food-focused articles for ${tenantStateName} are linked through our Hunter Valley, Margaret River, and other regional guides depending on your location.`,
    })
  }

  // 13 — Wheelchair accessibility
  const accessibleCount = nearby.filter(n => n.osm_id && n.name).length
  if (accessibleCount > 5) {
    faqs.push({
      q: `Is ${name} accessible for wheelchair users and reduced mobility?`,
      a: `Major town centres, museums and built-up tourist precincts at ${name} are usually accessible; bush walks and lookouts vary widely. The OpenStreetMap data underneath the "What else is around" panel records wheelchair access on individual sites — click through to any place's page for the specific accessibility info. For tours, check the operator's website or call ahead; most reputable operators publish their access details.`,
    })
  }

  // 14 — Cost / budget
  faqs.push({
    q: `How much does a trip to ${name} cost?`,
    a: `Budget travellers can do ${name} on roughly $120–180 per person per day (caravan park, cooking your own, free walks); mid-range $200–350 (hotel, paid attractions, eating out once a day); higher-end $400+ (boutique stays, tours, fine dining). Fuel is the big variable — Australia's regional driving distances add up. Tours and attractions in the listings above show prices in AUD where the operator publishes them.`,
  })

  // 15 — Connectivity
  faqs.push({
    q: `Will I have phone signal at ${name}?`,
    a: `Most named destinations in ${tenantStateName} have at least Telstra and Optus coverage in town. Coverage drops off quickly outside built-up areas — particularly in national parks, valleys and along long stretches of highway. If you're heading into remote areas, download offline maps before you leave, tell someone your itinerary, and consider a PLB (personal locator beacon) for serious bush walks.`,
  })

  if (faqs.length < 2) return null
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <section id="faq" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24, scrollMarginTop: 80 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: '#111827' }}>Frequently asked about {d.name}</h2>
      <dl style={{ margin: 0 }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ marginBottom: i < faqs.length - 1 ? 16 : 0 }}>
            <dt style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{f.q}</dt>
            <dd style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DestNearbyPanel({ name, nearby }: { name: string; nearby: DestNearby[] }) {
  const ICON: Record<string, string> = {
    attraction: '🎡', museum: '🏛️', family: '🦁', viewpoint: '🔭',
    historic: '🏰', beach: '🏖️', peak: '⛰️', waterfall: '💦',
    cave: '🕳️', nature_reserve: '🌳', culture: '🎭', other: '📍',
  }
  const LABEL: Record<string, string> = {
    attraction: 'Attractions', museum: 'Museums & galleries', family: 'Family — zoos, aquariums, theme parks',
    viewpoint: 'Lookouts & viewpoints', historic: 'Historic sites', beach: 'Beaches', peak: 'Peaks & summits',
    waterfall: 'Waterfalls', cave: 'Caves', nature_reserve: 'Nature reserves & national parks',
    culture: 'Theatres, cinemas & markets', other: 'Other',
  }
  const groups: Record<string, DestNearby[]> = {}
  for (const n of nearby) (groups[n.category] ||= []).push(n)
  const order = ['attraction','beach','viewpoint','peak','waterfall','nature_reserve','historic','museum','family','culture','cave','other']
  return (
    <section id="nearby-poi" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 4px', color: '#111827' }}>What else is around {name}</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>Points of interest within 25 km, pulled from OpenStreetMap. Distances are straight-line; check road access before heading out.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {order.filter(c => groups[c]?.length).map(c => {
          const items = groups[c].slice(0, 6)
          return (
            <div key={c} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{ICON[c] || ICON.other}</span> {LABEL[c] || c} ({groups[c].length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {items.map((n, i) => {
                  // Linkable when the POI has a real name. Skip the OSM junk
                  // (construction-site branding, advertising signs, etc.) which
                  // is technically "named" but useless to travellers.
                  const lname = (n.name || '').toLowerCase()
                  const junk = !n.name || lname === 'unnamed' || /\b(branding|advertising|scaffolding|hoarding|construction sign|temporary sign)\b/.test(lname) || /^\d+m\b/.test(lname)
                  const isLinkable = !junk && n.osm_id
                  const row = (
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, color: isLinkable ? 'var(--brand)' : '#6b7280', margin: '3px 0', textDecoration: 'none' }}>
                      <span style={{ overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, fontWeight: isLinkable ? 600 : 400 }}>{n.name || 'Unnamed'}</span>
                      <span style={{ color: '#6b7280', flexShrink: 0 }}>{Number(n.distance_km).toFixed(1)} km</span>
                    </span>
                  )
                  return (
                    <li key={i}>
                      {isLinkable
                        ? <Link href={poiUrl(n.osm_id!, n.name)} style={{ textDecoration: 'none' }}>{row}</Link>
                        : row}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 12 }}>
        Source: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>OpenStreetMap contributors</a>, ODbL.
      </div>
    </section>
  )
}
