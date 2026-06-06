#!/usr/bin/env node
// import-osm-nearby.mjs — for every active park with a lat/lng, fetch nearby
// OpenStreetMap features (campgrounds, picnic areas, viewpoints, fuel, public
// toilets, swimming, lookouts) within 30km via Overpass API. Cached in
// park_nearby table. Free, no key. Polite (3s between requests, batched 5km).
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null
const RADIUS_M = 30000

// One Overpass call per park with all categories
const QUERY = (lat, lng) => `[out:json][timeout:25];
(
  node["tourism"="camp_site"](around:${RADIUS_M},${lat},${lng});
  node["tourism"="caravan_site"](around:${RADIUS_M},${lat},${lng});
  node["tourism"="picnic_site"](around:${RADIUS_M},${lat},${lng});
  node["tourism"="viewpoint"](around:${RADIUS_M},${lat},${lng});
  node["leisure"="park"](around:${RADIUS_M},${lat},${lng});
  node["natural"="beach"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="fuel"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="toilets"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="drinking_water"](around:${RADIUS_M},${lat},${lng});
  node["leisure"="swimming_pool"](around:${RADIUS_M},${lat},${lng});
);
out tags center 200;`

async function ensureTable() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS autravel.park_nearby (
      park_id uuid NOT NULL REFERENCES autravel.parks(id) ON DELETE CASCADE,
      osm_id bigint NOT NULL,
      category text NOT NULL,
      name text,
      lat numeric(9,6),
      lng numeric(9,6),
      distance_km numeric(5,2),
      tags jsonb,
      PRIMARY KEY (park_id, osm_id)
    )`)
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_park_nearby_park ON autravel.park_nearby (park_id, category, distance_km)`)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS autravel.park_nearby_meta (
      park_id uuid PRIMARY KEY REFERENCES autravel.parks(id) ON DELETE CASCADE,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
}

function categorise(tags) {
  if (tags.tourism === 'camp_site' || tags.tourism === 'caravan_site') return 'campground'
  if (tags.tourism === 'picnic_site') return 'picnic'
  if (tags.tourism === 'viewpoint') return 'viewpoint'
  if (tags.amenity === 'fuel') return 'fuel'
  if (tags.amenity === 'toilets') return 'toilet'
  if (tags.amenity === 'drinking_water') return 'water'
  if (tags.natural === 'beach') return 'beach'
  if (tags.leisure === 'swimming_pool') return 'swim'
  if (tags.leisure === 'park') return 'park'
  return 'other'
}

function haversineKm(a, b, c, d) {
  const r = 6371
  const dLat = (c - a) * Math.PI / 180
  const dLng = (d - b) * Math.PI / 180
  const lat1 = a * Math.PI / 180
  const lat2 = c * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return r * 2 * Math.asin(Math.sqrt(x))
}

async function fetchOverpass(lat, lng) {
  const body = QUERY(lat, lng)
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(body),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'autravel-osm-importer/1.0 (team@growthfactory.com.au)',
          'Accept': 'application/json',
        },
      })
      if (r.ok) return await r.json()
      if (r.status === 429 || r.status === 504 || r.status >= 500) {
        await new Promise(s => setTimeout(s, 5000 * attempt))
        continue
      }
      throw new Error(`overpass ${r.status}`)
    } catch (e) {
      if (attempt === 4) throw e
      await new Promise(s => setTimeout(s, 3000 * attempt))
    }
  }
  throw new Error('overpass exhausted')
}

await ensureTable()

const parks = await sql`
  SELECT id, slug, state_code, name, lat, lng FROM parks
  WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY state_code, name
`
console.log(`parks: ${parks.length}`)

let processed = 0, skipped = 0, failed = 0
for (const p of parks) {
  if (LIMIT && processed >= LIMIT) break
  if (!FORCE) {
    const [chk] = await sql`SELECT 1 FROM park_nearby_meta WHERE park_id = ${p.id} AND updated_at > now() - interval '90 days' LIMIT 1`
    if (chk) { skipped++; continue }
  }
  try {
    const data = await fetchOverpass(p.lat, p.lng)
    const elements = data.elements || []
    await sql`DELETE FROM park_nearby WHERE park_id = ${p.id}`
    for (const e of elements) {
      const lat = e.lat ?? e.center?.lat
      const lng = e.lon ?? e.center?.lon
      if (lat == null || lng == null) continue
      const dist = haversineKm(Number(p.lat), Number(p.lng), lat, lng)
      if (dist > 30) continue
      const cat = categorise(e.tags || {})
      const name = e.tags?.name || e.tags?.['name:en'] || null
      try {
        await sql`
          INSERT INTO park_nearby (park_id, osm_id, category, name, lat, lng, distance_km, tags)
          VALUES (${p.id}, ${e.id}, ${cat}, ${name}, ${lat}, ${lng}, ${dist.toFixed(2)}, ${e.tags || {}})
          ON CONFLICT (park_id, osm_id) DO NOTHING
        `
      } catch {}
    }
    await sql`
      INSERT INTO park_nearby_meta (park_id, updated_at)
      VALUES (${p.id}, now())
      ON CONFLICT (park_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
    `
    processed++
    if (processed % 25 === 0) console.log(`  ${processed} done…`)
    await new Promise(r => setTimeout(r, 3000)) // overpass = polite delay
  } catch (e) {
    failed++
    console.log(`  ✗ ${p.state_code}/${p.slug} — ${e.message}`)
    await new Promise(r => setTimeout(r, 5000))
  }
}

console.log(`\n${processed} processed, ${skipped} skipped (cached), ${failed} failed`)
await sql.end()
