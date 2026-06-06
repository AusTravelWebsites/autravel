import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import { UserItemActions } from '@/components/features/UserItemActions';
import { PostEditor } from '@/components/features/PostEditor';

interface Props { params: Promise<{ username: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488' };

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}

export default async function UserPostsPage({ params }: Props) {
  const { username } = await params;
  const users = await sql`SELECT id, username, display_name FROM users WHERE username = ${username} LIMIT 1`;
  if (!users.length) notFound();
  const user = users[0];

  const entries = await sql`
    SELECT je.id, je.body, je.location_name, je.media_urls, je.like_count, je.comment_count, je.is_public, je.created_at,
           p.name AS place_name, p.slug AS place_slug
    FROM journal_entries je
    LEFT JOIN places p ON p.id = je.place_id
    WHERE je.user_id = ${user.id.toString()}
    ORDER BY je.created_at DESC LIMIT 100`;

  const ownerId = user.id as string;

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'32px 16px' }}>
        <Link href={`/${user.username}`} style={{ color:C.sub, fontSize:14, textDecoration:'none', display:'inline-block', marginBottom:16 }}>← {user.display_name || user.username}</Link>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, margin:'0 0 24px' }}>{user.display_name || user.username}'s posts <span style={{ color:C.sub, fontSize:16, fontWeight:400 }}>({entries.length})</span></h1>
        {entries.length === 0 ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center' as const, color:C.sub }}>
            No journal entries yet.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:14 }}>
            {entries.map((e: any) => {
              const firstSentence = (e.body as string || '').split(/[.!?\n]/)[0]?.trim() || '';
              const heading = firstSentence.length > 6
                ? (firstSentence.length > 80 ? firstSentence.slice(0, 77) + '…' : firstSentence)
                : (e.place_name || e.location_name ? `Journal from ${e.place_name || e.location_name}` : 'Journal entry');
              return (
              <div key={e.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 20px' }}>
                <div style={{ fontSize:12, color:C.sub, marginBottom:6, display:'flex', gap:8, alignItems:'center' }}>
                  {(e.place_slug || e.location_name) && (
                    <span>📍 {e.place_slug
                      ? <Link href={'/places/' + e.place_slug} style={{ color:C.teal, textDecoration:'none', fontWeight:600 }}>{e.place_name || e.location_name}</Link>
                      : <Link href={'/explore?q=' + encodeURIComponent(e.location_name)} style={{ color:C.teal, textDecoration:'none', fontWeight:600 }}>{e.location_name}</Link>
                    } ·</span>
                  )}
                  <span>{timeAgo(e.created_at)}</span>
                  {!e.is_public && <span style={{ background:'#f3f4f6', color:C.sub, padding:'1px 8px', borderRadius:99, fontSize:11 }}>Private</span>}
                </div>
                <Link href={'/journal-entries/' + e.id} style={{ textDecoration:'none' }}>
                  <h3 style={{ fontFamily:'Georgia, serif', fontSize:18, fontWeight:700, color:C.text, margin:'0 0 8px', lineHeight:1.35 }}>{heading}</h3>
                </Link>
                <p style={{ fontSize:15, color:'#374151', lineHeight:1.7, margin:0 }}>{e.body}</p>
                {e.media_urls && e.media_urls.length > 0 && (
                  <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' as const }}>
                    {e.media_urls.slice(0, 4).map((url: string, i: number) => (
                      <img loading="lazy" decoding="async" key={i} src={url} alt={`Photo ${i+1}`} style={{ width:120, height:88, objectFit:'cover' as const, borderRadius:8 }} />
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:16, marginTop:12, fontSize:13, color:C.sub }}>
                  <span>♥ {e.like_count || 0}</span>
                  <span>💬 {e.comment_count || 0}</span>
                </div>
                <PostEditor
                  ownerId={ownerId}
                  postId={e.id}
                  initialBody={e.body}
                  initialIsPublic={e.is_public}
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
  return { title: `@${username} — posts`, description: `All journal entries by @${username} on BugBitten.` };
}
