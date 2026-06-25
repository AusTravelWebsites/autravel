import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/get-tenant'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: 'Cookie Policy',
    description: `How ${tenant.name} uses cookies and similar technologies, and how to control your preferences.`,
    alternates: { canonical: `https://${tenant.host}/cookies/` },
  }
}

const C = { bg: '#f3f4f6', text: '#111827', body: '#374151', sub: '#6b7280', teal: 'var(--brand)' }

export default async function CookiesPage() {
  const tenant = await getTenant()
  const brand = tenant.name
  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '0 0 8px', color: C.text }}>Cookie Policy</h1>
        <p style={{ fontSize: 13, color: C.sub, margin: '0 0 32px' }}>Last updated: April 2026</p>

        <div style={{ fontSize: 16, color: C.body, lineHeight: 1.75 }}>
          <p>{brand} uses cookies and similar technologies to make the site work, remember your preferences, and — with your consent — measure usage so we can improve. Here&rsquo;s the breakdown.</p>

          <H2>Essential</H2>
          <p>Required for the site to function — login sessions, security, and remembering your cookie choice. These cannot be turned off without breaking core functionality.</p>

          <H2>Analytics (opt-in)</H2>
          <p>Google Analytics tracks anonymous usage (which pages are visited, how people arrive at the site, device type) so we can improve the content. Only loaded if you accept analytics cookies via the banner.</p>

          <H2>Marketing (opt-in)</H2>
          <p>Third-party marketing tags (e.g. Meta Pixel, Google Ads). Only loaded if you accept marketing cookies. {brand} doesn&rsquo;t enable any marketing cookies by default.</p>

          <H2>Managing your choice</H2>
          <p>You can change your consent any time via the &ldquo;Cookie settings&rdquo; link at the bottom of every page. You can also clear cookies in your browser settings, which will re-prompt you on next visit.</p>

          <H2>Contact</H2>
          <p>For any cookie or privacy question, please use our <Link href="/contact/" style={{ color: C.teal }}>contact form</Link>.</p>

          <p style={{ marginTop: 32, fontSize: 14, color: C.sub }}>See also our <Link href="/privacy/" style={{ color: C.teal }}>Privacy Policy</Link> and <Link href="/terms/" style={{ color: C.teal }}>Terms &amp; Conditions</Link>.</p>
        </div>
      </div>
    </main>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '32px 0 12px', color: C.text }}>{children}</h2>
}
