import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchNswRfs() {
  try {
    const r = await fetch('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json', { headers: { 'User-Agent': 'autravel-alerts/1.0' } })
    if (!r.ok) return []
    const j: any = await r.json()
    return (j.features || []).map((f: any) => {
      const desc = String(f.properties?.description || '')
      const get = (k: string) => {
        const m = desc.match(new RegExp(k + '\\s*:\\s*([^<]+)', 'i'))
        return m ? m[1].trim() : null
      }
      return {
        id: 'nsw-rfs:' + (f.properties?.guid || f.properties?.title),
        source: 'NSW RFS', state_code: 'nsw',
        title: f.properties?.title, severity: f.properties?.category || get('ALERT LEVEL'),
        type: get('TYPE') || 'Fire', body: f.properties?.description, link: f.properties?.link,
        lat: f.geometry?.coordinates?.[1] ?? null, lng: f.geometry?.coordinates?.[0] ?? null,
      }
    }).filter((a: any) => a.lat != null && a.lng != null)
  } catch { return [] }
}

async function fetchEmergencyVic() {
  try {
    const r = await fetch('https://emergency.vic.gov.au/public/osom-geojson.json', { headers: { 'User-Agent': 'autravel-alerts/1.0' } })
    if (!r.ok) return []
    const j: any = await r.json()
    return (j.features || []).map((f: any) => {
      const p = f.properties || {}
      const g = f.geometry
      let lat = null, lng = null
      if (g?.type === 'Point') { lng = g.coordinates[0]; lat = g.coordinates[1] }
      else if (g?.coordinates) {
        const flat = (g.coordinates as any[]).flat(Infinity) as number[]
        if (flat.length >= 2) { lng = flat[0]; lat = flat[1] }
      }
      return {
        id: 'vic:' + (p.id || p.feedType + p.sourceTitle),
        source: 'EmergencyVic', state_code: 'vic',
        title: p.location || p.sourceTitle || 'Incident',
        severity: p.statusId || p.status || null, type: p.feedType || null,
        body: p.text || p.webBody || null, link: p.url || 'https://emergency.vic.gov.au/',
        lat, lng, issued_at: p.created ? new Date(p.created).toISOString() : null,
      }
    }).filter((a: any) => a.lat != null && a.lng != null)
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const all = [...await fetchNswRfs(), ...await fetchEmergencyVic()]
  let upserted = 0
  for (const a of all) {
    try {
      await db`
        INSERT INTO alerts (id, source, state_code, title, severity, type, body, link, lat, lng, seen_at)
        VALUES (${a.id}, ${a.source}, ${a.state_code}, ${a.title.slice(0, 500)}, ${a.severity}, ${a.type}, ${a.body?.slice(0, 4000) || null}, ${a.link}, ${a.lat}, ${a.lng}, now())
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, severity=EXCLUDED.severity, type=EXCLUDED.type, body=EXCLUDED.body, link=EXCLUDED.link, lat=EXCLUDED.lat, lng=EXCLUDED.lng, seen_at=now()
      `
      upserted++
    } catch {}
  }
  // Sweep stale per state
  const seen: Record<string, string[]> = {}
  for (const a of all) (seen[a.state_code] ||= []).push(a.id)
  for (const [state, ids] of Object.entries(seen)) {
    await db`DELETE FROM alerts WHERE state_code = ${state} AND NOT (id = ANY(${ids}))`
  }
  return NextResponse.json({ ok: true, upserted, sources: ['NSW RFS', 'EmergencyVic'] })
}
