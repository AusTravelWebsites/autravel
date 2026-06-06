// Google Places verification helper.
// USE THIS before inserting any new row into the `places` table.
// Returns the matched Google place (with place_id, lat/lng, formatted_address)
// or null if no match — meaning we MUST NOT save the place.

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
}

/**
 * Verify a place exists on Google Maps via Places Text Search.
 * Returns the top result on success, null when nothing matches.
 *
 * Throws if GOOGLE_PLACES_API_KEY is missing — never silently fall through.
 */
export async function verifyOnGoogle(query: string): Promise<GooglePlace | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY not set — cannot verify places');
  if (!query || !query.trim()) return null;

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query.trim())}&key=${key}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Google Places HTTP ${r.status}`);
  const d = await r.json();
  if (d.status === 'ZERO_RESULTS' || !d.results?.length) return null;
  if (d.status !== 'OK') throw new Error(`Google Places ${d.status}: ${d.error_message || 'unknown error'}`);

  const top = d.results[0];
  return {
    place_id: top.place_id,
    name: top.name,
    formatted_address: top.formatted_address || '',
    lat: top.geometry?.location?.lat,
    lng: top.geometry?.location?.lng,
    types: top.types || [],
    rating: top.rating,
    user_ratings_total: top.user_ratings_total,
  };
}

export interface ResolvedLocation {
  place_id: string;
  formatted_address: string;
  country: string | null;         // long-form country name (e.g. "Australia")
  country_code: string | null;    // ISO 3166-1 alpha-2 (e.g. "AU")
  city: string | null;            // locality / sublocality when available
  lat: number | null;
  lng: number | null;
}

/**
 * Resolve a free-text location ("Melbourne, Australia") to structured fields via
 * Google Places Text Search + Details. Uses address_components for precise country
 * extraction rather than parsing the formatted_address string.
 */
export async function resolveLocation(query: string): Promise<ResolvedLocation | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY not set');
  const match = await verifyOnGoogle(query);
  if (!match) return null;

  // Details call for address_components (free within Basic SKU, cheap regardless).
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${match.place_id}&fields=address_component,formatted_address,geometry,name&key=${key}`;
  let country: string | null = null;
  let country_code: string | null = null;
  let city: string | null = null;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      const comps: any[] = d?.result?.address_components || [];
      for (const c of comps) {
        if (c.types?.includes('country')) { country = c.long_name || null; country_code = c.short_name || null; }
        if (c.types?.includes('locality')) city = c.long_name || city;
        if (!city && c.types?.includes('postal_town')) city = c.long_name;
        if (!city && c.types?.includes('administrative_area_level_2')) city = c.long_name;
      }
    }
  } catch { /* fall back to formatted_address parse */ }

  if (!country && match.formatted_address) {
    const parts = match.formatted_address.split(',').map(s => s.trim()).filter(Boolean);
    country = parts[parts.length - 1] || null;
  }

  return {
    place_id: match.place_id,
    formatted_address: match.formatted_address,
    country,
    country_code,
    city,
    lat: match.lat ?? null,
    lng: match.lng ?? null,
  };
}

/**
 * Convenience wrapper: throw a NextResponse-friendly error if a place can't be verified.
 */
export async function requireGoogleMatch(query: string): Promise<GooglePlace> {
  const match = await verifyOnGoogle(query);
  if (!match) {
    throw new Error(`Place not found on Google Maps: "${query}". Per policy, we only add real places.`);
  }
  return match;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/['"’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function categoryFromTypes(types: string[]): string {
  if (!types) return 'attractions';
  if (types.includes('lodging')) return 'hotels';
  if (types.includes('restaurant') || types.includes('cafe') || types.includes('food')) return 'food';
  if (types.includes('bar') || types.includes('night_club')) return 'food';
  if (types.includes('beach') || types.includes('natural_feature')) return 'beaches';
  if (types.includes('park')) return 'nature';
  if (types.includes('place_of_worship')) return 'temples';
  if (types.includes('locality') || types.includes('political')) return 'cities';
  return 'attractions';
}

interface UpsertedPlace {
  id: string;
  slug: string;
  name: string;
  google_place_id: string;
  created: boolean; // true if we just inserted it
}

/**
 * Look up a free-text location string on Google Places. If it matches a real place:
 *   - If a row with this google_place_id is already in the `places` table → return it
 *   - Else: insert a new row (with placeholder description, category from Google types,
 *     and an Unsplash cover image when available) and return it
 * If Google returns nothing → return null (the location stays as plain text in the UI).
 *
 * Designed for use inside POST handlers that accept user-supplied location text.
 * Fast in the hot path (one Google call, optional one Unsplash call); description
 * generation can happen out-of-band later via a separate enrichment job.
 */
export async function upsertPlaceFromLocation(
  locationText: string,
  db: any
): Promise<UpsertedPlace | null> {
  const text = (locationText || '').trim();
  if (!text || text.length < 2) return null;

  const match = await verifyOnGoogle(text);
  if (!match) return null;

  // Already in DB?
  const existing = await db`SELECT id::text AS id, slug, name, google_place_id FROM places WHERE google_place_id = ${match.place_id} LIMIT 1`;
  if (existing[0]) return { ...existing[0], created: false };

  // Generate unique slug
  let baseSlug = slugify(match.name);
  if (!baseSlug) baseSlug = 'place-' + match.place_id.slice(-8).toLowerCase();
  let slug = baseSlug;
  for (let n = 2; n < 50; n++) {
    const dupe = await db`SELECT 1 FROM places WHERE slug = ${slug} LIMIT 1`;
    if (!dupe.length) break;
    slug = `${baseSlug}-${n}`;
  }

  // Parse city / country from formatted_address
  const parts = (match.formatted_address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const country = parts[parts.length - 1] || null;
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;

  // Try to find an Unsplash image (best-effort, cheap, skip-on-failure)
  let cover: string | null = null;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const used = new Set<string>();
      for (const r of await db`SELECT cover_image FROM places WHERE cover_image LIKE '%images.unsplash.com%'`) {
        const m = r.cover_image?.match(/photo-([\w-]+)/);
        if (m) used.add(m[1]);
      }
      const queries = [`${match.name} ${city || ''}`.trim(), match.name, `${city || country || 'travel'}`];
      for (const q of queries) {
        if (cover) break;
        const ur = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape`, {
          headers: { Authorization: `Client-ID ${unsplashKey}`, 'Accept-Version': 'v1' },
        });
        if (!ur.ok) continue;
        const ud = await ur.json();
        for (const p of ud.results || []) {
          if (!used.has(p.id)) { cover = p.urls.regular; break; }
        }
      }
    } catch {}
  }

  const placeholder = `${match.name} is a real, Google-verified location at ${match.formatted_address}. A detailed traveller overview will appear here shortly.`;
  const category = categoryFromTypes(match.types);

  const [row] = await db`
    INSERT INTO places (slug, name, city, country, address, category, lat, lng, google_place_id, cover_image, description, created_at, updated_at)
    VALUES (${slug}, ${match.name}, ${city}, ${country}, ${match.formatted_address}, ${category},
            ${match.lat ?? null}, ${match.lng ?? null}, ${match.place_id}, ${cover}, ${placeholder}, NOW(), NOW())
    RETURNING id::text AS id, slug, name, google_place_id`;
  return { ...row, created: true };
}
