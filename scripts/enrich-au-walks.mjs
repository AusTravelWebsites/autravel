#!/usr/bin/env node
/**
 * enrich-au-walks.mjs — generate rich guide copy for the curated iconic AU walks
 * (autravel.trails, state_code='auex') via Claude. Australia-wide prompt (not the
 * WA-specific enrich-wa-trails). Grounded in each walk's facts + curated blurb.
 * Concurrency pool, resumable.
 *
 *   node --env-file=.env.local scripts/enrich-au-walks.mjs [--concurrency 8] [--force]
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const args = process.argv.slice(2)
const arg = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const STATE = 'auex'
const FORCE = args.includes('--force')
const CONC = Math.max(1, Number(arg('concurrency', '8')))

const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 10 })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You write authoritative, plain Australian-English guides to iconic Australian bushwalks and multi-day hikes, for keen walkers planning a trip.

Ground each guide in the FACTS provided (name, region/state, difficulty, distance, duration, context note) plus general, well-known knowledge of that walk and its landscape (alpine Tasmania, the Red Centre ranges, the Great Dividing Range, the WA coast, the Flinders, etc.). Australian spelling and terms (bushwalk, track, car park, trailhead, saddle, lookout, hut, buttongrass).

HARD RULES:
- Do NOT invent specific hut names, fees, booking systems, exact campsite spacings, transport operators or facilities beyond what's given — speak generally and tell readers to check current details, bookings and closures with the managing park authority.
- Be honest about difficulty, remoteness, weather and fitness. Note where a walk is booked/permit/fee-based, one-way (needs transport), seasonal, or culturally sensitive (respect Traditional-Owner requests).
- No clichés ("nestled", "bucket-list", "hidden gem"). Write for someone actually planning the walk.

Return STRICT JSON only: { "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string }
- summary: 110-170 words, 2 short paragraphs.
- highlights: 4-6 bullets, 4-10 words each.
- whatToExpect: 70-120 words — terrain, gradient, surface, weather, the experience.
- goodToKnow: 60-100 words — best season, bookings/permits/fees (general), one-way transport, fitness, water, leave-no-trace.`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function enrich(t) {
  const blurb = t.source_raw?.blurb || ''
  const facts = [
    `NAME: ${t.name}`, `REGION: ${t.area}`, `DIFFICULTY: ${t.difficulty}`,
    t.distance_label ? `DISTANCE: ${t.distance_label}` : '', t.duration_label ? `DURATION: ${t.duration_label}` : '',
    blurb ? `CONTEXT: ${blurb}` : '', '\nWrite the JSON now.',
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

const rows = await sql`SELECT slug, name, area, difficulty, distance_label, duration_label, source_raw
  FROM autravel.trails WHERE state_code=${STATE} ${FORCE ? sql`` : sql`AND description_ai IS NULL`} ORDER BY length_m DESC NULLS LAST`
console.log(`enriching ${rows.length} walks (concurrency=${CONC})…`)
let ok = 0, fail = 0, next = 0
async function worker() {
  while (next < rows.length) {
    const t = rows[next++]
    try {
      const ai = await enrich(t)
      await sql`UPDATE autravel.trails SET description_ai=${ai.description_ai}, highlights_ai=${sql.json(ai.highlights_ai)}, what_to_expect_ai=${ai.what_to_expect_ai}, good_to_know_ai=${ai.good_to_know_ai}, updated_at=now() WHERE state_code=${STATE} AND slug=${t.slug}`
      ok++; if (ok % 10 === 0) console.log(`  ${ok}/${rows.length}`)
    } catch (e) { fail++; console.warn(`  ✗ ${t.name}: ${e.message}`) }
  }
}
await Promise.all(Array.from({ length: CONC }, () => worker()))
console.log(`\nDone: ${ok} enriched, ${fail} failed.`)
await sql.end()
