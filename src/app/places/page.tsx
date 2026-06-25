import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { PlacesCountrySearch } from '@/components/features/PlacesCountrySearch';

export const revalidate = 1800;

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)', amber: '#f59e0b' };

const CATEGORIES = [
  { slug: 'cities',       label: '🏙️ Cities',       col: 'var(--brand)' },
  { slug: 'beaches',      label: '🏖️ Beaches',      col: '#0891b2' },
  { slug: 'nature',       label: '🌲 Nature',       col: '#16a34a' },
  { slug: 'attractions',  label: '🎡 Attractions',  col: '#f59e0b' },
  { slug: 'food',         label: '🍜 Food & drink', col: '#dc2626' },
  { slug: 'hotels',       label: '🏨 Hotels',       col: '#8b5cf6' },
  { slug: 'hostels',      label: '🛏️ Hostels',      col: '#ec4899' },
  { slug: 'temples',      label: '🛕 Temples',      col: '#a16207' },
];

function slugifyCountry(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const CONTINENT_OF: Record<string, string> = {
  Australia:'Oceania','New Zealand':'Oceania',Fiji:'Oceania','Papua New Guinea':'Oceania',Vanuatu:'Oceania','Solomon Islands':'Oceania','French Polynesia':'Oceania','Cook Islands':'Oceania',
  Thailand:'Asia',Vietnam:'Asia',Indonesia:'Asia',Malaysia:'Asia',Singapore:'Asia',Philippines:'Asia',Cambodia:'Asia',Laos:'Asia',Myanmar:'Asia','Sri Lanka':'Asia',India:'Asia',Nepal:'Asia',Bhutan:'Asia',Japan:'Asia','South Korea':'Asia',China:'Asia',Taiwan:'Asia','Hong Kong':'Asia',Mongolia:'Asia',
  'United States':'North America',Canada:'North America',Mexico:'North America','Costa Rica':'North America',Guatemala:'North America',Nicaragua:'North America',Panama:'North America',Honduras:'North America','El Salvador':'North America',Cuba:'North America',Jamaica:'North America','Dominican Republic':'North America',
  Peru:'South America',Colombia:'South America',Brazil:'South America',Argentina:'South America',Chile:'South America',Ecuador:'South America',Bolivia:'South America',Uruguay:'South America',Paraguay:'South America',Venezuela:'South America',Suriname:'South America',
  'United Kingdom':'Europe',France:'Europe',Spain:'Europe',Italy:'Europe',Germany:'Europe',Greece:'Europe',Portugal:'Europe',Netherlands:'Europe',Belgium:'Europe',Ireland:'Europe',Iceland:'Europe',Norway:'Europe',Sweden:'Europe',Denmark:'Europe',Finland:'Europe',Switzerland:'Europe',Austria:'Europe',Czechia:'Europe','Czech Republic':'Europe',Poland:'Europe',Hungary:'Europe',Croatia:'Europe',Slovenia:'Europe','Bosnia and Herzegovina':'Europe',Serbia:'Europe',Montenegro:'Europe',Albania:'Europe',Bulgaria:'Europe',Romania:'Europe',Turkey:'Europe',Russia:'Europe',Ukraine:'Europe',Estonia:'Europe',Latvia:'Europe',Lithuania:'Europe',
  Morocco:'Africa',Egypt:'Africa',Kenya:'Africa',Tanzania:'Africa','South Africa':'Africa',Namibia:'Africa',Botswana:'Africa',Zambia:'Africa',Zimbabwe:'Africa',Ethiopia:'Africa',Rwanda:'Africa',Uganda:'Africa',Ghana:'Africa',Senegal:'Africa',Tunisia:'Africa',Madagascar:'Africa',Mozambique:'Africa','Sri Lanka':'Asia',
};

export const metadata: Metadata = {
  title: 'Explore Places by Country',
  description: 'Find real travel destinations by country. Browse cities, beaches, nature, food and hotels across the globe — every review GPS-verified by travellers who were actually there.',
  alternates: { canonical: 'https://bugbitten.com/places' },
  openGraph: {
    title: 'Explore Places by Country — BugBitten',
    description: 'Browse real, GPS-verified travel places by country and category.',
    url: 'https://bugbitten.com/places',
    siteName: 'BugBitten',
    type: 'website',
  },
};

// 2026-05-25 — cached 30 min. Country distribution barely changes.
const getCountries = unstable_cache(
  async () => {
    try {
      // Single table scan: group by country + pick a stable cover via DISTINCT ON.
      const rows = await db`
        WITH covers AS (
          SELECT DISTINCT ON (country) country, cover_image
          FROM places
          WHERE cover_image IS NOT NULL AND cover_image <> ''
          ORDER BY country, id
        )
        SELECT p.country,
               COUNT(*)::int AS place_count,
               c.cover_image AS cover
        FROM places p
        LEFT JOIN covers c ON c.country = p.country
        WHERE p.country IS NOT NULL AND p.country <> ''
          AND p.country NOT IN ('Multiple','Multiple Countries')
        GROUP BY p.country, c.cover_image
        ORDER BY place_count DESC`;
      return rows as any[];
    } catch (e) { console.warn('[places/countries]', (e as any)?.code || e); return [] as any[]; }
  },
  ['places-countries'],
  { revalidate: 1800, tags: ['places'] }
)

export default async function PlacesOverviewPage() {
  const countries = await getCountries();
  const total = countries.reduce((s: number, c: any) => s + Number(c.place_count || 0), 0);

  // Group by continent
  const byContinent: Record<string, any[]> = {};
  for (const c of countries) {
    const cont = CONTINENT_OF[c.country] || 'Other';
    (byContinent[cont] ||= []).push(c);
  }
  const continentOrder = ['Oceania','Asia','Europe','Africa','North America','South America','Other'];

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bugbitten.com/' },
          { '@type': 'ListItem', position: 2, name: 'Places', item: 'https://bugbitten.com/places' },
        ],
      }) }} />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, var(--brand) 0%, #134e4a 100%)', color: '#fff', padding: '56px 20px 48px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>Explore places</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px,5vw,46px)', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15 }}>
            Travel places in every country
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: '0 0 26px', lineHeight: 1.55 }}>
            Cities, beaches, nature, food, hostels and hotels — real places, GPS-verified by travellers who were actually there.
            {total > 0 && <> Currently {total.toLocaleString()} places across {countries.length} countries.</>}
          </p>

          {/* Smart country search (Google Places) */}
          <PlacesCountrySearch />
        </div>
      </section>

      {/* Category shortcut chips */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10 }}>
          Browse by category
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {CATEGORIES.map(cat => (
            <Link key={cat.slug} href={`/explore?category=${cat.slug}`}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${cat.col}`, borderRadius: 10, padding: '14px 16px', fontSize: 15, fontWeight: 700, color: C.text, textDecoration: 'none', transition: 'transform 0.12s' }}>
              {cat.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Countries — by continent */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 64px' }}>
        {continentOrder.filter(c => byContinent[c]).map(cont => (
          <div key={cont} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 14px' }}>{cont}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {byContinent[cont].map((c: any) => (
                <Link key={c.country} href={`/country/${slugifyCountry(c.country)}`}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' as const }}>
                  {c.cover && <img loading="lazy" decoding="async" src={c.cover} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' as const, display: 'block' }} />}
                  <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{c.country}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{Number(c.place_count).toLocaleString()} place{Number(c.place_count) === 1 ? '' : 's'}</div>
                    </div>
                    <span style={{ color: C.teal, fontSize: 18 }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {countries.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' as const, color: C.sub }}>
            No countries indexed yet. Check back soon.
          </div>
        )}
      </section>
    </div>
  );
}
