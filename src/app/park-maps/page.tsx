import { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { getTenant } from '@/lib/get-tenant';
import { notFound } from 'next/navigation';
import { TrailExplorer, type TrailCard } from '@/components/features/TrailExplorer';

export const revalidate = 600;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa', dark: '#0f2e2a' };

type Row = {
  slug: string; name: string; trail_type: string; difficulty: string | null;
  distance_label: string | null; duration_label: string | null; length_m: number | null;
  area: string | null; surface: string | null; waymarked: boolean | null;
  dog_friendly: boolean | null; bicycle_allowed: boolean | null; horse_allowed: boolean | null;
  preview_points: [number, number][] | null;
};

// preview_points is pre-computed and stored on autravel.trails (28-point
// normalised 0..100/0..60 shape per trail). Reading it directly drops the
// listing payload from ~3.3 MB (full geometry) to ~380 KB so the result fits
// inside unstable_cache's 2 MB ceiling. Backfill: scripts/backfill-trail-previews.mjs.
const getTrails = unstable_cache(
  async () => {
    return await db<Row[]>`
      SELECT slug, name, trail_type, difficulty, distance_label, duration_label, length_m,
             area, surface, waymarked, dog_friendly, bicycle_allowed, horse_allowed,
             preview_points
        FROM autravel.trails
       WHERE state_code = 'uk' AND active = true
       ORDER BY (trail_type LIKE '%route%') DESC, length_m DESC NULLS LAST`;
  },
  ['uk-trails-explorer', 'v2'],
  { revalidate: 600, tags: ['uk-trails'] }
);

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const url = `https://${tenant.host}/park-maps/`;
  const title = 'New Forest Park Maps — Walks, Trails & Cycle Routes';
  const description = 'Interactive maps for every walk, trail, bridleway and cycle route in the New Forest National Park. Search by type, distance, difficulty and area — with route maps, distances and what to expect.';
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [tenant.ogImage] },
  };
}

export default async function ParkMapsPage() {
  const tenant = await getTenant();
  if (tenant.state_code !== 'uk') notFound();

  const rows = await getTrails();
  const trails: TrailCard[] = rows.map(r => ({
    slug: r.slug, name: r.name, trail_type: r.trail_type, difficulty: r.difficulty,
    distance_label: r.distance_label, duration_label: r.duration_label, length_m: r.length_m,
    area: r.area, surface: r.surface, waymarked: r.waymarked,
    dog_friendly: r.dog_friendly, bicycle_allowed: r.bicycle_allowed, horse_allowed: r.horse_allowed,
    preview: r.preview_points ?? [],
  }));

  const types = [...new Set(trails.map(t => t.trail_type))].sort();
  const areas = [...new Set(trails.map(t => t.area).filter(Boolean) as string[])].sort();
  const stats = {
    total: trails.length,
    routes: trails.filter(t => t.trail_type.includes('route')).length,
    km: Math.round(rows.reduce((a, r) => a + (r.length_m || 0), 0) / 1000),
  };

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${C.dark}, #145049)`, color: '#fff', padding: '46px 20px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <nav style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link> &rsaquo; Park Maps
          </nav>
          <h1 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.1 }}>New Forest Park Maps</h1>
          <p style={{ fontSize: 'clamp(15px,2.2vw,18px)', opacity: 0.92, maxWidth: 720, lineHeight: 1.55, margin: 0 }}>
            Every walk, trail, bridleway and cycle route across the New Forest National Park — each with an interactive route map,
            distance, estimated time, difficulty and what to expect underfoot. Search and filter to find your next outing.
          </p>
          <div style={{ display: 'flex', gap: 26, marginTop: 22, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.total}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>mapped routes</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.routes}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>waymarked trails</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{stats.km.toLocaleString()}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>km of paths</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{areas.length}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>areas covered</div></div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 60px' }}>
        {trails.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.sub }}>
            Route maps are being prepared — please check back shortly.
          </div>
        ) : (
          <TrailExplorer trails={trails} types={types} areas={areas} />
        )}
      </section>
    </main>
  );
}
