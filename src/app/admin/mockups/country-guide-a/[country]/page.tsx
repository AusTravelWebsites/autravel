import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  C, slugify, resolveCountry, fetchCountryData, isoForName,
  MockupBanner, TourCard, CountryFlag, stubGuideCopy,
} from '../../country-guide-shared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

interface Props { params: Promise<{ country: string }> }

export default async function MockupA({ params }: Props) {
  const { country } = await params
  const resolved = await resolveCountry(country)
  if (!resolved) notFound()
  const { name, code } = resolved
  const iso = code || isoForName(name)
  const data = await fetchCountryData(name)
  const stub = stubGuideCopy(name)

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: stub.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <MockupBanner which="a" country={country} />

      {/* Hero */}
      <div style={{ background: `linear-gradient(160deg, ${C.tealDeep} 0%, ${C.teal} 100%)`, padding: '48px 20px 56px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Home</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <Link href={`/country/${country}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>{name}</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <span>Travel guide</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <CountryFlag code={iso} size={56} />
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.1 }}>
                {name} Travel Guide
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', margin: '8px 0 0', fontSize: 16, fontStyle: 'italic' }}>{stub.tagline}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 22, flexWrap: 'wrap', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
            <div><strong style={{ color: '#fff', fontSize: 18 }}>{data.placeTotal.toLocaleString()}</strong> places</div>
            <div><strong style={{ color: '#fff', fontSize: 18 }}>{data.toursTotal.toLocaleString()}</strong> live tours</div>
            <div><strong style={{ color: '#fff', fontSize: 18 }}>{data.allCities.length}</strong> cities covered</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>

        {/* Editorial intro */}
        <section style={{ marginBottom: 44 }}>
          {stub.intro.map((p, i) => (
            <p key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.7, color: C.text, margin: '0 0 16px' }}>{p}</p>
          ))}
          <div style={{ background:'#fef3c7', border:'1px dashed #f59e0b', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginTop:4 }}>
            Note — the intro, highlights list and FAQ will be Claude-generated per country in Phase 2 and stored in a <code>country_guides</code> DB table. This is placeholder copy.
          </div>
        </section>

        {/* City search */}
        <section style={{ marginBottom: 44 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>Explore cities in {name}</h2>
          <p style={{ color: C.sub, fontSize: 14, margin: '0 0 14px' }}>Search any city — we'll take you straight to the guide for that spot.</p>
          <form action={`/places/city/${country}`} method="get" style={{ display: 'flex', gap: 8 }}>
            <input list={`cities-${country}`} name="q" placeholder={`Start typing a city in ${name}…`}
              style={{ flex: 1, padding: '14px 18px', border: `2px solid ${C.border}`, borderRadius: 12, fontSize: 16, outline: 'none', background: '#fff' }} />
            <datalist id={`cities-${country}`}>
              {data.allCities.map(city => <option key={city} value={city} />)}
            </datalist>
            <button type="submit" style={{ padding: '14px 24px', background: C.teal, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Go →</button>
          </form>
        </section>

        {/* Top destinations */}
        {data.topCities.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Top destinations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {data.topCities.slice(0, 6).map((c: any, i: number) => (
                <Link key={c.city} href={`/places/city/${country}/${slugify(c.city)}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${['#0d9488','#0f766e','#14b8a6','#0891b2','#059669','#f59e0b'][i%6]} 0%, ${['#0f766e','#134e4a','#0d9488','#0e7490','#047857','#d97706'][i%6]} 100%)`,
                    borderRadius: 12, padding: '24px 18px', minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff',
                  }}>
                    <div style={{ fontSize: 28, opacity: 0.3, fontFamily: 'Georgia, serif', fontWeight: 800 }}>0{i+1}</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{c.city}</div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{c.c} places</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Must-see highlights */}
        <section style={{ marginBottom: 44 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Must-see highlights</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stub.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 18, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.tealLight, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0, fontFamily: 'Georgia, serif' }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 3 }}>{h.name}</div>
                  <div style={{ color: C.sub, fontSize: 14, lineHeight: 1.55 }}>{h.blurb}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tours in country */}
        {data.tours.length > 0 ? (
          <section style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 18px', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: 0 }}>Tours in {name}</h2>
              <Link href={`/tours?country=${encodeURIComponent(name)}`} style={{ color: C.teal, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>See all {data.toursTotal.toLocaleString()} tours →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {data.tours.map(t => <TourCard key={t.slug} t={t} />)}
            </div>
          </section>
        ) : (
          <section style={{ marginBottom: 44, background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: C.sub }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>No tours indexed for {name} yet</div>
            <div style={{ fontSize: 13 }}>Tours import for this country is queued. This section will populate from the live <code>tours</code> table once available.</div>
          </section>
        )}

        {/* Everything you need to know */}
        <section style={{ marginBottom: 44 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Everything you need to know</h2>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {stub.faq.map((f, i) => (
              <details key={i} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <summary style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 15, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {f.q}
                  <span style={{ color: C.teal, fontSize: 20, fontWeight: 400 }}>+</span>
                </summary>
                <div style={{ padding: '0 20px 18px', color: C.sub, fontSize: 14, lineHeight: 1.6 }}>{f.a}</div>
              </details>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Best time', val: stub.practicals.bestTime },
              { label: 'Budget/day', val: stub.practicals.budget },
              { label: 'Visa', val: stub.practicals.visa },
              { label: 'Currency', val: stub.practicals.currency },
              { label: 'Plug', val: stub.practicals.plug },
              { label: 'Safety', val: stub.practicals.safety },
            ].map(p => (
              <div key={p.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{p.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{p.val}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What travellers say */}
        {data.reviews.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>What travellers say</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {data.reviews.map(r => (
                <Link key={r.id} href={`/places/${r.place_slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, height: '100%' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
                      <span style={{ color: C.amber, fontSize: 14 }}>{'★'.repeat(Math.round(Number(r.overall_rating) || 0))}</span>
                      {r.gps_verified && <span style={{ background: C.tealLight, color: C.teal, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>GPS verified</span>}
                    </div>
                    <div style={{ color: C.text, fontSize: 14, lineHeight: 1.55, fontStyle: 'italic', marginBottom: 10 }}>"{String(r.body).slice(0, 180)}{String(r.body).length > 180 ? '…' : ''}"</div>
                    <div style={{ fontSize: 12, color: C.sub }}>— on <strong style={{ color: C.text }}>{r.place_name}</strong>{r.city ? `, ${r.city}` : ''}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent journals + blog posts */}
        {data.blogPosts.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Stories from {name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {data.blogPosts.map(b => (
                <Link key={b.slug} href={`/blog/${b.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', height: '100%' }}>
                    {b.featured_image && <div style={{ aspectRatio: '16/9', background: '#f1f5f9', overflow: 'hidden' }}><img src={b.featured_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>{b.title}</div>
                      {b.excerpt && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{String(b.excerpt).slice(0, 140)}…</div>}
                      {b.reading_minutes && <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>{b.reading_minutes} min read</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
