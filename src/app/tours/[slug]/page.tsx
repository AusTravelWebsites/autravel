import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, tourStatesFor } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'
import { SaveButton } from '@/components/features/SaveButton'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { sanitizeForEditor } from '@/lib/wp-html'

// Render a tour's rich-text field. Old content is plain text with \n line
// breaks; new content (edited via /admin/tours/[id]/edit) is real HTML with
// <a target="_blank">, lists, formatting. We detect which mode the content
// is in and render appropriately so links display as links, not as raw markup.
function renderRichField(raw: string): string {
  if (!raw) return ''
  const hasHtmlTags = /<(?:a|p|h[1-6]|ul|ol|li|strong|em|b|i|br|blockquote)\b/i.test(raw)
  if (hasHtmlTags) {
    // Sanitise first so any stale <script>/<style> never reaches the page.
    return sanitizeForEditor(raw)
  }
  // Plain text: escape, then turn double-newlines into paragraph breaks and
  // single newlines into <br>. Preserves the look of the old whiteSpace:pre-wrap.
  const esc = raw.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  return '<p>' + esc.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br/>')).join('</p><p>') + '</p>'
}

type Params = Promise<{ slug: string }>

type Tour = {
  slug: string
  title: string
  country: string | null
  city: string | null
  state_code: string | null
  duration_label: string | null
  duration_min: number | null
  price_from: string | null
  currency: string | null
  rating: string | null
  review_count: number | null
  cover_image: string | null
  images: string[] | null
  booking_url: string
  summary_ai: string | null
  highlights_ai: string[] | null
  what_to_expect_ai: string | null
  good_to_know_ai: string | null
  source: string
}

async function getTour(slug: string, tourStates: StateCode[] | null): Promise<Tour | null> {
  try {
    const [row] = await db<Tour[]>`
      SELECT slug, title, country, city, state_code, duration_label, duration_min,
             price_from, currency, rating, review_count,
             cover_image, images, booking_url,
             summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai, source
      FROM tours
      WHERE slug = ${slug}
        AND active = true
        AND ${tourStates === null ? db`true` : db`state_code = ANY(${tourStates})`}
      LIMIT 1`
    return row || null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  const tour = await getTour(slug, tourStatesFor(tenant))
  if (!tour) return { title: 'Tour not found' }
  // Title: trim to ≤60 chars to avoid Google SERP truncation. Layout adds " · {tenant.name}" so budget headroom.
  const rawTitle = tour.title
  const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
  const rawDesc = tour.summary_ai || `${tour.title} — tour in ${[tour.city, tour.country].filter(Boolean).join(', ')}`
  // 155 chars keeps the snippet inside Google's typical desktop cut-off.
  const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
  const url = `https://${tenant.host}/tours/${tour.slug}/`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: tour.cover_image ? [tour.cover_image] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: tour.cover_image ? [tour.cover_image] : [] },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' }

export default async function TourDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const tenant = await getTenant()
  const tour = await getTour(slug, tourStatesFor(tenant))
  if (!tour) notFound()

  const gallery = (tour.images || []).filter(Boolean)
  const partnerLabel = tour.source === 'viator' ? 'Viator' : tour.source === 'wetravel' ? 'WeTravel' : 'our partners'
  const canonical = `https://${tenant.host}/tours/${tour.slug}/`
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Tours', item: `https://${tenant.host}/tours/` },
      { '@type': 'ListItem', position: 3, name: tour.title, item: canonical },
    ],
  }

  // Dual type: Product makes aggregateRating valid for Google Review Snippets
  // (TouristTrip alone is NOT a supported parent). Product MUST come first —
  // Google treats the first @type as the parent node when validating rich results,
  // and listing TouristTrip first triggers "Invalid object type for field parent_node".
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['Product', 'TouristTrip'],
    name: tour.title,
    description: tour.summary_ai || undefined,
    image: tour.cover_image || undefined,
    url: canonical,
    touristType: [tour.city, tour.country].filter(Boolean).join(', ') || undefined,
    // Google rejects aggregateRating when reviewCount is 0 — require at least 1.
    aggregateRating: tour.rating && Number(tour.review_count || 0) > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Number(tour.rating),
      reviewCount: Number(tour.review_count),
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    offers: tour.price_from ? {
      '@type': 'Offer',
      price: Number(tour.price_from),
      priceCurrency: tour.currency || 'AUD',
      availability: 'https://schema.org/InStock',
      url: tour.booking_url,
    } : undefined,
  }

  // Generate FAQs from tour metadata — eligible for FAQ rich results.
  const tourFaqs: Array<{ q: string; a: string }> = []
  if (tour.duration_label || tour.duration_min) {
    tourFaqs.push({
      q: `How long does ${tour.title} take?`,
      a: tour.duration_label
        ? `${tour.title} runs for approximately ${tour.duration_label}.`
        : `${tour.title} runs for about ${tour.duration_min} minutes.`,
    })
  }
  if (tour.price_from) {
    tourFaqs.push({
      q: `How much does ${tour.title} cost?`,
      a: `Prices start from ${tour.currency || 'AUD'} $${Number(tour.price_from).toFixed(0)} per person. Final pricing varies by date, group size and any add-ons — confirmed at checkout via ${partnerLabel}.`,
    })
  }
  if (tour.city || tour.country) {
    tourFaqs.push({
      q: `Where does ${tour.title} run?`,
      a: `This tour operates around ${[tour.city, tour.country].filter(Boolean).join(', ')}. Specific meeting points and pickup options are listed by the operator at checkout.`,
    })
  }
  tourFaqs.push({
    q: `Who runs ${tour.title}?`,
    a: `The tour is sold and operated by its supplier through ${partnerLabel}. ${tenant.name} earns a small commission on bookings made via the link, which keeps this site free for travellers.`,
  })
  tourFaqs.push({
    q: `Is the tour confirmed at the listed price?`,
    a: `The price shown is the operator's "from" price as of our last sync. Final price, currency conversion, group discounts and cancellation policy are confirmed at checkout — always review before paying.`,
  })
  const tourFaqLd = tourFaqs.length >= 2 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tourFaqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}/>
      {tourFaqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tourFaqLd) }}/>}

      {/* Hero */}
      {tour.cover_image && (
        <div style={{ width: '100%', height: 'clamp(220px,32vw,380px)', background: '#0b1420', overflow: 'hidden' as const, position: 'relative' as const }}>
          <img src={tour.cover_image} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.85 }}/>
          <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)' }}/>
          <div style={{ position: 'absolute' as const, left: 0, right: 0, bottom: 0, padding: '18px 20px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ marginBottom: 8 }}>
                <Breadcrumbs crumbs={[
                  { href: '/', label: 'Home' },
                  { href: '/tours/', label: 'Tours' },
                  ...(tour.country ? [{ href: `/tours?country=${encodeURIComponent(tour.country)}`, label: tour.country }] : []),
                  { label: tour.title.length > 60 ? tour.title.slice(0, 57).replace(/\s+\S*$/, '') + '…' : tour.title },
                ]}/>
              </div>
              <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(22px,4vw,34px)', margin: 0, lineHeight: 1.2, textShadow: '0 2px 14px rgba(0,0,0,0.4)' }}>{tour.title}</h1>
              <div style={{ color: 'rgba(255,255,255,0.9)', marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' as const, fontSize: 14 }}>
                {tour.rating && <span><b>★ {Number(tour.rating).toFixed(1)}</b>{tour.review_count ? ` · ${Number(tour.review_count).toLocaleString()} reviews` : ''}</span>}
                {tour.duration_label && <span>⏱ {tour.duration_label}</span>}
                {[tour.city, tour.country].filter(Boolean).length > 0 && <span>📍 {[tour.city, tour.country].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 28 }}>
        <div style={{ minWidth: 0 }}>
          {/* Gallery */}
          {gallery.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 6, marginBottom: 24 }}>
              {gallery.slice(0, 8).map((u, i) => (
                <div key={u + i} style={{ aspectRatio: '4/3', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' as const }}>
                  <img src={u} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {tour.summary_ai && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px', color: C.text }}>About this tour</h2>
              <div className="tour-rich" style={{ fontSize: 15, lineHeight: 1.65, color: C.text }}
                dangerouslySetInnerHTML={{ __html: renderRichField(tour.summary_ai) }}/>
            </section>
          )}

          {/* Highlights */}
          {tour.highlights_ai && tour.highlights_ai.length > 0 && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px', color: C.text }}>Highlights</h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: C.text }}>
                {tour.highlights_ai.map((h, i) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}
              </ul>
            </section>
          )}

          {/* What to expect */}
          {tour.what_to_expect_ai && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px', color: C.text }}>What to expect</h2>
              <div className="tour-rich" style={{ fontSize: 15, lineHeight: 1.65, color: C.text }}
                dangerouslySetInnerHTML={{ __html: renderRichField(tour.what_to_expect_ai) }}/>
            </section>
          )}

          {/* Good to know */}
          {tour.good_to_know_ai && (
            <section style={{ background: C.tealLight, border: `1px solid #a7f3d0`, borderRadius: 14, padding: '18px 22px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 17, margin: '0 0 8px', color: '#065f46' }}>Good to know</h2>
              <div className="tour-rich tour-rich-gtk" style={{ fontSize: 14, lineHeight: 1.6, color: '#065f46' }}
                dangerouslySetInnerHTML={{ __html: renderRichField(tour.good_to_know_ai) }}/>
            </section>
          )}

          {tourFaqs.length >= 2 && (
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 18, margin: '0 0 12px', color: C.text }}>Frequently asked</h2>
              <dl style={{ margin: 0 }}>
                {tourFaqs.map((f, i) => (
                  <div key={i} style={{ marginBottom: i < tourFaqs.length - 1 ? 12 : 0 }}>
                    <dt style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{f.q}</dt>
                    <dd style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, margin: 0 }}>{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <p style={{ fontSize: 11, color: C.sub, marginTop: 18, lineHeight: 1.5 }}>
            Tour sold and operated by its supplier via{' '}
            <a href="https://www.viator.com" target="_blank" rel="noopener noreferrer" style={{ color: C.sub }}>{partnerLabel}</a>.
            Descriptions on this page are original {tenant.name} summaries, not copied from the operator. Prices and availability are confirmed at checkout.
          </p>
        </div>

        {/* Booking sidebar */}
        <aside>
          <div style={{ position: 'sticky' as const, top: 90, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 22px 18px' }}>
            {tour.price_from && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>From</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'Georgia, serif' }}>
                  {tour.currency || 'AUD'} ${Number(tour.price_from).toFixed(0)}
                </div>
                <div style={{ fontSize: 11, color: C.sub }}>per person · final price at checkout</div>
              </div>
            )}
            {tour.duration_label && (
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                ⏱ {tour.duration_label}
              </div>
            )}
            <a href={tour.booking_url} target="_blank" rel="noopener noreferrer"
               style={{ display: 'block', background: C.teal, color: '#fff', borderRadius: 10, padding: '13px 16px', fontWeight: 700, fontSize: 15, textAlign: 'center' as const, textDecoration: 'none' }}>
              Check availability on {partnerLabel}
            </a>
            <div style={{ marginTop: 10, textAlign: 'center' as const }}>
              <SaveButton type="tour" slug={tour.slug} name={tour.title} href={`/tours/${tour.slug}/`} image={tour.cover_image} state_code={tour.state_code || ''} region={tour.city || tour.country}/>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 10, textAlign: 'center' as const }}>
              Free cancellation on most tours · 24h support
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
