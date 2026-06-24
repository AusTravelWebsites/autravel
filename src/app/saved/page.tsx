import type { Metadata } from 'next'
import { getTenant } from '@/lib/get-tenant'
import { SavedListClient } from '@/components/features/SaveButton'
import { PrintButton } from '@/components/features/PrintButton'

// Must be dynamic, not force-static: this is a multi-tenant app and the shared
// layout (nav mega-menu, footer) is per-tenant. A force-static build freezes the
// default tenant's (qld) nav onto this page and serves it to every tenant, so
// e.g. perthtourism showed qld destination links that 404. getTenant() reads
// headers() — keep the render per-request so the nav matches the host.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: 'Your saved trip board',
    description: `Every tour, caravan park, destination and article you've saved while planning your trip across ${tenant.aggregator ? 'Australia' : tenant.stateName}. Stored on this device only — no account needed.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `https://${tenant.host}/saved/` },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

export default async function SavedPage() {
  const tenant = await getTenant()
  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '36px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Trip board</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,38px)', fontWeight: 800, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>Your saved trip board</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 600 }}>
            Everything you've bookmarked while planning your trip across {tenant.aggregator ? 'Australia' : tenant.stateName}. Stored only on this device — no account, no email needed.
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }} data-print-hide>
          <PrintButton label="Print my trip board"/>
        </div>
        <SavedListClient/>
      </div>
    </main>
  )
}
