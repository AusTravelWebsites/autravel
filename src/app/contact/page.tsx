import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/get-tenant'
import { ContactForm } from '@/components/ContactForm'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const title = `Contact ${tenant.name}`
  const desc = `Get in touch with the ${tenant.name} team — corrections, suggestions, partnership enquiries, or a quick question about a tour or caravan park we've listed.`
  const url = `https://${tenant.host}/contact/`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)' }

export default async function ContactPage() {
  const tenant = await getTenant()
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Contact', item: `https://${tenant.host}/contact/` },
    ],
  }
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: tenant.name,
    url: `https://${tenant.host}/`,
    contactPoint: {
      '@type': 'ContactPoint',
      url: `https://${tenant.host}/contact/`,
      contactType: 'customer support',
      availableLanguage: ['en-AU'],
      areaServed: tenant.aggregator ? 'AU' : tenant.regionCode,
    },
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%)', padding: '40px 20px 32px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Get in touch</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,38px)', fontWeight: 800, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>Contact {tenant.name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 600 }}>
            Spotted something out of date? Got a tour or caravan park we should add? Want to talk partnerships? Drop us a line — we're a small team and we read everything.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 26px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', color: C.text }}>Send us a message</h2>
          <ContactForm tenantName={tenant.name} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 26px', marginTop: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: C.text }}>Reply time</h2>
          <p style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
            We aim to reply within two business days. If you&rsquo;re flagging an error on a tour or caravan park page, please paste the page URL into the form above so we can find it quickly.
          </p>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 26px', marginTop: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: C.text }}>What kind of message helps most</h2>
          <ul style={{ fontSize: 14, color: C.text, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            <li><b>Corrections:</b> closed park, wrong opening hours, dead phone number &mdash; we&rsquo;ll fix it the same day.</li>
            <li><b>Suggestions:</b> a tour or destination guide we&rsquo;ve missed.</li>
            <li><b>Partnerships:</b> caravan-park operators, tour companies, accommodation providers wanting a listing.</li>
            <li><b>Press:</b> photo licensing, syndication, interview requests.</li>
          </ul>
        </div>

        <div style={{ marginTop: 26, textAlign: 'center' as const }}>
          <Link href="/" style={{ background: C.teal, color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Back to {tenant.name}</Link>
        </div>
      </div>
    </main>
  )
}
