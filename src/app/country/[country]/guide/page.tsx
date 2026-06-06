import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import {
  C, slugify, resolveCountry, fetchCountryData, fetchCountryGuide, mergeGuideCopy, isoForName,
  TourCard, CountryFlag,
} from '@/app/admin/mockups/country-guide-shared'

// Pre-build only countries that have data — everything else in the ISO set
// falls through to ISR on first hit (dynamicParams default true). This keeps
// build-time DB pressure bounded while still making every country reachable.
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  // All countries render via ISR on first request rather than at build time.
  // Pre-building 40+ pages in parallel saturated pgbouncer and timed out (each
  // page fans out to 8 live DB queries). Runtime ISR is fine — first visit
  // renders, then cached for 24h (`revalidate = 86400`), and the sitemap makes
  // them all discoverable to Googlebot.
  return []
}

interface Props {
  params: Promise<{ country: string }>
}

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'cities',      label: 'Cities' },
  { id: 'attractions', label: 'Attractions' },
  { id: 'tours',       label: 'Tours' },
  { id: 'articles',    label: 'Articles' },
] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params
  const resolved = await resolveCountry(country)
  if (!resolved) return { title: 'Country not found · BugBitten' }
  const { name } = resolved
  const url = `https://bugbitten.com/country/${country}/guide`
  const title = `${name} Travel Guide — Tours, Cities & Traveller Reviews | BugBitten`
  const description = `The complete travel guide to ${name}: live tours, GPS-verified reviews, city search, must-see highlights, and practical travel tips from real backpackers on BugBitten.`
  return {
    title,
    description,
    keywords: [
      `${name} travel`,
      `${name} travel guide`,
      `${name} tours`,
      `${name} cities`,
      `${name} attractions`,
      `backpacking ${name}`,
      `visit ${name}`,
    ],
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: 'BugBitten',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CountryGuidePage({ params }: Props) {
  const { country } = await params
  const resolved = await resolveCountry(country)
  if (!resolved) notFound()
  const { name, code } = resolved
  const iso = code || isoForName(name)
  const [data, guideRow] = await Promise.all([
    fetchCountryData(name),
    fetchCountryGuide(country),
  ])
  const copy = mergeGuideCopy(name, guideRow)

  const tabCounts: Record<string, number> = {
    overview: 0,
    cities: data.allCities.length,
    attractions: data.placeTotal,
    tours: data.toursTotal,
    articles: data.blogPosts.length,
  }

  const touristLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name,
    description: `Travel guide to ${name} — tours, cities, attractions and traveller reviews on BugBitten.`,
    url: `https://bugbitten.com/country/${country}/guide`,
    containedInPlace: { '@type': 'Country', name },
    isPartOf: { '@type': 'WebSite', name: 'BugBitten', url: 'https://bugbitten.com' },
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',   item: 'https://bugbitten.com/' },
      { '@type': 'ListItem', position: 2, name,           item: `https://bugbitten.com/country/${country}` },
      { '@type': 'ListItem', position: 3, name: 'Guide',  item: `https://bugbitten.com/country/${country}/guide` },
    ],
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: copy.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(touristLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Hero with background image + dark overlay */}
      <div style={{
        position: 'relative',
        backgroundImage: data.tours[0]?.cover_image
          ? `linear-gradient(180deg, rgba(15,23,42,0.40) 0%, rgba(15,23,42,0.78) 100%), url(${data.tours[0].cover_image})`
          : `linear-gradient(160deg, ${C.tealDeep} 0%, ${C.slate} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: `1px solid ${C.border}`,
        padding: '36px 20px 40px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 10, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>Home</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            <Link href={`/country/${country}`} style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>{name}</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            <span>Guide</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <CountryFlag code={iso} size={44} />
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, margin: 0, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              {name} Travel Guide
            </h1>
          </div>
          {copy.tagline && copy._source === 'ai' && (
            <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: 'clamp(15px, 2vw, 18px)', margin: '10px 0 0', fontStyle: 'italic', fontFamily: 'Georgia, serif', textShadow: '0 1px 6px rgba(0,0,0,0.5)', maxWidth: 720 }}>
              {copy.tagline}
            </p>
          )}
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, margin: '10px 0 0', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {data.toursTotal.toLocaleString()} live tours · {data.placeTotal.toLocaleString()} places · {data.allCities.length} cities
          </p>

          {/* Big city search */}
          <form action={`/places/city/${country}`} method="get" style={{ display: 'flex', gap: 8, marginTop: 22, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', borderRadius: 12 }}>
            <input list={`cities-${country}`} name="q" placeholder={`🔎  Search any city in ${name}…`}
              style={{ flex: 1, padding: '16px 20px', border: '2px solid #fff', borderRadius: '12px 0 0 12px', fontSize: 16, outline: 'none', fontWeight: 500, background: '#fff', color: C.text }} />
            <datalist id={`cities-${country}`}>{data.allCities.map(c => <option key={c} value={c} />)}</datalist>
            <button type="submit" style={{ padding: '16px 28px', background: C.teal, color: '#fff', border: '2px solid #fff', borderLeft: 'none', borderRadius: '0 12px 12px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Explore →</button>
          </form>
          {data.topCities.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginRight: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Popular:</span>
              {data.topCities.slice(0, 6).map(c => (
                <Link key={c.city} href={`/places/city/${country}/${slugify(c.city)}`} style={{ fontSize: 12, color: '#fff', textDecoration: 'none', fontWeight: 600, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)' }}>{c.city}</Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anchor nav (client-side scroll, no searchParams = ISR-safe) */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', overflowX: 'auto', padding: '0 20px' }}>
          {TABS.map(t => (
            <a key={t.id} href={`#${t.id}`} style={{
              padding: '14px 18px', fontSize: 14, fontWeight: 500, color: C.text,
              borderBottom: '3px solid transparent',
              textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center',
            }}>
              {t.label}
              {tabCounts[t.id] > 0 && <span style={{ fontSize: 11, background: '#f1f5f9', color: C.sub, padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>{tabCounts[t.id].toLocaleString()}</span>}
            </a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Overview */}
        <section id="overview" style={{ scrollMarginTop: 60 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 28 }} className="overview-grid">
            <style>{`@media (max-width: 880px) { .overview-grid { grid-template-columns: 1fr !important; } }`}</style>
            <div>
              {copy.intro.map((p, i) => (
                <p key={i} style={{ fontSize: 15, lineHeight: 1.65, margin: '0 0 14px', color: C.text }}>{p}</p>
              ))}
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '28px 0 14px' }}>Highlights</h2>
              <ol style={{ margin: 0, padding: '0 0 0 20px', color: C.text, fontSize: 14, lineHeight: 1.8 }}>
                {copy.highlights.map((h, i) => (
                  <li key={i}><strong>{h.name}</strong> — <span style={{ color: C.sub }}>{h.blurb}</span></li>
                ))}
              </ol>

              {data.tours.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Featured tours</h2>
                    <Link href={`#tours`} style={{ fontSize: 13, color: C.teal, fontWeight: 600, textDecoration: 'none' }}>View all {data.toursTotal.toLocaleString()} →</Link>
                  </div>
                  <style>{`
                    .featured-tours { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
                    @media (max-width: 640px) { .featured-tours { grid-template-columns: repeat(2, 1fr) !important; } }
                    @media (max-width: 420px) { .featured-tours { grid-template-columns: 1fr !important; } }
                  `}</style>
                  <div className="featured-tours">
                    {data.tours.slice(0, 9).map(t => <TourCard key={t.slug} t={t} />)}
                  </div>
                </div>
              )}
            </div>

            <aside>
              <div style={{ position: 'sticky', top: 70, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Quick facts</h3>
                {[
                  { label: 'Best time', val: copy.practicals.bestTime },
                  { label: 'Budget/day', val: copy.practicals.budget },
                  { label: 'Visa', val: copy.practicals.visa },
                  { label: 'Currency', val: copy.practicals.currency },
                  { label: 'Plug type', val: copy.practicals.plug },
                  { label: 'Safety', val: copy.practicals.safety },
                ].map((p, i, arr) => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: C.sub }}>{p.label}</span>
                    <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{p.val}</span>
                  </div>
                ))}
                {data.toursTotal > 0 && (
                  <div style={{ marginTop: 14, background: C.tealLight, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tours available</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.tealDeep, lineHeight: 1 }}>{data.toursTotal.toLocaleString()}</div>
                    <Link href={`#tours`} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: C.teal, fontWeight: 700, textDecoration: 'none' }}>Browse all →</Link>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section id="cities" style={{ marginTop: 48, scrollMarginTop: 60 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>All cities in {name}</h2>
            <p style={{ color: C.sub, fontSize: 14, margin: '0 0 18px' }}>{data.allCities.length} cities with traveller activity — sorted by place count.</p>
            {data.allCities.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {data.topCities.map((c: any) => (
                  <Link key={c.city} href={`/places/city/${country}/${slugify(c.city)}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{c.city}</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{c.c} places</div>
                    </div>
                  </Link>
                ))}
                {data.allCities.filter(c => !data.topCities.find(t => t.city === c)).map(c => (
                  <Link key={c} href={`/places/city/${country}/${slugify(c)}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{c}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: C.sub }}>
                No cities indexed for {name} yet — be the first traveller to add a review from here.
              </div>
            )}
        </section>

        <section id="attractions" style={{ marginTop: 48, scrollMarginTop: 60 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Top attractions in {name}</h2>
            <p style={{ color: C.sub, fontSize: 14, margin: '0 0 18px' }}>{data.placeTotal.toLocaleString()} indexed places — showing top 10 by reviews.</p>
            {data.topPlaces.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {data.topPlaces.map((p: any) => (
                  <Link key={p.slug} href={`/places/${p.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ height: 120, background: C.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.cover_image ? <img loading="lazy" src={p.cover_image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 38 }}>{p.emoji || '📍'}</span>}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{p.city} · {p.category}</div>
                        {p.bb_rating && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>★ {Number(p.bb_rating).toFixed(1)} ({p.bb_review_count || 0})</div>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: C.sub }}>
                No attractions indexed for {name} yet.
              </div>
            )}
        </section>

        <section id="tours" style={{ marginTop: 48, scrollMarginTop: 60 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, margin: '0 0 18px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tours in {name}</h2>
              <Link href={`/tours?country=${encodeURIComponent(name)}`} style={{ fontSize: 14, color: C.teal, fontWeight: 700, textDecoration: 'none' }}>Open full catalogue ({data.toursTotal.toLocaleString()}) →</Link>
            </div>
            {data.tours.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {data.tours.map(t => <TourCard key={t.slug} t={t} />)}
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: C.sub }}>
                No tours indexed for {name} yet — check back soon as we expand coverage.
              </div>
            )}
        </section>

        <section id="articles" style={{ marginTop: 48, scrollMarginTop: 60 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 18px' }}>Articles about {name}</h2>
            {data.blogPosts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {data.blogPosts.map(b => (
                  <Link key={b.slug} href={`/blog/${b.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', height: '100%' }}>
                      {b.featured_image && <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: '#f1f5f9' }}><img src={b.featured_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{b.title}</div>
                        {b.excerpt && <div style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{String(b.excerpt).slice(0, 140)}…</div>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: C.sub }}>
                No articles published about {name} yet.
              </div>
            )}
        </section>

        {/* Related countries (AI-suggested, internal linking) */}
        {copy._source === 'ai' && copy.relatedCountries && copy.relatedCountries.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px' }}>You might also like</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {copy.relatedCountries.map(nm => {
                const rslug = slugify(nm)
                if (!rslug) return null
                return (
                  <Link key={nm} href={`/country/${rslug}/guide`} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 16px',
                    fontSize: 14, color: C.text, fontWeight: 600, textDecoration: 'none',
                  }}>{nm} →</Link>
                )
              })}
            </div>
          </section>
        )}

        {/* FAQ accordion (always on, for FAQPage schema) */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px' }}>Everything you need to know</h2>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {copy.faq.map((f, i) => (
              <details key={i} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <summary style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 15, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {f.q}
                  <span style={{ color: C.teal, fontSize: 20, fontWeight: 400 }}>+</span>
                </summary>
                <div style={{ padding: '0 20px 18px', color: C.sub, fontSize: 14, lineHeight: 1.6 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
