#!/usr/bin/env node
// import-alerts.mjs — fetch live alerts from public AU emergency feeds and
// match them to parks/destinations within radius. Run on a 15-minute cron.
//
// Sources:
//   • NSW RFS major incidents (fires, public JSON)        — nsw
//   • EmergencyVic incidents                              — vic (CFA + others)
//   • QFES current incidents                              — qld
//   • DFES (WA), CFS (SA), TFS (TAS), Bushfires NT        — TODO when available
//
// Stores into autravel.alerts (one row per active incident, marked stale when
// it disappears from upstream). Each park within radius_km gets a row in
// park_alerts via an in-memory haversine match.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS autravel.alerts (
    id text PRIMARY KEY,
    source text NOT NULL,
    state_code text NOT NULL,
    title text NOT NULL,
    severity text,
    type text,
    body text,
    link text,
    lat numeric(9,6),
    lng numeric(9,6),
    issued_at timestamptz,
    seen_at timestamptz NOT NULL DEFAULT now()
  )
`)
await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_alerts_state ON autravel.alerts (state_code, seen_at DESC)`)

function haversineKm(a, b, c, d) {
  const r = 6371
  const dLat = (c - a) * Math.PI / 180
  const dLng = (d - b) * Math.PI / 180
  const lat1 = a * Math.PI / 180
  const lat2 = c * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return r * 2 * Math.asin(Math.sqrt(x))
}

function parseRfsDesc(d) {
  const out = {}
  for (const part of String(d || '').split(/<br\s*\/?>/i)) {
    const [k, ...v] = part.split(':')
    if (k && v.length) out[k.trim().toUpperCase()] = v.join(':').trim()
  }
  return out
}

async function fetchNswRfs() {
  try {
    const r = await fetch('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json', { headers: { 'User-Agent': 'autravel-alerts/1.0' } })
    if (!r.ok) throw new Error(`rfs ${r.status}`)
    const j = await r.json()
    return (j.features || []).map(f => {
      const desc = parseRfsDesc(f.properties.description)
      return {
        id: 'nsw-rfs:' + (f.properties.guid || f.properties.title),
        source: 'NSW RFS',
        state_code: 'nsw',
        title: f.properties.title,
        severity: f.properties.category || desc['ALERT LEVEL'] || null,
        type: desc['TYPE'] || 'Fire',
        body: f.properties.description,
        link: f.properties.link,
        lat: f.geometry?.coordinates?.[1] ?? null,
        lng: f.geometry?.coordinates?.[0] ?? null,
        issued_at: null, // pubDate is dd/mm/yyyy AEST — skip for now, seen_at is good enough
      }
    }).filter(a => a.lat != null && a.lng != null)
  } catch (e) { console.error('  nsw rfs fail:', e.message); return [] }
}

async function fetchEmergencyVic() {
  // Public OpenAPI feed of current incidents — geometry varies (Point or Polygon)
  try {
    const r = await fetch('https://emergency.vic.gov.au/public/osom-geojson.json', { headers: { 'User-Agent': 'autravel-alerts/1.0' } })
    if (!r.ok) throw new Error(`emv ${r.status}`)
    const j = await r.json()
    return (j.features || []).map(f => {
      const p = f.properties || {}
      const g = f.geometry
      let lat = null, lng = null
      if (g?.type === 'Point') { lng = g.coordinates[0]; lat = g.coordinates[1] }
      else if (g?.coordinates) {
        // take first coord of first ring as a fallback centroid
        const flat = g.coordinates.flat(Infinity)
        if (flat.length >= 2) { lng = flat[0]; lat = flat[1] }
      }
      return {
        id: 'vic:' + (p.id || p.feedType + p.sourceTitle),
        source: 'EmergencyVic',
        state_code: 'vic',
        title: p.location || p.sourceTitle || 'Incident',
        severity: p.statusId || p.status || null,
        type: p.feedType || null,
        body: p.text || p.webBody || null,
        link: p.url || 'https://emergency.vic.gov.au/',
        lat, lng,
        issued_at: p.created ? new Date(p.created).toISOString() : null,
      }
    }).filter(a => a.lat != null && a.lng != null)
  } catch (e) { console.error('  emv fail:', e.message); return [] }
}

const all = [...await fetchNswRfs(), ...await fetchEmergencyVic()]
console.log(`fetched ${all.length} live alerts`)

// Upsert
let upserted = 0
for (const a of all) {
  await sql`
    INSERT INTO alerts (id, source, state_code, title, severity, type, body, link, lat, lng, issued_at, seen_at)
    VALUES (${a.id}, ${a.source}, ${a.state_code}, ${a.title.slice(0, 500)}, ${a.severity}, ${a.type}, ${a.body?.slice(0, 4000) || null}, ${a.link}, ${a.lat}, ${a.lng}, ${a.issued_at}, now())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      severity = EXCLUDED.severity,
      type = EXCLUDED.type,
      body = EXCLUDED.body,
      link = EXCLUDED.link,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      seen_at = now()
  `
  upserted++
}

// Mark stale: anything in alerts not seen this run + state we just hit gets deleted
const seenByState = {}
for (const a of all) (seenByState[a.state_code] ||= new Set()).add(a.id)
for (const [state, ids] of Object.entries(seenByState)) {
  const idArr = Array.from(ids)
  await sql`DELETE FROM alerts WHERE state_code = ${state} AND NOT (id = ANY(${idArr}))`
}

const total = await sql`SELECT count(*)::int FROM alerts`
console.log(`upserted ${upserted}, total active in DB: ${total[0].count}`)
await sql.end()
