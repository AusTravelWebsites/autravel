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

export default async function MockupC({ params }: Props) {
  const { country } = await params
  const resolved = await resolveCountry(country)
  if (!resolved) notFound()
  const { name, code } = resolved
  const iso = code || isoForName(name)
  const data = await fetchCountryData(name)
  const stub = stubGuideCopy(name)

  // Group tours by city for "tours by region" pattern
  const toursByCity = new Map<string, any[]>()
  for (const t of data.tours) {
    const key = t.city || 'Other'
    if (!toursByCity.has(key)) toursByCity.set(key, [])
    toursByCity.get(key)!.push(t)
  }

  // Pick top 10 things to see from topPlaces + highlights
  const topTen = [
    ...data.topPlaces.slice(0, 10),
    ...stub.highlights.slice(0, Math.max(0, 10 - data.topPlaces.length)).map((h, i) => ({
      slug: null, name: h.name, blurb: h.blurb, city: '', category: 'highlight', stub: true,
      cover_image: null, emoji: '✨',
    })),
  ].slice(0, 10) as any[]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <MockupBanner which="c" country={country} />

      {/* Full-bleed hero */}
      <div style={{
        position: 'relative', minHeight: 440,
        backgroundImage: data.tours[0]?.cover_image ? `linear-gradient(180deg, rgba(15,23,42,0.25) 0%, rgba(15,23,42,0.75) 100%), url(${data.tours[0].cover_image})` : `linear-gradient(160deg, ${C.tealDeep}, ${C.slate})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px 48px', color: '#fff', width: '100%' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>BugBitten Travel Guide</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <CountryFlag code={iso} size={48} />
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(40px, 7vw, 84px)', fontWeight: 800, margin: 0, lineHeight: 0.95 }}>{name}</h1>
          </div>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(18px, 2.2vw, 24px)', fontStyle: 'italic', color: 'rgba(255,255,255,0.95)', margin: '18px 0 0', maxWidth: 700, lineHeight: 1.45 }}>
            {stub.tagline}. {data.toursTotal.toLocaleString()} live tours, {data.placeTotal.toLocaleString()} GPS-verified places, written by a community of travellers who've actually been.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px 60px' }}>

        {/* Long-form intro */}
        <section style={{ marginBottom: 56, maxWidth: 760 }}>
          {stub.intro.map((p, i) => (
            <p key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.75, color: C.text, margin: '0 0 18px', fontWeight: i === 0 ? 500 : 400 }}>
              {i === 0 && <span style={{ float: 'left', fontSize: 62, lineHeight: 0.85, marginRight: 10, marginTop: 6, fontFamily: 'Georgia, serif', fontWeight: 800, color: C.teal }}>{p[0]}</span>}
              {i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </section>

        {/* Where to go — city search + list */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ borderTop: `3px solid ${C.slate}`, paddingTop: 8, marginBottom: 18 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.sub, fontWeight: 700 }}>Chapter One</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 800, margin: '4px 0 0' }}>Where to go</h2>
          </div>

          <form action={`/places/city/${country}`} method="get" style={{ display: 'flex', gap: 8, marginBottom: 18, maxWidth: 560 }}>
            <input list={`cities-${country}`} name="q" placeholder={`Search ${data.allCities.length} cities in ${name}…`}
              style={{ flex: 1, padding: '13px 18px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 15, outline: 'none', background: '#fff' }} />
            <datalist id={`cities-${country}`}>{data.allCities.map(c => <option key={c} value={c} />)}</datalist>
            <button type="submit" style={{ padding: '13px 22px', background: C.slate, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Go →</button>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {data.topCities.map((c: any, i: number) => (
              <Link key={c.city} href={`/places/city/${country}/${slugify(c.city)}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{c.city}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>{c.c} places</div>
                  </div>
                  <div style={{ color: C.teal, fontSize: 18 }}>→</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ background:'#fef3c7', border:'1px dashed #f59e0b', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginTop:14 }}>
            The final version will have an interactive map (Leaflet) alongside this city list — click a city, the map pans to it. Not built into the mockup yet.
          </div>
        </section>

        {/* Top 10 things to see */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ borderTop: `3px solid ${C.slate}`, paddingTop: 8, marginBottom: 26 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.sub, fontWeight: 700 }}>Chapter Two</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 800, margin: '4px 0 0' }}>Top 10 things to see</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {topTen.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 160px', gap: 20, alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 24 }} className="top10-row">
                <style>{`@media (max-width: 720px) { .top10-row { grid-template-columns: 60px 1fr !important; } .top10-row > .top10-image { display: none !important; } }`}</style>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 64, fontWeight: 800, color: C.teal, lineHeight: 1, textAlign: 'right' }}>{i + 1}</div>
                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.55 }}>
                    {p.blurb || (p.city ? `${p.city} · ${p.category}` : p.category)}
                  </div>
                  {p.slug && <Link href={`/places/${p.slug}`} style={{ fontSize: 12, color: C.teal, fontWeight: 700, textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>Read reviews →</Link>}
                </div>
                <div className="top10-image" style={{ aspectRatio: '4/3', background: C.tealLight, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.cover_image ? <img src={p.cover_image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 38 }}>{p.emoji || '✨'}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tours by region */}
        {toursByCity.size > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div style={{ borderTop: `3px solid ${C.slate}`, paddingTop: 8, marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.sub, fontWeight: 700 }}>Chapter Three</div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 800, margin: '4px 0 0' }}>Tours by region</h2>
              </div>
              <Link href={`/tours?country=${encodeURIComponent(name)}`} style={{ color: C.teal, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>See all {data.toursTotal.toLocaleString()} tours →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              {Array.from(toursByCity.entries()).slice(0, 4).map(([city, tours]) => (
                <div key={city}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{city} <span style={{ color: C.sub, fontWeight: 400, fontSize: 14 }}>({tours.length})</span></h3>
                    <Link href={`/tours?country=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`} style={{ fontSize: 12, color: C.teal, fontWeight: 600, textDecoration: 'none' }}>More from {city} →</Link>
                  </div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                    {tours.map(t => (
                      <div key={t.slug} style={{ flex: '0 0 240px' }}><TourCard t={t} /></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pull-quote reviews */}
        {data.reviews.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div style={{ borderTop: `3px solid ${C.slate}`, paddingTop: 8, marginBottom: 22 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.sub, fontWeight: 700 }}>Voices</div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 800, margin: '4px 0 0' }}>From the traveller community</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {data.reviews.map(r => (
                <figure key={r.id} style={{ margin: 0, borderLeft: `4px solid ${C.teal}`, paddingLeft: 22 }}>
                  <blockquote style={{ fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1.55, fontStyle: 'italic', color: C.text, margin: 0 }}>
                    "{String(r.body).slice(0, 260)}{String(r.body).length > 260 ? '…' : ''}"
                  </blockquote>
                  <figcaption style={{ fontSize: 13, color: C.sub, marginTop: 10 }}>
                    — on <Link href={`/places/${r.place_slug}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none' }}>{r.place_name}</Link>{r.city ? `, ${r.city}` : ''}
                    {r.gps_verified && <span style={{ marginLeft: 10, background: C.tealLight, color: C.teal, padding: '2px 9px', borderRadius: 999, fontWeight: 700, fontSize: 11 }}>GPS verified</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Practical info strip */}
        <section style={{ marginBottom: 40, background: C.slate, borderRadius: 14, padding: '28px 24px', color: '#fff' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>Know before you go</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18 }}>
            {[
              { label: 'Best time', val: stub.practicals.bestTime, icon: '🌤️' },
              { label: 'Budget/day', val: stub.practicals.budget, icon: '💰' },
              { label: 'Visa', val: stub.practicals.visa, icon: '📘' },
              { label: 'Currency', val: stub.practicals.currency, icon: '💱' },
              { label: 'Plug', val: stub.practicals.plug, icon: '🔌' },
              { label: 'Safety', val: stub.practicals.safety, icon: '🛡️' },
            ].map(p => (
              <div key={p.label}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{p.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: '#fff' }}>{p.val}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Related countries */}
        <section>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 14px' }}>You might also like</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(name === 'Peru' ? ['Bolivia','Ecuador','Chile','Colombia','Argentina']
             : name === 'Indonesia' ? ['Thailand','Vietnam','Malaysia','Philippines']
             : name === 'Australia' ? ['New Zealand','Indonesia','Fiji']
             : name === 'France' ? ['Italy','Spain','Portugal','Germany']
             : ['Indonesia','Thailand','Peru','France']).map(nm => (
              <Link key={nm} href={`/admin/mockups/country-guide-c/${slugify(nm)}`} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 16px',
                fontSize: 14, color: C.text, fontWeight: 600, textDecoration: 'none',
              }}>{nm}</Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
