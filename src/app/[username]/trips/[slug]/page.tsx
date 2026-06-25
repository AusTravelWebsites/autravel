import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { TripOwnerActions } from '@/components/features/TripOwnerActions'
import { TripGalleryEditor } from '@/components/features/TripGalleryEditor'
import { ShareButton } from '@/components/features/ShareButton'
import { ReportButton } from '@/components/features/ReportButton'

async function TripTags({ ids }: { ids: string[] }) {
  let users: any[] = []
  try {
    users = await db`SELECT id::text AS id, username, display_name, avatar_url FROM users WHERE id::text = ANY(${ids as any})`
  } catch {}
  if (!users.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
      {users.map(u => (
        <Link key={u.id} href={'/' + u.username} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 99, padding: '6px 14px 6px 6px', textDecoration: 'none' }}>
          {u.avatar_url
            ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' as const }} />
            : <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(u.display_name || u.username)[0].toUpperCase()}</span>}
          <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{u.display_name || u.username}</span>
        </Link>
      ))}
    </div>
  )
}

interface Props { params: Promise<{ username: string; slug: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)' }

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 7) return days + 'd ago'
  if (days < 30) return Math.floor(days/7) + 'w ago'
  return Math.floor(days/30) + 'mo ago'
}

async function loadTrip(username: string, slug: string) {
  const rows = await db`
    SELECT t.*,
           u.username, u.display_name, u.avatar_url,
           p.slug AS place_slug, p.name AS place_name,
           (SELECT COUNT(*) FROM journal_entries je WHERE je.trip_id = t.id) AS entry_count
    FROM trips t
    JOIN users u ON u.id::text = t.user_id
    LEFT JOIN places p ON p.id = t.place_id
    WHERE u.username = ${username} AND t.slug = ${slug} LIMIT 1`
  return rows[0] || null
}

export default async function TripPage({ params }: Props) {
  const { username, slug } = await params
  const trip = await loadTrip(username, slug)
  if (!trip) notFound()

  let entries: any[] = []
  try {
    entries = await db`
      SELECT je.id, je.body, je.location_name, je.media_urls, je.like_count, je.comment_count, je.created_at,
             p.slug AS place_slug, p.name AS place_name
      FROM journal_entries je
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.trip_id = ${trip.id} AND je.is_public = true
      ORDER BY je.created_at DESC LIMIT 50`
  } catch {}

  const dateRange = trip.start_date
    ? new Date(trip.start_date).toLocaleDateString('en', { month: 'short', year: 'numeric' }) +
      (trip.end_date ? ' – ' + new Date(trip.end_date).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : ' – ongoing')
    : null

  const canonical = `https://bugbitten.com/${trip.username}/trips/${trip.slug}`
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: (trip.description || `${trip.display_name || trip.username}'s trip on BugBitten`).slice(0, 5000),
    url: canonical,
    ...(trip.start_date && { itinerary: { '@type': 'ItemList', numberOfItems: Number(trip.entry_count) || entries.length } }),
    ...(trip.cover_image && { image: trip.cover_image }),
    ...(trip.start_date && { startDate: trip.start_date }),
    ...(trip.end_date && { endDate: trip.end_date }),
    provider: {
      '@type': 'Person',
      name: trip.display_name || trip.username,
      url: `https://bugbitten.com/${trip.username}`,
      ...(trip.avatar_url && { image: trip.avatar_url }),
    },
    isPartOf: { '@type': 'WebSite', name: 'BugBitten', url: 'https://bugbitten.com' },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bugbitten.com/' },
      { '@type': 'ListItem', position: 2, name: trip.display_name || trip.username, item: `https://bugbitten.com/${trip.username}` },
      { '@type': 'ListItem', position: 3, name: 'Trips', item: `https://bugbitten.com/${trip.username}/trips` },
      { '@type': 'ListItem', position: 4, name: trip.title, item: canonical },
    ],
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 16px' }}>
        {trip.cover_image && (
          <div style={{ borderRadius:16, overflow:'hidden', marginBottom:28, height:260 }}>
            <img loading="lazy" decoding="async" src={trip.cover_image} alt={trip.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
        )}
        <Link href={'/' + trip.username + '/trips'} style={{ display:'inline-flex', alignItems:'center', gap:6, color:C.sub, textDecoration:'none', fontSize:14, fontWeight:500, marginBottom:8 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>←</span> All trips
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          {trip.cover_emoji && <span style={{ fontSize:36 }}>{trip.cover_emoji}</span>}
          <h1 style={{ fontFamily:'Georgia', fontSize:34, margin:0, lineHeight:1.2, color:C.text }}>{trip.title}</h1>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' }}>
          <Link href={'/' + trip.username} style={{ color:C.teal, textDecoration:'none', fontSize:14, fontWeight:600 }}>
            {trip.display_name || trip.username}
          </Link>
          {(trip.place_slug || trip.location_name) && (
            <span style={{ fontSize: 13 }}>
              📍 {trip.place_slug
                ? <Link href={`/places/${trip.place_slug}`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{trip.place_name || trip.location_name}</Link>
                : <Link href={`/explore?q=${encodeURIComponent(trip.location_name)}`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{trip.location_name}</Link>}
            </span>
          )}
          {dateRange && <span style={{ fontSize:13, color:C.sub }}>{dateRange}</span>}
          {trip.country_count > 0 && (
            <span style={{ background:C.tealLight, border:`1px solid #99f6e4`, color:C.teal, borderRadius:20, padding:'2px 10px', fontSize:12 }}>
              {trip.country_count} {trip.country_count === 1 ? 'country' : 'countries'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 16 }}>
          <TripOwnerActions tripId={trip.id} ownerId={trip.user_id} />
          <ShareButton url={canonical} text={`${trip.title} — ${trip.display_name || trip.username}'s trip on BugBitten`} />
          <ReportButton targetType="trip" targetId={trip.id} />
        </div>
        {trip.description && (
          <div style={{ fontSize:16, color:'#374151', lineHeight:1.8, marginBottom:32, borderLeft:`3px solid ${C.teal}`, paddingLeft:16 }}>
            {trip.description}
          </div>
        )}

        <TripGalleryEditor
          tripId={trip.id}
          ownerId={trip.user_id}
          tripTitle={trip.title}
          initial={Array.isArray(trip.gallery) ? trip.gallery : []}
        />

        {Array.isArray(trip.tagged_user_ids) && trip.tagged_user_ids.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Georgia', fontSize: 20, margin: '0 0 12px', color: C.text }}>Travelled with</h2>
            <TripTags ids={trip.tagged_user_ids} />
          </div>
        )}

        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h2 style={{ fontFamily:'Georgia', fontSize:22, margin:0, color:C.text }}>Journal</h2>
            <span style={{ fontSize:13, color:C.sub }}>{Number(trip.entry_count) || 0} {Number(trip.entry_count) === 1 ? 'entry' : 'entries'}</span>
          </div>
          {entries.length === 0 ? (
            <div style={{ background:C.card, borderRadius:12, padding:24, border:`1px solid ${C.border}`, textAlign:'center', color:C.sub, fontSize:14 }}>
              No journal entries on this trip yet.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {entries.map((e: any) => (
                <div key={e.id} style={{ background:C.card, borderRadius:12, padding:'16px 20px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12, color:C.sub, marginBottom:6 }}>
                    {(e.place_slug || e.location_name) && (
                      <span>📍 {e.place_slug
                        ? <Link href={`/places/${e.place_slug}`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{e.place_name || e.location_name}</Link>
                        : <Link href={`/explore?q=${encodeURIComponent(e.location_name)}`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{e.location_name}</Link>
                      } · </span>
                    )}
                    {timeAgo(e.created_at)}
                  </div>
                  <Link href={'/journal-entries/' + e.id} style={{ textDecoration:'none' }}>
                    <h3 style={{ fontFamily:'Georgia, serif', fontSize:17, fontWeight:700, color:C.text, margin:'0 0 8px', lineHeight:1.35 }}>{((e.body || '').split(/[.!?\n]/)[0] || '').slice(0,80) || 'Journal entry'}</h3>
                  </Link>
                  <p style={{ fontSize:15, color:'#374151', lineHeight:1.7, margin:0 }}>{e.body}</p>
                  {e.media_urls && e.media_urls.length > 0 && (
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      {e.media_urls.slice(0,3).map((url: string, i: number) => (
                        <img loading="lazy" decoding="async" key={i} src={url} alt="" style={{ width:100, height:70, objectFit:'cover', borderRadius:8 }} />
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:16, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.bg}`, fontSize:13, color:C.sub }}>
                    <span>♥ {e.like_count || 0}</span>
                    <span>💬 {e.comment_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { username, slug } = await params
  try {
    const { getTenant } = await import('@/lib/get-tenant')
    const tenant = await getTenant()
    const trip = await loadTrip(username, slug)
    if (trip) {
      const title = `${trip.title} — ${trip.display_name || trip.username}`
      const desc = (trip.description && (trip.description as string).trim())
        ? (trip.description as string).slice(0, 155)
        : `${trip.display_name || trip.username}'s trip "${trip.title}" on ${tenant.name} — travel journal, photos, and entries.`
      const canonical = `https://${tenant.host}/${trip.username}/trips/${trip.slug}`
      const image = trip.cover_image || tenant.ogImage
      return {
        title,
        description: desc,
        alternates: { canonical },
        openGraph: { type: 'article', title, description: desc, url: canonical, images: [{ url: image, alt: trip.title }], siteName: tenant.name },
        twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
      }
    }
  } catch {}
  return { title: 'Trip not found' }
}
