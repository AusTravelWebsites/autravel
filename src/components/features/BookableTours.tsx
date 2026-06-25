import { db } from '@/lib/db'

type Article = {
  title: string
  tags?: string[] | null
  categories?: string[] | null
  state_code: string
}

type Tour = {
  slug: string
  title: string
  price_from: string | null
  currency: string | null
  cover_image: string | null
  booking_url: string | null
  rating: string | null
  review_count: number | null
  duration_label: string | null
}

// Keys are stems so we match "cruise/cruising/cruises", "dive/diving/diver",
// "sail/sailing", "fish/fishing" etc. Values are SQL LIKE patterns used to
// find matching tour titles.
const TOPIC_KEYWORDS: Record<string, string[]> = {
  cruis:   ['%cruise%', '%sail%', '%yacht%', '%boat%'],
  sail:    ['%sail%', '%yacht%', '%cruise%'],
  yacht:   ['%yacht%', '%sail%', '%charter%'],
  charter: ['%charter%', '%yacht%'],
  reef:    ['%reef%', '%snorkel%', '%dive%', '%cruise%'],
  div:     ['%dive%', '%snorkel%', '%reef%'],
  scuba:   ['%dive%', '%scuba%', '%snorkel%'],
  snorkel: ['%snorkel%', '%reef%', '%dive%'],
  whale:   ['%whale%', '%cruise%'],
  fish:    ['%fish%', '%charter%'],
  kayak:   ['%kayak%', '%paddle%'],
  rafting: ['%raft%'],
  surf:    ['%surf%'],
  hike:    ['%hike%', '%hiking%', '%trek%', '%walk%'],
  tour:    ['%tour%'],  // generic catch-all for city/destination pages
}

function pickKeywords(article: Article): string[] {
  const haystack = [
    article.title,
    ...(article.tags || []),
    ...(article.categories || []),
  ].join(' ').toLowerCase()
  const topics = Object.keys(TOPIC_KEYWORDS).filter(t => haystack.includes(t))
  if (!topics.length) return []
  const out = new Set<string>()
  topics.forEach(t => TOPIC_KEYWORDS[t].forEach(k => out.add(k)))
  return [...out]
}

async function getMatchingTours(state: string, keywords: string[]): Promise<Tour[]> {
  if (!keywords.length) return []
  try {
    const rows = await db<Tour[]>`
      SELECT slug, title, price_from, currency, cover_image, booking_url, rating, review_count, duration_label
      FROM tours
      WHERE state_code = ${state}
        AND active = true
        AND booking_url IS NOT NULL
        AND (LOWER(title) LIKE ANY(${keywords}::text[]))
      ORDER BY (COALESCE(review_count, 0) * COALESCE(rating::numeric, 0)) DESC NULLS LAST
      LIMIT 3
    `
    return rows
  } catch { return [] }
}

export async function BookableTours({ article }: { article: Article }) {
  const keywords = pickKeywords(article)
  if (!keywords.length) return null
  const tours = await getMatchingTours(article.state_code, keywords)
  if (!tours.length) return null

  return (
    <section style={{ marginTop: 32, padding: '20px 22px', background: 'var(--brand-light)', border: '1px solid #a7f3d0', borderRadius: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--brand-dark)', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 }}>
        Book a real cruise or tour
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {tours.map(t => (
          <a key={t.slug} href={t.booking_url!} rel="sponsored nofollow noopener" target="_blank"
             style={{ display: 'flex', gap: 14, padding: 14, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none', color: '#111827' }}>
            {t.cover_image && (
              <img src={t.cover_image} alt="" loading="lazy"
                   style={{ width: 110, height: 110, objectFit: 'cover' as const, borderRadius: 8, flexShrink: 0 }}/>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginBottom: 6 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                {t.duration_label}
                {t.rating ? `${t.duration_label ? ' · ' : ''}★${Number(t.rating).toFixed(1)}${t.review_count ? ` (${t.review_count})` : ''}` : ''}
              </div>
              {t.price_from && (
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                  From {t.currency || 'AUD'} ${Math.round(Number(t.price_from))} →
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 10, fontStyle: 'italic' as const }}>
        Affiliate links via Viator — we may earn a small commission when you book, at no cost to you.
      </div>
    </section>
  )
}
