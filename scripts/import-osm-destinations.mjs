#!/usr/bin/env node
// import-osm-destinations.mjs — Overpass POI fetch within 25km of every
// active destination. Same model as park_nearby. Mirrors importer logic.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: /@(127\.0\.0\.1|localhost)\b/.test(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL || '') ? false : 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null
const RADIUS_M = 25000

const QUERY = (lat, lng) => `[out:json][timeout:30];
(
  node["tourism"~"^(attraction|museum|gallery|theme_park|zoo|aquarium|viewpoint)$"](around:${RADIUS_M},${lat},${lng});
  node["historic"~"^(monument|castle|memorial|ruins|archaeological_site)$"](around:${RADIUS_M},${lat},${lng});
  node["natural"~"^(beach|peak|cave_entrance|waterfall)$"](around:${RADIUS_M},${lat},${lng});
  node["leisure"="nature_reserve"](around:${RADIUS_M},${lat},${lng});
  way["boundary"="national_park"](around:${RADIUS_M},${lat},${lng});
  node["amenity"~"^(theatre|cinema|marketplace)$"](around:${RADIUS_M},${lat},${lng});
);
out tags center 200;`

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS autravel.destination_nearby (
    destination_id uuid NOT NULL REFERENCES autravel.destinations(id) ON DELETE CASCADE,
    osm_id bigint NOT NULL,
    category text NOT NULL,
    name text,
    lat numeric(9,6),
    lng numeric(9,6),
    distance_km numeric(5,2),
    tags jsonb,
    PRIMARY KEY (destination_id, osm_id)
  )`)
await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_dest_nearby ON autravel.destination_nearby (destination_id, category, distance_km)`)
await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS autravel.destination_nearby_meta (
    destination_id uuid PRIMARY KEY REFERENCES autravel.destinations(id) ON DELETE CASCADE,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

function categorise(t) {
  if (t.tourism === 'attraction') return 'attraction'
  if (t.tourism === 'museum' || t.tourism === 'gallery') return 'museum'
  if (t.tourism === 'theme_park' || t.tourism === 'zoo' || t.tourism === 'aquarium') return 'family'
  if (t.tourism === 'viewpoint') return 'viewpoint'
  if (t.historic) return 'historic'
  if (t.natural === 'beach') return 'beach'
  if (t.natural === 'peak') return 'peak'
  if (t.natural === 'waterfall') return 'waterfall'
  if (t.natural === 'cave_entrance') return 'cave'
  if (t.leisure === 'nature_reserve' || t.boundary === 'national_park') return 'nature_reserve'
  if (t.amenity === 'theatre' || t.amenity === 'cinema' || t.amenity === 'marketplace') return 'culture'
  return 'other'
}

function haversineKm(a, b, c, d) {
  const r = 6371
  const dLat = (c - a) * Math.PI / 180, dLng = (d - b) * Math.PI / 180
  const lat1 = a * Math.PI / 180, lat2 = c * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return r * 2 * Math.asin(Math.sqrt(x))
}

async function fetchOverpass(lat, lng) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(QUERY(lat, lng)),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'autravel-osm/1.0 (team@growthfactory.com.au)',
          'Accept': 'application/json',
        },
      })
      if (r.ok) return await r.json()
      if (r.status === 429 || r.status === 504 || r.status >= 500) {
        await new Promise(s => setTimeout(s, 5000 * attempt)); continue
      }
      throw new Error(`overpass ${r.status}`)
    } catch (e) {
      if (attempt === 4) throw e
      await new Promise(s => setTimeout(s, 3000 * attempt))
    }
  }
}

const dests = await sql`
  SELECT id, slug, state_code, name, lat, lng FROM destinations
  WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY state_code, name
`
console.log(`destinations: ${dests.length}`)

let processed = 0, skipped = 0, failed = 0
for (const d of dests) {
  if (LIMIT && processed >= LIMIT) break
  if (!FORCE) {
    const [chk] = await sql`SELECT 1 FROM destination_nearby_meta WHERE destination_id = ${d.id} AND updated_at > now() - interval '90 days' LIMIT 1`
    if (chk) { skipped++; continue }
  }
  try {
    const data = await fetchOverpass(d.lat, d.lng)
    const elements = data.elements || []
    await sql`DELETE FROM destination_nearby WHERE destination_id = ${d.id}`
    for (const e of elements) {
      const lat = e.lat ?? e.center?.lat
      const lng = e.lon ?? e.center?.lon
      if (lat == null || lng == null) continue
      const dist = haversineKm(Number(d.lat), Number(d.lng), lat, lng)
      if (dist > 25) continue
      const cat = categorise(e.tags || {})
      const name = e.tags?.name || e.tags?.['name:en'] || null
      try {
        await sql`
          INSERT INTO destination_nearby (destination_id, osm_id, category, name, lat, lng, distance_km, tags)
          VALUES (${d.id}, ${e.id}, ${cat}, ${name}, ${lat}, ${lng}, ${dist.toFixed(2)}, ${e.tags || {}})
          ON CONFLICT (destination_id, osm_id) DO NOTHING`
      } catch {}
    }
    await sql`
      INSERT INTO destination_nearby_meta (destination_id, updated_at)
      VALUES (${d.id}, now())
      ON CONFLICT (destination_id) DO UPDATE SET updated_at = EXCLUDED.updated_at`
    processed++
    if (processed % 10 === 0) console.log(`  ${processed} done…`)
    await new Promise(r => setTimeout(r, 3000))
  } catch (e) {
    failed++
    console.log(`  ✗ ${d.state_code}/${d.slug} — ${e.message}`)
    await new Promise(r => setTimeout(r, 5000))
  }
}
console.log(`\n${processed} processed, ${skipped} skipped (cached), ${failed} failed`)
await sql.end()
