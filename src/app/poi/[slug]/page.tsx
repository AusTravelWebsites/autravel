import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { parsePoiSlug, slugifyName, poiUrl, POI_ICON, POI_LABEL } from '@/lib/poi'

export const revalidate = 600

type Poi = {
  osm_id: string
  category: string
  name: string | null
  lat: number
  lng: number
  tags: Record<string, string>
}
type CoveringDest = { slug: string; name: string; state_code: string; distance_km: string }
type NearbyPoi = { osm_id: string; name: string | null; category: string; lat: number; lng: number; distance_km: number }

async function loadPoi(osmId: number, stateCode: string | null): Promise<Poi | null> {
  // The same OSM POI can be linked to multiple destinations; pick one row.
  // Tenant-scoped to the active site so a POI in another state isn't surfaced
  // here unless the aggregator is loading it.
  try {
    const rows = await db<Array<{ osm_id: string; category: string; name: string | null; lat: string; lng: string; tags: any }>>`
      SELECT DISTINCT ON (n.osm_id)
             n.osm_id::text, n.category, n.name,
             n.lat::text AS lat, n.lng::text AS lng, n.tags
        FROM autravel.destination_nearby n
        JOIN autravel.destinations d ON d.id = n.destination_id AND d.active = true
       WHERE n.osm_id = ${osmId}
         AND (${stateCode}::text IS NULL OR d.state_code = ${stateCode}::text)
       LIMIT 1`
    if (!rows.length) return null
    const r = rows[0]
    return {
      osm_id: r.osm_id,
      category: r.category,
      name: r.name,
      lat: Number(r.lat),
      lng: Number(r.lng),
      tags: r.tags || {},
    }
  } catch (e) { console.error('[loadPoi]', e); return null }
}

async function loadCoveringDestinations(osmId: number, stateCode: string | null): Promise<CoveringDest[]> {
  try {
    return await db<CoveringDest[]>`
      SELECT d.slug, d.name, d.state_code, n.distance_km::text
        FROM autravel.destination_nearby n
        JOIN autravel.destinations d ON d.id = n.destination_id AND d.active = true
       WHERE n.osm_id = ${osmId}
         AND (${stateCode}::text IS NULL OR d.state_code = ${stateCode}::text)
       ORDER BY n.distance_km ASC LIMIT 10`
  } catch { return [] }
}

async function loadNearbyPois(p: Poi, stateCode: string | null): Promise<NearbyPoi[]> {
  // Find other named POIs of any category within ~5km using the haversine
  // approximation. Postgres-side; cheap with the existing lat/lng + index.
  try {
    return await db<NearbyPoi[]>`
      SELECT DISTINCT ON (n.osm_id)
             n.osm_id::text, n.name, n.category, n.lat::float AS lat, n.lng::float AS lng,
             (
               6371 * acos(
                 LEAST(1, GREATEST(-1,
                   cos(radians(${p.lat})) * cos(radians(n.lat)) *
                     cos(radians(n.lng) - radians(${p.lng})) +
                   sin(radians(${p.lat})) * sin(radians(n.lat))
                 ))
               )
             )::float AS distance_km
        FROM autravel.destination_nearby n
        JOIN autravel.destinations d ON d.id = n.destination_id AND d.active = true
       WHERE n.osm_id <> ${Number(p.osm_id)}
         AND n.name IS NOT NULL AND lower(n.name) NOT LIKE 'unnamed%'
         AND (${stateCode}::text IS NULL OR d.state_code = ${stateCode}::text)
       ORDER BY n.osm_id, distance_km ASC
       LIMIT 80`
  } catch { return [] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const osmId = parsePoiSlug(slug)
  const tenant = await getTenant()
  if (!osmId) return { title: 'Place not found' }
  const p = await loadPoi(osmId, stateFilterValue(tenant))
  if (!p) return { title: 'Place not found' }
  const label = POI_LABEL[p.category] || POI_LABEL.other
  const name = p.name || label
  const desc = p.tags.description
    || `${name} is a ${label.toLowerCase()} in ${tenant.stateName}. Location, OpenStreetMap details, sister destinations and what else is nearby.`
  const canonical = `https://${tenant.host}${poiUrl(p.osm_id, p.name)}`
  return {
    title: `${name} — ${label} in ${tenant.stateName}`,
    description: desc.slice(0, 155),
    alternates: { canonical },
    openGraph: { title: name, description: desc.slice(0, 200), url: canonical, type: 'website' },
  }
}

export default async function PoiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const osmId = parsePoiSlug(slug)
  const tenant = await getTenant()
  if (!osmId) notFound()
  const state = stateFilterValue(tenant)
  const p = await loadPoi(osmId, state)
  if (!p) notFound()

  // Canonical-redirect mismatched slugs to the right one — keeps SEO clean
  // even if someone hand-edits the URL.
  const canonical = poiUrl(p.osm_id, p.name)
  // (We don't redirect server-side here because the page itself sets the
  // canonical link tag; soft canonical is enough for crawlers.)

  const [covering, nearby] = await Promise.all([
    loadCoveringDestinations(osmId, state),
    loadNearbyPois(p, state),
  ])

  const label = POI_LABEL[p.category] || POI_LABEL.other
  const icon = POI_ICON[p.category] || POI_ICON.other
  const name = p.name || `Unnamed ${label.toLowerCase()}`
  const tags = p.tags

  // Address from osm addr:* tags
  const addressParts = [
    tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : tags['addr:street'],
    tags['addr:suburb'] || tags['addr:city'],
    tags['addr:state'], tags['addr:postcode'],
  ].filter(Boolean) as string[]

  const wikipediaLink = tags.wikipedia
    ? (() => { const parts = tags.wikipedia.split(':'); const lang = parts.length > 1 ? parts[0] : 'en'; const title = parts.length > 1 ? parts.slice(1).join(':') : parts[0]; return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` })()
    : null
  const wikidataLink = tags.wikidata ? `https://www.wikidata.org/wiki/${encodeURIComponent(tags.wikidata)}` : null
  const osmLink = `https://www.openstreetmap.org/${p.osm_id < '0' ? 'relation' : 'node'}/${p.osm_id}`
  const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
  const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
  const osmTilesEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${p.lng - 0.01},${p.lat - 0.005},${p.lng + 0.01},${p.lat + 0.005}&layer=mapnik&marker=${p.lat},${p.lng}`

  // Build JSON-LD: Place / TouristAttraction
  const placeLd: any = {
    '@context': 'https://schema.org',
    '@type': p.category === 'historic' ? 'LandmarksOrHistoricalBuildings' : p.category === 'museum' ? 'Museum' : p.category === 'beach' ? 'BeachOrCoast' : 'TouristAttraction',
    name,
    description: tags.description || `${name} — ${label} in ${tenant.stateName}, Australia.`,
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    url: `https://${tenant.host}${canonical}`,
    ...(addressParts.length ? { address: { '@type': 'PostalAddress', streetAddress: tags['addr:street'], addressLocality: tags['addr:suburb'] || tags['addr:city'], addressRegion: tenant.stateName, postalCode: tags['addr:postcode'], addressCountry: 'AU' } } : {}),
    ...(tags.website ? { url: tags.website } : {}),
    ...(tags.phone ? { telephone: tags.phone } : {}),
    ...(tags.opening_hours ? { openingHours: tags.opening_hours } : {}),
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}/>

      {/* Header */}
      <section style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 22px' }}>
          {covering[0] && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              <Link href={`/${covering[0].slug}/`} style={{ color: '#0d9488', textDecoration: 'none' }}>← Back to {covering[0].name}</Link>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 36, lineHeight: 1 }} aria-hidden>{icon}</span>
            <div>
              <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label}</div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, margin: '2px 0 0', color: '#111827', lineHeight: 1.2 }}>{name}</h1>
            </div>
          </div>
          {(tags.description || addressParts.length > 0) && (
            <div style={{ marginTop: 10, color: '#374151', fontSize: 15, lineHeight: 1.6, maxWidth: 760 }}>
              {tags.description && <p style={{ margin: '0 0 6px' }}>{tags.description}</p>}
              {addressParts.length > 0 && <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>📍 {addressParts.join(', ')}</p>}
            </div>
          )}
          {/* Quick-fact strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 14 }}>
            {tags.ele && <Fact label="Elevation" value={`${tags.ele} m`} />}
            {tags.opening_hours && <Fact label="Hours" value={tags.opening_hours.length > 40 ? tags.opening_hours.slice(0, 40) + '…' : tags.opening_hours} />}
            {tags.phone && <Fact label="Phone" value={tags.phone} href={`tel:${tags.phone.replace(/\s+/g, '')}`} />}
            {tags.website && <Fact label="Website" value="Official site ↗" href={tags.website} />}
            {tags.fee && <Fact label="Entry" value={tags.fee === 'yes' ? `Fee${tags.charge ? ` (${tags.charge})` : ''}` : 'Free'} />}
            {tags.wheelchair === 'yes' && <Fact label="Access" value="♿ Wheelchair accessible" />}
            <Fact label="Get directions" value="Open in Google Maps ↗" href={directionsLink} />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 22 }}>

        {/* Main column */}
        <div>
          {/* Map */}
          <section style={card}>
            <h2 style={h2}>Location</h2>
            <p style={p2}>Latitude <b>{p.lat.toFixed(5)}</b>, longitude <b>{p.lng.toFixed(5)}</b>. View on the map, or open directions on your phone.</p>
            <div style={{ borderRadius: 10, overflow: 'hidden' as const, border: '1px solid #e5e7eb', aspectRatio: '16/9', background: '#f1f5f9' }}>
              <iframe
                src={osmTilesEmbed}
                title={`Map of ${name}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginTop: 12 }}>
              <a href={gmapsLink} target="_blank" rel="noopener" style={btnSecondary}>Google Maps ↗</a>
              <a href={directionsLink} target="_blank" rel="noopener" style={btnPrimary}>Get directions ↗</a>
              <a href={osmLink} target="_blank" rel="noopener" style={btnSecondary}>OpenStreetMap ↗</a>
            </div>
          </section>

          {/* About — pulls from tags */}
          {(wikipediaLink || wikidataLink || tags.description || tags.inscription || tags.operator || tags['name:en']) && (
            <section style={card}>
              <h2 style={h2}>About {name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, color: '#374151', fontSize: 14, lineHeight: 1.6 }}>
                {tags.description && <p style={{ margin: 0 }}>{tags.description}</p>}
                {tags.inscription && <p style={{ margin: 0, fontStyle: 'italic' as const, padding: '8px 12px', background: '#f9fafb', borderLeft: '3px solid #0d9488', borderRadius: 4 }}>"{tags.inscription}"</p>}
                {tags.operator && <p style={{ margin: 0 }}><b>Operated by:</b> {tags.operator}</p>}
                {tags['name:en'] && tags['name:en'] !== name && <p style={{ margin: 0 }}><b>English name:</b> {tags['name:en']}</p>}
                {wikipediaLink && <p style={{ margin: 0 }}>Read more on <a href={wikipediaLink} target="_blank" rel="noopener" style={linkStyle}>Wikipedia ↗</a></p>}
                {wikidataLink && <p style={{ margin: 0 }}>Structured data on <a href={wikidataLink} target="_blank" rel="noopener" style={linkStyle}>Wikidata ↗</a></p>}
              </div>
            </section>
          )}

          {/* Other places nearby */}
          {nearby.length > 0 && (
            <section style={card}>
              <h2 style={h2}>Other places within a few km</h2>
              <p style={p2}>Named places from OpenStreetMap, sorted by straight-line distance.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {nearby.slice(0, 18).map(n => (
                  <li key={n.osm_id}>
                    <Link href={poiUrl(n.osm_id, n.name)} style={{ display: 'block', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                          <span aria-hidden style={{ marginRight: 4 }}>{POI_ICON[n.category] || POI_ICON.other}</span>{n.name}
                        </span>
                        <span style={{ color: '#6b7280', fontWeight: 500, flexShrink: 0 }}>{n.distance_km.toFixed(1)} km</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
          <section style={card}>
            <h3 style={h3}>Featured in</h3>
            <p style={{ ...p2, marginBottom: 12 }}>Destinations that include {name} in their guide.</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {covering.map(d => (
                <Link key={d.slug} href={`/${d.slug}/`} style={{ display: 'block', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{Number(d.distance_km).toFixed(1)} km away</div>
                </Link>
              ))}
            </div>
          </section>

          <section style={{ ...card, fontSize: 12, color: '#6b7280' }}>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Data source</div>
            <p style={{ margin: 0 }}>POI details from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style={linkStyle}>OpenStreetMap contributors</a>, ODbL. Distances are straight-line — check road access and opening hours with the operator before visiting.</p>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Fact({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700, display: 'block' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value}</span>
    </>
  )
  const style: React.CSSProperties = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', textDecoration: 'none', color: 'inherit', display: 'block' }
  return href
    ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener' : undefined} style={style}>{content}</a>
    : <div style={style}>{content}</div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 18 }
const h2: React.CSSProperties = { fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 8px', color: '#111827' }
const h3: React.CSSProperties = { fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: '#111827' }
const p2: React.CSSProperties = { fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.55 }
const btnPrimary: React.CSSProperties = { background: '#0d9488', color: '#fff', padding: '9px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700 }
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#111827', padding: '9px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, border: '1px solid #e5e7eb' }
const linkStyle: React.CSSProperties = { color: '#0d9488', textDecoration: 'underline' }
