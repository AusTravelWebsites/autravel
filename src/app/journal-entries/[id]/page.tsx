import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import { PostEditor } from '@/components/features/PostEditor';
import { ShareButton } from '@/components/features/ShareButton';
import { CommentSection } from '@/components/features/CommentSection';
import { ReportButton } from '@/components/features/ReportButton';

interface Props { params: Promise<{ id: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)' };

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}

function titleFromBody(body: string, location: string | null, createdAt: string) {
  const first = (body || '').split(/[.!?\n]/)[0]?.trim();
  if (first && first.length > 6) return first.length > 80 ? first.slice(0, 77) + '…' : first;
  if (location) return `Journal from ${location}`;
  return `Journal entry — ${new Date(createdAt).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}`;
}

export default async function JournalEntryPage({ params }: Props) {
  const { id } = await params;

  const rows = await sql`
    SELECT je.id, je.body, je.location_name, je.media_urls, je.like_count, je.comment_count,
           je.is_public, je.created_at, je.user_id,
           u.username, u.display_name, u.avatar_url,
           p.name AS place_name, p.slug AS place_slug
    FROM journal_entries je
    JOIN users u ON u.id::text = je.user_id
    LEFT JOIN places p ON p.id = je.place_id
    WHERE je.id = ${id} LIMIT 1`;
  if (!rows.length) notFound();
  const e = rows[0] as any;
  const title = titleFromBody(e.body, e.place_name || e.location_name, e.created_at);

  // Related entries: same place (if known) or same user
  let related: any[] = [];
  try {
    related = await sql`
      SELECT je.id::text AS id, je.body, je.created_at, je.media_urls, je.location_name,
             u.username, u.display_name, u.avatar_url,
             p.name AS place_name
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.is_public = true AND je.id <> ${id}
        AND (
          ${e.place_slug ? true : false}::boolean AND p.slug = ${e.place_slug || null}
          OR (${!e.place_slug ? true : false}::boolean AND je.user_id = ${e.user_id})
        )
      ORDER BY je.created_at DESC LIMIT 6`;
  } catch {}
  const initials = (e.display_name as string)?.[0]?.toUpperCase() || '?';

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bugbitten.com/' },
      { '@type': 'ListItem', position: 2, name: e.display_name || e.username, item: `https://bugbitten.com/${e.username}` },
      { '@type': 'ListItem', position: 3, name: 'Journal', item: `https://bugbitten.com/${e.username}/posts` },
      { '@type': 'ListItem', position: 4, name: title, item: `https://bugbitten.com/journal-entries/${e.id}` },
    ],
  };
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: title,
    articleBody: (e.body as string).slice(0, 5000),
    datePublished: e.created_at,
    author: { '@type': 'Person', name: e.display_name || e.username, url: `https://bugbitten.com/${e.username}` },
    ...(e.media_urls && e.media_urls[0] && { image: e.media_urls[0] }),
    ...((e.place_slug || e.location_name) && { contentLocation: { '@type': 'Place', name: e.place_name || e.location_name } }),
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div style={{ maxWidth:760, margin:'0 auto', padding:'32px 16px' }}>
        <Link href={`/${e.username}`} style={{ color:C.sub, fontSize:14, textDecoration:'none', display:'inline-block', marginBottom:16 }}>← {e.display_name || e.username}</Link>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'24px 28px' }}>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:26, fontWeight:800, margin:'0 0 14px', lineHeight:1.3 }}>{title}</h1>

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            {e.avatar_url
              ? <img loading="lazy" decoding="async" src={e.avatar_url} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover' as const }} />
              : <div style={{ width:36, height:36, borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:14 }}>{initials}</div>}
            <div>
              <Link href={`/${e.username}`} style={{ fontSize:14, fontWeight:600, color:C.text, textDecoration:'none' }}>{e.display_name}</Link>
              <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>
                {(e.place_slug || e.location_name) && (
                  <>📍 {e.place_slug ? (
                    <Link href={'/places/' + e.place_slug} style={{ color:C.teal, textDecoration:'none', fontWeight:600 }}>{e.place_name || e.location_name}</Link>
                  ) : (
                    <Link href={'/explore?q=' + encodeURIComponent(e.location_name)} style={{ color:C.teal, textDecoration:'none', fontWeight:600 }}>{e.location_name}</Link>
                  )} · </>
                )}
                {timeAgo(e.created_at)}
                {!e.is_public && <span style={{ marginLeft:8, background:'#f3f4f6', color:C.sub, padding:'1px 8px', borderRadius:99, fontSize:11 }}>Private</span>}
              </div>
            </div>
          </div>

          <p style={{ fontSize:16, color:'#374151', lineHeight:1.75, whiteSpace:'pre-wrap' as const, margin:0 }}>{e.body}</p>

          {e.media_urls && e.media_urls.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns: e.media_urls.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap:10, marginTop:18 }}>
              {e.media_urls.map((url: string, i: number) => (
                <img loading="lazy" decoding="async" key={i} src={url} alt={`Photo ${i+1}`} style={{ width:'100%', maxHeight:480, objectFit:'cover' as const, borderRadius:10, border:`1px solid ${C.border}` }} />
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:16, marginTop:18, paddingTop:14, borderTop:`1px solid #f3f4f6`, fontSize:13, color:C.sub, alignItems:'center' }}>
            <span>♥ {e.like_count || 0}</span>
            <CommentSection entryId={e.id} count={e.comment_count || 0} />
            <div style={{ marginLeft:'auto', display:'flex', gap:4, alignItems:'center' }}>
              <ReportButton targetType="post" targetId={e.id} />
              <ShareButton url={`https://bugbitten.com/journal-entries/${e.id}`} text={`${e.display_name || e.username}'s journal from ${e.place_name || e.location_name || 'the road'} on BugBitten`} />
            </div>
          </div>

          <PostEditor
            ownerId={e.user_id}
            postId={e.id}
            initialBody={e.body}
            initialIsPublic={e.is_public}
          />
        </div>

        {related.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:20, fontWeight:700, color:C.text, margin:'0 0 14px' }}>
              {e.place_slug ? `More from ${e.place_name}` : `More from ${e.display_name || e.username}`}
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
              {related.map((r: any) => {
                const firstImg = Array.isArray(r.media_urls) && r.media_urls[0];
                const firstSent = (r.body || '').split(/[.!?\n]/)[0]?.trim() || '';
                const head = firstSent.length > 6 ? (firstSent.length > 70 ? firstSent.slice(0, 67) + '…' : firstSent) : `Journal from ${r.place_name || r.location_name || 'the road'}`;
                return (
                  <a key={r.id} href={`/journal-entries/${r.id}`} style={{ textDecoration:'none', background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' as const }}>
                    {firstImg && <img loading="lazy" decoding="async" src={firstImg} alt="" style={{ width:'100%', height:120, objectFit:'cover' as const, display:'block' }} />}
                    <div style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:11, color:C.sub, marginBottom:4 }}>@{r.username}{(r.place_name || r.location_name) ? ' · 📍 ' + (r.place_name || r.location_name) : ''}</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text, lineHeight:1.4 }}>{head}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const rows = await sql`
      SELECT je.body, je.location_name, je.created_at, u.display_name, u.username,
             p.name AS place_name
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.id = ${id} LIMIT 1`;
    if (rows[0]) {
      const e = rows[0] as any;
      const t = (e.body || '').split(/[.!?\n]/)[0]?.trim() || `Journal from ${e.place_name || e.location_name || e.username}`;
      return { title: t.slice(0, 60), description: (e.body as string || '').slice(0, 155) };
    }
  } catch {}
  return { title: 'Journal entry' };
}
