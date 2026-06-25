import Link from 'next/link'
import { db } from '@/lib/db'

type Article = {
  slug: string
  state_code: string
  legacy_path: string | null
  destination_slug: string | null
  title: string
}

type Sibling = { slug: string; title: string; legacy_path: string | null; cover_image: string | null }
type Park = { slug: string; name: string; suburb: string | null; region: string | null; cover_image: string | null; avg_rating: string | null }
type Tour = { slug: string; title: string; city: string | null; cover_image: string | null; rating: string | null; price_from: string | null; currency: string | null }
type Dest = { slug: string; name: string; region: string | null; hero_image: string | null }

/**
 * Discovers the "first segment" of the legacy_path which is usually the
 * destination/place name (e.g. /maroochydore/accommodation/luxury-accommodation/ → "maroochydore").
 * Falls back to the explicit destination_slug if set on the article.
 */
function firstSegment(path: string | null): string | null {
  if (!path) return null
  const m = path.match(/^\/([^\/]+)\//)
  return m ? m[1].toLowerCase() : null
}

/** Two-segment prefix used to find sibling articles, e.g. /maroochydore/accommodation/. */
function siblingPrefix(path: string | null): string | null {
  if (!path) return null
  const m = path.match(/^(\/[^\/]+\/[^\/]+\/)/)
  return m ? m[1] : null
}

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

/**
 * Bottom-of-article "Related on [Destination]" section. Renders for ANY published
 * article — no body changes needed. Gives every legacy WP article a clean hub-and-spoke
 * link surface: parent destination guide, sibling articles, top parks, top tours.
 *
 * Self-contained: pulls everything from the DB in 4 parallel queries with hard LIMITs
 * so it can't slow the page. Returns null silently if nothing matches.
 */
export async function ArticleRelated({ article }: { article: Article }) {
  const seg = firstSegment(article.legacy_path) || article.destination_slug
  const prefix = siblingPrefix(article.legacy_path)
  if (!seg && !prefix) return null

  const candidateSlug = article.destination_slug || seg

  // 4 parallel queries; each catches its own error so a single failing query doesn't break the section
  const [dest, siblings, parks, tours] = await Promise.all([
    candidateSlug
      ? db<Dest[]>`
          SELECT slug, name, region, hero_image
            FROM destinations
           WHERE active = true
             AND state_code = ${article.state_code}
             AND slug = ${candidateSlug}
           LIMIT 1`.catch(() => [] as Dest[])
      : Promise.resolve([] as Dest[]),
    prefix
      ? db<Sibling[]>`
          SELECT slug, title, legacy_path, cover_image
            FROM articles
           WHERE state_code = ${article.state_code}
             AND status = 'published'
             AND legacy_path LIKE ${prefix + '%'}
             AND slug <> ${article.slug}
           ORDER BY published_at DESC NULLS LAST
           LIMIT 6`.catch(() => [] as Sibling[])
      : Promise.resolve([] as Sibling[]),
    candidateSlug
      ? db<Park[]>`
          SELECT p.slug, p.name, p.suburb, p.region, p.cover_image, p.avg_rating
            FROM parks p
           WHERE p.active = true AND p.state_code = ${article.state_code}
             AND (p.suburb ILIKE ${'%' + candidateSlug.replace(/-/g, ' ') + '%'}
                  OR p.region ILIKE ${'%' + candidateSlug.replace(/-/g, ' ') + '%'})
           ORDER BY p.featured DESC, p.avg_rating DESC NULLS LAST
           LIMIT 3`.catch(() => [] as Park[])
      : Promise.resolve([] as Park[]),
    candidateSlug
      ? db<Tour[]>`
          SELECT slug, title, city, cover_image, rating, price_from, currency
            FROM tours
           WHERE active = true AND state_code = ${article.state_code}
             AND (city ILIKE ${candidateSlug.replace(/-/g, ' ')} OR title ILIKE ${'%' + candidateSlug.replace(/-/g, ' ') + '%'})
           ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST
           LIMIT 3`.catch(() => [] as Tour[])
      : Promise.resolve([] as Tour[]),
  ])

  const d = dest[0]
  // If we found NOTHING related at all, don't bother rendering the section
  if (!d && siblings.length === 0 && parks.length === 0 && tours.length === 0) return null

  const placeName = d?.name || (candidateSlug ? candidateSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'this destination')

  return (
    <section style={{ marginTop: 40, paddingTop: 28, borderTop: `2px solid ${C.tealLight}` }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
        More about {placeName}
      </h2>
      <p style={{ fontSize: 14, color: C.sub, margin: '0 0 22px' }}>
        Other guides, accommodation, tours and travel reads from the same area.
      </p>

      {/* Hero callout: parent destination guide */}
      {d && (
        <Link href={`/${d.slug}/`} style={{ display: 'flex', gap: 16, padding: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 22, textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
          {d.hero_image && (
            <img src={d.hero_image} alt={d.name} loading="lazy" style={{ width: 110, height: 80, objectFit: 'cover' as const, borderRadius: 8, flexShrink: 0 }}/>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }}>{d.region || 'Destination guide'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>The full {d.name} travel guide</div>
            <div style={{ fontSize: 13, color: C.teal, fontWeight: 600, marginTop: 4 }}>Tours, parks, attractions and where to stay →</div>
          </div>
        </Link>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
        {/* Sibling articles — other accommodation/tours/etc under the same parent path */}
        {siblings.length > 0 && (
          <div>
            <h3 style={subhead}>More guides from this area</h3>
            <ul style={listReset}>
              {siblings.map(s => (
                <li key={s.slug} style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 0' }}>
                  <Link href={s.legacy_path || `/articles/${s.slug}/`} style={miniLink}>
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {parks.length > 0 && (
          <div>
            <h3 style={subhead}>Caravan parks in {placeName}</h3>
            <ul style={listReset}>
              {parks.map(p => (
                <li key={p.slug} style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 0' }}>
                  <Link href={`/parks/${p.slug}/`} style={miniLink}>
                    {p.name}
                    {p.avg_rating ? <span style={{ color: C.sub, fontWeight: 400, marginLeft: 6 }}>★ {Number(p.avg_rating).toFixed(1)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/parks/?q=${encodeURIComponent(placeName)}`} style={seeAll}>See all parks in {placeName} →</Link>
          </div>
        )}

        {tours.length > 0 && (
          <div>
            <h3 style={subhead}>Tours in {placeName}</h3>
            <ul style={listReset}>
              {tours.map(t => (
                <li key={t.slug} style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 0' }}>
                  <Link href={`/tours/${t.slug}/`} style={miniLink}>
                    {t.title}
                    {t.price_from && <span style={{ color: C.sub, fontWeight: 400, marginLeft: 6 }}>from {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/tours/?loc=${encodeURIComponent(placeName)}`} style={seeAll}>See all tours in {placeName} →</Link>
          </div>
        )}
      </div>
    </section>
  )
}

const subhead: React.CSSProperties = { fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 800, color: C.text, margin: '0 0 4px', paddingBottom: 6, borderBottom: `2px solid ${C.teal}` }
const listReset: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0 }
const miniLink: React.CSSProperties = { color: C.text, textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'block', lineHeight: 1.4 }
const seeAll: React.CSSProperties = { display: 'inline-block', marginTop: 8, color: C.teal, fontSize: 13, fontWeight: 700, textDecoration: 'none' }
