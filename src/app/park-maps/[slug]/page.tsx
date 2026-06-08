import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getTenant } from '@/lib/get-tenant';
import { TrailMap } from '@/components/features/TrailMap';

export const revalidate = 600;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa', dark: '#0f2e2a' };
const DIFFICULTY_COLOR: Record<string, string> = { Easy: '#16a34a', Moderate: '#d97706', Challenging: '#dc2626' };

type Trail = {
  slug: string; name: string; trail_type: string; difficulty: string | null;
  distance_label: string | null; duration_label: string | null; length_m: number | null;
  surface: string | null; area: string | null; waymarked: boolean | null;
  dog_friendly: boolean | null; accessible: boolean | null; bicycle_allowed: boolean | null; horse_allowed: boolean | null;
  center_lat: number | null; center_lng: number | null; start_lat: number | null; start_lng: number | null;
  geometry: [number, number][][] | null;
  description_ai: string | null; what_to_expect_ai: string | null; good_to_know_ai: string | null;
  highlights_ai: string[] | null; tags: Record<string, any> | null;
};

async function getTrail(slug: string): Promise<Trail | null> {
  try {
    const [row] = await db<Trail[]>`
      SELECT slug, name, trail_type, difficulty, distance_label, duration_label, length_m,
             surface, area, waymarked, dog_friendly, accessible, bicycle_allowed, horse_allowed,
             center_lat, center_lng, start_lat, start_lng, geometry,
             description_ai, what_to_expect_ai, good_to_know_ai, highlights_ai, tags
        FROM autravel.trails
       WHERE state_code = 'uk' AND active = true AND slug = ${slug}
       LIMIT 1`;
    return row || null;
  } catch { return null; }
}

async function getNearby(area: string | null, slug: string): Promise<Array<{ slug: string; name: string; trail_type: string; distance_label: string | null; difficulty: string | null }>> {
  if (!area) return [];
  try {
    return await db`
      SELECT slug, name, trail_type, distance_label, difficulty
        FROM autravel.trails
       WHERE state_code = 'uk' AND active = true AND area = ${area} AND slug <> ${slug}
       ORDER BY (trail_type LIKE '%route%') DESC, length_m DESC NULLS LAST
       LIMIT 6` as any;
  } catch { return []; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant();
  const t = await getTrail(slug);
  if (!t) return {};
  const url = `https://${tenant.host}/park-maps/${t.slug}/`;
  const bits = [t.distance_label, t.difficulty, t.area ? `near ${t.area}` : null].filter(Boolean).join(' · ');
  const title = `${t.name} — ${t.trail_type} | New Forest Park Maps`;
  const description = (t.description_ai
    ? t.description_ai.slice(0, 150)
    : `${t.name}: a ${t.distance_label || ''} ${t.trail_type.toLowerCase()} in the New Forest${t.area ? ` near ${t.area}` : ''}. Route map, distance, difficulty and what to expect.`).replace(/\s+/g, ' ').trim();
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title: `${t.name} (${bits})`, description, url, type: 'article', images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title: t.name, description, images: [tenant.ogImage] },
  };
}

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
    <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{value}</div>
  </div>
);

export default async function TrailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant();
  if (tenant.state_code !== 'uk') notFound();
  const t = await getTrail(slug);
  if (!t) notFound();
  const nearby = await getNearby(t.area, t.slug);

  const access: string[] = [];
  if (t.dog_friendly) access.push('Dogs welcome (keep under control near livestock & ground-nesting birds)');
  if (t.bicycle_allowed) access.push('Open to cyclists');
  if (t.horse_allowed) access.push('Open to horse riders');
  if (t.accessible) access.push('Firm/surfaced — more accessible going');
  if (t.waymarked) access.push('Waymarked route');

  const schema = {
    '@context': 'https://schema.org', '@type': 'TouristAttraction',
    name: t.name, description: t.description_ai || `${t.trail_type} in the New Forest National Park`,
    ...(t.center_lat && t.center_lng ? { geo: { '@type': 'GeoCoordinates', latitude: t.center_lat, longitude: t.center_lng } } : {}),
    isAccessibleForFree: true,
    ...(t.area ? { containedInPlace: { '@type': 'Place', name: `${t.area}, New Forest` } } : {}),
  };

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 20px 60px' }}>
        <nav style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
          <Link href="/" style={{ color: C.teal, textDecoration: 'none' }}>Home</Link> &rsaquo;{' '}
          <Link href="/park-maps/" style={{ color: C.teal, textDecoration: 'none' }}>Park Maps</Link> &rsaquo; {t.name}
        </nav>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, background: C.tealLight, padding: '3px 10px', borderRadius: 7 }}>{t.trail_type}</span>
          {t.difficulty && <span style={{ fontSize: 12, fontWeight: 700, color: DIFFICULTY_COLOR[t.difficulty], background: `${DIFFICULTY_COLOR[t.difficulty]}14`, padding: '3px 10px', borderRadius: 7 }}>{t.difficulty}</span>}
          {t.area && <span style={{ fontSize: 12, fontWeight: 700, color: C.sub, background: '#fff', border: `1px solid ${C.border}`, padding: '3px 10px', borderRadius: 7 }}>📍 {t.area}</span>}
        </div>
        <h1 style={{ fontSize: 'clamp(24px,4.5vw,36px)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.15 }}>{t.name}</h1>

        {/* Map */}
        <TrailMap geometry={t.geometry || []} start={t.start_lat && t.start_lng ? [t.start_lat, t.start_lng] : null} height={440} />

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, margin: '16px 0 22px' }}>
          {t.distance_label && <Stat label="Distance" value={t.distance_label} />}
          {t.duration_label && <Stat label="Approx. time" value={t.duration_label} />}
          {t.difficulty && <Stat label="Difficulty" value={<span style={{ color: DIFFICULTY_COLOR[t.difficulty] }}>{t.difficulty}</span>} />}
          {t.surface && <Stat label="Surface" value={<span style={{ textTransform: 'capitalize' }}>{t.surface.replace(/_/g, ' ')}</span>} />}
          {t.area && <Stat label="Nearest town" value={t.area} />}
        </div>

        {/* Description */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px' }}>About this {t.trail_type.toLowerCase()}</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: '#1f2937', margin: 0 }}>
            {t.description_ai || `${t.name} is a ${t.distance_label || ''} ${t.trail_type.toLowerCase()} in the New Forest National Park${t.area ? `, close to ${t.area}` : ''}. Use the route map above to plan your walk; the New Forest is open-access heath and ancient woodland, so take care around free-roaming ponies, cattle and ground-nesting birds.`}
          </p>

          {t.highlights_ai && t.highlights_ai.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>Highlights</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#1f2937', fontSize: 15, lineHeight: 1.7 }}>
                {t.highlights_ai.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </>
          )}
          {t.what_to_expect_ai && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>What to expect</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: '#1f2937', margin: 0, whiteSpace: 'pre-wrap' }}>{t.what_to_expect_ai}</p>
            </>
          )}
        </div>

        {/* Access / good to know */}
        {(access.length > 0 || t.good_to_know_ai) && (
          <div style={{ background: C.tealLight, border: `1px solid #99f6e4`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px', color: C.dark }}>Good to know</h2>
            {access.length > 0 && (
              <ul style={{ margin: '0 0 8px', paddingLeft: 20, color: '#134e4a', fontSize: 14.5, lineHeight: 1.7 }}>
                {access.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
            {t.good_to_know_ai && <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#134e4a', margin: 0 }}>{t.good_to_know_ai}</p>}
          </div>
        )}

        {/* Nearby */}
        {nearby.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>More routes near {t.area}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {nearby.map(n => (
                <Link key={n.slug} href={`/park-maps/${n.slug}/`} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11.5, color: C.teal, fontWeight: 700 }}>{n.trail_type}{n.difficulty ? ` · ${n.difficulty}` : ''}</div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, margin: '3px 0' }}>{n.name}</div>
                  {n.distance_label && <div style={{ fontSize: 12.5, color: C.sub }}>📏 {n.distance_label}</div>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Link href="/park-maps/" style={{ color: C.teal, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>← All New Forest park maps</Link>
        </div>
      </div>
    </main>
  );
}
