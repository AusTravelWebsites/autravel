import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import type { Metadata } from 'next';

export const revalidate = 1800;

interface Props { params: Promise<{ country: string; city: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa' };

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

async function resolveCityCountry(countrySlug: string, citySlug: string): Promise<{ country: string; city: string } | null> {
  try {
    const rows = await db`SELECT DISTINCT country, city FROM places WHERE country IS NOT NULL AND city IS NOT NULL AND country <> '' AND city <> ''`;
    for (const r of rows as any[]) {
      if (slugify(r.country) === countrySlug && slugify(r.city) === citySlug) return { country: r.country, city: r.city };
    }
  } catch {}
  return null;
}

export default async function CityPlacesPage({ params }: Props) {
  const { country, city } = await params;
  const resolved = await resolveCityCountry(country, city);
  if (!resolved) notFound();
  const { country: countryName, city: cityName } = resolved;

  const [placesAll, cats] = await Promise.all([
    db`SELECT slug, name, category, emoji, cover_image,
              (SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id) AS review_count
       FROM places WHERE country = ${countryName} AND city = ${cityName}
       ORDER BY places.review_count DESC NULLS LAST, name ASC LIMIT 200`,
    db`SELECT category, COUNT(*)::int AS c FROM places WHERE country = ${countryName} AND city = ${cityName} GROUP BY category ORDER BY c DESC`,
  ]);

  const total = placesAll.length;
  const catChips = (cats as any[]).map(c => ({ category: c.category, c: Number(c.c) }));
  const grouped = new Map<string, any[]>();
  for (const p of placesAll as any[]) {
    if (!grouped.has(p.category)) grouped.set(p.category, []);
    grouped.get(p.category)!.push(p);
  }
  const categoryOrder = ['attractions','activities','nature','temples','beaches','food','hotels','hostels','tours'];
  const orderedCats = categoryOrder.filter(c => grouped.has(c));
  for (const c of grouped.keys()) if (!orderedCats.includes(c)) orderedCats.push(c);

  const pageUrl = `https://bugbitten.com/places/city/${country}/${city}`;
  const jsonLd = {
    '@context':'https://schema.org','@type':'City',
    name: cityName,
    containedInPlace: { '@type':'Country', name: countryName },
    description: `Top tourist attractions, activities, and places to visit in ${cityName}, ${countryName} — curated on BugBitten.`,
    url: pageUrl,
  };
  const breadcrumbLd = {
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement: [
      { '@type':'ListItem', position:1, name:'Home', item:'https://bugbitten.com/' },
      { '@type':'ListItem', position:2, name:'Explore', item:'https://bugbitten.com/explore' },
      { '@type':'ListItem', position:3, name: countryName, item:`https://bugbitten.com/country/${country}` },
      { '@type':'ListItem', position:4, name: cityName, item: pageUrl },
    ],
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div style={{ background: 'linear-gradient(160deg,#0d9488 0%,#0f766e 100%)', padding:'40px 20px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ color:'#cbd5e1', fontSize:13, marginBottom:10 }}>
            <Link href="/explore" style={{ color:'#cbd5e1', textDecoration:'none' }}>Explore</Link>
            <span style={{ margin:'0 8px' }}>›</span>
            <Link href={`/country/${country}`} style={{ color:'#cbd5e1', textDecoration:'none' }}>{countryName}</Link>
            <span style={{ margin:'0 8px' }}>›</span>
            <span>{cityName}</span>
          </div>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px, 4vw, 42px)', fontWeight:800, color:'#fff', margin:'0 0 10px' }}>Things to do in {cityName}</h1>
          <p style={{ color:'#cbd5e1', margin:'0 0 16px', fontSize:15 }}>
            {total === 0 ? 'No places yet — be the first to check in!' : `${total} place${total === 1 ? '' : 's'} in ${cityName}, ${countryName}`}
          </p>
          {catChips.length > 0 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              {catChips.map(c => (
                <Link key={c.category} href={`#cat-${c.category}`} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', padding:'7px 14px', borderRadius:999, fontSize:13, fontWeight:600, textDecoration:'none' }}>
                  {c.c} {c.category}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 20px' }}>
        {total === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px', color:C.sub, background:C.card, borderRadius:12, border:`1px solid ${C.border}` }}>
            <p style={{ margin:'0 0 10px', fontSize:15, color:C.text, fontWeight:600 }}>No places listed in {cityName} yet.</p>
            <p style={{ margin:0, fontSize:14 }}>Check out the rest of <Link href={`/country/${country}`} style={{ color:C.teal, fontWeight:600 }}>{countryName}</Link>.</p>
          </div>
        ) : (
          orderedCats.map(cat => (
            <section key={cat} id={`cat-${cat}`} style={{ marginBottom:40 }}>
              <h2 style={{ fontFamily:'Georgia, serif', fontSize:22, fontWeight:700, color:C.text, margin:'0 0 14px', textTransform:'capitalize' as const }}>
                {cat} <span style={{ color:C.sub, fontSize:14, fontWeight:400 }}>({grouped.get(cat)!.length})</span>
              </h2>
              <div className="bb-row-grid">
                {(() => {
                  const items = grouped.get(cat)!
                  const cap = Math.min(48, items.length)
                  const n = cap >= 4 ? Math.floor(cap / 4) * 4 : cap
                  return items.slice(0, n)
                })().map((p: any) => (
                  <Link key={p.slug} href={`/places/${p.slug}`} style={{ textDecoration:'none' }}>
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' as const }}>
                      <div style={{ height:120, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' as const }}>
                        {p.cover_image
                          ? <img loading="lazy" decoding="async" src={p.cover_image} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' as const }} />
                          : <span style={{ fontSize:40 }}>{p.emoji || '📍'}</span>}
                      </div>
                      <div style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:700, color:C.text, fontSize:14, overflow:'hidden' as const, textOverflow:'ellipsis' as const, whiteSpace:'nowrap' as const }}>{p.name}</div>
                        <div style={{ fontSize:12, color:C.sub, marginTop:2, textTransform:'capitalize' as const }}>{p.category}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, city } = await params;
  const resolved = await resolveCityCountry(country, city);
  if (!resolved) return { title: 'City not found' };
  const { country: countryName, city: cityName } = resolved;
  const total = await db`SELECT COUNT(*)::int AS c FROM places WHERE country = ${countryName} AND city = ${cityName}`.then(r => (r[0] as any).c).catch(() => 0);
  const title = `Things to do in ${cityName}, ${countryName} — ${total} place${total === 1 ? '' : 's'}`;
  const description = `${total} tourist attractions, parks, activities and places to visit in ${cityName}, ${countryName}. Traveller reviews and photos on BugBitten.`;
  const url = `https://bugbitten.com/places/city/${country}/${city}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, siteName: 'BugBitten' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
