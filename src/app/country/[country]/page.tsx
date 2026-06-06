import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';

export const revalidate = 1800; // 30 min ISR — country inventories change slowly
import type { Metadata } from 'next';

interface Props { params: Promise<{ country: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa' };

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

async function resolveCountry(slug: string): Promise<string | null> {
  try {
    const rows = await db`SELECT DISTINCT country FROM places WHERE country IS NOT NULL AND country <> ''`;
    for (const r of rows) if (slugify(r.country) === slug) return r.country;
  } catch {}
  return null;
}

const FMT_CATS = (cats: { category: string; c: number }[]) =>
  cats.map(c => `${c.c} ${c.category}`).join(', ');

export default async function CountryPlacesPage({ params }: Props) {
  const { country } = await params;
  const realName = await resolveCountry(country);
  if (!realName) notFound();

  const [placesAll, cats, topCities, toursHere] = await Promise.all([
    db`SELECT slug, name, city, category, emoji, cover_image,
              (SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id) AS review_count
       FROM places WHERE country = ${realName}
       ORDER BY review_count DESC NULLS LAST, name ASC LIMIT 200`,
    db`SELECT category, COUNT(*)::int AS c FROM places WHERE country = ${realName} GROUP BY category ORDER BY c DESC`,
    db`SELECT city, COUNT(*)::int AS c FROM places WHERE country = ${realName} AND city IS NOT NULL AND city <> '' GROUP BY city ORDER BY c DESC LIMIT 8`,
    // Top tours — 12 divides evenly into 1/2/3/4/6 column breakpoints so rows always fill.
    db`SELECT slug, title, cover_image, duration_label, price_from, currency, rating, review_count
       FROM tours WHERE active = true AND country = ${realName}
       ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 12`.catch(() => []),
  ]);

  const total = placesAll.length;
  const catChips = (cats as any[]).map(c => ({ category: c.category, c: Number(c.c) }));
  // Pick a hero image from this country's top-reviewed place (placesAll is already sorted
  // review_count DESC). Falls back to the first tour's cover if no place has one, else
  // to the teal gradient. Keeps SEO copy readable via a dark gradient overlay.
  const heroImage: string | null =
    (placesAll as any[]).find(p => p.cover_image && typeof p.cover_image === 'string')?.cover_image
    || (toursHere as any[]).find(t => t.cover_image)?.cover_image
    || null;

  // Group by category for section rendering
  const grouped = new Map<string, any[]>();
  for (const p of placesAll as any[]) {
    if (!grouped.has(p.category)) grouped.set(p.category, []);
    grouped.get(p.category)!.push(p);
  }
  const categoryOrder = ['cities','attractions','activities','nature','temples','beaches','food','hotels','hostels','tours'];
  const orderedCats = categoryOrder.filter(c => grouped.has(c));
  for (const c of grouped.keys()) if (!orderedCats.includes(c)) orderedCats.push(c);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: realName,
    description: `Top tourist attractions, activities, parks, and places to visit in ${realName} — curated on BugBitten.`,
    url: `https://bugbitten.com/country/${country}`,
    containedInPlace: { '@type': 'Country', name: realName },
    isPartOf: { '@type': 'WebSite', name: 'BugBitten', url: 'https://bugbitten.com' },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bugbitten.com/' },
      { '@type': 'ListItem', position: 2, name: 'Explore', item: 'https://bugbitten.com/explore' },
      { '@type': 'ListItem', position: 3, name: realName, item: `https://bugbitten.com/country/${country}` },
    ],
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div style={{
        position: 'relative' as const,
        padding: '64px 20px 48px',
        background: heroImage
          ? `#0f2329`
          : 'linear-gradient(160deg,#0d9488 0%,#0f766e 100%)',
        overflow: 'hidden' as const,
      }}>
        {heroImage && (
          <>
            {/* Country cover photo — zoomed + slightly blurred so text on top is readable without hiding the scene */}
            <img loading="eager" decoding="async" fetchPriority="high" aria-hidden="true" src={heroImage} alt=""
              style={{
                position: 'absolute' as const, inset: 0, width: '100%', height: '100%',
                objectFit: 'cover' as const, objectPosition: 'center',
              }}/>
            {/* Dark gradient overlay: deeper at bottom-left where the text sits, softer at the top-right */}
            <div aria-hidden="true" style={{
              position: 'absolute' as const, inset: 0,
              background: 'linear-gradient(105deg, rgba(4,14,28,0.78) 0%, rgba(4,14,28,0.55) 55%, rgba(4,14,28,0.35) 100%)',
            }}/>
            {/* Soft bottom fade so the content below meets the hero cleanly */}
            <div aria-hidden="true" style={{
              position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 90,
              background: 'linear-gradient(to bottom, rgba(243,244,246,0) 0%, rgba(243,244,246,0.35) 100%)',
            }}/>
          </>
        )}
        <div style={{ position: 'relative' as const, maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ color: heroImage ? 'rgba(255,255,255,0.85)' : '#cbd5e1', fontSize: 13, marginBottom: 10, textShadow: heroImage ? '0 1px 2px rgba(0,0,0,0.4)' : 'none' }}>
            <Link href="/explore" style={{ color: 'inherit', textDecoration: 'none' }}>Explore</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <span>{realName}</span>
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 10px',
            // Drop shadow keeps the title sharp even over busy photos.
            textShadow: heroImage ? '0 2px 14px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)' : 'none',
          }}>Things to do in {realName}</h1>
          <p style={{
            color: heroImage ? 'rgba(255,255,255,0.92)' : '#cbd5e1',
            margin: '0 0 16px', fontSize: 15,
            textShadow: heroImage ? '0 1px 8px rgba(0,0,0,0.55)' : 'none',
          }}>{total} places · {FMT_CATS(catChips.slice(0, 5))}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {catChips.map(c => (
              <Link key={c.category} href={`#cat-${c.category}`} style={{
                background: heroImage ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)',
                backdropFilter: heroImage ? 'blur(6px)' : undefined,
                color: '#fff',
                padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                border: heroImage ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>
                {c.c} {c.category}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 20px' }}>

        {/* CTA to the travel guide — higher-intent landing */}
        <Link href={`/country/${country}/guide`} style={{ textDecoration:'none', display:'block', marginBottom:28 }}>
          <div style={{ background:`linear-gradient(135deg, ${C.teal} 0%, #0f766e 100%)`, color:'#fff', borderRadius:12, padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' as const, boxShadow:'0 4px 14px rgba(13, 148, 136, 0.25)' }}>
            <div>
              <div style={{ fontSize:13, opacity:0.85, fontWeight:600, letterSpacing:0.3, textTransform:'uppercase' as const }}>Travel Guide</div>
              <div style={{ fontSize:18, fontWeight:700, marginTop:3 }}>📘 Read the full {realName} travel guide →</div>
              <div style={{ fontSize:13, opacity:0.9, marginTop:3 }}>Tours, cities, highlights, and traveller tips — all in one place.</div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', padding:'10px 18px', borderRadius:999, fontSize:14, fontWeight:700, whiteSpace:'nowrap' as const }}>Open guide →</div>
          </div>
        </Link>

        {(topCities as any[]).length > 1 && (
          <section style={{ marginBottom:32 }}>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:22, fontWeight:700, color:C.text, margin:'0 0 14px' }}>Top cities</h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              {(topCities as any[]).map((c: any) => (
                <Link key={c.city} href={`/places/city/${country}/${slugify(c.city)}`} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:99, padding:'7px 14px', fontSize:13, color:C.text, textDecoration:'none' }}>
                  <strong style={{ color:C.teal }}>{c.city}</strong> <span style={{ color:C.sub, marginLeft:4 }}>{c.c}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(toursHere as any[]).length > 0 && (
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, margin:'0 0 14px', flexWrap:'wrap' as const }}>
              <h2 style={{ fontFamily:'Georgia, serif', fontSize:22, fontWeight:700, color:C.text, margin:0 }}>
                Tours &amp; experiences in {realName}
              </h2>
              <Link href={`/tours?country=${encodeURIComponent(realName)}`} style={{ color:C.teal, fontSize:13, textDecoration:'none', fontWeight:600 }}>View all tours →</Link>
            </div>
            <div className="bb-row-grid">
              {(toursHere as any[]).map((t: any) => (
                <Link key={t.slug} href={`/tours/${t.slug}`} style={{ textDecoration:'none' }}>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' as const }}>
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
                      <div style={{ fontSize:12, color:C.sub, marginTop:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>{t.duration_label || ''}</span>
                        {t.price_from && <span style={{ color:C.teal, fontWeight:700 }}>from {t.currency || 'AUD'} ${Number(t.price_from).toFixed(0)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {orderedCats.map(cat => {
          const items = grouped.get(cat)!
          const cap = Math.min(48, items.length)
          const n = cap >= 4 ? Math.floor(cap / 4) * 4 : cap
          const shown = items.slice(0, n)
          const hasMore = items.length > n
          return (
            <section key={cat} id={`cat-${cat}`} style={{ marginBottom:40 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, margin:'0 0 14px', flexWrap:'wrap' as const }}>
                <h2 style={{ fontFamily:'Georgia, serif', fontSize:22, fontWeight:700, color:C.text, margin:0, textTransform:'capitalize' as const }}>
                  {cat} <span style={{ color:C.sub, fontSize:14, fontWeight:400 }}>({items.length})</span>
                </h2>
                {hasMore && (
                  <Link href={`/explore?country=${encodeURIComponent(realName)}&category=${encodeURIComponent(cat)}`}
                    style={{ color:C.teal, fontSize:13, textDecoration:'none', fontWeight:600, whiteSpace:'nowrap' as const }}>
                    See all {items.length} {cat} in {realName} →
                  </Link>
                )}
              </div>
              <div className="bb-row-grid">
                {shown.map((p: any) => (
                  <Link key={p.slug} href={`/places/${p.slug}`} style={{ textDecoration:'none' }}>
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' as const }}>
                      <div style={{ height:120, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' as const, position:'relative' as const }}>
                        {p.cover_image
                          ? <img loading="lazy" decoding="async" src={p.cover_image} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' as const }} />
                          : <span style={{ fontSize:40 }}>{p.emoji || '📍'}</span>}
                      </div>
                      <div style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:700, color:C.text, fontSize:14, overflow:'hidden' as const, textOverflow:'ellipsis' as const, whiteSpace:'nowrap' as const }}>{p.name}</div>
                        <div style={{ fontSize:12, color:C.sub, marginTop:2, overflow:'hidden' as const, textOverflow:'ellipsis' as const, whiteSpace:'nowrap' as const }}>{p.city || ''}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const realName = await resolveCountry(country);
  if (!realName) return { title: 'Country not found' };
  const total = await db`SELECT COUNT(*)::int AS c FROM places WHERE country = ${realName}`.then(r => (r[0] as any).c).catch(() => 0);
  const title = `Things to do in ${realName} — ${total} places`;
  const description = `${total} tourist attractions, parks, activities and places to visit in ${realName}. Traveller reviews, photos and trip ideas on BugBitten.`;
  const url = `https://bugbitten.com/country/${country}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, siteName: 'BugBitten' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
