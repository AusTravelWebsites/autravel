#!/usr/bin/env node
/**
 * One-off backfill: compute autravel.trails.preview_points from geometry+bbox so
 * the /park-maps/ listing query stops shipping ~3.3 MB of raw GPS points just
 * to draw 28-point thumbnail outlines per card.
 *
 * Same downsampling logic as buildPreview() in src/app/park-maps/page.tsx —
 * kept here verbatim so the data shape matches exactly.
 *
 * Usage: node --env-file=.env.local scripts/backfill-trail-previews.mjs
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })

function buildPreview(geometry, bbox) {
  if (!geometry?.length || !bbox || bbox.length < 4) return []
  const [s, w, n, e] = bbox
  const spanLat = (n - s) || 1e-6, spanLng = (e - w) || 1e-6
  const flat = []
  for (const seg of geometry) for (const p of seg) flat.push(p)
  if (!flat.length) return []
  const step = Math.max(1, Math.floor(flat.length / 28))
  const out = []
  for (let i = 0; i < flat.length; i += step) {
    const [lat, lng] = flat[i]
    out.push([((lng - w) / spanLng) * 100, (1 - (lat - s) / spanLat) * 60])
  }
  return out
}

const trails = await sql`
  SELECT id, slug, geometry, bbox FROM trails
   WHERE active = true AND geometry IS NOT NULL AND bbox IS NOT NULL`
console.log(`Backfilling preview_points for ${trails.length} trails`)

let ok = 0, skipped = 0
for (const t of trails) {
  const pts = buildPreview(t.geometry, t.bbox)
  if (!pts.length) { skipped++; continue }
  await sql`UPDATE trails SET preview_points = ${sql.json(pts)} WHERE id = ${t.id}`
  ok++
}
console.log(`Done: ok=${ok} skipped=${skipped}`)
await sql.end()
