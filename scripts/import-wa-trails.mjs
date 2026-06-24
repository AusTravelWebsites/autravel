#!/usr/bin/env node
/**
 * import-wa-trails.mjs — build the Perth Tourism "Walks, Bike Paths & Trails"
 * dataset (state_code='perth') from OpenStreetMap via Overpass.
 *
 *   node --env-file=.env.local scripts/import-wa-trails.mjs [--dry-run] [--limit N] [--region NAME]
 *
 * Forked from import-newforest-trails.mjs. The difference: Western Australia is
 * far too large for a single Overpass pass, so we sweep a set of REGIONAL
 * bounding boxes covering WA's trail hotspots (Perth metro + Hills, Rottnest,
 * Margaret River, the karri South-West, Albany/Denmark, Esperance, the Mid-West,
 * Ningaloo, the Pilbara, the Kimberley), accumulate + dedupe by OSM id globally,
 * then merge named ways by name and upsert. Idempotent on (source, osm_type, osm_id).
 *
 * What it imports:
 *   - Waymarked ROUTE relations (route=hiking/foot/walking/bicycle/mtb) — the
 *     curated long-distance + circular trails (Bibbulmun Track, Cape to Cape,
 *     Munda Biddi, Kep Track, etc.).
 *   - NAMED ways (highway=path/footway/bridleway/cycleway/byway/track), MERGED
 *     by name across all regions into one entry with combined geometry + length.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity
const REGION_IDX = args.indexOf('--region')
const ONLY_REGION = REGION_IDX >= 0 ? args[REGION_IDX + 1] : null

const STATE = 'perth'

// WA trail hotspots as [name, "S,W,N,E"]. Kept reasonably tight so each Overpass
// pass stays well under the timeout. Add regions here to widen coverage.
const REGIONS = [
  ['Perth metro',        '-32.20,115.65,-31.60,116.10'],
  ['Perth Hills',        '-32.20,116.00,-31.55,116.40'],
  ['Rottnest & islands', '-32.06,115.43,-31.96,115.58'],
  ['Mandurah & Peel',    '-32.75,115.62,-32.42,115.95'],
  ['Swan Valley',        '-31.90,115.95,-31.70,116.15'],
  ['Margaret River SW',  '-34.05,114.95,-33.45,115.35'],
  ['Busselton-Dunsboro', '-33.70,115.00,-33.55,115.45'],
  ['Karri South-West',   '-34.65,115.85,-34.20,116.45'], // Pemberton, Walpole, Northcliffe
  ['Albany & Denmark',   '-35.10,117.20,-34.85,118.05'],
  ['Stirling Range',     '-34.50,117.95,-34.30,118.30'],
  ['Esperance',          '-33.95,121.70,-33.70,122.30'],
  ['Bunbury-Collie',     '-33.45,115.55,-33.20,116.20'],
  ['Geraldton-Kalbarri', '-28.85,114.05,-27.55,114.40'],
  ['Ningaloo-Exmouth',   '-22.40,113.75,-21.80,114.20'],
  ['Karijini-Pilbara',   '-22.55,118.10,-22.20,118.70'],
  ['Broome-Kimberley',   '-18.10,122.10,-17.90,122.45'],
  ['Kalgoorlie',         '-30.85,121.40,-30.65,121.60'],
]

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const queryFor = bbox => `[out:json][timeout:240];
(
  way["highway"~"^(path|footway|bridleway|cycleway|byway|track)$"]["name"](${bbox});
  relation["route"~"^(hiking|foot|walking|bicycle|mtb)$"](${bbox});
);
out geom;`

// WA towns/localities for nearest-area labelling. Spread to match REGIONS so
// every trail gets a sensible nearest place.
const TOWNS = [
  ['Perth', -31.9523, 115.8613], ['Fremantle', -32.0569, 115.7439],
  ['Joondalup', -31.7448, 115.7661], ['Rockingham', -32.2769, 115.7297],
  ['Mandurah', -32.5269, 115.7217], ['Armadale', -32.1490, 116.0140],
  ['Kalamunda', -31.9750, 116.0570], ['Mundaring', -31.9000, 116.1670],
  ['Midland', -31.8880, 116.0090], ['Swan Valley', -31.7900, 116.0200],
  ['Rottnest Island', -32.0067, 115.5167], ['Yanchep', -31.5480, 115.6340],
  ['Bunbury', -33.3271, 115.6414], ['Busselton', -33.6555, 115.3470],
  ['Dunsborough', -33.6150, 115.1050], ['Margaret River', -33.9550, 115.0750],
  ['Augusta', -34.3140, 115.1590], ['Collie', -33.3620, 116.1550],
  ['Pemberton', -34.4470, 116.0360], ['Walpole', -34.9770, 116.7330],
  ['Northcliffe', -34.6320, 116.1230], ['Denmark', -34.9610, 117.3530],
  ['Albany', -35.0228, 117.8814], ['Mount Barker', -34.6300, 117.6660],
  ['Esperance', -33.8610, 121.8910], ['Geraldton', -28.7744, 114.6089],
  ['Kalbarri', -27.7100, 114.1650], ['Exmouth', -21.9320, 114.1280],
  ['Karijini', -22.3760, 118.2560], ['Tom Price', -22.6940, 117.7920],
  ['Broome', -17.9614, 122.2359], ['Kalgoorlie', -30.7490, 121.4660],
  ['York', -31.8880, 116.7680], ['Toodyay', -31.5500, 116.4670],
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function overpass(query, label) {
  for (const ep of ENDPOINTS) {
    for (let a = 1; a <= 2; a++) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'autravel-osm-importer/1.0 (team@growthfactory.com.au)',
            'Accept': 'application/json',
          },
        })
        if (r.ok) { console.log(`[overpass] ${label} ok via ${ep}`); return await r.json() }
        console.warn(`[overpass] ${label} ${ep} HTTP ${r.status} (attempt ${a})`)
        await sleep(5000 * a)
      } catch (e) {
        console.warn(`[overpass] ${label} ${ep} ${e.message} (attempt ${a})`)
        await sleep(4000 * a)
      }
    }
  }
  throw new Error(`all Overpass endpoints failed for ${label}`)
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
    // ── Sweep every region, dedupe elements by OSM id globally ──────────
    const wayById = new Map()   // id -> element
    const relById = new Map()
    const regions = ONLY_REGION ? REGIONS.filter(r => r[0].toLowerCase().includes(ONLY_REGION.toLowerCase())) : REGIONS
    for (const [name, bbox] of regions) {
      let data
      try { data = await overpass(queryFor(bbox), name) }
      catch (e) { console.warn(`[skip] ${name}: ${e.message}`); continue }
      const els = data.elements || []
      let w = 0, rl = 0
      for (const e of els) {
        if (e.type === 'way' && e.geometry?.length && e.tags?.name) { if (!wayById.has(e.id)) { wayById.set(e.id, e); w++ } }
        else if (e.type === 'relation') { if (!relById.has(e.id)) { relById.set(e.id, e); rl++ } }
      }
      console.log(`[region] ${name}: +${w} ways, +${rl} routes (running ${wayById.size}/${relById.size})`)
      await sleep(1500) // be polite to Overpass between regions
    }

    const ways = [...wayById.values()]
    const rels = [...relById.values()]
    console.log(`[overpass] ${ways.length} named ways, ${rels.length} route relations total`)

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
      for (const t of sorted.slice(0, 50)) console.log(`  ${t.trail_type.padEnd(14)} ${distanceLabel(t.length_m).padStart(8)}  ${(t.area || '').padEnd(16)}  ${t.name}`)
      console.log(`(dry-run) would upsert ${Math.min(trails.length, LIMIT)} trails`)
      return
    }

    const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4 })
    let ok = 0
    const slugSeen = new Set()
    // Same downsampling as /park-maps/page.tsx + scripts/backfill-trail-previews.mjs.
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
            ${STATE}, ${slug}, ${t.name}, ${t.trail_type}, ${t.osm_type}, ${t.osm_id},
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
    console.log(`\nDone: ${ok} trails upserted (state_code='${STATE}').`)
    await sql.end()
  })()
}

function buildTrail({ name, highway, route, tags, osm_type, osm_id, segs, length, isCycle, memberCount }) {
  const bbox = bboxOf(segs)
  const center_lat = (bbox[0] + bbox[2]) / 2, center_lng = (bbox[1] + bbox[3]) / 2
  const start = segs[0][0]
  const surface = tags?.surface || null
  const waymarked = !!(tags?.network || tags?.osmc_symbol || tags?.['ref'] || route)
  // WA: many trails run through national parks where dogs are prohibited, so
  // only assert dog access when OSM explicitly tags it (don't assume open-access
  // like the New Forest). Unknown → null.
  const dog_friendly = tags?.dog === 'yes' ? true : (tags?.dog === 'no' ? false : null)
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
