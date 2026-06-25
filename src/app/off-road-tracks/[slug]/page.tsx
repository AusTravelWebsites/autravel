import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getTenant } from '@/lib/get-tenant';

export const revalidate = 600;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', accent: '#b45309', accentLight: '#fff7ed', dark: '#7c2d12' };
const GRADE_COLOR: Record<string, string> = { 'Easy 4WD': '#16a34a', 'Moderate 4WD': '#d97706', 'Hard 4WD': '#ea580c', 'Extreme': '#dc2626' };

type Track = {
  slug: string; name: string; region: string | null; states: string[] | null; grade: string | null;
  length_km: number | null; days: string | null; best_season: string | null; permits: string | null;
  fuel_range: string | null; water: string | null; remoteness: string | null; corrugations: string | null;
  epirb_recommended: boolean | null; lat: number | null; lng: number | null;
  description_ai: string | null; highlights_ai: string[] | null; what_to_expect_ai: string | null; good_to_know_ai: string | null; blurb: string | null;
};

async function getTrack(slug: string, state: string): Promise<Track | null> {
  try {
    const [row] = await db<Track[]>`
      SELECT slug, name, region, states, grade, length_km, days, best_season, permits, fuel_range, water,
             remoteness, corrugations, epirb_recommended, lat, lng,
             description_ai, highlights_ai, what_to_expect_ai, good_to_know_ai, blurb
      FROM autravel.tracks WHERE state_code = ${state} AND active = true AND slug = ${slug} LIMIT 1`;
    return row || null;
  } catch { return null; }
}
async function getNearby(region: string | null, slug: string, state: string) {
  if (!region) return [];
  try {
    return await db`SELECT slug, name, grade, length_km FROM autravel.tracks
      WHERE state_code=${state} AND active AND region=${region} AND slug<>${slug} LIMIT 6` as any;
  } catch { return []; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant();
  const t = await getTrack(slug, tenant.state_code);
  if (!t) return {};
  const url = `https://${tenant.host}/off-road-tracks/${t.slug}/`;
  const title = `${t.name} — ${t.grade} 4WD Track Guide`;
  const description = (t.description_ai ? t.description_ai.slice(0, 150) : `${t.name}: a ${t.grade} off-road track in ${t.region}. Distance, best season, permits, fuel and water, and what to expect.`).replace(/\s+/g, ' ').trim();
  return { title, description, alternates: { canonical: url }, openGraph: { title: t.name, description, url, type: 'article', images: [tenant.ogImage] }, twitter: { card: 'summary_large_image', title: t.name, description, images: [tenant.ogImage] } };
}

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
    <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 3 }}>{value}</div>
  </div>
);

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant();
  const t = await getTrack(slug, tenant.state_code);
  if (!t) notFound();
  const nearby = await getNearby(t.region, t.slug, tenant.state_code);
  const gc = GRADE_COLOR[t.grade || ''] || C.accent;

  const schema = {
    '@context': 'https://schema.org', '@type': 'TouristTrip',
    name: t.name, description: t.description_ai || t.blurb || undefined,
    ...(t.lat && t.lng ? { itinerary: { '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', position: 1, item: { '@type': 'Place', name: t.region || t.name, geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng } } }] } } : {}),
  };

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, color: '#fff', padding: '38px 20px 30px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <nav style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link> &rsaquo;{' '}
            <Link href="/off-road-tracks/" style={{ color: '#fff', textDecoration: 'none' }}>Off-Road Tracks</Link> &rsaquo; {t.name}
          </nav>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {t.grade && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: gc, padding: '3px 11px', borderRadius: 7 }}>{t.grade}</span>}
            {t.remoteness && <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '3px 11px', borderRadius: 7 }}>{t.remoteness} remoteness</span>}
          </div>
          <h1 style={{ fontSize: 'clamp(26px,4.6vw,40px)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.12 }}>{t.name}</h1>
          {t.region && <div style={{ fontSize: 15, opacity: 0.9 }}>📍 {t.region}</div>}
        </div>
      </section>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 22 }}>
          {t.length_km != null && <Stat label="Distance" value={`${t.length_km.toLocaleString()} km`} />}
          {t.days && <Stat label="Typical duration" value={t.days} />}
          {t.grade && <Stat label="Difficulty" value={<span style={{ color: gc }}>{t.grade}</span>} />}
          {t.best_season && <Stat label="Best season" value={t.best_season} />}
          {t.fuel_range && <Stat label="Fuel" value={t.fuel_range} />}
          {t.water && <Stat label="Water" value={t.water} />}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>About this track</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: '#1f2937', margin: 0, whiteSpace: 'pre-wrap' }}>{t.description_ai || t.blurb}</p>
          {Array.isArray(t.highlights_ai) && t.highlights_ai.length > 0 && (<>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>Highlights</h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#1f2937', fontSize: 15, lineHeight: 1.7 }}>{t.highlights_ai.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </>)}
          {t.what_to_expect_ai && (<>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>What to expect</h3>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: '#1f2937', margin: 0, whiteSpace: 'pre-wrap' }}>{t.what_to_expect_ai}</p>
          </>)}
        </div>

        {(t.permits || t.good_to_know_ai || t.epirb_recommended) && (
          <div style={{ background: C.accentLight, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', color: C.dark }}>Permits, prep & good to know</h2>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20, color: C.dark, fontSize: 14.5, lineHeight: 1.7 }}>
              {t.permits && <li><b>Permits:</b> {t.permits} — confirm current details before you go.</li>}
              {t.corrugations && <li><b>Surface / hazards:</b> {t.corrugations}.</li>}
              {t.remoteness && <li><b>Remoteness:</b> {t.remoteness} — travel self-sufficient{['High', 'Extreme'].includes(t.remoteness) ? ', ideally in convoy' : ''}.</li>}
              {t.epirb_recommended && <li>Carry an EPIRB or satellite communicator, recovery gear, extra fuel and water.</li>}
            </ul>
            {t.good_to_know_ai && <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.dark, margin: 0 }}>{t.good_to_know_ai}</p>}
          </div>
        )}

        {nearby.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>More tracks in {t.region}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {nearby.map((n: any) => (
                <Link key={n.slug} href={`/off-road-tracks/${n.slug}/`} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11.5, color: GRADE_COLOR[n.grade] || C.accent, fontWeight: 700 }}>{n.grade}</div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, margin: '3px 0' }}>{n.name}</div>
                  {n.length_km != null && <div style={{ fontSize: 12.5, color: C.sub }}>📏 {n.length_km.toLocaleString()} km</div>}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <Link href="/off-road-tracks/" style={{ color: C.accent, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>← All off-road tracks</Link>
        </div>
      </div>
    </main>
  );
}
