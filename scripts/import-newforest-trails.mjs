#!/usr/bin/env node
/**
 * import-newforest-trails.mjs — build the New Forest "Park Maps" dataset from
 * OpenStreetMap via Overpass.
 *
 *   node --env-file=.env.local scripts/import-newforest-trails.mjs [--dry-run] [--limit N]
 *
 * What it imports (state_code='uk'):
 *   - Waymarked ROUTE relations (route=hiking/foot/walking/bicycle/mtb) — the
 *     named long-distance + circular trails.
 *   - NAMED ways (highway=path/footway/bridleway/cycleway/byway/track), MERGED
 *     by name so a trail split across many OSM segments becomes ONE entry with
 *     combined geometry + total length.
 *
 * Geometry is stored as an array of segments ([[ [lat,lng], ... ], ... ]) so the
 * TrailMap component can draw each as a polyline. Length is computed with the
 * haversine formula; difficulty/duration are derived from length + type. Area
 * is the nearest New Forest town. Idempotent on (source, osm_type, osm_id).
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity

// New Forest National Park approximate bounding box (S,W,N,E).
const BBOX = '50.70,-1.86,51.00,-1.33'

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const QUERY = `[out:json][timeout:240];
(
  way["highway"~"^(path|footway|bridleway|cycleway|byway|track)$"]["name"](${BBOX});
  relation["route"~"^(hiking|foot|walking|bicycle|mtb)$"](${BBOX});
);
out geom;`

// New Forest towns/villages for nearest-area labelling.
const TOWNS = [
  ['Lyndhurst', 50.8720, -1.5740], ['Brockenhurst', 50.8230, -1.5730],
  ['Lymington', 50.7580, -1.5450], ['Beaulieu', 50.8170, -1.4520],
  ['Burley', 50.8270, -1.7060], ['Ringwood', 50.8460, -1.7920],
  ['Fordingbridge', 50.9270, -1.7900], ['Sway', 50.7860, -1.6080],
  ['Ashurst', 50.8830, -1.5230], ['Hythe', 50.8690, -1.3990],
  ['Milford on Sea', 50.7240, -1.5860], ['Bransgore', 50.7900, -1.7370],
  ['Fawley', 50.8230, -1.3490], ['New Milton', 50.7560, -1.6580],
  ['Totton', 50.9170, -1.4880], ['Cadnam', 50.9170, -1.5840],
  ['Bramshaw', 50.9350, -1.6360], ['Minstead', 50.8950, -1.5870],
  ['Sopley', 50.8000, -1.7670], ['Hordle', 50.7570, -1.6280],
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function overpass() {
  for (const ep of ENDPOINTS) {
    for (let a = 1; a <= 2; a++) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(QUERY),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'autravel-osm-importer/1.0 (team@growthfactory.com.au)',
            'Accept': 'application/json',
          },
        })
        if (r.ok) { console.log('[overpass] ok via', ep); return await r.json() }
        console.warn(`[overpass] ${ep} HTTP ${r.status} (attempt ${a})`)
        await sleep(5000 * a)
      } catch (e) {
        console.warn(`[overpass] ${ep} ${e.message} (attempt ${a})`)
        await sleep(4000 * a)
      }
    }
  }
  throw new Error('all Overpass endpoints failed')
}

function haversine(a, b) {
  const R = 6371000, toRad = d => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
function segLength(pts) { let m = 0; for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]); return m }

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'trail'
}

function nearestTown(lat, lng) {
  let best = null, bestD = Infinity
  for (const [name, tlat, tlng] of TOWNS) {
    const d = haversine([lat, lng], [tlat, tlng])
    if (d < bestD) { bestD = d; best = name }
  }
  return best
}

function distanceLabel(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
  return `${Math.round(m / 10) * 10} m`
}
function durationLabel(m, isCycle) {
  const speed = isCycle ? 15000 : 4500 // m/h
  const hrs = m / speed
  if (hrs < 1) return `${Math.max(5, Math.round(hrs * 60 / 5) * 5)} min`
  const h = Math.floor(hrs), mm = Math.round((hrs - h) * 60 / 15) * 15
  return mm ? `${h}h ${mm}m` : `${h}h`
}
function difficulty(m) {
  if (m < 2500) return 'Easy'
  if (m < 7000) return 'Moderate'
  return 'Challenging'
}

function classify(highway, route) {
  if (route) {
    if (route === 'bicycle' || route === 'mtb') return 'Cycle route'
    return 'Walking route'
  }
  return ({
    path: 'Footpath', footway: 'Footpath', bridleway: 'Bridleway',
    cycleway: 'Cycle path', byway: 'Byway', track: 'Track',
  })[highway] || 'Path'
}

function bboxOf(segs) {
  let s = 90, w = 180, n = -90, e = -180
  for (const seg of segs) for (const [la, lo] of seg) {
    if (la < s) s = la; if (la > n) n = la; if (lo < w) w = lo; if (lo > e) e = lo
  }
  return [s, w, n, e]
}

function run() {
  return (async () => {
    const data = await overpass()
    const els = data.elements || []
    const ways = els.filter(e => e.type === 'way' && e.geometry?.length)
    const rels = els.filter(e => e.type === 'relation')
    console.log(`[overpass] ${ways.length} named ways, ${rels.length} route relations`)

    /** @type {Array<any>} */
    const trails = []

    // ── Route relations → one trail each ──────────────────────────────
    for (const rel of rels) {
      const segs = (rel.members || [])
        .filter(m => m.type === 'way' && m.geometry?.length)
        .map(m => m.geometry.map(g => [g.lat, g.lon]))
      if (!segs.length) continue
      const name = rel.tags?.name || (rel.tags?.ref ? `Route ${rel.tags.ref}` : null)
      if (!name) continue
      const isCycle = /bicycle|mtb/.test(rel.tags?.route || '')
      const length = segs.reduce((a, s) => a + segLength(s), 0)
      trails.push(buildTrail({
        name, highway: null, route: rel.tags?.route, tags: rel.tags,
        osm_type: 'relation', osm_id: rel.id, segs, length, isCycle,
      }))
    }

    // ── Named ways → MERGE by name into one trail ─────────────────────
    const byName = new Map()
    for (const w of ways) {
      const name = w.tags.name
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name).push(w)
    }
    for (const [name, group] of byName) {
      const segs = group.map(w => w.geometry.map(g => [g.lat, g.lon]))
      const length = segs.reduce((a, s) => a + segLength(s), 0)
      // pick the most common highway type in the group for classification
      const hwCounts = {}
      for (const w of group) { const h = w.tags.highway; hwCounts[h] = (hwCounts[h] || 0) + 1 }
      const highway = Object.entries(hwCounts).sort((a, b) => b[1] - a[1])[0][0]
      const merged = group[0].tags
      const isCycle = highway === 'cycleway'
      trails.push(buildTrail({
        name, highway, route: null, tags: merged,
        osm_type: 'way', osm_id: group[0].id, segs, length, isCycle,
        memberCount: group.length,
      }))
    }

    console.log(`[build] ${trails.length} trails (${rels.length} routes + ${byName.size} named ways merged from ${ways.length} segments)`)

    if (DRY) {
      const sorted = [...trails].sort((a, b) => b.length_m - a.length_m)
      for (const t of sorted.slice(0, 40)) console.log(`  ${t.trail_type.padEnd(14)} ${distanceLabel(t.length_m).padStart(8)}  ${t.area?.padEnd(14)||''}  ${t.name}`)
      console.log(`(dry-run) would upsert ${Math.min(trails.length, LIMIT)} trails`)
      return
    }

    const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4 })
    let ok = 0
    const slugSeen = new Set()
    // Same downsampling as /park-maps/page.tsx + scripts/backfill-trail-previews.mjs.
    // Compute up-front so new trails are immediately listable in the explorer
    // without needing a separate backfill pass.
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
    for (const t of trails.slice(0, LIMIT)) {
      // unique slug per state
      let base = slugify(t.name), slug = base, i = 2
      while (slugSeen.has(slug)) slug = `${base}-${i++}`
      slugSeen.add(slug)
      const preview = buildPreview(t.geometry, t.bbox)
      try {
        await sql`
          INSERT INTO autravel.trails (
            state_code, slug, name, trail_type, osm_type, osm_id,
            length_m, distance_label, duration_label, difficulty, surface, area,
            waymarked, dog_friendly, accessible, bicycle_allowed, horse_allowed,
            center_lat, center_lng, start_lat, start_lng, bbox, geometry, preview_points,
            tags, source, source_raw, active
          ) VALUES (
            'uk', ${slug}, ${t.name}, ${t.trail_type}, ${t.osm_type}, ${t.osm_id},
            ${t.length_m}, ${t.distance_label}, ${t.duration_label}, ${t.difficulty}, ${t.surface}, ${t.area},
            ${t.waymarked}, ${t.dog_friendly}, ${t.accessible}, ${t.bicycle_allowed}, ${t.horse_allowed},
            ${t.center_lat}, ${t.center_lng}, ${t.start_lat}, ${t.start_lng}, ${sql.json(t.bbox)}, ${sql.json(t.geometry)}, ${sql.json(preview)},
            ${sql.json(t.tags)}, 'osm', ${sql.json(t.source_raw)}, true
          )
          ON CONFLICT (source, osm_type, osm_id) DO UPDATE SET
            name = EXCLUDED.name, trail_type = EXCLUDED.trail_type,
            length_m = EXCLUDED.length_m, distance_label = EXCLUDED.distance_label,
            duration_label = EXCLUDED.duration_label, difficulty = EXCLUDED.difficulty,
            surface = EXCLUDED.surface, area = EXCLUDED.area,
            waymarked = EXCLUDED.waymarked, dog_friendly = EXCLUDED.dog_friendly,
            accessible = EXCLUDED.accessible, bicycle_allowed = EXCLUDED.bicycle_allowed,
            horse_allowed = EXCLUDED.horse_allowed,
            center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
            start_lat = EXCLUDED.start_lat, start_lng = EXCLUDED.start_lng,
            bbox = EXCLUDED.bbox, geometry = EXCLUDED.geometry, preview_points = EXCLUDED.preview_points,
            tags = EXCLUDED.tags, updated_at = now()`
        ok++
        if (ok % 50 === 0) console.log(`  upserted ${ok}…`)
      } catch (e) {
        console.warn(`  FAIL ${t.name}: ${e.message}`)
      }
    }
    console.log(`\nDone: ${ok} trails upserted.`)
    await sql.end()
  })()
}

function buildTrail({ name, highway, route, tags, osm_type, osm_id, segs, length, isCycle, memberCount }) {
  const bbox = bboxOf(segs)
  const center_lat = (bbox[0] + bbox[2]) / 2, center_lng = (bbox[1] + bbox[3]) / 2
  const start = segs[0][0]
  const surface = tags?.surface || null
  const waymarked = !!(tags?.network || tags?.osmc_symbol || tags?.['ref'] || route)
  // New Forest is open-access; bridleways/byways/most paths allow dogs.
  const dog_friendly = tags?.dog === 'no' ? false : true
  const accessible = ['paved', 'asphalt', 'concrete', 'paving_stones'].includes(surface) || tags?.wheelchair === 'yes' || null
  const bicycle_allowed = highway === 'cycleway' || isCycle || tags?.bicycle === 'yes' || tags?.bicycle === 'designated' || null
  const horse_allowed = highway === 'bridleway' || tags?.horse === 'yes' || tags?.horse === 'designated' || null
  return {
    name, trail_type: classify(highway, route), osm_type, osm_id,
    length_m: Math.round(length),
    distance_label: distanceLabel(length),
    duration_label: durationLabel(length, isCycle),
    difficulty: difficulty(length),
    surface, area: nearestTown(center_lat, center_lng),
    waymarked, dog_friendly, accessible, bicycle_allowed, horse_allowed,
    center_lat, center_lng, start_lat: start[0], start_lng: start[1],
    bbox, geometry: segs,
    tags: { highway, route: route || null, surface, network: tags?.network || null, operator: tags?.operator || null, segments: memberCount || segs.length },
    source_raw: { osm_type, osm_id, raw_tags: tags },
  }
}

run().catch(e => { console.error(e); process.exit(1) })
