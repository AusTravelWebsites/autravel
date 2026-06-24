import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue, tourStatesFor } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'
import { HeroSearch } from '@/components/features/HeroSearch'
import { trailsCopy } from '@/lib/trails'

export const revalidate = 600

const C = {
  bg: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  body: '#374151',
  sub: '#6b7280',
  teal: '#0d9488',
  tealDark: '#0f766e',
  tealLight: '#f0fdfa',
}

type Destination = { slug: string; name: string; region: string | null; intro: string | null; hero_image: string | null }
type Tour = { slug: string; title: string; city: string | null; cover_image: string | null; rating: string | null; review_count: number | null; price_from: string | null; currency: string | null }
type Park = { slug: string; name: string; region: string | null; suburb: string | null; cover_image: string | null; avg_rating: string | null }
type Article = { slug: string; legacy_path: string | null; title: string; excerpt: string | null; cover_image: string | null; published_at: string | null }
type Trail = { slug: string; name: string; trail_type: string; difficulty: string | null; distance_label: string | null; duration_label: string | null; area: string | null; preview_points: [number, number][] | null }

function getHomeData(state: StateCode | null, tourStates: StateCode[] | null) {
  const key = state ?? 'all'
  const tourKey = tourStates ? tourStates.join('+') : 'all'
  return unstable_cache(
    async () => {
      const [destinations, featuredTours, topParks, recentArticles, trails, counts] = await Promise.all([
        db<Destination[]>`
          SELECT slug, name, region, intro, hero_image
          FROM destinations
          WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
          ORDER BY is_featured DESC, display_order ASC LIMIT 8`,
        db<Tour[]>`
          SELECT slug, title, city, cover_image, rating, review_count, price_from, currency
          FROM tours
          WHERE active = true AND ${tourStates === null ? db`true` : db`state_code = ANY(${tourStates})`}
            AND cover_image IS NOT NULL
          ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 6`,
        db<Park[]>`
          SELECT slug, name, region, suburb, cover_image, avg_rating
          FROM parks
          WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
            AND cover_image IS NOT NULL
          ORDER BY featured DESC, avg_rating DESC NULLS LAST LIMIT 6`,
        db<Article[]>`
          SELECT slug, legacy_path, title, excerpt, cover_image, published_at
          FROM articles
          WHERE status = 'published' AND (${state}::text IS NULL OR state_code = ${state}::text)
          ORDER BY published_at DESC NULLS LAST LIMIT 6`,
        db<Trail[]>`
          SELECT slug, name, trail_type, difficulty, distance_label, duration_label, area, preview_points
          FROM autravel.trails
          WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
          ORDER BY (trail_type LIKE '%route%') DESC, length_m DESC NULLS LAST LIMIT 6`,
        db<[{ d: number; t: number; p: number; a: number }]>`
          SELECT
            (SELECT COUNT(*)::int FROM destinations WHERE active AND (${state}::text IS NULL OR state_code = ${state}::text)) AS d,
            (SELECT COUNT(*)::int FROM tours WHERE active AND ${tourStates === null ? db`true` : db`state_code = ANY(${tourStates})`}) AS t,
            (SELECT COUNT(*)::int FROM parks WHERE active AND (${state}::text IS NULL OR state_code = ${state}::text)) AS p,
            (SELECT COUNT(*)::int FROM articles WHERE status='published' AND (${state}::text IS NULL OR state_code = ${state}::text)) AS a`,
      ])
      return { destinations, featuredTours, topParks, recentArticles, trails, counts: counts[0] || { d: 0, t: 0, p: 0, a: 0 } }
    },
    ['home', key, tourKey, 'v3'],
    { revalidate: 600, tags: ['home', `home:${key}`] }
  )()
}

export default async function HomePage() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const data = await getHomeData(state, tourStatesFor(tenant)).catch(() => ({
    destinations: [] as Destination[], featuredTours: [] as Tour[], topParks: [] as Park[], recentArticles: [] as Article[], trails: [] as Trail[], counts: { d: 0, t: 0, p: 0, a: 0 },
  }))
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const trailCopy = trailsCopy(tenant)

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <section style={{ position: 'relative' as const, padding: '72px 20px 64px', textAlign: 'center' as const, color: '#fff', overflow: 'hidden' as const, minHeight: 460 }}>
        {/* Hero photo — a real picture of the state, served via Unsplash CDN. */}
        <img
          src={tenant.heroImage}
          alt={`${tenant.heroCredit} — ${scope}`}
          fetchPriority="high"
          decoding="async"
          style={{ position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const, objectPosition: 'center', zIndex: 0 }}
        />
        {/* Dark gradient overlay for text legibility — slightly darker at the bottom where the CTAs sit. */}
        <div aria-hidden="true" style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.55) 50%, rgba(15,23,42,0.70) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative' as const, zIndex: 2, maxWidth: 920, margin: '0 auto', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.92)', fontWeight: 700, marginBottom: 14 }}>
            {tenant.name}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(32px,6vw,54px)', margin: '0 0 16px', lineHeight: 1.1, color: '#fff' }}>
            {tenant.aggregator
              ? 'Plan your Australian trip'
              : `Everything to see and do in ${scope}`}
          </h1>
          <p style={{ fontSize: 18, color: '#fff', maxWidth: 700, margin: '0 auto 26px', lineHeight: 1.55 }}>
            {tenant.tagline} Our small team — Mick, Beth, Sam and Jess — has been knocking around {scope} for a while; this is the trip planner we wish we'd had ten years ago.
          </p>
          <HeroSearch
            placeholder={`Search ${scope} — destinations, parks, tours, articles…`}
            suggestions={(data.destinations.slice(0, 4).map(d => ({ label: d.name, href: `/${d.slug}/` })))}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, justifyContent: 'center', marginTop: 22 }}>
            <Link href="/destinations/" style={ctaSecondary}>Browse destinations</Link>
            <Link href="/parks/" style={ctaSecondary}>Find caravan parks</Link>
            <Link href="/tours/" style={ctaSecondary}>Book a tour</Link>
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 'clamp(16px, 4vw, 36px)', flexWrap: 'wrap' as const, justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.95)' }}>
            <span><b style={{ color: '#fff', fontSize: 17 }}>{data.counts.d.toLocaleString()}</b> destinations</span>
            <span><b style={{ color: '#fff', fontSize: 17 }}>{data.counts.p.toLocaleString()}</b> caravan parks</span>
            <span><b style={{ color: '#fff', fontSize: 17 }}>{data.counts.t.toLocaleString()}</b> tours &amp; experiences</span>
            <span><b style={{ color: '#fff', fontSize: 17 }}>{data.counts.a.toLocaleString()}</b> travel articles</span>
          </div>
        </div>
        {/* Subtle photo credit, bottom-right. Hidden on the smallest screens. */}
        <div style={{ position: 'absolute' as const, bottom: 10, right: 14, zIndex: 2, fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {tenant.heroCredit}
        </div>
      </section>

      {/* Trails-first: walks & bike paths lead the page for trails-enabled tenants. */}
      {trailCopy.enabled && data.trails.length > 0 && (
        <section style={{ ...section, background: '#fff' }}>
          <div style={wrap}>
            <SectionHeader title={`Walks, bike paths & trails`} subtitle={`Walking trails, bike paths and cycle routes ${trailCopy.scope} — with route maps, distance and difficulty.`} cta={{ href: `${trailCopy.base}/`, label: 'Explore all trails →' }} accent={trailCopy.accent}/>
            <div style={grid3}>
              {data.trails.map(t => (
                <Link key={t.slug} href={`${trailCopy.base}/${t.slug}/`} style={cardLink}>
                  <article style={card}>
                    <RoutePreview pts={t.preview_points ?? []} color={trailCopy.accent}/>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ ...tagline, color: trailCopy.accent }}>{t.trail_type}{t.difficulty ? ` · ${t.difficulty}` : ''}</div>
                      <h3 style={titleH3}>{t.name}</h3>
                      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                        {t.distance_label && <span>📏 {t.distance_label}</span>}
                        {t.duration_label && <span>⏱ {t.duration_label}</span>}
                        {t.area && <span>📍 {t.area}</span>}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.destinations.length > 0 && (
        <section style={section}>
          <div style={wrap}>
            <SectionHeader title="Popular destinations" subtitle={`Curated guides for every main tourist location in ${scope}.`} cta={{ href: '/destinations/', label: 'See all destinations →' }}/>
            <div style={grid4}>
              {data.destinations.map(d => (
                <Link key={d.slug} href={`/${d.slug}/`} style={cardLink}>
                  <article style={card}>
                    <div style={{ aspectRatio: '4/3', background: '#f1f5f9', overflow: 'hidden' as const }}>
                      {d.hero_image
                        ? <img src={d.hero_image} alt={d.name} loading="lazy" style={img}/>
                        : <div style={emojiFallback}>📍</div>}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={tagline}>{d.region || 'Destination'}</div>
                      <h3 style={titleH3}>{d.name}</h3>
                      {d.intro && <p style={pSub}>{d.intro}</p>}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.featuredTours.length > 0 && (
        <section style={{ ...section, background: '#fff' }}>
          <div style={wrap}>
            <SectionHeader title="Top-rated tours" subtitle={`Small-group tours, day trips and multi-day experiences across ${scope}.`} cta={{ href: '/tours/', label: 'All tours →' }}/>
            <div style={grid3}>
              {data.featuredTours.map(t => (
                <Link key={t.slug} href={`/tours/${t.slug}/`} style={cardLink}>
                  <article style={card}>
                    <div style={{ aspectRatio: '16/10', background: '#f1f5f9' }}>
                      <img src={t.cover_image!} alt={t.title} loading="lazy" style={img}/>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={tagline}>{t.city || 'Tour'}</div>
                      <h3 style={titleH3}>{t.title}</h3>
                      <div style={{ fontSize: 12, color: C.body, marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                        {t.rating && <span>★ <b>{Number(t.rating).toFixed(1)}</b>{t.review_count ? ` (${Number(t.review_count).toLocaleString()})` : ''}</span>}
                        {t.price_from && <span>from {t.currency || 'AUD'} <b>${Number(t.price_from).toFixed(0)}</b></span>}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.topParks.length > 0 && (
        <section style={section}>
          <div style={wrap}>
            <SectionHeader title="Caravan &amp; holiday parks" subtitle={`Powered sites, cabins, glamping and big-rig-friendly grounds across ${scope}.`} cta={{ href: '/parks/', label: 'All parks →' }}/>
            <div style={grid3}>
              {data.topParks.map(p => (
                <Link key={p.slug} href={`/parks/${p.slug}/`} style={cardLink}>
                  <article style={card}>
                    <div style={{ aspectRatio: '16/10', background: '#f1f5f9' }}>
                      <img src={p.cover_image!} alt={p.name} loading="lazy" style={img}/>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={tagline}>{[p.suburb, p.region].filter(Boolean).join(' · ')}</div>
                      <h3 style={titleH3}>{p.name}</h3>
                      {p.avg_rating && <div style={{ fontSize: 12, color: C.body, marginTop: 8 }}>★ <b>{Number(p.avg_rating).toFixed(1)}</b></div>}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.recentArticles.length > 0 && (
        <section style={{ ...section, background: '#fff' }}>
          <div style={wrap}>
            <SectionHeader title="From the travel blog" subtitle={`Local guides, tips and recent stories from ${scope}.`} cta={null}/>
            <div style={grid3}>
              {data.recentArticles.map(a => {
                const href = a.legacy_path || `/articles/${a.slug}/`
                return (
                  <Link key={a.slug} href={href} style={cardLink}>
                    <article style={card}>
                      <div style={{ aspectRatio: '16/10', background: '#f1f5f9' }}>
                        {a.cover_image
                          ? <img src={a.cover_image} alt={a.title} loading="lazy" style={img}/>
                          : <div style={emojiFallback}>✍️</div>}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <h3 style={titleH3}>{a.title}</h3>
                        {a.excerpt && <p style={pSub}>{a.excerpt.slice(0, 140)}</p>}
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function SectionHeader({ title, subtitle, cta, accent }: { title: string; subtitle: string; cta: { href: string; label: string } | null; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' as const }}>
      <div style={{ maxWidth: 620 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(22px,3vw,30px)', margin: '0 0 6px', color: C.text }}>{title}</h2>
        <p style={{ fontSize: 15, color: C.sub, margin: 0 }}>{subtitle}</p>
      </div>
      {cta && <Link href={cta.href} style={{ color: accent || C.teal, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>{cta.label}</Link>}
    </div>
  )
}

// Server-rendered route shape for the homepage trail cards. Mirrors the
// TrailExplorer card SVG (28-point normalised 0..100 x / 0..60 y preview).
function RoutePreview({ pts, color }: { pts: [number, number][]; color: string }) {
  if (!pts?.length) return <div style={{ aspectRatio: '16/10', background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)' }} />
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', aspectRatio: '16/10', display: 'block', background: 'linear-gradient(135deg,#fff7ed,#f0f9ff)' }}>
      <path d={d} fill="none" stroke="#fff" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {pts[0] && <circle cx={pts[0][0]} cy={pts[0][1]} r={2.2} fill={color} stroke="#fff" strokeWidth={0.8} />}
    </svg>
  )
}

const ctaSecondary: React.CSSProperties = { background: 'rgba(15,23,42,0.45)', color: '#fff', padding: '11px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)' as any, WebkitBackdropFilter: 'blur(4px)' as any }
const section: React.CSSProperties = { padding: '48px 20px' }
const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto' }
const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }
const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, height: '100%' }
const cardLink: React.CSSProperties = { textDecoration: 'none', color: 'inherit' }
const img: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' as const }
const emojiFallback: React.CSSProperties = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50 }
const titleH3: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '4px 0 0', color: C.text, lineHeight: 1.3 }
const tagline: React.CSSProperties = { fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }
const pSub: React.CSSProperties = { fontSize: 13, color: C.sub, margin: '6px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }
