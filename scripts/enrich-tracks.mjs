#!/usr/bin/env node
/**
 * enrich-tracks.mjs — generate rich guide copy for the off-road tracks
 * (autravel.tracks) via Claude. Grounded in the curated structured facts; never
 * invents permit/fuel/distance specifics. Concurrency pool. Resumable.
 *
 *   node --env-file=.env.local scripts/enrich-tracks.mjs [--state auex] [--concurrency 8] [--force]
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const args = process.argv.slice(2)
const arg = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const STATE = arg('state', 'auex')
const FORCE = args.includes('--force')
const CONC = Math.max(1, Number(arg('concurrency', '8')))

const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 10 })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You write authoritative, plain Australian-English guides to iconic Australian off-road / outback 4WD tracks, for experienced adventure travellers.

Ground every guide in the FACTS provided (name, region, grade, length, days, best season, permits, fuel, water, remoteness, corrugations) plus general, well-known knowledge of that track and region. Australian spelling and 4WD terms (corrugations, jump-ups, sand flag, low range, recovery tracks, dual battery, UHF, EPIRB, tyre pressures).

HARD RULES:
- NEVER invent specific permit names, costs, fuel distances, phone numbers, opening dates or facilities beyond what's given — speak generally ("permits are required — check current details before you go") and tell readers to confirm conditions/closures with the managing authority.
- Be safety-forward and honest about difficulty: remote desert tracks demand convoy travel, full self-sufficiency, sand flags, recovery gear, extra fuel/water and an EPIRB. Note wet-season/seasonal closures where relevant.
- No clichés ("nestled", "bucket-list", "hidden gem"). Write for someone actually planning the trip.

Return STRICT JSON only: { "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string }
- summary: 110-170 words, 2 short paragraphs — what/where the track is, its character and why it's iconic.
- highlights: 4-6 bullets, 4-10 words each (key features, side trips, hazards).
- whatToExpect: 70-120 words — terrain, surface, crossings, the driving, remoteness.
- goodToKnow: 60-100 words — permits/closures (general), best season, fuel/water/recovery prep, convoy/comms/EPIRB, leave-no-trace.`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function enrich(t) {
  const facts = [
    `NAME: ${t.name}`, `REGION: ${t.region}`, `GRADE: ${t.grade}`,
    t.length_km ? `LENGTH: ${t.length_km} km` : '', t.days ? `TYPICAL DURATION: ${t.days}` : '',
    t.best_season ? `BEST SEASON: ${t.best_season}` : '', t.permits ? `PERMITS: ${t.permits}` : '',
    t.fuel_range ? `FUEL: ${t.fuel_range}` : '', t.water ? `WATER: ${t.water}` : '',
    t.remoteness ? `REMOTENESS: ${t.remoteness}` : '', t.corrugations ? `SURFACE/HAZARDS: ${t.corrugations}` : '',
    t.blurb ? `CONTEXT: ${t.blurb}` : '', '\nWrite the JSON now.',
  ].filter(Boolean).join('\n')
  for (let a = 0; a < 4; a++) {
    try {
      const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, system: SYSTEM, messages: [{ role: 'user', content: facts }] })
      const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let p = null; try { p = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]) } catch {} } }
      if (p?.summary) return {
        description_ai: String(p.summary).trim(),
        highlights_ai: (p.highlights || []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 6),
        what_to_expect_ai: String(p.whatToExpect || '').trim(),
        good_to_know_ai: String(p.goodToKnow || '').trim(),
      }
      throw new Error('bad JSON')
    } catch (e) { if (a === 3) throw e; await sleep([1500, 4000, 10000][a]) }
  }
}

const rows = await sql`SELECT slug, name, region, grade, length_km, days, best_season, permits, fuel_range, water, remoteness, corrugations, blurb
  FROM autravel.tracks WHERE state_code=${STATE} ${FORCE ? sql`` : sql`AND description_ai IS NULL`} ORDER BY name`
console.log(`enriching ${rows.length} tracks (concurrency=${CONC})…`)
let ok = 0, fail = 0, next = 0
async function worker() {
  while (next < rows.length) {
    const t = rows[next++]
    try {
      const ai = await enrich(t)
      await sql`UPDATE autravel.tracks SET description_ai=${ai.description_ai}, highlights_ai=${sql.json(ai.highlights_ai)}, what_to_expect_ai=${ai.what_to_expect_ai}, good_to_know_ai=${ai.good_to_know_ai}, updated_at=now() WHERE state_code=${STATE} AND slug=${t.slug}`
      ok++; if (ok % 10 === 0) console.log(`  ${ok}/${rows.length}`)
    } catch (e) { fail++; console.warn(`  ✗ ${t.name}: ${e.message}`) }
  }
}
await Promise.all(Array.from({ length: CONC }, () => worker()))
console.log(`\nDone: ${ok} enriched, ${fail} failed.`)
await sql.end()
