import Link from 'next/link';
import { db } from '@/lib/db';
import type { Metadata } from 'next';

export const revalidate = 600; // 10-min ISR

interface Props { searchParams: Promise<{ q?: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)' };

function fmt(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

export default async function DiscoverTripsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();

  let trips: any[] = [];
  try {
    const pat = q ? `%${q}%` : null;
    trips = q
      ? await db`
        SELECT t.id::text AS id, t.title, t.slug, t.description, t.cover_emoji, t.cover_image,
               t.location_name, t.start_date, t.end_date, t.country_count,
               u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*)::int FROM journal_entries je WHERE je.trip_id = t.id) AS entry_count
        FROM trips t JOIN users u ON u.id::text = t.user_id
        WHERE t.is_public = true AND (t.title ILIKE ${pat} OR t.description ILIKE ${pat} OR t.location_name ILIKE ${pat})
        ORDER BY COALESCE(t.updated_at, t.created_at) DESC LIMIT 60`
      : await db`
        SELECT t.id::text AS id, t.title, t.slug, t.description, t.cover_emoji, t.cover_image,
               t.location_name, t.start_date, t.end_date, t.country_count,
               u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*)::int FROM journal_entries je WHERE je.trip_id = t.id) AS entry_count
        FROM trips t JOIN users u ON u.id::text = t.user_id
        WHERE t.is_public = true
        ORDER BY COALESCE(t.updated_at, t.created_at) DESC LIMIT 60`;
  } catch {}

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <div style={{ background:'linear-gradient(160deg,var(--brand) 0%,var(--brand-dark) 100%)', padding:'40px 20px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px, 4vw, 36px)', fontWeight:800, color:'#fff', margin:'0 0 8px' }}>Discover trips</h1>
          <p style={{ color:'#cbd5e1', margin:'0 0 18px', fontSize:15 }}>Travel journals from BugBitten travellers around the world.</p>
          <form action="/trips/discover" style={{ display:'flex', gap:8, maxWidth:480, flexWrap:'wrap' as const }}>
            <input name="q" defaultValue={q} placeholder="Search trips by title, location, description…" style={{ flex:'1 1 240px', padding:'10px 14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' as const }} />
            <button type="submit" style={{ padding:'10px 18px', borderRadius:10, background:'#fff', color:C.teal, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Search</button>
          </form>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 20px' }}>
        {trips.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:48, textAlign:'center' as const, color:C.sub }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🌏</div>
            <div style={{ fontWeight:700, color:C.text, fontSize:16, marginBottom:6 }}>No public trips yet{q ? ` for "${q}"` : ''}</div>
            <div style={{ fontSize:14 }}>Travellers' public trips appear here as they're created.</div>
            <Link href="/trips/new" style={{ display:'inline-block', marginTop:14, background:C.teal, color:'#fff', padding:'10px 22px', borderRadius:8, fontSize:14, fontWeight:700, textDecoration:'none' }}>Plan your own adventure</Link>
          </div>
        ) : (
          <>
            <div style={{ color:C.sub, fontSize:13, marginBottom:14 }}>{trips.length} trip{trips.length === 1 ? '' : 's'}</div>
            <div className="bb-row-grid" style={{ gap: 14 }}>
              {trips.map((t: any) => (
                <Link key={t.id} href={`/${t.username}/trips/${t.slug}`} style={{ textDecoration:'none' }}>
                  <article style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' as const, height:'100%', display:'flex', flexDirection:'column' as const }}>
                    <div style={{ height:140, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' as const, position:'relative' as const }}>
                      {t.cover_image
                        ? <img loading="lazy" decoding="async" src={t.cover_image} alt={t.title} style={{ width:'100%', height:'100%', objectFit:'cover' as const }} />
                        : <span style={{ fontSize:48 }}>{t.cover_emoji || '🌏'}</span>}
                    </div>
                    <div style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column' as const }}>
                      <h2 style={{ fontFamily:'Georgia, serif', fontSize:17, fontWeight:700, color:C.text, margin:'0 0 6px', lineHeight:1.3 }}>{t.title}</h2>
                      <div style={{ fontSize:12, color:C.sub, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                        <span>by</span>
                        {t.avatar_url
                          ? <img loading="lazy" decoding="async" src={t.avatar_url} alt="" style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover' as const }} />
                          : <span style={{ width:18, height:18, borderRadius:'50%', background:C.teal, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>{(t.display_name || t.username || '?')[0].toUpperCase()}</span>}
                        <span style={{ color:C.teal, fontWeight:600 }}>{t.display_name || t.username}</span>
                      </div>
                      {t.description && <p style={{ fontSize:13, color:'#374151', lineHeight:1.55, margin:'0 0 10px', display:'-webkit-box' as any, WebkitLineClamp:3, WebkitBoxOrient:'vertical' as any, overflow:'hidden' as const }}>{t.description}</p>}
                      <div style={{ marginTop:'auto', fontSize:12, color:C.sub, display:'flex', flexWrap:'wrap' as const, gap:10 }}>
                        {t.location_name && <span>📍 {t.location_name}</span>}
                        {t.start_date && <span>{fmt(t.start_date)}{t.end_date ? ' – ' + fmt(t.end_date) : ''}</span>}
                        {Number(t.entry_count) > 0 && <span>📝 {t.entry_count}</span>}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const title = q ? `Trip search: ${q}` : 'Discover travel journals';
  const description = q
    ? `Public travel journals matching "${q}" on BugBitten — real journeys from real travellers.`
    : 'Browse public travel journals from BugBitten travellers — itineraries, photos, and stories from around the world.';
  const url = 'https://bugbitten.com/trips/discover' + (q ? `?q=${encodeURIComponent(q)}` : '');
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, siteName: 'BugBitten' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
