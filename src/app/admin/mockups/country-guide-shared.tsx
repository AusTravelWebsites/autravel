import Link from 'next/link'
import { db } from '@/lib/db'
import { flagFor, COUNTRIES } from '@/lib/countries'

export const C = {
  bg: '#f3f4f6', card: '#fff', border: '#e5e7eb',
  text: '#111827', sub: '#6b7280',
  teal: 'var(--brand)', tealLight: 'var(--brand-light)', tealDeep: 'var(--brand-dark)',
  amber: '#f59e0b', slate: '#0f172a',
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
}

export async function resolveCountry(slug: string): Promise<{ name: string; code: string | null } | null> {
  try {
    const rows = await db`SELECT DISTINCT country, country_code FROM places WHERE country IS NOT NULL AND country <> ''`
    for (const r of rows as any[]) if (slugify(r.country) === slug) return { name: r.country, code: r.country_code || null }
    const tourRows = await db`SELECT DISTINCT country, country_code FROM tours WHERE country IS NOT NULL AND country <> ''`
    for (const r of tourRows as any[]) if (slugify(r.country) === slug) return { name: r.country, code: r.country_code || null }
  } catch {}
  // Fallback to the ISO catalogue so every country on earth resolves,
  // even when there's no places/tours data indexed yet.
  for (const [code, { name }] of Object.entries(COUNTRIES)) {
    if (slugify(name) === slug) return { name, code }
  }
  return null
}

export async function fetchCountryData(name: string) {
  // Fast probe — if the country has no data anywhere, skip the 8-query fan-out.
  try {
    const hit: any[] = await db`
      SELECT 1 FROM places WHERE country = ${name} LIMIT 1
      UNION ALL
      SELECT 1 FROM tours  WHERE country = ${name} LIMIT 1
    `
    if (hit.length === 0) {
      return { tours: [], toursTotal: 0, topCities: [], topPlaces: [], placeTotal: 0, reviews: [], blogPosts: [], allCities: [] }
    }
  } catch {}
  const [tours, toursTotal, topCities, topPlaces, placeTotal, reviews, blogPosts, allCities] = await Promise.all([
    db`SELECT slug, title, city, cover_image, rating, review_count, duration_label, price_from, currency
       FROM tours WHERE active = true AND country = ${name}
       ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 9`.catch(() => []),
    db`SELECT COUNT(*)::int AS c FROM tours WHERE active = true AND country = ${name}`.then(r => Number((r[0] as any)?.c || 0)).catch(() => 0),
    db`SELECT city, COUNT(*)::int AS c FROM places WHERE country = ${name} AND city IS NOT NULL AND city <> ''
       GROUP BY city ORDER BY c DESC LIMIT 12`.catch(() => []),
    db`SELECT slug, name, city, category, emoji, cover_image, bb_rating, bb_review_count
       FROM places WHERE country = ${name}
       ORDER BY bb_review_count DESC NULLS LAST, bb_rating DESC NULLS LAST LIMIT 10`.catch(() => []),
    db`SELECT COUNT(*)::int AS c FROM places WHERE country = ${name}`.then(r => Number((r[0] as any)?.c || 0)).catch(() => 0),
    db`SELECT r.id, r.body, r.overall_rating, r.gps_verified, r.created_at, p.name AS place_name, p.city, p.slug AS place_slug
       FROM reviews r JOIN places p ON p.id = r.place_id
       WHERE p.country = ${name} AND r.body IS NOT NULL AND length(r.body) > 60
       ORDER BY r.gps_verified DESC NULLS LAST, r.like_count DESC NULLS LAST, r.created_at DESC LIMIT 3`.catch(() => []),
    db`SELECT slug, title, excerpt, featured_image, published_at, reading_minutes
       FROM blog_posts WHERE country = ${name} AND status = 'published'
       ORDER BY published_at DESC NULLS LAST LIMIT 4`.catch(() => []),
    db`SELECT DISTINCT city FROM places WHERE country = ${name} AND city IS NOT NULL AND city <> '' ORDER BY city`.catch(() => []),
  ])
  return {
    tours: tours as any[], toursTotal,
    topCities: topCities as any[],
    topPlaces: topPlaces as any[], placeTotal,
    reviews: reviews as any[],
    blogPosts: blogPosts as any[],
    allCities: (allCities as any[]).map(r => r.city),
  }
}

export function isoForName(name: string): string | null {
  const map: Record<string, string> = {
    'Peru':'PE','Indonesia':'ID','Australia':'AU','France':'FR','Japan':'JP','Thailand':'TH','Vietnam':'VN','India':'IN',
    'Italy':'IT','Spain':'ES','United States':'US','USA':'US','Mexico':'MX','Brazil':'BR','Argentina':'AR','Chile':'CL',
    'Bolivia':'BO','Ecuador':'EC','Colombia':'CO','Morocco':'MA','Egypt':'EG','South Africa':'ZA','Kenya':'KE','Tanzania':'TZ',
    'Portugal':'PT','Germany':'DE','Greece':'GR','Turkey':'TR','Netherlands':'NL','United Kingdom':'GB','Ireland':'IE',
    'New Zealand':'NZ','Philippines':'PH','Malaysia':'MY','Singapore':'SG','Cambodia':'KH','Laos':'LA','Nepal':'NP',
    'Sri Lanka':'LK','Maldives':'MV','China':'CN','South Korea':'KR',
  }
  return map[name] || null
}

export function MockupBanner({ which, country }: { which: 'a'|'b'|'c'; country: string }) {
  const variants = [
    { id:'a', label:'A · Classic Magazine', href:`/admin/mockups/country-guide-a/${country}` },
    { id:'b', label:'B · Search-First',     href:`/admin/mockups/country-guide-b/${country}` },
    { id:'c', label:'C · Editorial Long-Form', href:`/admin/mockups/country-guide-c/${country}` },
  ]
  const testers = ['australia','indonesia','france','peru']
  return (
    <div style={{ position:'sticky', top:0, zIndex:100, background:'#0f172a', color:'#fff', padding:'10px 16px', borderBottom:'2px solid #4ade80', fontSize:13 }}>
      <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
        <strong style={{ color:'#4ade80' }}>MOCKUP {which.toUpperCase()}</strong>
        <span style={{ opacity:0.6 }}>Compare:</span>
        {variants.map(v => (
          <Link key={v.id} href={v.href} style={{
            color: v.id === which ? '#4ade80' : '#fff',
            fontWeight: v.id === which ? 700 : 400,
            textDecoration: v.id === which ? 'none' : 'underline',
          }}>{v.label}</Link>
        ))}
        <span style={{ opacity:0.4, marginLeft:'auto' }}>Test country:</span>
        {testers.map(t => (
          <Link key={t} href={`/admin/mockups/country-guide-${which}/${t}`} style={{ color: country===t ? '#4ade80' : 'rgba(255,255,255,0.7)', textDecoration:'none', textTransform:'capitalize', fontWeight: country===t ? 700 : 400 }}>{t}</Link>
        ))}
      </div>
    </div>
  )
}

export function TourCard({ t }: { t: any }) {
  return (
    <Link href={`/tours/${t.slug}`} style={{ textDecoration:'none' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' as const, height:'100%' }}>
        <div style={{ position:'relative' as const, aspectRatio:'4/3', background:'#f1f5f9', overflow:'hidden' as const }}>
          {t.cover_image
            ? <img loading="lazy" decoding="async" src={t.cover_image} alt={t.title} style={{ width:'100%', height:'100%', objectFit:'cover' as const }} />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>🌏</div>}
          {t.rating && (
            <div style={{ position:'absolute' as const, top:8, left:8, background:'rgba(0,0,0,0.72)', color:'#fff', borderRadius:999, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
              ★ {Number(t.rating).toFixed(1)}{t.review_count ? ` (${Number(t.review_count).toLocaleString()})` : ''}
            </div>
          )}
        </div>
        <div style={{ padding:'10px 12px 12px' }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, lineHeight:1.3, overflow:'hidden' as const, display:'-webkit-box', WebkitLineClamp:2 as any, WebkitBoxOrient:'vertical' as any }}>
            {t.title}
          </div>
          <div style={{ fontSize:12, color:C.sub, marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
            <span>{t.city || t.duration_label || ''}</span>
            {t.price_from && <span style={{ color:C.teal, fontWeight:700 }}>from {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function CountryFlag({ code, size = 40 }: { code: string | null; size?: number }) {
  return <span style={{ fontSize: size, lineHeight:1 }}>{code ? flagFor(code) : '🌐'}</span>
}

export interface CountryGuide {
  slug: string
  name: string
  country_code: string | null
  tagline: string | null
  intro_md: string | null
  highlights: { name: string; blurb: string }[] | null
  faq: { q: string; a: string }[] | null
  best_time: string | null
  budget_per_day: string | null
  visa_summary: string | null
  safety_note: string | null
  currency: string | null
  plug_type: string | null
  languages: string[] | null
  related_countries: string[] | null
  generated_at: string
  model_used: string | null
}

export async function fetchCountryGuide(slug: string): Promise<CountryGuide | null> {
  try {
    const rows: any[] = await db`SELECT * FROM country_guides WHERE slug = ${slug} LIMIT 1`
    return (rows[0] as CountryGuide) || null
  } catch {
    return null
  }
}

// Merge a Claude-generated row with the stub fallback so every field has
// something to render even if generation hasn't run for a country yet.
export function mergeGuideCopy(name: string, g: CountryGuide | null) {
  const stub = stubGuideCopy(name)
  if (!g) return { ...stub, _source: 'stub' as const }
  const intro = g.intro_md ? g.intro_md.split(/\n{2,}/).map(s => s.trim()).filter(Boolean) : stub.intro
  return {
    tagline: g.tagline || stub.tagline,
    intro,
    highlights: (Array.isArray(g.highlights) && g.highlights.length ? g.highlights : stub.highlights) as { name: string; blurb: string }[],
    faq: (Array.isArray(g.faq) && g.faq.length ? g.faq : stub.faq) as { q: string; a: string }[],
    practicals: {
      bestTime: g.best_time || stub.practicals.bestTime,
      budget:   g.budget_per_day || stub.practicals.budget,
      visa:     g.visa_summary || stub.practicals.visa,
      currency: g.currency || stub.practicals.currency,
      plug:     g.plug_type || stub.practicals.plug,
      safety:   g.safety_note || stub.practicals.safety,
    },
    languages: g.languages || [],
    relatedCountries: g.related_countries || [],
    _source: 'ai' as const,
  }
}

// Stub copy used as a fallback when a country has no country_guides row yet.
export function stubGuideCopy(name: string) {
  return {
    tagline: `The ultimate BugBitten traveller's guide to ${name}`,
    intro: [
      `${name} is a destination that rewards the curious. From buzzing capital streets to remote mountain passes, every region has its own rhythm — and our community of GPS-verified travellers has walked most of them.`,
      `This guide pulls together everything you need: the cities worth your time, the tours that come back with 5-star reviews, the neighbourhoods locals send their friends to, and the practical info that stops the little things from tripping you up.`,
      `Search for any city below, or scroll on for highlights, tours and traveller reviews that only exist because someone stood in the right spot with GPS on.`,
    ],
    highlights: [
      { name: 'Iconic landmark', blurb: 'The view everyone comes home talking about — best visited at sunrise before the crowds.' },
      { name: 'Cultural quarter', blurb: 'Markets, museums and the food that tells the country\'s story in one bite.' },
      { name: 'Natural wonder', blurb: 'A landscape that puts your camera to shame. Go slow, stay longer than you planned.' },
      { name: 'Coastal escape', blurb: 'Beaches with enough space to find your own patch of sand, and a town nearby with good food.' },
      { name: 'Off-the-map town', blurb: 'Where you end up when you ditch the bucket list and just follow the road.' },
      { name: 'Adventure base', blurb: 'Outdoor operators run most of their tours from here — stay a couple of nights.' },
    ],
    faq: [
      { q: `When is the best time to visit ${name}?`, a: `Shoulder seasons (spring and autumn) hit the sweet spot: fewer crowds, better prices, and weather that usually cooperates. Dry season peaks can be crowded.` },
      { q: `Do I need a visa for ${name}?`, a: `Most Western passports get 30–90 days visa-free or visa-on-arrival. Always double-check your nationality's rules on the official government site before booking.` },
      { q: `How much does a week in ${name} cost?`, a: `Backpacker: ~$40/day. Mid-range: ~$90/day. Comfortable: $180+/day. Tours, intercity transport, and tips add on top.` },
      { q: `Is ${name} safe for solo travellers?`, a: `Generally yes — our GPS-verified reviews skew positive. Standard precautions apply: watch bags in crowds, use reputable taxis, keep someone updated on your plans.` },
      { q: `What should I pack?`, a: `Layers (weather can swing), a sturdy daypack, a power adapter, sunblock, and one item that feels like home. Everything else is buyable on the ground.` },
    ],
    practicals: {
      bestTime: 'Apr–Jun & Sep–Nov',
      budget: '$40–180 / day',
      visa: 'Visa-free or on-arrival for most',
      currency: 'Varies — check locally',
      plug: 'Type A / C / G depending on region',
      safety: 'Generally safe, usual precautions',
    },
  }
}
