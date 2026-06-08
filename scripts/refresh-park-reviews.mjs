#!/usr/bin/env node
/**
 * For any caravan/holiday/tourist park that has a google_place_id but no reviews
 * in source_raw, re-fetch Google Place Details with the `review` field and
 * update source_raw + avg_rating + review_count.
 *
 * Usage:
 *   node --env-file=.env.local scripts/refresh-park-reviews.mjs [--state qld] [--limit 100]
 *
 * Cost: ~$0.017 per place. 64 QLD parks = ~$1.10.
 */
import 'dotenv/config'
import postgres from 'postgres'

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const STATE = arg('state') || null
const LIMIT = Number(arg('limit', '200'))

const KEY = process.env.GOOGLE_PLACES_API_KEY
const DB_URL = process.env.DATABASE_URL
if (!KEY || !DB_URL) { console.error('missing env'); process.exit(1) }

const sql = postgres(DB_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })

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

async function run() {
  const stateFilter = STATE ? sql`AND state_code = ${STATE}` : sql``
  const parks = await sql`
    SELECT id, slug, name, google_place_id, source_raw
    FROM parks
    WHERE park_type IN ('caravan','holiday','tourist')
      AND google_place_id IS NOT NULL
      AND (source_raw IS NULL OR NOT (source_raw ? 'reviews') OR jsonb_array_length(source_raw->'reviews') = 0)
      ${stateFilter}
    ORDER BY review_count DESC NULLS LAST
    LIMIT ${LIMIT}`
  console.log(`Refreshing reviews for ${parks.length} parks`)

  let ok = 0, fail = 0, noReviews = 0
  for (const p of parks) {
    try {
      const det = await placeDetails(p.google_place_id)
      if (!det) { console.log(`  ✗ ${p.slug}: no details`); fail++; continue }
      const reviewCount = (det.reviews || []).length
      if (reviewCount === 0) noReviews++

      await sql`
        UPDATE parks
        SET source_raw = ${sql.json(det)},
            source_fetched_at = NOW(),
            avg_rating = ${det.rating || null},
            review_count = ${det.user_ratings_total || 0},
            updated_at = NOW()
        WHERE id = ${p.id}`
      console.log(`  ✓ ${p.slug}  (${reviewCount} reviews fetched, ${det.user_ratings_total || 0} total on Google, ${det.rating || '?'}★)`)
      ok++
    } catch (e) {
      console.log(`  ✗ ${p.slug}: ${e.message}`)
      fail++
    }
  }
  console.log(`\nDone: ok=${ok} no_reviews=${noReviews} fail=${fail}`)
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
