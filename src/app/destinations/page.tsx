import { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { DestinationsFilter } from './DestinationsFilter'

export const revalidate = 600

type Destination = {
  slug: string
  name: string
  region: string | null
  intro: string | null
  hero_image: string | null
  is_featured: boolean
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const title = `Destinations in ${scope}`
  const desc = `Curated destination guides for every main tourist location in ${scope}. Find tours, caravan parks, attractions and travel articles organised by place.`
  const url = `https://${tenant.host}/destinations/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: `Destinations in ${scope}` }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

// 2026-05-25 — cached for 10 min, tenant-scoped. Was uncached, contributing
// to the same pool-starvation that took the sites down repeatedly.
function getDestinationsList(state: StateCode | null) {
  const key = state ?? 'all'
  return unstable_cache(
    async () => {
      try {
        return await db<Destination[]>`
          SELECT slug, name, region, intro, hero_image, is_featured
          FROM destinations
          WHERE active = true
            AND (${state}::text IS NULL OR state_code = ${state}::text)
          ORDER BY is_featured DESC, display_order ASC, name ASC`
      } catch (e) { console.warn('[destinations/list]', (e as any)?.code || e); return [] as Destination[] }
    },
    ['destinations-list', key],
    { revalidate: 600, tags: ['destinations', `destinations:${key}`] }
  )()
}

export default async function DestinationsPage() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const destinations = await getDestinationsList(state)
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Destinations in ${scope}`,
    url: `https://${tenant.host}/destinations/`,
    isPartOf: { '@type': 'WebSite', name: tenant.name, url: `https://${tenant.host}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: destinations.length,
      itemListElement: destinations.slice(0, 50).map((d, i) => ({
        '@type': 'ListItem', position: i + 1, name: d.name,
        url: `https://${tenant.host}/${d.slug}/`,
      })),
    },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',         item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Destinations', item: `https://${tenant.host}/destinations/` },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Destinations</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
            Every main destination in {scope}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 640 }}>
            Tours, attractions, caravan parks and local guides — all organised by place. Sam pulls these together from what our team's actually visited and what travellers tell us is worth the detour. Pick a destination to start planning.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        {destinations.length > 0 ? (
          <DestinationsFilter destinations={destinations}/>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' as const, color: C.sub }}>
            No destinations configured yet.
          </div>
        )}
      </div>
    </main>
  )
}
