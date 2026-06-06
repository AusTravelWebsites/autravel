import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  C, slugify, resolveCountry, fetchCountryData, isoForName,
  MockupBanner, TourCard, CountryFlag, stubGuideCopy,
} from '../../country-guide-shared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

interface Props {
  params: Promise<{ country: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'cities',      label: 'Cities' },
  { id: 'attractions', label: 'Attractions' },
  { id: 'tours',       label: 'Tours' },
  { id: 'articles',    label: 'Articles' },
] as const

export default async function MockupB({ params, searchParams }: Props) {
  const { country } = await params
  const sp = await searchParams
  const tab = (TABS.find(t => t.id === sp.tab)?.id || 'overview') as typeof TABS[number]['id']
  const resolved = await resolveCountry(country)
  if (!resolved) notFound()
  const { name, code } = resolved
  const iso = code || isoForName(name)
  const data = await fetchCountryData(name)
  const stub = stubGuideCopy(name)

  const tabCounts: Record<string, number> = {
    overview: 0,
    cities: data.allCities.length,
    attractions: data.placeTotal,
    tours: data.toursTotal,
    articles: data.blogPosts.length,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <MockupBanner which="b" country={country} />

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
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, margin: '6px 0 0', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
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

      {/* Tabs */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 44, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', overflowX: 'auto', padding: '0 20px' }}>
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <Link key={t.id} href={`?tab=${t.id}`} style={{
                padding: '14px 18px', fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? C.teal : C.text,
                borderBottom: active ? `3px solid ${C.teal}` : '3px solid transparent',
                textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center',
              }}>
                {t.label}
                {tabCounts[t.id] > 0 && <span style={{ fontSize: 11, background: active ? C.tealLight : '#f1f5f9', color: active ? C.teal : C.sub, padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>{tabCounts[t.id].toLocaleString()}</span>}
              </Link>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 28 }} className="overview-grid">
            <style>{`@media (max-width: 880px) { .overview-grid { grid-template-columns: 1fr !important; } }`}</style>
            {/* LEFT */}
            <div>
              {stub.intro.map((p, i) => (
                <p key={i} style={{ fontSize: 15, lineHeight: 1.65, margin: '0 0 14px', color: C.text }}>{p}</p>
              ))}
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '28px 0 14px' }}>Highlights</h2>
              <ol style={{ margin: 0, padding: '0 0 0 20px', color: C.text, fontSize: 14, lineHeight: 1.8 }}>
                {stub.highlights.map((h, i) => (
                  <li key={i}><strong>{h.name}</strong> — <span style={{ color: C.sub }}>{h.blurb}</span></li>
                ))}
              </ol>

              {data.tours.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Featured tours</h2>
                    <Link href={`?tab=tours`} style={{ fontSize: 13, color: C.teal, fontWeight: 600, textDecoration: 'none' }}>View all {data.toursTotal.toLocaleString()} →</Link>
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

              <div style={{ background:'#fef3c7', border:'1px dashed #f59e0b', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginTop:24 }}>
                Note — intro + highlights stubbed; real copy comes from Claude-generated <code>country_guides</code> in Phase 2.
              </div>
            </div>

            {/* RIGHT — sticky quick facts */}
            <aside>
              <div style={{ position: 'sticky', top: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Quick facts</h3>
                {[
                  { label: 'Best time', val: stub.practicals.bestTime },
                  { label: 'Budget/day', val: stub.practicals.budget },
                  { label: 'Visa', val: stub.practicals.visa },
                  { label: 'Currency', val: stub.practicals.currency },
                  { label: 'Plug type', val: stub.practicals.plug },
                  { label: 'Safety', val: stub.practicals.safety },
                ].map((p, i, arr) => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: C.sub }}>{p.label}</span>
                    <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{p.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, background: C.tealLight, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tours available</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.tealDeep, lineHeight: 1 }}>{data.toursTotal.toLocaleString()}</div>
                  <Link href={`?tab=tours`} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: C.teal, fontWeight: 700, textDecoration: 'none' }}>Browse all →</Link>
                </div>
              </div>
            </aside>
          </div>
        )}

        {tab === 'cities' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>All cities in {name}</h2>
            <p style={{ color: C.sub, fontSize: 14, margin: '0 0 18px' }}>{data.allCities.length} cities with traveller activity — sorted by place count.</p>
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
          </div>
        )}

        {tab === 'attractions' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Top attractions in {name}</h2>
            <p style={{ color: C.sub, fontSize: 14, margin: '0 0 18px' }}>{data.placeTotal.toLocaleString()} indexed places — showing top 10 by reviews.</p>
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
          </div>
        )}

        {tab === 'tours' && (
          <div>
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
                No Viator tours indexed for {name} yet.
              </div>
            )}
          </div>
        )}

        {tab === 'articles' && (
          <div>
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
                No published posts tagged <code>country = {name}</code>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
