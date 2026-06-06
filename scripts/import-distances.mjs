#!/usr/bin/env node
// import-distances.mjs — compute drive distance + duration between every pair
// of destinations within the same state, using OSRM's public router.
// Idempotent — skip pairs already computed unless --force.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS autravel.distance_pairs (
    state_code text NOT NULL,
    from_slug text NOT NULL,
    to_slug text NOT NULL,
    from_name text NOT NULL,
    to_name text NOT NULL,
    distance_km numeric(7,1) NOT NULL,
    duration_min int NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (state_code, from_slug, to_slug)
  )
`)
await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_dist_state ON autravel.distance_pairs (state_code)`)

async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'autravel-distance/1.0 (team@growthfactory.com.au)' } })
      if (r.ok) {
        const j = await r.json()
        const route = j?.routes?.[0]
        if (!route) return null
        return { distance_km: route.distance / 1000, duration_min: Math.round(route.duration / 60) }
      }
      if (r.status === 429 || r.status >= 500) {
        await new Promise(s => setTimeout(s, 3000 * attempt))
        continue
      }
      return null
    } catch (e) {
      if (attempt === 4) return null
      await new Promise(s => setTimeout(s, 2000 * attempt))
    }
  }
  return null
}

const dests = await sql`
  SELECT state_code, slug, name, lat::text, lng::text FROM destinations
  WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY state_code, name
`
console.log(`destinations: ${dests.length}`)

// Group by state and generate pairs (i<j to avoid duplicates)
const byState = {}
for (const d of dests) (byState[d.state_code] ||= []).push(d)

const pairs = []
for (const [state, ds] of Object.entries(byState)) {
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      pairs.push({ state, from: ds[i], to: ds[j] })
    }
  }
}
console.log(`pairs: ${pairs.length}`)

let processed = 0, skipped = 0, failed = 0
for (const p of pairs) {
  if (LIMIT && processed >= LIMIT) break
  const [fromSlug, toSlug] = [p.from.slug, p.to.slug].sort()
  if (!FORCE) {
    const [chk] = await sql`SELECT 1 FROM distance_pairs WHERE state_code = ${p.state} AND from_slug = ${fromSlug} AND to_slug = ${toSlug} LIMIT 1`
    if (chk) { skipped++; continue }
  }
  // Always compute in canonical (from < to) direction; render both directions on render side
  const a = fromSlug === p.from.slug ? p.from : p.to
  const b = fromSlug === p.from.slug ? p.to : p.from
  const route = await fetchRoute(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng))
  if (!route) {
    failed++
    console.log(`  ✗ ${p.state}/${a.slug}-to-${b.slug}`)
    await new Promise(r => setTimeout(r, 1500))
    continue
  }
  await sql`
    INSERT INTO distance_pairs (state_code, from_slug, to_slug, from_name, to_name, distance_km, duration_min)
    VALUES (${p.state}, ${a.slug}, ${b.slug}, ${a.name}, ${b.name}, ${route.distance_km.toFixed(1)}, ${route.duration_min})
    ON CONFLICT (state_code, from_slug, to_slug) DO UPDATE SET
      distance_km = EXCLUDED.distance_km,
      duration_min = EXCLUDED.duration_min,
      updated_at = now()
  `
  processed++
  if (processed % 25 === 0) console.log(`  ${processed} done, ${failed} failed`)
  await new Promise(r => setTimeout(r, 1500))
}
console.log(`\n${processed} processed, ${skipped} skipped (cached), ${failed} failed`)
await sql.end()
