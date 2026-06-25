import Link from 'next/link'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/get-tenant'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  return {
    title: `About ${tenant.name} — your guide to ${scope}`,
    description: `${tenant.name} is a complete travel guide to ${scope} — hand-picked tours, caravan parks, destination guides and thousands of local travel articles.`,
    alternates: { canonical: `https://${tenant.host}/about/` },
    openGraph: {
      type: 'website',
      title: `About ${tenant.name}`,
      description: `A complete travel guide to ${scope}.`,
      url: `https://${tenant.host}/about/`,
      images: tenant.ogImage ? [{ url: tenant.ogImage, alt: tenant.name }] : undefined,
      siteName: tenant.name,
    },
  }
}

const C = {
  bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb',
  text: '#111827', body: '#374151', sub: '#6b7280',
  teal: 'var(--brand)', tealLight: 'var(--brand-light)',
}

export default async function AboutPage() {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.tealLight, color: C.teal, border: '1px solid #99f6e4', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
          About {tenant.name}
        </div>

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.15, color: C.text, margin: '0 0 20px' }}>
          Your complete guide to <span style={{ color: C.teal, fontStyle: 'italic' as const }}>{scope}</span>
        </h1>
        <p style={{ fontSize: 18, color: C.sub, lineHeight: 1.7, marginBottom: 32 }}>
          {tenant.tagline}
        </p>
        <p style={{ fontSize: 16, color: C.body, lineHeight: 1.8, marginBottom: 40 }}>
          Whether you&rsquo;re planning a big caravanning trip, a weekend away, or just dreaming about your next adventure, we bring together everything you need to see, do and book in {scope} &mdash; organised by destination, filterable, and honest.
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 28px', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>🗺 Destination guides</h2>
          <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, margin: 0 }}>
            Curated hub pages for every main tourist location &mdash; tours, attractions, activities, caravan parks, landmarks and local articles all gathered in one place. Start with <Link href="/destinations/" style={{ color: C.teal }}>our destinations</Link> to see what&rsquo;s waiting.
          </p>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 28px', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>🏕 Every caravan park, in one place</h2>
          <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, margin: 0 }}>
            Powered sites, cabins, glamping, bush camps, national-park campgrounds &mdash; filter by pets-allowed, big-rig friendly, region and more. See the <Link href="/parks/" style={{ color: C.teal }}>full park directory</Link>.
          </p>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 28px', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>🎟 Tours &amp; experiences</h2>
          <p style={{ fontSize: 15, color: C.body, lineHeight: 1.7, margin: 0 }}>
            Small-group tours, day trips, cooking classes, dive courses and multi-day adventures &mdash; hand-picked from trusted operators. Prices, reviews and availability confirmed at checkout. <Link href="/tours/" style={{ color: C.teal }}>Browse tours</Link>.
          </p>
        </div>

        <div style={{ background: C.tealLight, border: '1px solid #a7f3d0', borderRadius: 16, padding: '28px 28px', marginTop: 32 }}>
          <p style={{ fontSize: 14, color: 'var(--brand-dark)', lineHeight: 1.7, margin: 0 }}>
            {tenant.aggregator
              ? `${tenant.name} is part of a network of state-specific travel guides covering QLD, NSW, VIC, WA, SA, TAS and NT.`
              : `${tenant.name} is part of a network of state-specific Australian travel guides. Heading interstate? See our sister sites at aunztravel.com.au.`}
          </p>
        </div>
      </div>
    </div>
  )
}
