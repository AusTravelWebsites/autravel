#!/usr/bin/env node
/**
 * import-parks.mjs — seed the `parks` table from Google Places Text Search.
 *
 * Usage:
 *   node scripts/import-parks.mjs --state qld [--queries "caravan park,holiday park"] [--pages 3] [--dry-run]
 *
 * Strategy:
 *   For each state, runs several Text Search queries ("caravan park in Queensland",
 *   "holiday park in Queensland", "tourist park in Queensland"), paginates up to
 *   --pages pages of 20 results each, then calls Place Details for address
 *   components + phone + website. Deduplicates on google_place_id.
 *
 * Conservative on API spend: default max 3 pages per query, sleep 2s between
 * pagination requests (Google requires a delay before next_page_token is valid),
 * resumable via google_place_id UPSERT.
 */
import 'dotenv/config'
import postgres from 'postgres'

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const STATE = (arg('state') || '').toLowerCase()
const DRY = args.includes('--dry-run')
const MAX_PAGES = Number(arg('pages', '3'))
const QUERIES_ARG = arg('queries')

const STATE_NAMES = {
  qld: 'Queensland', nsw: 'New South Wales', nt: 'Northern Territory',
  wa: 'Western Australia', sa: 'South Australia', tas: 'Tasmania', vic: 'Victoria',
  // Perth Tourism — WA-wide content tagged 'perth' (separate brand from watravel).
  perth: 'Western Australia',
}
if (!STATE || !STATE_NAMES[STATE]) {
  console.error('Usage: node scripts/import-parks.mjs --state <qld|nsw|nt|wa|sa|tas|vic> [--queries "..."] [--pages 3] [--dry-run]')
  process.exit(1)
}
const STATE_NAME = STATE_NAMES[STATE]
const DEFAULT_QUERIES = [
  `caravan park in ${STATE_NAME}`,
  `holiday park in ${STATE_NAME}`,
  `tourist park in ${STATE_NAME}`,
  `big4 in ${STATE_NAME}`,
  `discovery park in ${STATE_NAME}`,
]
const QUERIES = QUERIES_ARG ? QUERIES_ARG.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_QUERIES

const KEY = process.env.GOOGLE_PLACES_API_KEY
if (!KEY) { console.error('GOOGLE_PLACES_API_KEY not set'); process.exit(1) }
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const sql = postgres(DB_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function classifyParkType(name, types) {
  const n = (name || '').toLowerCase()
  if (n.includes('bush') || n.includes('free camp')) return 'bushcamp'
  if (n.includes('national park')) return 'national_park'
  if (n.includes('holiday park')) return 'holiday'
  if (n.includes('tourist park')) return 'tourist'
  if (n.includes('caravan park')) return 'caravan'
  if ((types || []).includes('rv_park')) return 'caravan'
  return 'caravan'
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function textSearch(query, nextPageToken = null) {
  const url = nextPageToken
    ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${KEY}`
    : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=au&key=${KEY}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Places TextSearch HTTP ${r.status}`)
  const d = await r.json()
  if (d.status === 'ZERO_RESULTS') return { results: [], next_page_token: null }
  if (d.status !== 'OK') throw new Error(`Places TextSearch ${d.status}: ${d.error_message || ''}`)
  return d
}

async function placeDetails(placeId) {
  const fields = [
    'place_id', 'name', 'formatted_address', 'address_component', 'geometry', 'types',
    'international_phone_number', 'website', 'url', 'rating', 'user_ratings_total',
    'opening_hours', 'photo', 'business_status',
  ].join(',')
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${KEY}`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  if (d.status !== 'OK') return null
  return d.result
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
  const started_at = new Date()
  let ok = 0, skipped = 0, failed = 0
  const seen = new Set()

  for (const q of QUERIES) {
    console.log(`\n  Query: "${q}"`)
    let pageToken = null
    for (let p = 0; p < MAX_PAGES; p++) {
      if (p > 0 && !pageToken) break
      if (p > 0) await sleep(2200)
      let page
      try { page = await textSearch(q, pageToken) }
      catch (e) { console.warn('   ', e.message); break }
      console.log(`    Page ${p + 1}: ${page.results.length} hits`)
      for (const hit of page.results) {
        const pid = hit.place_id
        if (!pid || seen.has(pid)) continue
        seen.add(pid)
        try {
          const det = await placeDetails(pid)
          if (!det) { skipped++; continue }
          const { suburb, postcode, region, state } = extract(det)
          if (state && !state.toLowerCase().includes(STATE_NAME.toLowerCase())) { skipped++; continue }
          const name = det.name || hit.name
          const slug = slugify(`${name}-${suburb || region || STATE}`)
          const cover = det.photos?.[0]?.photo_reference ? photoUrl(det.photos[0].photo_reference) : null
          const row = {
            state_code: STATE,
            slug,
            name,
            park_type: classifyParkType(name, det.types),
            region: region || null,
            address: det.formatted_address || null,
            suburb: suburb || null,
            postcode: postcode || null,
            lat: det.geometry?.location?.lat || null,
            lng: det.geometry?.location?.lng || null,
            phone: det.international_phone_number || null,
            website: det.website || null,
            description: null,
            cover_image: cover,
            google_place_id: pid,
            source: 'google',
            source_raw: det,
            source_fetched_at: new Date(),
            avg_rating: det.rating || null,
            review_count: det.user_ratings_total || 0,
            active: true,
          }
          if (DRY) { console.log('      (dry)', STATE, slug, '←', name); ok++; continue }
          await sql`
            INSERT INTO parks ${sql(row)}
            ON CONFLICT (google_place_id) WHERE google_place_id IS NOT NULL DO UPDATE SET
              name = EXCLUDED.name,
              address = EXCLUDED.address,
              suburb = EXCLUDED.suburb,
              postcode = EXCLUDED.postcode,
              lat = EXCLUDED.lat,
              lng = EXCLUDED.lng,
              phone = COALESCE(parks.phone, EXCLUDED.phone),
              website = COALESCE(parks.website, EXCLUDED.website),
              cover_image = COALESCE(parks.cover_image, EXCLUDED.cover_image),
              avg_rating = EXCLUDED.avg_rating,
              review_count = EXCLUDED.review_count,
              source_raw = EXCLUDED.source_raw,
              source_fetched_at = EXCLUDED.source_fetched_at,
              updated_at = NOW()`
          ok++
        } catch (e) {
          console.warn('      err:', e.message)
          failed++
        }
      }
      pageToken = page.next_page_token || null
    }
  }

  const finished_at = new Date()
  console.log(`\n Done: ok=${ok} skipped=${skipped} failed=${failed}  (${Math.round((finished_at - started_at) / 1000)}s)`)
  if (!DRY) {
    await sql`
      INSERT INTO wp_import_log (state_code, action, ok, count_ok, count_fail, details, started_at, finished_at)
      VALUES (${STATE}, 'parks:google', ${failed === 0}, ${ok}, ${failed}, ${sql.json({ queries: QUERIES, skipped })}, ${started_at}, ${finished_at})`
  }
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
