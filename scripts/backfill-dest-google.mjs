#!/usr/bin/env node
/**
 * backfill-dest-google.mjs — fetch Google Places Text Search for each
 * destination without a hero_image and use the top-result photo.
 * Uses the same GOOGLE_PLACES_API_KEY as the parks importer.
 */
import 'dotenv/config'
import postgres from 'postgres'

const KEY = process.env.GOOGLE_PLACES_API_KEY
const DB = process.env.DATABASE_URL_POOL || process.env.DATABASE_URL
if (!KEY || !DB) { console.error('missing env'); process.exit(1) }

const STATE_NAMES = {
  qld: 'Queensland', nsw: 'New South Wales', vic: 'Victoria',
  wa: 'Western Australia', sa: 'South Australia', tas: 'Tasmania',
  nt: 'Northern Territory', aunz: 'Australia',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function search(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=au&key=${KEY}`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  if (d.status !== 'OK' || !d.results?.length) return null
  const hit = d.results[0]
  const photoRef = hit.photos?.[0]?.photo_reference
  if (!photoRef) return null
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${photoRef}&key=${KEY}`
}

async function main() {
  const sql = postgres(DB, { prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' } })
  const rows = await sql`SELECT state_code, slug, name FROM destinations WHERE hero_image IS NULL AND active ORDER BY state_code, name`
  console.log(`destinations missing hero: ${rows.length}`)
  let ok = 0, failed = 0
  for (const d of rows) {
    const state = STATE_NAMES[d.state_code] || 'Australia'
    const queries = [
      `${d.name} ${state} Australia landmark`,
      `${d.name} tourism ${state}`,
      `${d.name} ${state}`,
    ]
    let url = null
    for (const q of queries) {
      url = await search(q)
      if (url) break
      await sleep(300)
    }
    if (!url) { failed++; console.warn('  no match:', d.slug); continue }
    await sql`UPDATE destinations SET hero_image = ${url}, updated_at = NOW() WHERE state_code = ${d.state_code} AND slug = ${d.slug}`
    ok++
    if (ok % 10 === 0) console.log(`  [${ok}/${rows.length}] last: ${d.slug}`)
    await sleep(300)
  }
  console.log(`\n Done: ok=${ok} failed=${failed}`)
  await sql.end()
}
main().catch(e => { console.error(e); process.exit(1) })
