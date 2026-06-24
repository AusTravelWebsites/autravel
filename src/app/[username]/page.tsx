import { notFound } from 'next/navigation';
import Link from 'next/link';
import LikeButton from '@/components/features/LikeButton';

export const revalidate = 300; // 5 min ISR on profile pages
import { ProfileFollowButton } from '@/components/features/ProfileFollowButton';
import { ProfileRating } from '@/components/features/ProfileRating';
import { BlockButton } from '@/components/features/BlockButton';
import { ProfileSelfTips } from '@/components/features/ProfileSelfTips';
import sql from '@/lib/db';

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  // autravel: single-segment paths are usually migrated WP articles. Return
  // the article's metadata first; fall through to user-profile metadata only
  // if no article matches. Mirrors the fallback in the component below.
  try {
    const { getTenant, stateFilterValue } = await import('@/lib/get-tenant')
    const tenant = await getTenant()
    const state = stateFilterValue(tenant)
    const path = `/${username}/`
    const noSlashPath = `/${username}`
    const rows = await sql`
      SELECT slug, legacy_path, title, excerpt, cover_image, seo_title, seo_description, noindex
      FROM articles
      WHERE status = 'published'
        AND (${state}::text IS NULL OR state_code = ${state}::text)
        AND legacy_path = ANY(${[path, noSlashPath]}::text[])
      LIMIT 1`
    if (rows[0]) {
      const a = rows[0] as any
      const rawTitle = a.seo_title || a.title
      const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
      const rawDesc = a.seo_description
        || a.excerpt
        || `${a.title} — travel guide for ${tenant.stateName} from ${tenant.name}.`
      const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
      const url = `https://${tenant.host}${a.legacy_path || `/articles/${a.slug}/`}`
      return {
        title,
        description: desc,
        alternates: { canonical: url },
        robots: a.noindex ? { index: false, follow: true } : undefined,
        openGraph: { title, description: desc, type: 'article' as const, url, images: a.cover_image ? [a.cover_image] : [] },
        twitter: { card: 'summary_large_image' as const, title, description: desc, images: a.cover_image ? [a.cover_image] : [] },
      }
    }
  } catch {}
  // 2026-06-24 URL flatten: destinations now canonical at /<slug>/. If no
  // article matched the slug, check destinations and return that metadata.
  try {
    const { getTenant, stateFilterValue } = await import('@/lib/get-tenant')
    const tenant = await getTenant()
    const state = stateFilterValue(tenant)
    const cand = decodeURIComponent(username).toLowerCase()
    const [d] = await sql`SELECT slug FROM destinations
      WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
        AND slug = ${cand} LIMIT 1`
    if (d) {
      const { generateDestinationMetadata } = await import('@/app/destinations/[slug]/page')
      return await generateDestinationMetadata(cand)
    }
  } catch {}
  try {
    const rows = await sql`SELECT username, display_name, bio, avatar_url, location, visited_countries FROM users WHERE username = ${username} LIMIT 1`;
    if (rows[0]) {
      const { getTenant } = await import('@/lib/get-tenant');
      const tenant = await getTenant();
      const u = rows[0] as any;
      const name = u.display_name || u.username;
      const visited = (u.visited_countries as string[] | null)?.length || 0;
      const desc = (u.bio && (u.bio as string).trim())
        ? (u.bio as string).slice(0, 155)
        : `${name} on ${tenant.name} — travel journal${u.location ? ' from ' + u.location : ''}${visited ? `, ${visited} countries visited` : ''}. Adventures, reviews, and meetups.`;
      const url = `https://${tenant.host}/${username}`;
      const image = u.avatar_url || tenant.ogImage;
      return {
        title: `${name} (@${u.username})`,
        description: desc,
        alternates: { canonical: url },
        openGraph: { type: 'profile', title: `${name} (@${u.username})`, description: desc, url, images: [{ url: image, alt: name }], siteName: tenant.name },
        twitter: { card: 'summary', title: `${name} (@${u.username})`, description: desc, images: [image] },
      };
    }
  } catch {}
  return { title: `@${username}` };
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days/7) + 'w ago';
  return Math.floor(days/30) + 'mo ago';
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  // autravel: single-segment paths are usually migrated WP articles, not user
  // profiles. Check redirects + articles first; fall through to user lookup
  // only if no legacy article matches. (Original bugbitten behaviour is
  // preserved for the user-profile case.)
  {
    const { getTenant, stateFilterValue } = await import('@/lib/get-tenant')
    const { ArticleView } = await import('@/app/articles/[slug]/page')
    const { permanentRedirect } = await import('next/navigation')
    const tenant = await getTenant()
    const state = stateFilterValue(tenant)
    const path = `/${username}/`
    const noSlashPath = `/${username}`

    // Admin-configured redirects (including auto-seeded .html → /slug/).
    try {
      const [rdr] = await sql`
        SELECT to_path FROM redirects
        WHERE match_type = 'exact' AND is_active = true
          AND (state_code = ${state} OR state_code IS NULL)
          AND from_path = ANY(${[path, noSlashPath]}::text[])
        ORDER BY state_code NULLS LAST LIMIT 1`
      if (rdr?.to_path) permanentRedirect(rdr.to_path)
    } catch (e: any) {
      // permanentRedirect throws NEXT_REDIRECT — re-throw it so Next.js can handle
      if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e
    }
    try {
      const rows = await sql`
        SELECT * FROM articles
        WHERE status = 'published'
          AND (${state}::text IS NULL OR state_code = ${state}::text)
          AND legacy_path = ANY(${[path, noSlashPath]}::text[])
        LIMIT 1`
      if (rows[0]) {
        const article = rows[0] as any
        let author = null
        try {
          const arows = await sql`
            SELECT slug, name, role, bio, avatar_url FROM autravel.authors
             WHERE is_active = true AND (slug = ${article.author_slug ?? ''} OR name = ${article.author ?? ''})
             LIMIT 1`
          author = arows[0] || null
        } catch {}
        return <ArticleView article={article} tenant={tenant} author={author}/>
      }
    } catch {}

    // 2026-06-24 URL flatten: if `/<slug>/` matches a destination AND no
    // article occupied this path, render the destination guide here. This
    // makes `/<slug>/` the canonical URL for destinations; the old
    // `/destinations/<slug>/` route 301-redirects here.
    try {
      const cand = decodeURIComponent(username).toLowerCase()
      const [d] = await sql`
        SELECT 1 FROM destinations
        WHERE active = true
          AND (${state}::text IS NULL OR state_code = ${state}::text)
          AND slug = ${cand} LIMIT 1`
      if (d) {
        const { DestinationPageContent } = await import('@/app/destinations/[slug]/page')
        return await DestinationPageContent({ params: Promise.resolve({ slug: cand }) })
      }
    } catch (e: any) {
      if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e
    }

    // Dead legacy `.html` URL (pre-WP static-site era) with no article —
    // redirect to the matching destination guide at the new flat URL.
    if (/\.html$/i.test(username)) {
      const cand = decodeURIComponent(username).replace(/\.html$/i, '').toLowerCase()
      let dest = '/'
      try {
        const [d] = await sql`
          SELECT slug FROM destinations
          WHERE (${state}::text IS NULL OR state_code = ${state}::text)
            AND slug = ${cand} LIMIT 1`
        if (d?.slug) dest = `/${d.slug}/`
      } catch {}
      permanentRedirect(dest)
    }
  }

  // autravel doesn't have bugbitten's full user-profile schema (no travel_status,
  // follows, journal_entries, trips, reviews, user_locations). If the lookup
  // fails, treat as not-found rather than 500.
  let users: any[] = [];
  try {
    users = await sql`
      SELECT u.id, u.username, u.firebase_uid,
             COALESCE(u.display_name, u.username) as display_name,
             u.avatar_url, u.bio, u.location, u.travel_status,
             u.interests, u.visited_countries, u.wishlist_countries,
             u.bb_rating, u.bb_rating_count,
             u.home_city, u.home_country, u.home_country_code,
             u.verification_status, u.last_seen_at,
             (SELECT COUNT(*) FROM follows WHERE following_id = u.id::text) as followers,
             (SELECT COUNT(*) FROM follows WHERE follower_id = u.id::text) as following,
             (SELECT COUNT(*) FROM journal_entries WHERE user_id = u.id::text AND is_public = true) as post_count,
             (SELECT COUNT(*) FROM trips WHERE user_id = u.id::text) as trip_count,
             (SELECT COUNT(*) FROM reviews WHERE user_id = u.id::text) as review_count,
             (SELECT COUNT(DISTINCT country_code) FROM user_locations WHERE user_id = u.id::text AND is_public = true) as country_count
      FROM users u WHERE u.username = ${username} LIMIT 1
    `;
  } catch { notFound(); }

  if (!users.length) notFound();
  const user = users[0];

  const entries = await sql`
    SELECT je.id, je.body, je.location_name, je.media_urls, je.like_count, je.comment_count, je.created_at,
           p.name as place_name, p.slug as place_slug
    FROM journal_entries je
    LEFT JOIN places p ON p.id = je.place_id
    WHERE je.user_id = ${user.id.toString()} AND je.is_public = true
    ORDER BY je.created_at DESC LIMIT 12
  `;

  const hostedMeetups = await sql`
    SELECT id, title, location_name, meetup_date, cover_image, status,
      (SELECT COUNT(*)::int FROM meetup_attendees WHERE meetup_id = meetups.id AND status = 'going') AS attendee_count
    FROM meetups
    WHERE host_id = ${user.id.toString()} AND meetup_date > NOW() - INTERVAL '14 days' AND COALESCE(status,'open') <> 'cancelled'
    ORDER BY meetup_date ASC LIMIT 6`;

  const reviews = await sql`
    SELECT r.id, r.title, r.body, r.overall_rating, r.created_at,
           p.name as place_name, p.slug as place_slug
    FROM reviews r
    JOIN places p ON p.id = r.place_id
    WHERE r.user_id = ${user.id.toString()}
    ORDER BY r.created_at DESC LIMIT 6
  `;

  const initials = (user.display_name as string)?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', color: '#111827' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          dateCreated: user.created_at,
          mainEntity: {
            '@type': 'Person',
            name: user.display_name || user.username,
            alternateName: '@' + user.username,
            url: `https://bugbitten.com/${username}`,
            image: user.avatar_url || undefined,
            description: user.bio || undefined,
            address: user.location ? { '@type': 'PostalAddress', addressLocality: user.location } : undefined,
            interactionStatistic: [
              { '@type': 'InteractionCounter', interactionType: { '@type': 'FollowAction' }, userInteractionCount: Number(user.followers) || 0 },
            ],
          },
        }) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bugbitten.com/' },
            { '@type': 'ListItem', position: 2, name: user.display_name || user.username, item: `https://bugbitten.com/${username}` },
          ],
        }) }}
      />
      <style>{`
        @media (max-width: 640px) {
          .bb-profile-hero { flex-direction: column !important; align-items: flex-start !important; }
          .bb-profile-stats { gap: 16px !important; flex-wrap: wrap !important; }
        }
      `}</style>
      {/* Hero / Header */}
      <div style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 0' }}>
          <div className="bb-profile-hero" style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' as const }}>
            {/* Avatar */}
            {user.avatar_url ? (
              <img loading="lazy" decoding="async" src={user.avatar_url as string} alt={user.display_name as string}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid #0d9488', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, #0d9488, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: '#fff', flexShrink: 0, border: '3px solid #0d9488' }}>
                {initials}
              </div>
            )}

            {/* Name + bio */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 800, margin: '0 0 4px', color: '#111827', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                {user.display_name as string}
                {user.verification_status === 'verified' && <span title="Verified 18+" style={{ color: '#0d9488', fontSize: 20 }}>✓</span>}
                {(() => {
                  const raw = user.last_seen_at as string | null | undefined;
                  if (!raw) return null;
                  const ms = Date.now() - new Date(raw).getTime();
                  if (ms < 5 * 60 * 1000) return (
                    <span title="Active now" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}/>Active now
                    </span>
                  );
                  if (ms > 30 * 86400000) return null; // quiet > 30d
                  const label = ms < 3600000 ? `${Math.floor(ms/60000)}m ago`
                    : ms < 86400000 ? `${Math.floor(ms/3600000)}h ago`
                    : `${Math.floor(ms/86400000)}d ago`;
                  return <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, background: '#f3f4f6', padding: '2px 8px', borderRadius: 999 }}>last seen {label}</span>;
                })()}
              </h1>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                <span>@{user.username}</span>
                {(user.home_city || user.home_country) && (
                  <span style={{ color: '#0d9488' }}>· 📍 {[user.home_city, user.home_country].filter(Boolean).join(', ')}</span>
                )}
              </div>
              <ProfileRating username={user.username as string} initialRating={user.bb_rating ? Number(user.bb_rating) : null} initialCount={Number(user.bb_rating_count) || 0} />
              {user.bio && <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.5, margin: '8px 0 0', maxWidth: 500 }}>{user.bio as string}</p>}
            </div>

            {/* Follow + Block */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ProfileFollowButton username={user.username as string} targetUserId={user.id as string} />
              <BlockButton username={user.username as string} userId={user.id as string} />
            </div>
          </div>

          {/* Stats row */}
          <div className="bb-profile-stats" style={{ display: 'flex', gap: 32, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
            {[
              { val: user.post_count, label: 'Posts', href: '/' + username + '/posts' },
              { val: user.review_count, label: 'Reviews', href: '/' + username + '/reviews' },
              { val: user.trip_count, label: 'Trips', href: '/' + username + '/trips' },
              { val: user.followers, label: 'Followers', href: '/' + username + '/followers' },
              { val: user.following, label: 'Following', href: '/' + username + '/following' },
              { val: user.country_count, label: 'Countries', href: '/' + username + '/locations' },
            ].map(s => (
              <div key={s.label}>
                {s.href ? (
                  <Link href={s.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0d9488' }}>{s.val as number}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                  </Link>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0d9488' }}>{s.val as number}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>

        <ProfileSelfTips username={user.username as string} verified={user.verification_status === 'verified'} />

        {/* Travel snapshot — interests + visited / wishlist countries */}
        {((user.interests as string[])?.length > 0 || (user.visited_countries as string[])?.length > 0 || (user.wishlist_countries as string[])?.length > 0) && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 32 }}>
            {(user.interests as string[])?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Interests</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {(user.interests as string[]).map(i => (
                    <span key={i} style={{ background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{i.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            )}
            {(user.visited_countries as string[])?.length > 0 && (
              <div style={{ marginBottom: (user.wishlist_countries as string[])?.length > 0 ? 16 : 0 }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  ✈️ Visited ({(user.visited_countries as string[]).length})
                </div>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                  {(user.visited_countries as string[]).slice(0, 30).join(' · ')}
                  {(user.visited_countries as string[]).length > 30 && ' …'}
                </div>
              </div>
            )}
            {(user.wishlist_countries as string[])?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  🌟 Wishlist ({(user.wishlist_countries as string[]).length})
                </div>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                  {(user.wishlist_countries as string[]).slice(0, 30).join(' · ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hosted meetups */}
        {hostedMeetups.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Hosting</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {(hostedMeetups as any[]).map((m: any) => (
                <Link key={m.id} href={`/meetups/${m.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' as const, border: '1px solid #e5e7eb' }}>
                    {m.cover_image && <img loading="lazy" decoding="async" src={m.cover_image} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' as const, display: 'block' }} />}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>📅 {new Date(m.meetup_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                      {m.location_name && <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {m.location_name}</div>}
                      <div style={{ fontSize: 12, color: '#0d9488', marginTop: 4, fontWeight: 600 }}>👥 {m.attendee_count} going</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews section */}
        {reviews.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Reviews</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {reviews.map((r: any) => (
                <Link key={r.id} href={'/places/' + r.place_slug} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0d9488' }}>{r.place_name}</div>
                      <div style={{ display: 'flex', gap: 1 }}>
                        {[1,2,3,4,5].map((s: number) => (
                          <span key={s} style={{ color: s <= r.overall_rating ? '#f97316' : '#1e3354', fontSize: 13 }}>★</span>
                        ))}
                      </div>
                    </div>
                    {r.title && <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{r.title}</div>}
                    {r.body && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{(r.body as string).slice(0,120)}{(r.body as string).length > 120 ? '…' : ''}</div>}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>{timeAgo(r.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Journal section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#111827' }}>
            Journal {entries.length > 0 && <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 400 }}>({user.post_count as number} posts)</span>}
          </h2>

          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
              <p>No journal entries yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {entries.map((e: any) => {
                const firstSentence = (e.body as string || '').split(/[.!?\n]/)[0]?.trim() || '';
                const heading = firstSentence.length > 6
                  ? (firstSentence.length > 80 ? firstSentence.slice(0, 77) + '…' : firstSentence)
                  : (e.place_name || e.location_name ? `Journal from ${e.place_name || e.location_name}` : 'Journal entry');
                return (
                <div key={e.id} style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {user.avatar_url ? (
                      <img loading="lazy" decoding="async" src={user.avatar_url as string} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#111827', fontSize: 14 }}>{initials}</div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{user.display_name as string}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {(e.place_slug || e.location_name) && (
                          <span>📍 {e.place_slug
                            ? <Link href={'/places/' + e.place_slug} style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>{e.place_name || e.location_name}</Link>
                            : <Link href={'/explore?q=' + encodeURIComponent(e.location_name)} style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>{e.location_name}</Link>
                          } · </span>
                        )}
                        {timeAgo(e.created_at)}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>Journal</span>
                  </div>

                  <Link href={'/journal-entries/' + e.id} style={{ textDecoration: 'none' }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 8px', lineHeight: 1.35, fontFamily: 'Georgia, serif' }}>{heading}</h3>
                  </Link>

                  <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, margin: 0 }}>
                    {(e.body as string).slice(0, 320)}{(e.body as string).length > 320 ? '…' : ''}
                  </p>

                  {e.media_urls && (e.media_urls as string[]).length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, overflow: 'hidden' }}>
                      {(e.media_urls as string[]).slice(0,3).map((url: string, i: number) => (
                        <img loading="lazy" decoding="async" key={i} src={url} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8 }} />
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>♥ {e.like_count || 0}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>💬 {e.comment_count || 0}</span>
                    {e.place_name && (
                      <Link href={'/places/' + e.place_slug} style={{ marginLeft: 'auto', fontSize: 12, color: '#0d9488', textDecoration: 'none' }}>
                        {e.place_name} →
                      </Link>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
