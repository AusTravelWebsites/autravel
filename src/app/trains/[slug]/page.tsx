import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { getTrain, listTrains } from '@/lib/trains'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export const revalidate = 3600

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)' }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  const t = await getTrain(slug, stateFilterValue(tenant))
  if (!t) return { title: 'Train not found' }
  const title = t.seo_title || `${t.name} — ${t.route_summary || 'Train'}`
  const description = t.seo_description || t.intro || `${t.name} — routes, classes and how to book.`
  const url = `https://${tenant.host}/trains/${t.slug}/`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'article', url, images: t.cover_image ? [t.cover_image] : [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.sub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{value}</div>
    </div>
  )
}

export default async function TrainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const t = await getTrain(slug, state)
  if (!t) notFound()

  // "More trains" — sibling services for this tenant, excluding this one.
  const all = await listTrains(state)
  const more = all.filter(x => x.slug !== t.slug).slice(0, 6)

  const url = `https://${tenant.host}/trains/${t.slug}/`
  const ld = {
    '@context': 'https://schema.org', '@type': 'TouristTrip',
    name: t.name,
    description: t.seo_description || t.intro || undefined,
    url,
    ...(t.cover_image ? { image: t.cover_image } : {}),
    ...(t.from_city && t.to_city ? { itinerary: { '@type': 'ItemList', itemListElement: t.key_stations.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'TrainStation', name: s } })) } } : {}),
    provider: t.operator ? { '@type': 'Organization', name: t.operator, ...(t.operator_url ? { url: t.operator_url } : {}) } : undefined,
  }
  const crumbs = [{ href: '/', label: 'Home' }, { href: '/trains/', label: 'Trains' }, { label: t.name }]

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {/* Hero */}
      <div style={{ position: 'relative', background: `linear-gradient(135deg, var(--brand-dark), ${C.teal})`, color: '#fff' }}>
        {t.cover_image && <img src={t.cover_image} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.28 }} />}
        <div style={{ position: 'relative', maxWidth: 1000, margin: '0 auto', padding: '26px 20px 30px' }}>
          <Breadcrumbs crumbs={crumbs} variant="light" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 10px' }}>
            {t.is_national && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: C.teal, background: '#fff', padding: '3px 9px', borderRadius: 999 }}>National journey</span>}
            {t.is_heritage && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#92400e', background: '#fef3c7', padding: '3px 9px', borderRadius: 999 }}>Heritage railway</span>}
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>{t.name}</h1>
          {t.route_summary && <p style={{ fontSize: 17, margin: 0, opacity: 0.96 }}>{t.route_summary}</p>}
          {t.operator && <p style={{ fontSize: 13.5, margin: '8px 0 0', opacity: 0.85 }}>Operated by {t.operator}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 50px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }}>
        {/* Facts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {t.route_summary && <Fact label="Route" value={t.route_summary} />}
          {t.frequency && <Fact label="Frequency" value={t.frequency} />}
          {t.duration_label && <Fact label="Journey time" value={t.duration_label} />}
          {t.classes.length > 0 && <Fact label="Classes" value={t.classes.join(' · ')} />}
        </div>

        {/* Body */}
        {(t.intro || t.body_html) && (
          <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '22px 24px' }}>
            {t.intro && <p style={{ fontSize: 17, lineHeight: 1.6, color: C.text, margin: '0 0 14px', fontWeight: 500 }}>{t.intro}</p>}
            {t.body_html && <div style={{ fontSize: 15.5, lineHeight: 1.7, color: '#374151' }} dangerouslySetInnerHTML={{ __html: t.body_html }} />}
          </article>
        )}

        {/* Stations */}
        {t.key_stations.length > 0 && (
          <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 14px' }}>Key stations along the way</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {t.key_stations.map((s, i) => (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: C.tealLight, color: C.teal, border: `1px solid ${C.teal}`, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>{s}</span>
                  {i < t.key_stations.length - 1 && <span aria-hidden style={{ color: C.sub }}>→</span>}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{ background: C.tealLight, border: `1px solid ${C.teal}`, borderRadius: 12, padding: '22px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 6px' }}>Ready to book the {t.name}?</h2>
          <p style={{ margin: '0 0 16px', color: C.sub, fontSize: 14.5 }}>Check current timetables, fares and availability with {t.operator || 'the operator'}.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {t.booking_url && <a href={t.booking_url} target="_blank" rel="noopener noreferrer nofollow" style={{ background: C.teal, color: '#fff', padding: '11px 22px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14.5 }}>Book with {t.operator || 'the operator'} →</a>}
            {t.legacy_article_slug && <Link href={`/transport/queensland-rail-travel-train-timetables/${t.slug}/`} style={{ background: '#fff', color: C.teal, border: `1px solid ${C.teal}`, padding: '11px 22px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14.5 }}>Full timetable & details</Link>}
          </div>
        </section>

        {/* More trains */}
        {more.length > 0 && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 14px' }}>More trains{tenant.aggregator ? '' : ` in ${tenant.stateName}`}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
              {more.map(m => (
                <Link key={m.slug} href={`/trains/${m.slug}/`} style={{ display: 'block', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', textDecoration: 'none', color: C.text }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.name}</div>
                  {m.route_summary && <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{m.route_summary}</div>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
