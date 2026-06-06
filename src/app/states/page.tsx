import { Metadata } from 'next'
import { TENANTS } from '@/lib/tenants'
import { getTenant } from '@/lib/get-tenant'

export const revalidate = 3600

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const title = `Browse Australia by State`
  const desc = `Tours, caravan parks, destinations and travel guides organised by Australian state and territory. Pick your state to see what's on.`
  const url = `https://${tenant.host}/states/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

export default async function StatesPage() {
  const states = Object.values(TENANTS).filter(t => !t.aggregator)

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '40px 20px 32px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>By state</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
            Browse Australia by state
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 640 }}>
            Each state has its own dedicated travel hub. Pick yours for state-specific tours, caravan parks, destinations and articles.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
          {states.map(t => (
            <a key={t.state_code}
               href={`https://${t.host}/`}
               style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6 }}>{t.shortName}</div>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', color: C.text }}>{t.stateName}</h2>
              <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.5 }}>{t.tagline}</p>
              <div style={{ fontSize: 13, color: C.teal, fontWeight: 700, marginTop: 12 }}>Visit {t.host} →</div>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
