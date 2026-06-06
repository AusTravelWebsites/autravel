import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const revalidate = 3600

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const title = `Drive distances & times — ${scope}`
  const desc = `How far is it between major destinations in ${scope}? Real-road distance and drive time, suggested overnight stops, and caravan parks along the way.`
  const url = `https://${tenant.host}/distances/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

type Pair = { state_code: string; from_slug: string; to_slug: string; from_name: string; to_name: string; distance_km: string; duration_min: number }

export default async function DistancesIndex() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const rows = await db<Pair[]>`
    SELECT state_code, from_slug, to_slug, from_name, to_name, distance_km::text, duration_min
    FROM distance_pairs
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
    ORDER BY state_code, from_name, to_name`
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Distances', item: `https://${tenant.host}/distances/` },
    ],
  }
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Drive distances in ${scope}`,
    url: `https://${tenant.host}/distances/`,
    isPartOf: { '@type': 'WebSite', name: tenant.name, url: `https://${tenant.host}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: rows.length,
      itemListElement: rows.slice(0, 50).map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        name: `${p.from_name} to ${p.to_name}`,
        url: `https://${tenant.host}/distances/${p.state_code}/${p.from_slug}-to-${p.to_slug}/`,
      })),
    },
  }

  // Group by state
  const byState: Record<string, Pair[]> = {}
  for (const p of rows) (byState[p.state_code] ||= []).push(p)

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Distances</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,38px)', fontWeight: 800, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>Drive distances &amp; times across {scope}</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 600 }}>
            Real-road distance and drive time between every major destination — plus where to break the journey overnight, the parks at either end, and tours en route.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        {Object.entries(byState).map(([sc, pairs]) => (
          <section key={sc} style={{ marginBottom: 30 }}>
            {tenant.aggregator && <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, color: C.text, margin: '0 0 12px' }}>{sc.toUpperCase()}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {pairs.map(p => {
                const km = Number(p.distance_km)
                const hh = Math.floor(p.duration_min / 60)
                const mm = p.duration_min % 60
                return (
                  <Link key={p.from_slug + p.to_slug}
                        href={`/distances/${p.state_code}/${p.from_slug}-to-${p.to_slug}/`}
                        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{p.from_name} → {p.to_name}</div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{km.toFixed(0)} km · {hh}h {mm}m</div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
        {rows.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' as const, color: C.sub }}>
            Distance data is being computed and will appear here shortly.
          </div>
        )}
      </div>
    </main>
  )
}
