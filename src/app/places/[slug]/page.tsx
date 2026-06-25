import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FavouriteButton } from '@/components/features/FavouriteButton'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const revalidate = 600 // 10 min ISR
import { ShareButton } from '@/components/features/ShareButton'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
import { formatParagraphs } from '@/lib/format-paragraphs'

interface Props { params: Promise<{ slug: string }> }

export default async function PlacePage({ params }: Props) {
  const { slug } = await params
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  let place: any = null
  try {
    const { db } = await import('@/lib/db')
    const rows = await db`
      SELECT p.*,
        (SELECT COUNT(*) FROM reviews  r WHERE r.place_id = p.id) as review_count,
        (SELECT AVG(rating) FROM reviews r WHERE r.place_id = p.id) as avg_rating,
        (SELECT COUNT(*) FROM checkins c WHERE c.place_id = p.id) as checkin_count
      FROM places p
      WHERE p.slug = ${slug}
        AND (${state}::text IS NULL OR p.state_code = ${state}::text)
      LIMIT 1`
    place = rows[0] || null
  } catch (e) { console.error('[place page]', e) }
  if (!place) notFound()

  // Parallelise 4 related queries (was serial: reviews → photos → nearby → relatedTours)
  const { db } = await import('@/lib/db')
  const hasCoords = place.lat != null && place.lng != null
  const [reviews, photos, nearby] = await Promise.all([
    db`SELECT r.id, r.rating, r.overall_rating, r.title, r.body, r.gps_verified, r.created_at,
              u.username, u.display_name, u.avatar_url
       FROM reviews r
       JOIN users u ON u.id::text = r.user_id
       WHERE r.place_id = ${place.id}
       ORDER BY r.created_at DESC LIMIT 20`.catch((e) => { console.error('[place reviews]', e); return [] as any[] }),
    db`
      WITH wall AS (
        SELECT je.id::text AS entry_id, 'journal' AS source, je.created_at, je.user_id,
               UNNEST(je.media_urls) AS url
        FROM journal_entries je
        WHERE je.place_id = ${place.id} AND je.is_public = true
          AND je.media_urls IS NOT NULL AND array_length(je.media_urls, 1) > 0
        UNION ALL
        SELECT c.id::text AS entry_id, 'checkin' AS source, c.created_at, c.user_id,
               UNNEST(c.images) AS url
        FROM checkins c
        WHERE c.place_id = ${place.id}
          AND c.images IS NOT NULL AND array_length(c.images, 1) > 0
        UNION ALL
        SELECT r.id::text AS entry_id, 'review' AS source, r.created_at, r.user_id,
               UNNEST(COALESCE(r.photo_urls, r.media_urls, r.images)) AS url
        FROM reviews r
        WHERE r.place_id = ${place.id}
          AND COALESCE(array_length(r.photo_urls,1), array_length(r.media_urls,1), array_length(r.images,1), 0) > 0
      )
      SELECT w.url, w.source, w.entry_id, w.created_at,
             u.username, u.display_name, u.avatar_url
      FROM wall w
      JOIN users u ON u.id::text = w.user_id
      WHERE w.url IS NOT NULL AND w.url <> ''
      ORDER BY w.created_at DESC
      LIMIT 60`.catch((e) => { console.error('[place photos]', e); return [] as any[] }),
    hasCoords
      ? db`SELECT p.slug, p.name, p.city, p.country, p.category, p.emoji, p.cover_image,
                  6371 * acos(LEAST(1.0, GREATEST(-1.0,
                    cos(radians(${place.lat})) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(${place.lng}))
                    + sin(radians(${place.lat})) * sin(radians(p.lat))
                  ))) AS distance_km
           FROM places p
           WHERE p.id <> ${place.id} AND p.lat IS NOT NULL AND p.lng IS NOT NULL
             AND p.country = ${place.country}
           ORDER BY distance_km ASC LIMIT 8`.catch(() => [] as any[])
      : place.city
        ? db`SELECT slug, name, city, country, category, emoji, cover_image, NULL::numeric AS distance_km
             FROM places WHERE id <> ${place.id} AND city = ${place.city}
             ORDER BY name ASC LIMIT 8`.catch(() => [] as any[])
        : db`SELECT slug, name, city, country, category, emoji, cover_image, NULL::numeric AS distance_km
             FROM places WHERE id <> ${place.id} AND country = ${place.country}
             ORDER BY RANDOM() LIMIT 8`.catch(() => [] as any[]),
  ]) as [any[], any[], any[]]

  // De-dupe photos by URL (a single image won't appear twice)
  const seen = new Set<string>()
  const wall = photos.filter(p => { if (seen.has(p.url)) return false; seen.add(p.url); return true })

  // Distinct contributors (top 10)
  const contribMap = new Map<string, { username: string; display_name: string; avatar_url: string | null; count: number }>()
  for (const p of photos) {
    const k = p.username
    const cur = contribMap.get(k)
    if (cur) cur.count++
    else contribMap.set(k, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, count: 1 })
  }
  const contributors = Array.from(contribMap.values()).sort((a, b) => b.count - a.count).slice(0, 10)

  const stars = Math.round(place.avg_rating || 0)
  const mapsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.city, place.country].filter(Boolean).join(', '))}`

  // JSON-LD type selection. Google Review Snippets only accept Review/AggregateRating
  // on specific parent types — LocalBusiness subtypes qualify, plain TouristAttraction
  // does NOT. For attractions we emit a dual type (LocalBusiness FIRST, since Google
  // treats the first @type as the parent node when validating rich results — leading
  // with TouristAttraction triggers "Invalid object type for field parent_node").
  const cat = (place.category || '').toLowerCase()
  const ldType: string | string[] =
      cat === 'food' || cat === 'restaurant' ? 'Restaurant'
    : cat === 'hotels' || cat === 'hotel' || cat === 'hostels' || cat === 'accommodation' ? 'LodgingBusiness'
    : cat === 'bar' || cat === 'nightlife' ? 'BarOrPub'
    : ['LocalBusiness', 'TouristAttraction']
  const pageUrl = `https://bugbitten.com/places/${slug}`
  const allImages = [place.cover_image, ...wall.map(p => p.url)].filter(Boolean).slice(0, 10)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': ldType,
    name: place.name,
    url: pageUrl,
    description: place.description || `${place.name} on BugBitten — traveller photos, reviews and check-ins.`,
    image: allImages.length ? allImages : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: place.city || undefined,
      addressCountry: place.country || undefined,
      streetAddress: place.address || undefined,
    },
    geo: place.lat && place.lng ? {
      '@type': 'GeoCoordinates',
      latitude: Number(place.lat),
      longitude: Number(place.lng),
    } : undefined,
    aggregateRating: place.review_count > 0 && place.avg_rating ? {
      '@type': 'AggregateRating',
      ratingValue: Number(Number(place.avg_rating).toFixed(1)),
      reviewCount: Number(place.review_count),
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    // Omit `review` entirely when there are none — an empty array attached to a
    // non-supported parent type still trips Google's review-snippet validator.
    review: reviews.length > 0 ? reviews.slice(0, 5).map((r: any) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.display_name || r.username || 'Traveller' },
      reviewRating: { '@type': 'Rating', ratingValue: r.overall_rating || r.rating || 0, bestRating: 5, worstRating: 1 },
      reviewBody: (r.body || '').slice(0, 500),
      datePublished: r.created_at,
    })) : undefined,
  }
  // Strip undefined fields (JSON.stringify already does this, but cleaner ld output)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://bugbitten.com/explore' },
      ...(place.country ? [{ '@type': 'ListItem', position: 2, name: place.country, item: `https://bugbitten.com/country/${place.country.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}` }] : []),
      { '@type': 'ListItem', position: place.country ? 3 : 2, name: place.name, item: pageUrl },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', color: '#111827', fontFamily: 'system-ui' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <style>{`
        @media (max-width: 1024px) {
          .bb-place-grid { grid-template-columns: 1fr !important; }
          .bb-place-grid > :first-child { display: none !important; }
        }
      `}</style>
      <div className="bb-place-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' as const }}>
        <LeftSidebar />
        <div>
        <h1 style={{ fontFamily: 'Georgia', fontSize: 32, margin: '0 0 8px' }}>{place.name}</h1>
        <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 12 }}>
          {(() => {
            const countrySlug = place.country ? place.country.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') : '';
            const citySlug = place.city ? place.city.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') : '';
            const parts: React.ReactNode[] = [];
            if (place.city && countrySlug && citySlug) parts.push(<Link key="city" href={`/places/city/${countrySlug}/${citySlug}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{place.city}</Link>);
            else if (place.city) parts.push(<span key="city">{place.city}</span>);
            if (place.country && countrySlug) parts.push(<Link key="country" href={`/country/${countrySlug}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{place.country}</Link>);
            else if (place.country) parts.push(<span key="country">{place.country}</span>);
            return parts.reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ', ', el]), []);
          })()}
          {place.category && <span style={{ marginLeft: 12, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{place.category}</span>}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#6b7280', marginBottom: 24, flexWrap: 'wrap' as const }}>
          <div>
            <span style={{ color: 'var(--brand)' }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span style={{ marginLeft: 8 }}>{place.avg_rating ? Number(place.avg_rating).toFixed(1) : '—'} ({place.review_count || 0} reviews)</span>
          </div>
          <div>📍 {place.checkin_count || 0} check-ins</div>
          <div>📷 {wall.length} photo{wall.length === 1 ? '' : 's'}</div>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
            View on Google Maps →
          </a>
        </div>
        {place.description && (
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #e5e7eb', fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
            {formatParagraphs(place.description).map((para, i) => <p key={i} style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{para}</p>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' as const }}>
          <a href={'/check-in?place=' + place.id} style={{ background: 'var(--brand)', color: '#fff', padding: '12px 24px', borderRadius: 20, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Check In Here</a>
          <a href={'/reviews/new?place=' + place.id} style={{ background: '#fff', border: '1px solid var(--brand)', color: 'var(--brand)', padding: '12px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Write a Review</a>
          <FavouriteButton placeId={place.id} />
          <ShareButton url={`https://bugbitten.com/places/${place.slug}`} text={`${place.name} — ${place.city || place.country || ''} on BugBitten`} />
        </div>

        {/* Photo wall */}
        <h2 style={{ fontFamily: 'Georgia', fontSize: 22, margin: '0 0 16px' }}>Photos</h2>
        {wall.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
            No photos yet. Be the first — check in or post a public journal entry with photos.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 32 }}>
            {wall.map((p, i) => (
              <Link key={p.entry_id + ':' + i} href={'/' + p.username} style={{ position: 'relative' as const, display: 'block', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#e5e7eb', textDecoration: 'none' }}>
                <img src={p.url} alt={`Photo by ${p.display_name || p.username} of ${place.name}`} loading="lazy"
                  style={{ position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const }} />
                <div style={{ position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: '14px 10px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.avatar_url
                    ? <img loading="lazy" decoding="async" src={p.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' as const, border: '1.5px solid #fff' }} />
                    : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 11, fontWeight: 700, border: '1.5px solid #fff' }}>{(p.display_name || p.username || '?')[0].toUpperCase()}</div>
                  }
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {p.display_name || p.username}
                  </span>
                </div>
                <span style={{ position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, textTransform: 'capitalize' as const }}>
                  {p.source}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Contributors */}
        {contributors.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'Georgia', fontSize: 22, margin: '0 0 16px' }}>People who've been here</h2>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, marginBottom: 32, display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
              {contributors.map(c => (
                <Link key={c.username} href={'/' + c.username} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', borderRadius: 99, padding: '6px 12px 6px 6px', textDecoration: 'none' }}>
                  {c.avatar_url
                    ? <img loading="lazy" decoding="async" src={c.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' as const }} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 12, fontWeight: 700 }}>{(c.display_name || c.username)[0].toUpperCase()}</div>
                  }
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{c.display_name || c.username}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>· {c.count}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Reviews */}
        <h2 style={{ fontFamily: 'Georgia', fontSize: 22, margin: '0 0 16px' }}>Reviews</h2>
        {reviews.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            No reviews yet. Be the first to write one!
          </div>
        ) : reviews.map((r: any) => {
          const rStars = Math.round(r.overall_rating || r.rating || 0)
          return (
            <div key={r.id} style={{ background: '#ffffff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <Link href={'/' + r.username} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  {r.avatar_url
                    ? <img loading="lazy" decoding="async" src={r.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' as const }} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 12, fontWeight: 700 }}>{(r.display_name || r.username || '?')[0].toUpperCase()}</div>
                  }
                  <span style={{ fontWeight: 600, color: '#111827' }}>{r.display_name || r.username || 'Traveller'}</span>
                </Link>
                <span style={{ color: 'var(--brand)' }}>{'★'.repeat(rStars)}{'☆'.repeat(5 - rStars)}</span>
              </div>
              {r.title && <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>{r.title}</div>}
              <div style={{ color: '#374151', fontSize: 14, lineHeight: 1.6 }}>{r.body}</div>
            </div>
          )
        })}

        {/* Nearby */}
        {nearby.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'Georgia', fontSize: 22, margin: '40px 0 16px' }}>Nearby{place.country ? ' in ' + place.country : ''}</h2>
            <div className="bb-row-grid">
              {(() => {
                // Clamp to a multiple of 4 so the last row isn't ragged.
                const n = nearby.length >= 4 ? Math.floor(nearby.length / 4) * 4 : nearby.length
                return nearby.slice(0, n)
              })().map((n: any) => (
                <Link key={n.slug} href={'/places/' + n.slug} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#ffffff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <div style={{ height: 110, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                      {n.cover_image
                        ? <img loading="lazy" decoding="async" src={n.cover_image} alt={n.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const }} />
                        : <span style={{ fontSize: 40 }}>{n.emoji || '📍'}</span>}
                      {n.distance_km != null && (
                        <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                          {(() => { const km = Number(n.distance_km); return km < 1 ? Math.round(km * 1000) + ' m' : km < 50 ? km.toFixed(1) + ' km' : Math.round(km) + ' km'; })()}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: 14, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{n.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{[n.city, n.country].filter(Boolean).join(', ')}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  try {
    const tenant = await getTenant()
    const { db } = await import('@/lib/db')
    const rows = await db`
      SELECT name, city, country, category, description, cover_image, bb_rating, bb_review_count
      FROM places WHERE slug = ${slug} LIMIT 1`
    if (rows[0]) {
      const p = rows[0]
      const loc = [p.city, p.country].filter(Boolean).join(', ')
      const title = `${p.name}${loc ? ' — ' + loc : ''}`
      const rating = p.bb_review_count > 0 && p.bb_rating ? ` · ${Number(p.bb_rating).toFixed(1)}★ (${p.bb_review_count} reviews)` : ''
      const desc = p.description
        ? p.description.slice(0, 155).replace(/\s+\S*$/, '') + (p.description.length > 155 ? '…' : '')
        : `Travellers' photos, reviews and check-ins for ${p.name}${loc ? ' in ' + loc : ''}${rating}. Document your visit on ${tenant.name}.`
      const url = `https://${tenant.host}/places/${slug}`
      const image = p.cover_image || tenant.ogImage
      return {
        title,
        description: desc,
        alternates: { canonical: url },
        openGraph: {
          type: 'article',
          title,
          description: desc,
          url,
          images: [{ url: image, alt: p.name }],
          siteName: tenant.name,
        },
        twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
      }
    }
  } catch {}
  return { title: slug.replace(/-/g, ' ') }
}
