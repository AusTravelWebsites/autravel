// Import every locality (city/town/suburb/village/hamlet/locality) for an
// Australian state into autravel.localities, sourced from OpenStreetMap via
// Overpass. Idempotent (uses ON CONFLICT (state_code, slug)).
//
// Usage:  node scripts/import-osm-localities.mjs nsw
//         node scripts/import-osm-localities.mjs all
//
// Overpass needs a custom User-Agent + form-encoded data= POST body or it
// returns 406 (per existing autravel OSM importers).
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const STATES = {
  qld: 'AU-QLD', nsw: 'AU-NSW', nt: 'AU-NT', wa: 'AU-WA',
  sa: 'AU-SA',  tas: 'AU-TAS', vic: 'AU-VIC',
}
const OVERPASS = 'https://overpass-api.de/api/interpreter'

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function fetchState(state) {
  const iso = STATES[state]
  if (!iso) throw new Error(`unknown state: ${state}`)
  const ql = `
[out:json][timeout:300];
area["ISO3166-2"="${iso}"]->.s;
(
  node["place"~"^(city|town|suburb|village|hamlet|locality)$"](area.s);
);
out body;`
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'User-Agent': 'autravel-localities-importer/1.0 (team@growthfactory.com.au)',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'data=' + encodeURIComponent(ql),
  })
  if (!r.ok) throw new Error(`Overpass ${r.status} ${await r.text().then(t=>t.slice(0,200))}`)
  return r.json()
}

const dbUrl = readFileSync('.env.local', 'utf8').match(/DATABASE_URL=(.+)/)[1].trim()
const sql = postgres(dbUrl)

async function importState(state) {
  console.log(`\n=== ${state.toUpperCase()} ===`)
  const data = await fetchState(state)
  const elements = data.elements || []
  console.log(`OSM returned ${elements.length} place nodes`)

  const seen = new Set()
  let skipped = 0
  const rows = []
  for (const el of elements) {
    const name = el.tags?.name
    if (!name) { skipped++; continue }
    const slug = slugify(name)
    if (!slug) { skipped++; continue }
    if (seen.has(slug)) { skipped++; continue }
    seen.add(slug)
    const popRaw = el.tags?.population
    const population = popRaw && /^\d+$/.test(popRaw) ? parseInt(popRaw, 10) : null
    const postcode = el.tags?.postal_code || el.tags?.['addr:postcode'] || null
    rows.push({
      state_code: state,
      name,
      slug,
      place_type: el.tags?.place,
      latitude: el.lat,
      longitude: el.lon,
      population,
      postcode,
      osm_id: el.id,
    })
  }
  const chunkSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await sql`
      INSERT INTO autravel.localities ${sql(chunk, 'state_code','name','slug','place_type','latitude','longitude','population','postcode','osm_id')}
      ON CONFLICT (state_code, slug) DO UPDATE SET
        place_type = EXCLUDED.place_type,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        population = COALESCE(EXCLUDED.population, autravel.localities.population),
        postcode = COALESCE(EXCLUDED.postcode, autravel.localities.postcode),
        osm_id = EXCLUDED.osm_id`
    inserted += chunk.length
    process.stdout.write('.')
  }
  console.log(`\n  ${inserted} inserted/updated · ${skipped} skipped`)
}

async function main() {
  const arg = process.argv[2] || 'nsw'
  const targets = arg === 'all' ? Object.keys(STATES) : [arg]
  for (const s of targets) {
    if (!STATES[s]) { console.error(`skip: unknown state ${s}`); continue }
    await importState(s)
    if (targets.length > 1) await new Promise(r => setTimeout(r, 5000)) // be polite to Overpass
  }
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
