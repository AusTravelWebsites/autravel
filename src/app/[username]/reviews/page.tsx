import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import { ReviewEditor } from '@/components/features/ReviewEditor';

interface Props { params: Promise<{ username: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', orange:'#f97316' };

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}

export default async function UserReviewsPage({ params }: Props) {
  const { username } = await params;
  const users = await sql`SELECT id, username, display_name FROM users WHERE username = ${username} LIMIT 1`;
  if (!users.length) notFound();
  const user = users[0];

  const reviews = await sql`
    SELECT r.id, r.title, r.body, r.overall_rating, r.rating, r.visit_date, r.created_at,
           p.slug AS place_slug, p.name AS place_name, p.city, p.country
    FROM reviews r
    JOIN places p ON p.id = r.place_id
    WHERE r.user_id = ${user.id.toString()}
    ORDER BY r.created_at DESC LIMIT 100`;

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'32px 16px' }}>
        <Link href={`/${user.username}`} style={{ color:C.sub, fontSize:14, textDecoration:'none', display:'inline-block', marginBottom:16 }}>← {user.display_name || user.username}</Link>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, margin:'0 0 24px' }}>{user.display_name || user.username}'s reviews <span style={{ color:C.sub, fontSize:16, fontWeight:400 }}>({reviews.length})</span></h1>
        {reviews.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center' as const, color:C.sub }}>
            No reviews yet.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:14 }}>
            {reviews.map((r: any) => {
              const rStars = Math.round(r.overall_rating || r.rating || 0);
              return (
                <div key={r.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap' as const, gap:8 }}>
                    <Link href={'/places/' + r.place_slug} style={{ color:C.teal, fontSize:14, fontWeight:700, textDecoration:'none' }}>
                      📍 {r.place_name}{r.city ? `, ${r.city}` : ''}
                    </Link>
                    <span style={{ color:C.orange }}>{'★'.repeat(rStars)}{'☆'.repeat(5-rStars)}</span>
                  </div>
                  {r.title && <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>{r.title}</div>}
                  <p style={{ fontSize:14, color:'#374151', lineHeight:1.7, margin:'0 0 6px' }}>{r.body}</p>
                  <div style={{ fontSize:12, color:C.sub }}>
                    {r.visit_date && <span>Visited {new Date(r.visit_date).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })} · </span>}
                    Posted {timeAgo(r.created_at)}
                  </div>
                  <ReviewEditor
                    ownerId={user.id as string}
                    reviewId={r.id}
                    initialTitle={r.title || ''}
                    initialBody={r.body || ''}
                    initialRating={r.overall_rating || r.rating || 5}
                  />
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
  return { title: `@${username} — reviews`, description: `All travel reviews by @${username} on BugBitten.` };
}
