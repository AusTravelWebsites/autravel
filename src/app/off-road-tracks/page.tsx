import { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getTenant } from '@/lib/get-tenant';
import { TrackFinder, type TrackCard } from '@/components/features/TrackFinder';
import type { StateCode } from '@/lib/tenants';

export const revalidate = 600;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', sub: '#6b7280', accent: '#b45309', dark: '#7c2d12' };

function getTracks(state: StateCode) {
  return unstable_cache(
    async () => db<TrackCard[]>`
      SELECT slug, name, region, grade, length_km, days, best_season, remoteness
      FROM autravel.tracks WHERE state_code = ${state} AND active = true
      ORDER BY name`,
    ['offroad-tracks', state, 'v1'], { revalidate: 600, tags: [`tracks:${state}`] }
  )();
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const url = `https://${tenant.host}/off-road-tracks/`;
  const title = 'Off-Road Tracks — Iconic Australian 4WD & Outback Routes';
  const description = 'Plan your next outback adventure: a guide to Australia\'s iconic off-road and 4WD tracks — the Canning Stock Route, Gibb River Road, Simpson Desert, Cape York and more. Filter by difficulty, region, length and season.';
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website', images: [tenant.ogImage] }, twitter: { card: 'summary_large_image', title, description, images: [tenant.ogImage] } };
}

export default async function OffRoadTracksPage() {
  const tenant = await getTenant();
  const tracks = await getTracks(tenant.state_code);
  if (!tracks.length) notFound();
  const regions = [...new Set(tracks.map(t => t.region).filter(Boolean) as string[])].sort();
  const grades = new Set(tracks.map(t => t.grade).filter(Boolean)).size;
  const totalKm = tracks.reduce((a, t) => a + (t.length_km || 0), 0);

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <section style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, color: '#fff', padding: '46px 20px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <nav style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link> &rsaquo; Off-Road Tracks
          </nav>
          <h1 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.1 }}>Off-Road Tracks</h1>
          <p style={{ fontSize: 'clamp(15px,2.2vw,18px)', opacity: 0.92, maxWidth: 740, lineHeight: 1.55, margin: 0 }}>
            Australia's great 4WD and outback tracks, in one place — the deserts, the Kimberley, the Cape and the High Country.
            Filter by difficulty, region, length and season, then open a track for the full rundown: grade, distance, permits, fuel and water, the driving, and the good and the not-so-good.
          </p>
          <div style={{ display: 'flex', gap: 26, marginTop: 22, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{tracks.length}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>tracks</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{regions.length}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>regions</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{grades}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>difficulty grades</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 800 }}>{totalKm.toLocaleString()}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>km of tracks</div></div>
          </div>
        </div>
      </section>
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 60px' }}>
        <TrackFinder tracks={tracks} regions={regions} scope="Australia" />
      </section>
    </main>
  );
}
