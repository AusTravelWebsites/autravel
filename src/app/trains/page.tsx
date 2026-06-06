import { Metadata } from 'next'
import Link from 'next/link'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { listTrains, type Train } from '@/lib/trains'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export const revalidate = 3600

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' }

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const title = `Trains in ${tenant.stateName} — Routes, Operators & How to Book`
  const description = `Every passenger and scenic train you can ride in ${tenant.stateName} — long-distance, regional and heritage rail, with routes, classes and booking links from ${tenant.name}.`
  const url = `https://${tenant.host}/trains/`
  return {
    title: title.length > 58 ? `Trains in ${tenant.stateName}` : title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url, images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function TrainCard({ t }: { t: Train }) {
  return (
    <Link href={`/trains/${t.slug}/`} style={{ display: 'block', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', textDecoration: 'none', color: C.text, transition: 'transform .15s, box-shadow .15s' }}>
      {t.cover_image
        ? <img src={t.cover_image} alt={t.name} loading="lazy" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', background: '#e5e7eb' }} />
        : <div style={{ width: '100%', aspectRatio: '16/9', background: `linear-gradient(135deg,${C.teal},#0f766e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40 }} aria-hidden>🚆</div>}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {t.is_national && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#fff', background: C.teal, padding: '2px 8px', borderRadius: 999 }}>National</span>}
          {t.is_heritage && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 999 }}>Heritage</span>}
          {t.operator && <span style={{ fontSize: 11, fontWeight: 600, color: C.sub }}>{t.operator}</span>}
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{t.name}</h3>
        {t.route_summary && <p style={{ margin: 0, fontSize: 13.5, color: C.sub, lineHeight: 1.4 }}>{t.route_summary}</p>}
      </div>
    </Link>
  )
}

function Section({ title, blurb, trains }: { title: string; blurb?: string; trains: Train[] }) {
  if (trains.length === 0) return null
  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '0 0 4px' }}>{title}</h2>
      {blurb && <p style={{ margin: '0 0 16px', color: C.sub, fontSize: 14.5, maxWidth: 760 }}>{blurb}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {trains.map(t => <TrainCard key={t.slug} t={t} />)}
      </div>
    </section>
  )
}

export default async function TrainsHub() {
  const tenant = await getTenant()
  const trains = await listTrains(stateFilterValue(tenant))

  const national = trains.filter(t => t.is_national && !t.is_heritage)
  const regional = trains.filter(t => !t.is_national && !t.is_heritage)
  const heritage = trains.filter(t => t.is_heritage)

  const url = `https://${tenant.host}/trains/`
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Trains in ${tenant.stateName}`,
    itemListElement: trains.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `https://${tenant.host}/trains/${t.slug}/` })),
  }
  const crumbs = [{ href: '/', label: 'Home' }, { label: 'Trains' }]

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <div style={{ background: `linear-gradient(135deg, #0f766e, ${C.teal})`, color: '#fff', padding: '28px 20px 30px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Breadcrumbs crumbs={crumbs} variant="light" />
          <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '12px 0 8px' }}>Trains in {tenant.stateName}</h1>
          <p style={{ margin: 0, fontSize: 16, maxWidth: 720, opacity: 0.95, lineHeight: 1.5 }}>
            From transcontinental expeditions to regional railcars and heritage steam — here is every passenger train you can ride{tenant.aggregator ? ' across Australia' : ` in ${tenant.stateName}`}, with routes, classes and where to book.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 50px' }}>
        {trains.length === 0 && <p style={{ color: C.sub }}>Train information for this region is coming soon.</p>}
        <Section title="Great rail journeys of Australia" blurb="The all-inclusive, long-distance expeditions that cross states and continents." trains={national} />
        <Section title={`Regional & long-distance trains`} blurb={tenant.aggregator ? 'Scheduled state rail services around the country.' : `Scheduled services run by the state rail operator.`} trains={regional} />
        <Section title="Scenic & heritage railways" blurb="Restored steam, rack-and-pinion mountain lines and outback rail-motor adventures." trains={heritage} />
      </div>
    </main>
  )
}
