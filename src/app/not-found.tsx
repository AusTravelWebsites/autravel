import Link from 'next/link'
import type { Metadata } from 'next'
import { NotFoundTracker } from '@/components/legal/NotFoundTracker'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { db } from '@/lib/db'
import { HeroSearch } from '@/components/features/HeroSearch'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: 'Page not found',
    description: `That page has wandered off the map. Head back to explore ${tenant.name}.`,
    robots: { index: false, follow: true },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

type PopDest = { slug: string; name: string; region: string | null; hero_image: string | null }

export default async function NotFound() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  // Top 6 featured destinations — helps users recover from a 404 by suggesting where to go next.
  let popular: PopDest[] = []
  try {
    popular = await db<PopDest[]>`
      SELECT slug, name, region, hero_image
        FROM destinations
       WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
       ORDER BY is_featured DESC, display_order ASC LIMIT 6`
  } catch { /* empty popular list is fine */ }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 16px 60px' }}>
      <NotFoundTracker />
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px 36px', textAlign: 'center' as const }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🗺️</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>This page has wandered off the map</h1>
          <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.6, margin: '0 auto 26px', maxWidth: 520 }}>
            It might have moved, or the link might have a typo. Search what you were after, or pick a popular destination below.
          </p>
          <HeroSearch variant="page" placeholder={`Search ${scope} — destinations, parks, tours, articles…`} autoFocus />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' as const, flexWrap: 'wrap' as const, marginTop: 20, fontSize: 13 }}>
            <Link href="/" style={navLink}>{tenant.name} home</Link>
            <span style={{ color: C.sub }}>·</span>
            <Link href="/destinations/" style={navLink}>Destinations</Link>
            <span style={{ color: C.sub }}>·</span>
            <Link href="/parks/" style={navLink}>Caravan parks</Link>
            <span style={{ color: C.sub }}>·</span>
            <Link href="/tours/" style={navLink}>Tours</Link>
            <span style={{ color: C.sub }}>·</span>
            <Link href="/contact/" style={navLink}>Report a broken link</Link>
          </div>
        </div>

        {popular.length > 0 && (
          <section style={{ marginTop: 36 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 14px', color: C.text }}>Popular destinations in {scope}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {popular.map(d => (
                <Link key={d.slug} href={`/${d.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const, transition: 'transform 0.15s, box-shadow 0.15s' }}
                    >
                    <div style={{ aspectRatio: '4/3', background: '#f1f5f9', overflow: 'hidden' as const }}>
                      {d.hero_image
                        ? <img src={d.hero_image} alt={d.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📍</div>}
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }}>{d.region || 'Destination'}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2 }}>{d.name}</div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

const navLink: React.CSSProperties = { color: C.teal, textDecoration: 'none', fontWeight: 600, padding: '2px 0' }
