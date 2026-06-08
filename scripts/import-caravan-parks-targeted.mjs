#!/usr/bin/env node
/**
 * Targeted Google Places lookup for a hard-coded list of caravan parks that
 * were missing from autravel.parks (surfaced via 404 log from old qldtravel
 * directory URLs). Fetches Place Details INCLUDING reviews so the pro/con
 * generator has something to work from.
 *
 * Usage: node --env-file=.env.local scripts/import-caravan-parks-targeted.mjs
 *
 * Skips any park whose google_place_id already exists in DB.
 */
import 'dotenv/config'
import postgres from 'postgres'

const KEY = process.env.GOOGLE_PLACES_API_KEY
const DB_URL = process.env.DATABASE_URL
if (!KEY || !DB_URL) { console.error('missing env'); process.exit(1) }

const sql = postgres(DB_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })

// Hard-coded targets: { searchQuery, expectedOldSlug }
// searchQuery is what we send to Google Places Text Search.
const TARGETS = [
  { query: 'Bakers Creek Caravan Park, Queensland', oldSlug: 'bakers-creek-caravan-park' },
  { query: 'Beachmere Caravan Park, Queensland', oldSlug: 'beachmere-caravan-park' },
  { query: 'Beachside Holiday Caravan Park Yeppoon', oldSlug: 'beachside-holiday-caravan-park-yeppoon' },
  { query: 'Bells Caravan Park, Queensland', oldSlug: 'bells-caravan-park' },
  { query: 'Esk Caravan Park and Motel, Queensland', oldSlug: 'esk-caravan-park-brisbane-valley-rail-trail-motel' },
  { query: 'Harbour View Tourist Park, Queensland', oldSlug: 'harbour-view-tourist-park' },
  { query: 'Kingaroy Holiday Park, Queensland', oldSlug: 'kingaroy-holiday-park' },
  { query: 'Kingfisher Caravan Park, Queensland', oldSlug: 'kingfisher-caravan-park' },
  { query: 'Lake Wivenhoe Campgrounds, Queensland', oldSlug: 'lake-wivenhoe-campgrounds' },
  { query: 'Newmarket Gardens Caravan Park, Brisbane', oldSlug: 'newmarket-gardens-caravan-park-2' },
  { query: 'Noosa River Holiday Park, Queensland', oldSlug: 'noosa-river-holiday-park' },
  { query: "O'Connell River Whitsunday Tourist Park, Queensland", oldSlug: 'oconnell-river-whitsunday-tourist-park' },
]

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function classifyParkType(name, types) {
  const n = (name || '').toLowerCase()
  if (n.includes('national park')) return 'national_park'
  if (n.includes('holiday')) return 'holiday'
  if (n.includes('tourist')) return 'tourist'
  if (n.includes('caravan')) return 'caravan'
  if ((types || []).includes('rv_park')) return 'caravan'
  return 'caravan'
}

async function textSearch(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=au&key=${KEY}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json()
  if (d.status === 'ZERO_RESULTS') return null
  if (d.status !== 'OK') throw new Error(`Places ${d.status}: ${d.error_message || ''}`)
  return d.results?.[0] || null
}

async function placeDetails(placeId) {
  const fields = [
    'place_id', 'name', 'formatted_address', 'address_component', 'geometry',
    'types', 'international_phone_number', 'website', 'url', 'rating',
    'user_ratings_total', 'opening_hours', 'photo', 'business_status', 'review',
  ].join(',')
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${KEY}`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  return d.status === 'OK' ? d.result : null
}

function extract(details) {
  const comps = details?.address_components || []
  let suburb = null, postcode = null, region = null, state = null
  for (const c of comps) {
    if (!suburb && (c.types?.includes('locality') || c.types?.includes('sublocality'))) suburb = c.long_name
    if (c.types?.includes('postal_code')) postcode = c.long_name
    if (!region && c.types?.includes('administrative_area_level_2')) region = c.long_name
    if (c.types?.includes('administrative_area_level_1')) state = c.long_name
  }
  return { suburb, postcode, region, state }
}

function photoUrl(ref, max = 1200) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${max}&photoreference=${ref}&key=${KEY}`
}

async function run() {
  console.log(`Targeted Places lookup — ${TARGETS.length} caravan parks`)
  const results = { ok: [], skipped: [], failed: [] }

  for (const t of TARGETS) {
    try {
      console.log(`\n→ ${t.oldSlug}`)
      console.log(`  query: ${t.query}`)
      const hit = await textSearch(t.query)
      if (!hit) { console.log('  ZERO_RESULTS'); results.failed.push({...t, reason: 'zero_results'}); continue }
      console.log(`  hit: ${hit.name} (${hit.place_id})`)

      const det = await placeDetails(hit.place_id)
      if (!det) { console.log('  no details'); results.failed.push({...t, reason: 'no_details'}); continue }

      const { suburb, postcode, region, state } = extract(det)
      if (state && !state.toLowerCase().includes('queensland')) {
        console.log(`  ⚠ outside QLD (got ${state}) — skipping`)
        results.skipped.push({...t, reason: `outside_qld:${state}`}); continue
      }

      const name = det.name || hit.name
      const slug = slugify(`${name}-${suburb || region || 'qld'}`)
      const parkType = classifyParkType(name, det.types)
      const photos = (det.photos || []).slice(0, 8).map(p => photoUrl(p.photo_reference))
      const cover = photos[0] || null

      const row = {
        state_code: 'qld',
        slug,
        name,
        park_type: parkType,
        region: region || null,
        address: det.formatted_address || null,
        suburb: suburb || null,
        postcode: postcode || null,
        lat: det.geometry?.location?.lat || null,
        lng: det.geometry?.location?.lng || null,
        phone: det.international_phone_number || null,
        website: det.website || null,
        cover_image: cover,
        images: photos.length ? sql.json(photos) : null,
        google_place_id: det.place_id,
        source: 'google',
        source_raw: sql.json(det),
        source_fetched_at: new Date(),
        avg_rating: det.rating || null,
        review_count: det.user_ratings_total || 0,
        active: true,
      }

      const [r] = await sql`
        INSERT INTO parks ${sql(row)}
        ON CONFLICT (google_place_id) WHERE google_place_id IS NOT NULL
        DO UPDATE SET
          source_raw = EXCLUDED.source_raw,
          source_fetched_at = EXCLUDED.source_fetched_at,
          avg_rating = EXCLUDED.avg_rating,
          review_count = EXCLUDED.review_count,
          updated_at = NOW()
        RETURNING slug`
      console.log(`  ✓ saved as /parks/${r.slug}/  (${parkType}, ${det.user_ratings_total} reviews, ${det.rating}★)`)
      results.ok.push({ oldSlug: t.oldSlug, newSlug: r.slug, name, reviewCount: det.user_ratings_total || 0 })
    } catch (e) {
      console.log(`  ✗ ${e.message}`)
      results.failed.push({...t, reason: e.message})
    }
  }

  console.log(`\n\nResults: ok=${results.ok.length} skipped=${results.skipped.length} failed=${results.failed.length}`)
  console.log('\nMatched (write redirects for these):')
  for (const r of results.ok) console.log(`  /directory-qldtravel/listing/${r.oldSlug}/  ->  /parks/${r.newSlug}/`)
  console.log('\nFailed/skipped:')
  for (const r of [...results.failed, ...results.skipped]) console.log(`  ${r.oldSlug}  (${r.reason})`)
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
