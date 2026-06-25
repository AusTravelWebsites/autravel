import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import { TripCardActions } from '@/components/features/TripCardActions';

interface Props { params: Promise<{ username: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)' };

function fmt(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

export default async function UserTripsPage({ params }: Props) {
  const { username } = await params;
  const users = await sql`SELECT id, username, display_name FROM users WHERE username = ${username} LIMIT 1`;
  if (!users.length) notFound();
  const user = users[0];

  const trips = await sql`
    SELECT id::text AS id, slug, title, cover_emoji, cover_image, description,
           start_date, end_date, started_at, ended_at, is_public, is_active,
           (SELECT COUNT(*) FROM journal_entries je WHERE je.trip_id = trips.id) AS entry_count
    FROM trips
    WHERE user_id = ${user.id.toString()}
    ORDER BY COALESCE(start_date, started_at, created_at) DESC LIMIT 100`;

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'32px 16px' }}>
        <Link href={`/${user.username}`} style={{ color:C.sub, fontSize:14, textDecoration:'none', display:'inline-block', marginBottom:16 }}>← {user.display_name || user.username}</Link>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap' as const, gap:12 }}>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, margin:0 }}>{user.display_name || user.username}'s trips <span style={{ color:C.sub, fontSize:16, fontWeight:400 }}>({trips.length})</span></h1>
          <Link href="/trips/new" style={{ background:C.teal, color:'#fff', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>+ New adventure</Link>
        </div>
        {trips.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center' as const, color:C.sub }}>
            No trips yet.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
            {trips.map((t: any) => {
              const start = t.start_date || t.started_at;
              const end = t.end_date || t.ended_at;
              return (
                <div key={t.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 20px' }}>
                  <Link href={'/' + user.username + '/trips/' + t.slug} style={{ display:'flex', alignItems:'center', gap:14, textDecoration:'none' }}>
                    {t.cover_image
                      ? <img loading="lazy" decoding="async" src={t.cover_image} alt={t.title} style={{ width:64, height:64, borderRadius:10, objectFit:'cover' as const, flexShrink:0 }} />
                      : <span style={{ width:64, height:64, borderRadius:10, background:C.tealLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>{t.cover_emoji || '🌏'}</span>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
                        <span style={{ fontSize:16, fontWeight:700, color:C.text }}>{t.title}</span>
                        {!t.is_public && <span style={{ background:'#f3f4f6', color:C.sub, padding:'1px 8px', borderRadius:99, fontSize:11 }}>Private</span>}
                        {t.is_active && <span style={{ background:C.tealLight, color:C.teal, padding:'1px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>Active</span>}
                      </div>
                      <div style={{ fontSize:13, color:C.sub, marginTop:4 }}>
                        {start ? `${fmt(start)}${end ? ' – ' + fmt(end) : ' – ongoing'}` : 'No dates set'}
                        {t.entry_count > 0 && ` · ${t.entry_count} ${Number(t.entry_count) === 1 ? 'entry' : 'entries'}`}
                      </div>
                      {t.description && <div style={{ fontSize:13, color:'#374151', lineHeight:1.5, marginTop:6, overflow:'hidden' as const, display:'-webkit-box' as any, WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{t.description}</div>}
                    </div>
                  </Link>
                  <TripCardActions ownerId={user.id as string} tripId={t.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `@${username} — trips`, description: `All trips by @${username} on BugBitten.` };
}
