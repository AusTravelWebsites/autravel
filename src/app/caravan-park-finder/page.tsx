import { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { getTenant, parkStatesFor } from '@/lib/get-tenant';
import { ParkFinder, type ParkCard } from '@/components/features/ParkFinder';
import type { StateCode } from '@/lib/tenants';

export const revalidate = 600;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', dark: 'var(--brand-dark)' };

function getAllParks(parkStates: StateCode[] | null) {
  const key = parkStates ? parkStates.join('+') : 'all';
  return unstable_cache(
    async () => {
      const rows = await db<ParkCard[]>`
        SELECT slug, name, park_type, region, suburb, avg_rating, review_count, cover_image
        FROM parks
        WHERE active = true AND ${parkStates === null ? db`true` : db`state_code = ANY(${parkStates})`}
        ORDER BY avg_rating DESC NULLS LAST, review_count DESC NULLS LAST`;
      return rows;
    },
    ['caravan-park-finder', key, 'v1'],
    { revalidate: 600, tags: ['parks', `parks:${key}`] }
  )();
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName;
  const url = `https://${tenant.host}/caravan-park-finder/`;
  const title = `Caravan Park Finder — ${scope}`;
  const description = `Find and compare every caravan park, holiday park, tourist park and national-park campground across ${scope}. Filter by area, park type and guest rating — with photos, reviews and the good and not-so-good of each park.`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [tenant.ogImage] },
  };
}

export default async function CaravanParkFinderPage() {
  const tenant = await getTenant();
  const parkStates = parkStatesFor(tenant);
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName;
  const parks = await getAllParks(parkStates);
  const regions = [...new Set(parks.map(p => p.region).filter(Boolean) as string[])].sort();
  const rated = parks.filter(p => p.avg_rating != null).length;
  const types = new Set(parks.map(p => p.park_type).filter(Boolean)).size;

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <section style={{ background: `linear-gradient(135deg, ${C.dark}, var(--brand))`, color: '#fff', padding: '46px 20px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <nav style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link> &rsaquo;{' '}
            <Link href="/parks/" style={{ color: '#fff', textDecoration: 'none' }}>Caravan parks</Link> &rsaquo; Finder
          </nav>
          <h1 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.1 }}>Caravan Park Finder</h1>
          <p style={{ fontSize: 'clamp(15px,2.2vw,18px)', opacity: 0.92, maxWidth: 720, lineHeight: 1.55, margin: 0 }}>
            Every caravan park, holiday park, tourist park and national-park campground across {scope}, in one place.
            Search and filter by area, park type and guest rating — then open a park for the full rundown, the good and the not-so-good, and a link straight to the park.
          </p>
          <div style={{ display: 'flex', gap: 26, marginTop: 22, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{parks.length}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>parks</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{regions.length}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>areas</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{types}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>park types</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{rated}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>guest-rated</div></div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 60px' }}>
        {parks.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.sub }}>
            Parks are being added — please check back shortly.
          </div>
        ) : (
          <ParkFinder parks={parks} regions={regions} scope={scope} />
        )}
      </section>
    </main>
  );
}
