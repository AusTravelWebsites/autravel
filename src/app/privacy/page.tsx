import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/get-tenant'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: 'Privacy Policy',
    description: `How ${tenant.name} collects, uses, and protects your personal information.`,
    alternates: { canonical: `https://${tenant.host}/privacy/` },
  }
}

const C = { bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb', text: '#111827', body: '#374151', sub: '#6b7280', teal: '#0d9488' }

export default async function PrivacyPage() {
  const tenant = await getTenant()
  const brand = tenant.name
  const host = tenant.host
  const lastUpdated = 'April 2026'
  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '0 0 8px', color: C.text }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: C.sub, margin: '0 0 32px' }}>Last updated: {lastUpdated}</p>

        <div style={{ fontSize: 16, color: C.body, lineHeight: 1.75 }}>
          <p>
            This Privacy Policy explains how <b>{brand}</b> ({host}) collects, uses, and protects information about you when you visit the site, search for tours, browse destinations, book experiences, or create an account.
          </p>

          <H2>Information we collect</H2>
          <p>We collect information you provide directly (name, email, password, preferences when you sign up) and information collected automatically (pages visited, device type, browser, IP address, approximate location, referrer). If you make a booking via a third-party operator (e.g. Viator), that operator collects separate booking and payment details — we do not store payment card numbers.</p>

          <H2>How we use it</H2>
          <ul>
            <li>Show you relevant tours, destinations, articles and caravan parks.</li>
            <li>Operate the site, prevent abuse, and keep accounts secure.</li>
            <li>Improve the site with aggregated usage analytics.</li>
            <li>Send you transactional emails (e.g. account confirmations). Marketing emails are opt-in only.</li>
          </ul>

          <H2>Cookies &amp; analytics</H2>
          <p>{brand} uses first-party cookies for essential functions (login, preferences) and, with your consent, Google Analytics for anonymous usage measurement. You can change your consent at any time via the cookie banner at the bottom of the site.</p>

          <H2>How we share information</H2>
          <p>We share information only when needed to provide the service: with tour operators you book through, with infrastructure providers (hosting, authentication, analytics) who process data on our behalf, or when required by law. We do not sell your personal information.</p>

          <H2>Your rights</H2>
          <p>You can access, correct, or delete your personal information at any time via our <Link href="/contact/" style={{ color: C.teal }}>contact form</Link>. If you&rsquo;re in the EU/UK you also have the right to lodge a complaint with your local data-protection authority.</p>

          <H2>Data retention</H2>
          <p>We keep account information while your account is active and for a reasonable period after to comply with legal obligations. Backup copies may exist for longer as part of routine backup retention.</p>

          <H2>Children&rsquo;s privacy</H2>
          <p>{brand} is not directed at children under 13. We do not knowingly collect personal information from children; if you believe a child has given us data, please contact us and we&rsquo;ll remove it.</p>

          <H2>Changes to this policy</H2>
          <p>We&rsquo;ll post updates here and refresh the &ldquo;last updated&rdquo; date above. Material changes will be announced on the homepage.</p>

          <H2>Contact</H2>
          <p>For any privacy-related question, please use our <Link href="/contact/" style={{ color: C.teal }}>contact form</Link>.</p>
        </div>
      </div>
    </main>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '32px 0 12px', color: C.text }}>{children}</h2>
}
