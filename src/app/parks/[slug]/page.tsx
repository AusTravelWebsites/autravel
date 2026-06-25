import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, parkStatesFor } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'
import { SaveButton } from '@/components/features/SaveButton'
import { DestinationWeather } from '@/components/features/DestinationWeather'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

type Params = Promise<{ slug: string }>

type Park = {
  id: string
  slug: string
  state_code: string
  name: string
  park_type: string | null
  region: string | null
  destination_slug: string | null
  address: string | null
  suburb: string | null
  postcode: string | null
  lat: string | null
  lng: string | null
  phone: string | null
  email: string | null
  website: string | null
  description: string | null
  description_ai: string | null
  amenities: Record<string, boolean> | null
  site_types: Record<string, boolean> | null
  pets_allowed: boolean | null
  dump_point: boolean | null
  big_rig_friendly: boolean | null
  price_from: string | null
  currency: string | null
  star_rating: string | null
  avg_rating: string | null
  review_count: number | null
  cover_image: string | null
  images: string[] | null
  seo_title: string | null
  seo_description: string | null
  ai_pros: string[] | null
  ai_cons: string[] | null
  ai_review_summary: string | null
}

async function getPark(slug: string, parkStates: StateCode[] | null): Promise<Park | null> {
  try {
    const [row] = await db<Park[]>`
      SELECT * FROM parks
      WHERE slug = ${slug}
        AND active = true
        AND ${parkStates === null ? db`true` : db`state_code = ANY(${parkStates})`}
      LIMIT 1`
    return row || null
  } catch {
    return null
  }
}

async function getNearbyParks(park: Park): Promise<Park[]> {
  if (!park.lat || !park.lng) return []
  try {
    return await db<Park[]>`
      SELECT slug, name, region, suburb, cover_image, avg_rating, review_count, price_from, currency,
             pets_allowed, big_rig_friendly, site_types, description_ai, description
      FROM parks
      WHERE state_code = ${park.state_code}
        AND active = true
        AND slug <> ${park.slug}
        AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY (
        (lat - ${park.lat}::numeric) * (lat - ${park.lat}::numeric) +
        (lng - ${park.lng}::numeric) * (lng - ${park.lng}::numeric)
      ) ASC
      LIMIT 6`
  } catch { return [] }
}

type NearbyOsm = { category: string; name: string | null; distance_km: string | null; lat: string | null; lng: string | null }
type Alert = { id: string; source: string; title: string; severity: string | null; type: string | null; link: string | null; distance_km: number; seen_at: string }

async function getNearbyAlerts(park: Park): Promise<Alert[]> {
  if (!park.lat || !park.lng) return []
  // Bounding-box pre-filter (~1° = ~110km, then 50km strict via haversine)
  try {
    const rows = await db<Array<{ id: string; source: string; title: string; severity: string | null; type: string | null; link: string | null; lat: string; lng: string; seen_at: string }>>`
      SELECT id, source, title, severity, type, link, lat::text, lng::text, seen_at
      FROM alerts
      WHERE state_code = ${park.state_code}
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN (${park.lat}::numeric - 1.0) AND (${park.lat}::numeric + 1.0)
        AND lng BETWEEN (${park.lng}::numeric - 1.0) AND (${park.lng}::numeric + 1.0)
        AND seen_at > now() - interval '24 hours'
      LIMIT 50`
    const out: Alert[] = []
    for (const r of rows) {
      const lat1 = Number(park.lat), lng1 = Number(park.lng)
      const lat2 = Number(r.lat),    lng2 = Number(r.lng)
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      const dist = R * 2 * Math.asin(Math.sqrt(a))
      if (dist <= 50) out.push({ id: r.id, source: r.source, title: r.title, severity: r.severity, type: r.type, link: r.link, distance_km: dist, seen_at: r.seen_at })
    }
    return out.sort((a, b) => a.distance_km - b.distance_km).slice(0, 5)
  } catch { return [] }
}

type NearestDest = { slug: string; name: string; region: string | null; lat: string; lng: string; distance_km: number }
async function getNearestDestinations(park: Park, destState: StateCode): Promise<NearestDest[]> {
  if (!park.lat || !park.lng) return []
  try {
    // Use the CURRENT tenant's destinations (destState), not the park's home state
    // — an all-Australia tenant (auex) surfaces parks from every state but only its
    // own destinations exist, so link to the nearest of those (geographically).
    const rows = await db<Array<{ slug: string; name: string; region: string | null; lat: string; lng: string }>>`
      SELECT slug, name, region, lat::text, lng::text FROM destinations
      WHERE active = true AND state_code = ${destState}
        AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY (
        (lat - ${park.lat}::numeric) * (lat - ${park.lat}::numeric) +
        (lng - ${park.lng}::numeric) * (lng - ${park.lng}::numeric)
      ) ASC
      LIMIT 6`
    return rows.map(r => {
      const R = 6371
      const lat1 = Number(park.lat) * Math.PI / 180, lat2 = Number(r.lat) * Math.PI / 180
      const dLat = lat2 - lat1, dLng = (Number(r.lng) - Number(park.lng)) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
      const distance_km = R * 2 * Math.asin(Math.sqrt(a))
      return { ...r, distance_km }
    })
  } catch { return [] }
}

async function getNearbyOsm(parkId: string): Promise<NearbyOsm[]> {
  try {
    return await db<NearbyOsm[]>`
      SELECT category, name, distance_km, lat, lng
      FROM park_nearby
      WHERE park_id = ${parkId}
      ORDER BY distance_km ASC
      LIMIT 200`
  } catch { return [] }
}

async function getNearbyTours(park: Park): Promise<Array<{ slug: string; title: string; cover_image: string | null; rating: string | null; price_from: string | null; currency: string | null }>> {
  if (!park.suburb && !park.region) return []
  const city = park.suburb || null
  const region = park.region || null
  try {
    return await db`
      SELECT slug, title, cover_image, rating, price_from, currency
      FROM tours
      WHERE active = true
        AND state_code = ${park.state_code}
        AND (
          (${city}::text IS NOT NULL AND city ILIKE ${city}::text)
          OR (${region}::text IS NOT NULL AND city ILIKE ${region}::text)
        )
      ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
      LIMIT 6` as any
  } catch { return [] }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  const park = await getPark(slug, parkStatesFor(tenant))
  if (!park) return { title: 'Park not found' }
  const rawTitle = park.seo_title || `${park.name} — ${park.region || tenant.stateName}`
  const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
  const rawDesc = park.seo_description || park.description_ai || park.description || `Caravan park at ${park.name}, ${[park.suburb, park.region].filter(Boolean).join(', ')}. Pricing, amenities, site types and availability.`
  const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
  const url = `https://${tenant.host}/parks/${park.slug}/`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: park.cover_image ? [park.cover_image] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: park.cover_image ? [park.cover_image] : [] },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

const STATE_TZ_PARK = {
  qld: 'Australia/Brisbane', nsw: 'Australia/Sydney', vic: 'Australia/Melbourne',
  wa: 'Australia/Perth', sa: 'Australia/Adelaide', tas: 'Australia/Hobart',
  nt: 'Australia/Darwin', aunz: 'Australia/Sydney',
} as const

export default async function ParkDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const tenant = await getTenant()
  const park = await getPark(slug, parkStatesFor(tenant))
  if (!park) notFound()

  const [nearby, tours, osmNearby, alerts, nearestDests] = await Promise.all([getNearbyParks(park), getNearbyTours(park), getNearbyOsm(park.id), getNearbyAlerts(park), getNearestDestinations(park, tenant.state_code)])
  const rating = park.avg_rating ? Number(park.avg_rating) : (park.star_rating ? Number(park.star_rating) : null)
  const canonical = `https://${tenant.host}/parks/${park.slug}/`
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Caravan Parks', item: `https://${tenant.host}/parks/` },
      { '@type': 'ListItem', position: 3, name: park.name,       item: canonical },
    ],
  }
  const images = [park.cover_image, ...(park.images || [])].filter(Boolean) as string[]

  const jsonLd = {
    '@context': 'https://schema.org',
    // Dual-type: Campground for the topic + LodgingBusiness so it's eligible
    // for Google's Local Pack and rich-result snippets that need a business node.
    '@type': ['Campground', 'LodgingBusiness'],
    name: park.name,
    description: park.description_ai || park.description || undefined,
    image: images.slice(0, 6),
    url: canonical,
    address: {
      '@type': 'PostalAddress',
      streetAddress: park.address || undefined,
      addressLocality: park.suburb || undefined,
      addressRegion: tenant.stateName,
      postalCode: park.postcode || undefined,
      addressCountry: 'AU',
    },
    geo: park.lat && park.lng ? { '@type': 'GeoCoordinates', latitude: Number(park.lat), longitude: Number(park.lng) } : undefined,
    telephone: park.phone || undefined,
    priceRange: park.price_from ? `From ${park.currency || 'AUD'} $${Number(park.price_from).toFixed(0)}/night` : undefined,
    amenityFeature: park.amenities ? Object.entries(park.amenities).filter(([, v]) => v).map(([k]) => ({ '@type': 'LocationFeatureSpecification', name: k.replace(/_/g, ' ') })) : undefined,
    petsAllowed: park.pets_allowed || undefined,
    aggregateRating: rating && Number(park.review_count || 0) > 0 ? {
      '@type': 'AggregateRating', ratingValue: rating, reviewCount: Number(park.review_count), bestRating: 5, worstRating: 1,
    } : undefined,
  }

  const amenityList = park.amenities ? Object.entries(park.amenities).filter(([, v]) => v).map(([k]) => k) : []
  const siteTypeList = park.site_types ? Object.entries(park.site_types).filter(([, v]) => v).map(([k]) => k) : []

  // FAQ schema — derived from amenities/site types/policies. Eligible for Google rich results.
  const faqs: Array<{ q: string; a: string }> = []
  faqs.push({
    q: `Where is ${park.name}?`,
    a: `${park.name} is located at ${[park.address, park.suburb, park.region, tenant.stateName].filter(Boolean).join(', ')}.`,
  })
  if (park.pets_allowed !== null) faqs.push({
    q: `Are pets allowed at ${park.name}?`,
    a: park.pets_allowed
      ? `Yes, ${park.name} is pet-friendly. Always confirm conditions (leash rules, breed restrictions, designated areas) with the park before arriving.`
      : `No, ${park.name} does not allow pets. If you're travelling with a dog, check our other parks in ${park.region || tenant.stateName} or pet-friendly parks across ${tenant.stateName}.`,
  })
  if (park.big_rig_friendly) faqs.push({
    q: `Can I take a big rig or large caravan to ${park.name}?`,
    a: `Yes, ${park.name} is big-rig friendly with bays sized for larger caravans and motorhomes. Always confirm length and turning-circle requirements with the park before booking.`,
  })
  if (park.dump_point) faqs.push({
    q: `Does ${park.name} have a dump point?`,
    a: `Yes, ${park.name} has a dump point on-site for self-contained vehicles.`,
  })
  if (siteTypeList.length) faqs.push({
    q: `What kind of accommodation does ${park.name} offer?`,
    a: `${park.name} offers ${siteTypeList.map(s => s.replace(/_/g, ' ')).join(', ')}. Availability varies by season — confirm directly with the park before booking.`,
  })
  if (park.price_from) faqs.push({
    q: `How much does it cost to stay at ${park.name}?`,
    a: `Prices start from ${park.currency || 'AUD'} $${Number(park.price_from).toFixed(0)} per night. Final pricing depends on site type, season and length of stay — confirm with the park.`,
  })
  if (park.phone) faqs.push({
    q: `How do I contact ${park.name}?`,
    a: `Call ${park.name} on ${park.phone}${park.email ? ` or email ${park.email}` : ''}${park.website ? `. The official website is ${park.website}.` : '.'}`,
  })
  const faqLd = faqs.length >= 2 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}/>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>}

      {park.cover_image && (
        <div style={{ width: '100%', height: 'clamp(220px,32vw,380px)', background: '#0b1420', overflow: 'hidden' as const, position: 'relative' as const }}>
          <img src={park.cover_image} alt={park.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.88 }}/>
          <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)' }}/>
          <div style={{ position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: '18px 20px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ marginBottom: 8 }}>
                <Breadcrumbs crumbs={[
                  { href: '/', label: 'Home' },
                  { href: '/parks/', label: 'Caravan parks' },
                  ...(park.region ? [{ label: park.region }] : []),
                  { label: park.name },
                ]}/>
              </div>
              <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(22px,4vw,34px)', margin: 0, lineHeight: 1.2, textShadow: '0 2px 14px rgba(0,0,0,0.4)' }}>{park.name}</h1>
              <div style={{ color: 'rgba(255,255,255,0.95)', marginTop: 10, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const, fontSize: 14 }}>
                {rating != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
                    <span aria-hidden style={{ fontSize: 16, letterSpacing: 1, color: '#fbbf24' }}>
                      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
                    </span>
                    <b>{rating.toFixed(1)}</b>
                    {park.review_count ? <span style={{ opacity: 0.85 }}>· {Number(park.review_count).toLocaleString()} Google reviews</span> : null}
                  </span>
                )}
                {[park.suburb, park.region].filter(Boolean).length > 0 && <span>📍 {[park.suburb, park.region].filter(Boolean).join(', ')}</span>}
                {park.price_from && <span>💰 from {park.currency || 'AUD'} ${Number(park.price_from).toFixed(0)}/night</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderTop: '1px solid #fecaca', borderBottom: '1px solid #fecaca' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: alerts.length > 1 ? 8 : 0 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <strong style={{ fontSize: 14, color: '#991b1b' }}>Active alerts within 50 km of {park.name}</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 28, fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
              {alerts.map(a => (
                <li key={a.id}>
                  <strong>{a.severity || a.type || 'Alert'}:</strong> {a.title} · {a.distance_km.toFixed(1)} km away · <span style={{ color: '#9ca3af' }}>{a.source}</span>
                  {a.link && <> · <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontWeight: 600 }}>details →</a></>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 28 }}>
        <div style={{ minWidth: 0 }}>
          {images.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 6, marginBottom: 24 }}>
              {images.slice(0, 8).map((u, i) => (
                <div key={u + i} style={{ aspectRatio: '4/3', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' as const }}>
                  <img src={u} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                </div>
              ))}
            </div>
          )}

          {(park.description_ai || park.description) && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px', color: C.text }}>About this park</h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: C.text, margin: 0, whiteSpace: 'pre-wrap' as const }}>
                {park.description_ai || park.description}
              </p>
            </section>
          )}

          {((Array.isArray(park.ai_pros) && park.ai_pros.length > 0) || (Array.isArray(park.ai_cons) && park.ai_cons.length > 0) || park.ai_review_summary) && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 6px', color: C.text }}>What guests are saying</h2>
              <p style={{ fontSize: 12, color: C.sub, margin: '0 0 16px' }}>
                Summary distilled from {park.review_count ? Number(park.review_count).toLocaleString() : ''} Google reviews
              </p>
              {park.ai_review_summary && (
                <p style={{ fontSize: 15, lineHeight: 1.65, color: C.text, margin: '0 0 18px', fontStyle: 'italic' as const }}>
                  {park.ai_review_summary}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
                {Array.isArray(park.ai_pros) && park.ai_pros.length > 0 && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span aria-hidden style={{ fontSize: 18 }}>👍</span>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--brand-dark)', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>What people love</h3>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#064e3b', fontSize: 14, lineHeight: 1.55 }}>
                      {park.ai_pros.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(park.ai_cons) && park.ai_cons.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span aria-hidden style={{ fontSize: 18 }}>👎</span>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>What could be better</h3>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#7f1d1d', fontSize: 14, lineHeight: 1.55 }}>
                      {park.ai_cons.map((c, i) => <li key={i} style={{ marginBottom: 6 }}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {amenityList.length > 0 && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 12px', color: C.text }}>Facilities</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {amenityList.map(a => <div key={a} style={{ fontSize: 14, color: C.text }}>✓ {a.replace(/_/g, ' ')}</div>)}
              </div>
            </section>
          )}

          {siteTypeList.length > 0 && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 12px', color: C.text }}>Site types</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {siteTypeList.map(s => <div key={s} style={{ fontSize: 14, color: C.text }}>✓ {s.replace(/_/g, ' ')}</div>)}
              </div>
            </section>
          )}

          {faqs.length >= 2 && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 14px', color: C.text }}>Frequently asked</h2>
              <dl style={{ margin: 0 }}>
                {faqs.map((f, i) => (
                  <div key={i} style={{ marginBottom: i < faqs.length - 1 ? 14 : 0 }}>
                    <dt style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{f.q}</dt>
                    <dd style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: 0 }}>{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {park.lat && park.lng && <DestinationWeather name={park.name} lat={Number(park.lat)} lng={Number(park.lng)} timezone={STATE_TZ_PARK[park.state_code as keyof typeof STATE_TZ_PARK] || 'Australia/Sydney'}/>}
          {osmNearby.length >= 5 && <NearbyMap parkName={park.name} nearby={osmNearby}/>}
          {nearestDests.length > 0 && <NearestDestinationsPanel state={park.state_code} parkName={park.name} dests={nearestDests}/>}

          {tours.length > 0 && (
            <section style={{ marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 12px', color: C.text }}>Tours nearby</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                {tours.map(t => (
                  <Link key={t.slug} href={`/tours/${t.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' as const }}>
                      {t.cover_image && <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}><img src={t.cover_image} alt={t.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/></div>}
                      <div style={{ padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                          {t.rating && <>★ {Number(t.rating).toFixed(1)}</>}
                          {t.price_from && <> · from {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {nearby.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 12px', color: C.text }}>Nearby parks</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                {nearby.map(n => (
                  <Link key={n.slug} href={`/parks/${n.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' as const }}>
                      {n.cover_image && <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}><img src={n.cover_image} alt={n.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/></div>}
                      <div style={{ padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{n.name}</div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{[n.suburb, n.region].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside>
          <div style={{ position: 'sticky' as const, top: 90, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 22px 18px' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 17, margin: '0 0 12px', color: C.text }}>Contact &amp; details</h3>
            {park.address && <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>📍 {park.address}{park.postcode ? ` ${park.postcode}` : ''}</div>}
            {park.phone && <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>☎ <a href={`tel:${park.phone}`} style={{ color: C.teal, textDecoration: 'none' }}>{park.phone}</a></div>}
            {park.website && (
              <a href={park.website} target="_blank" rel="noopener noreferrer"
                 style={{ display: 'block', background: C.teal, color: '#fff', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: 15, textAlign: 'center' as const, textDecoration: 'none', marginTop: 12 }}>
                Visit website →
              </a>
            )}
            <div style={{ marginTop: 12, textAlign: 'center' as const }}>
              <SaveButton type="park" slug={park.slug} name={park.name} href={`/parks/${park.slug}/`} image={park.cover_image} state_code={park.state_code} region={park.region || park.suburb}/>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 12, textAlign: 'center' as const }}>
              Verify pricing and availability with the park before travelling.
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function NearbyMap({ parkName, nearby }: { parkName: string; nearby: NearbyOsm[] }) {
  // Group by category, keep top-5 closest of each
  const ICON: Record<string, string> = {
    campground: '⛺', picnic: '🧺', viewpoint: '🔭', fuel: '⛽',
    toilet: '🚻', water: '🚰', beach: '🏖️', swim: '🏊', park: '🌳', other: '📍',
  }
  const LABEL: Record<string, string> = {
    campground: 'Free / paid campgrounds', picnic: 'Picnic spots', viewpoint: 'Lookouts & viewpoints',
    fuel: 'Fuel stations', toilet: 'Public toilets', water: 'Drinking water taps',
    beach: 'Beaches', swim: 'Swimming pools', park: 'Parks', other: 'Other',
  }
  const groups: Record<string, NearbyOsm[]> = {}
  for (const n of nearby) {
    (groups[n.category] ||= []).push(n)
  }
  const order = ['campground', 'beach', 'viewpoint', 'picnic', 'swim', 'fuel', 'water', 'toilet', 'park', 'other']
  return (
    <section id="nearby-osm" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 18, scrollMarginTop: 80 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 4px', color: '#111827' }}>Within 30 km of {parkName}</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>
        Free / public facilities and points of interest pulled from OpenStreetMap. Distances are straight-line; check road access before heading out.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {order.filter(c => groups[c]?.length).map(c => {
          const items = groups[c].slice(0, 6)
          return (
            <div key={c} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{ICON[c] || ICON.other}</span> {LABEL[c] || c} ({groups[c].length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {items.map((n, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#374151', margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{n.name || 'Unnamed'}</span>
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>{Number(n.distance_km).toFixed(1)} km</span>
                  </li>
                ))}
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

function NearestDestinationsPanel({ state, parkName, dests }: { state: string; parkName: string; dests: NearestDest[] }) {
  return (
    <section id="nearest-destinations" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 6px', color: '#111827' }}>Nearest destinations to {parkName}</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>Direct distance to the closest destinations. Click for the full drive-time guide and tours along the way.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 10 }}>
        {dests.map(d => (
          <Link key={d.slug} href={`/${d.slug}/`} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
              {d.region && <>{d.region} · </>}{Math.round(d.distance_km)} km away
            </div>
          </Link>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 12 }}>
        <Link href="/distances/" style={{ color: 'var(--brand)', fontWeight: 700 }}>See full drive distances across the state →</Link>
      </div>
    </section>
  )
}
