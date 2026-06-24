'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HeroSearch } from '@/components/features/HeroSearch'

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' }

const POPULAR_QUERIES = [
  { label: 'Caravan parks', href: '/parks/' },
  { label: 'Day tours', href: '/tours/?duration=full-day' },
  { label: 'Snow', href: '/search/?q=snow' },
  { label: 'Beaches', href: '/search/?q=beach' },
  { label: 'National parks', href: '/search/?q=national+park' },
]

type Destination = { slug: string; name: string; region?: string | null; intro?: string | null; hero_image?: string | null }
type Park = { slug: string; name: string; region?: string | null; suburb?: string | null; cover_image?: string | null; price_from?: string | null; currency?: string | null; avg_rating?: string | null }
type Tour = { slug: string; title: string; city?: string | null; cover_image?: string | null; rating?: string | null; review_count?: number | null; price_from?: string | null; currency?: string | null }
type Article = { slug: string; legacy_path?: string | null; title: string; excerpt?: string | null; cover_image?: string | null }

type Results = { destinations: Destination[]; parks: Park[]; tours: Tour[]; articles: Article[] }

function Inner() {
  const params = useSearchParams()
  const query = params.get('q') || ''
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length >= 2) {
      setLoading(true)
      fetch('/api/search?q=' + encodeURIComponent(query) + '&limit=10')
        .then(r => r.ok ? r.json() : null)
        .then(d => { setResults(d); setLoading(false) })
        .catch(() => setLoading(false))
    } else { setResults(null); setLoading(false) }
  }, [query])

  const total = results ? (results.destinations.length + results.parks.length + results.tours.length + results.articles.length) : 0

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px 60px' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
            {query ? <>Results for <span style={{ color: C.teal }}>"{query}"</span></> : 'Search'}
          </h1>
          <p style={{ color: C.sub, fontSize: 15, margin: '0 0 22px' }}>
            {query
              ? (loading ? 'Searching…' : total === 0 ? 'No matches — try a different term below.' : `${total} match${total === 1 ? '' : 'es'} across destinations, parks, tours and articles.`)
              : 'Search destinations, caravan parks, tours and articles in one place.'}
          </p>
          <HeroSearch variant="page" initialValue={query} placeholder="Search destinations, parks, tours, articles…" autoFocus={!query}/>
        </div>

        {!query && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 24px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 }}>Popular searches</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
              {POPULAR_QUERIES.map(p => (
                <Link key={p.href} href={p.href} style={{ padding: '7px 14px', background: C.tealLight, color: C.teal, border: '1px solid #99f6e4', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {results && results.destinations.length > 0 && (
          <Section title={`Destinations (${results.destinations.length})`}>
            {results.destinations.map(d => (
              <Link key={d.slug} href={`/${d.slug}/`} style={linkStyle}>
                <Card img={d.hero_image} title={d.name} subtitle={d.region || ''} excerpt={d.intro || ''}/>
              </Link>
            ))}
          </Section>
        )}

        {results && results.parks.length > 0 && (
          <Section title={`Caravan parks (${results.parks.length})`}>
            {results.parks.map(p => (
              <Link key={p.slug} href={`/parks/${p.slug}/`} style={linkStyle}>
                <Card img={p.cover_image} title={p.name} subtitle={[p.suburb, p.region].filter(Boolean).join(' · ')}
                  meta={[
                    p.avg_rating ? `★ ${Number(p.avg_rating).toFixed(1)}` : null,
                    p.price_from ? `from ${p.currency || 'AUD'} $${Number(p.price_from).toFixed(0)}` : null,
                  ].filter(Boolean).join(' · ')}/>
              </Link>
            ))}
          </Section>
        )}

        {results && results.tours.length > 0 && (
          <Section title={`Tours (${results.tours.length})`}>
            {results.tours.map(t => (
              <Link key={t.slug} href={`/tours/${t.slug}/`} style={linkStyle}>
                <Card img={t.cover_image} title={t.title} subtitle={t.city || ''}
                  meta={[
                    t.rating ? `★ ${Number(t.rating).toFixed(1)}` : null,
                    t.price_from ? `from ${t.currency || 'AUD'} $${Number(t.price_from).toFixed(0)}` : null,
                  ].filter(Boolean).join(' · ')}/>
              </Link>
            ))}
          </Section>
        )}

        {results && results.articles.length > 0 && (
          <Section title={`Articles (${results.articles.length})`}>
            {results.articles.map(a => {
              const href = a.legacy_path || `/articles/${a.slug}/`
              return (
                <Link key={a.slug} href={href} style={linkStyle}>
                  <Card img={a.cover_image} title={a.title} subtitle="" excerpt={a.excerpt || ''}/>
                </Link>
              )
            })}
          </Section>
        )}
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 14px', color: C.text }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>{children}</div>
    </section>
  )
}

function Card({ img, title, subtitle, meta, excerpt }: { img?: string | null; title: string; subtitle: string; meta?: string; excerpt?: string }) {
  return (
    <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
        {img ? <img src={img} alt={title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
             : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📍</div>}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{subtitle}</div>}
        {meta && <div style={{ fontSize: 11, color: '#374151', marginTop: 6, fontWeight: 600 }}>{meta}</div>}
        {excerpt && <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{excerpt.slice(0, 160)}</div>}
      </div>
    </article>
  )
}

const linkStyle: React.CSSProperties = { textDecoration: 'none', color: 'inherit' }

export default function SearchPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: C.sub }}>Loading…</div>}><Inner/></Suspense>
}
