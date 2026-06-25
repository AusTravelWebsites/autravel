import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import type { Metadata } from 'next';
import { MeetupDetailClient } from '@/components/features/MeetupDetailClient';
import { MeetupComments } from '@/components/features/MeetupComments';
import { MeetupGallery } from '@/components/features/MeetupGallery';
import { MeetupMapPin } from '@/components/features/MeetupMapPin';
import { MeetupHostPanel } from '@/components/features/MeetupHostPanel';
import { MeetupHostControls } from '@/components/features/MeetupHostControls';
import { ReportButton } from '@/components/features/ReportButton';
import { ShareButton } from '@/components/features/ShareButton';

export const revalidate = 60;

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const { getTenant } = await import('@/lib/get-tenant');
    const tenant = await getTenant();
    const [m] = await sql`SELECT title, description, location_name, cover_image, meetup_date FROM meetups WHERE id = ${id} LIMIT 1`;
    if (m) {
      const title = `${m.title}${m.location_name ? ' — ' + m.location_name : ''} (Meetup)`;
      const desc = (m.description || '').slice(0, 155) || `Travel meetup${m.location_name ? ' in ' + m.location_name : ''} on ${new Date(m.meetup_date).toLocaleDateString()}.`;
      const url = `https://${tenant.host}/meetups/${id}`;
      const image = m.cover_image || tenant.ogImage;
      return {
        title, description: desc,
        alternates: { canonical: url },
        openGraph: { type: 'website', title, description: desc, url, images: [{ url: image }], siteName: tenant.name },
        twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
      };
    }
  } catch {}
  return { title: 'Meetup' };
}

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function MeetupDetailPage({ params }: Props) {
  const { id } = await params;
  const rows = await sql`
    SELECT m.*, u.username AS host_username, u.display_name AS host_display_name,
           u.avatar_url AS host_avatar_url, u.bb_rating AS host_rating, u.bb_rating_count AS host_rating_count, u.last_seen_at AS host_last_seen_at,
           u.verification_status AS host_verified
    FROM meetups m JOIN users u ON u.id::text = m.host_id
    WHERE m.id = ${id} LIMIT 1`;
  if (!rows.length) notFound();
  const m: any = rows[0];

  const attendees = await sql`
    SELECT ma.status, ma.status_extended, u.username, u.display_name, u.avatar_url, u.bb_rating, u.verification_status, u.last_seen_at
    FROM meetup_attendees ma JOIN users u ON u.id::text = ma.user_id
    WHERE ma.meetup_id = ${id} AND (ma.status = 'going' OR ma.status_extended IN ('going','waitlist','requested'))
    ORDER BY ma.created_at ASC LIMIT 100`;

  const goingCount = attendees.filter((a: any) => a.status === 'going' || a.status_extended === 'going').length;

  const scopeLabel: Record<string, string> = {
    public: '🌍 Open to everyone',
    verified_only: '✓ Verified travellers only',
    friends_only: '🤝 Friends only',
    friends_of_friends: '👥 Friends of friends',
  };

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', color: '#111827' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: m.title,
          description: m.description || undefined,
          startDate: m.meetup_date,
          eventStatus: m.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: m.location_name ? { '@type': 'Place', name: m.location_name } : undefined,
          image: m.cover_image || undefined,
          organizer: { '@type': 'Person', name: m.host_display_name || m.host_username, url: `https://bugbitten.com/${m.host_username}` },
        }) }}
      />

      {m.cover_image && (
        <div style={{ width: '100%', height: 'clamp(200px, 34vw, 380px)', background: `url(${m.cover_image}) center/cover no-repeat, #e5e7eb` }} />
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
        <Link href="/meetups" style={{ color: '#6b7280', fontSize: 14, textDecoration: 'none' }}>← All meetups</Link>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginTop: 18, marginBottom: 12 }}>
          {m.category && <span style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #99f6e4', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{m.category}</span>}
          <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>{scopeLabel[m.scope] || m.scope}</span>
          {m.women_only && <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Women only</span>}
          {m.host_approval_required && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Host approves</span>}
          {m.status === 'cancelled' && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>Cancelled</span>}
          {m.recurrence && <span style={{ background: '#ecfdf5', color: 'var(--brand-dark)', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>🔁 {m.recurrence === 'weekly' ? 'Weekly' : 'Monthly'}</span>}
        </div>

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 800, margin: '0 0 12px' }}>{m.title}</h1>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, color: '#374151', fontSize: 15, marginBottom: 24 }}>
          <div>📅 {fmt(m.meetup_date)}</div>
          {m.location_name && <div>📍 {m.location_name}</div>}
          <div>👥 {goingCount}{m.max_attendees ? ` of ${m.max_attendees}` : ''} going</div>
        </div>

        {/* Host card */}
        <Link href={`/${m.host_username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 24 }}>
            <div style={{ position: 'relative' as const, flexShrink: 0 }}>
            {m.host_avatar_url ? (
              <img loading="lazy" decoding="async" src={m.host_avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' as const }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700, fontSize: 20 }}>
                {(m.host_display_name || m.host_username || '?')[0].toUpperCase()}
              </div>
            )}
            {m.host_last_seen_at && Date.now() - new Date(m.host_last_seen_at).getTime() < 5 * 60 * 1000 && (
              <span title="Active now" style={{ position: 'absolute' as const, bottom: 0, right: 0, width: 14, height: 14, background: '#10b981', border: '2px solid #fff', borderRadius: '50%' }} />
            )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Hosted by</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{m.host_display_name || m.host_username}</span>
                {m.host_verified === 'verified' && <span title="Verified" style={{ color: 'var(--brand)', fontSize: 13 }}>✓</span>}
                {m.host_rating != null && (
                  <span style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 999, padding: '1px 8px', fontWeight: 600 }}>
                    ★ {Number(m.host_rating).toFixed(1)} <span style={{ fontWeight: 400, color: '#78350f' }}>({m.host_rating_count})</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        {m.description && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            {m.description.split(/\n\n+/).map((p: string, i: number) => (
              <p key={i} style={{ margin: i === 0 ? '0 0 12px' : '0 0 12px', lineHeight: 1.7, fontSize: 15 }}>{p}</p>
            ))}
          </div>
        )}

        {m.lat != null && m.lng != null && (
          <MeetupMapPin lat={Number(m.lat)} lng={Number(m.lng)} label={m.location_name || m.title} />
        )}

        <MeetupDetailClient meetupId={m.id} hostId={m.host_id} hostUsername={m.host_username} meetupDate={m.meetup_date} />
        <MeetupHostControls meetupId={m.id} hostId={m.host_id} status={m.status || 'open'} />
        <MeetupHostPanel meetupId={m.id} hostId={m.host_id} />
        <MeetupGallery meetupId={m.id} hostId={m.host_id} initialGallery={Array.isArray(m.gallery) ? m.gallery : []} />

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' as const }}>
          <ShareButton url={`https://bugbitten.com/meetups/${m.id}`} text={m.title} />
          <ReportButton targetType="meetup" targetId={m.id} />
        </div>

        <MeetupComments meetupId={m.id} />

        {attendees.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Going ({goingCount})</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
              {attendees.filter((a: any) => a.status === 'going' || a.status_extended === 'going').map((a: any) => {
                const active = a.last_seen_at && Date.now() - new Date(a.last_seen_at).getTime() < 5 * 60 * 1000;
                return (
                <Link key={a.username} href={`/${a.username}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 12px 4px 4px' }}>
                  <div style={{ position: 'relative' as const, width: 28, height: 28 }}>
                  {a.avatar_url ? (
                    <img loading="lazy" decoding="async" src={a.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' as const }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 12, fontWeight: 700 }}>{(a.display_name || a.username || '?')[0].toUpperCase()}</div>
                  )}
                  {active && <span style={{ position: 'absolute' as const, bottom: -1, right: -1, width: 9, height: 9, background: '#10b981', border: '2px solid #fff', borderRadius: '50%' }} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.display_name || a.username}</span>
                  {a.verification_status === 'verified' && <span style={{ color: 'var(--brand)', fontSize: 11 }}>✓</span>}
                  {a.bb_rating != null && <span style={{ fontSize: 11, color: '#92400e' }}>★{Number(a.bb_rating).toFixed(1)}</span>}
                </Link>
              );})}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
