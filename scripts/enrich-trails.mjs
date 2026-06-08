#!/usr/bin/env node
/**
 * enrich-trails.mjs — generate British-English descriptive copy for New Forest
 * trails (autravel.trails, state_code='uk') via Claude Haiku.
 *
 *   node --env-file=.env.local scripts/enrich-trails.mjs [--limit N] [--force]
 *
 * Resumable: only fills rows where description_ai IS NULL unless --force.
 * Difficulty/distance/duration are already computed at import time — this adds
 * description_ai, highlights_ai, what_to_expect_ai, good_to_know_ai.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity
const MODEL = 'claude-haiku-4-5-20251001'

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }

const SYSTEM = `You write concise, accurate British-English copy about walking, cycling and riding routes in the New Forest National Park (Hampshire, England).

You are given a route's FACTS (name, type, distance, difficulty, nearest town, surface, access). Write helpful copy grounded in those facts plus general, well-known knowledge of New Forest terrain and character — open heathland, ancient and ornamental woodland (inclosures), lawns grazed by free-roaming ponies, cattle and donkeys, gravel forest tracks and boggy patches after rain.

HARD RULES:
- British English spelling (colour, centre, metres, bridleway, waymarked).
- Do NOT invent specific named landmarks, pubs, car parks, distances or facilities you were not given — keep specifics to what's provided and otherwise describe the route's general character honestly.
- No clichés ("nestled", "hidden gem", "immerse yourself"). Write plainly for a walker planning an outing.
- Reflect the route TYPE: a cycle route is for bikes; a bridleway is shared with horses; a short footpath is a stroll, not an expedition.

Return STRICT JSON only:
{ "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string }
- summary: 80-130 words, one or two short paragraphs.
- highlights: 4-6 bullets, 4-10 words each, specific to the type/terrain.
- whatToExpect: 60-110 words — terrain underfoot, gradient feel, waymarking, livestock.
- goodToKnow: 40-70 words — practical notes (dogs near livestock/ground-nesting birds Mar-Jul, mud after rain, free open access, no charge, suitable footwear/bike).`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function enrich(t) {
  const facts = [
    `NAME: ${t.name}`,
    `TYPE: ${t.trail_type}`,
    t.distance_label ? `DISTANCE: ${t.distance_label}` : '',
    t.duration_label ? `APPROX TIME: ${t.duration_label}` : '',
    t.difficulty ? `DIFFICULTY: ${t.difficulty}` : '',
    t.area ? `NEAREST TOWN: ${t.area}` : '',
    t.surface ? `SURFACE: ${t.surface}` : '',
    t.waymarked ? 'WAYMARKED: yes' : '',
    t.dog_friendly ? 'DOGS: allowed (open access)' : '',
    t.bicycle_allowed ? 'CYCLING: allowed' : '',
    t.horse_allowed ? 'HORSES: allowed' : '',
    '\nWrite the JSON now.',
  ].filter(Boolean).join('\n')

  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: facts }] }),
    })
    if (r.ok) {
      const d = await r.json()
      const text = d.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let p = null
      try { p = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]) } catch {} } }
      if (p && typeof p.summary === 'string') return {
        description_ai: String(p.summary).trim(),
        highlights_ai: (p.highlights || []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 6),
        what_to_expect_ai: String(p.whatToExpect || '').trim(),
        good_to_know_ai: String(p.goodToKnow || '').trim(),
      }
      throw new Error('bad JSON: ' + text.slice(0, 120))
    }
    if (r.status === 429 || r.status >= 500) { await sleep([2000, 5000, 15000, 30000][a]); continue }
    throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`)
  }
  throw new Error('retries exhausted')
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 3 })
const rows = await sql`
  SELECT slug, name, trail_type, distance_label, duration_label, difficulty, area, surface,
         waymarked, dog_friendly, bicycle_allowed, horse_allowed
    FROM autravel.trails
   WHERE state_code = 'uk' ${FORCE ? sql`` : sql`AND description_ai IS NULL`}
   ORDER BY (trail_type LIKE '%route%') DESC, length_m DESC NULLS LAST`
const todo = rows.slice(0, LIMIT)
console.log(`enriching ${todo.length} trails…`)
let ok = 0, fail = 0
for (const t of todo) {
  try {
    const ai = await enrich(t)
    await sql`UPDATE autravel.trails SET
      description_ai = ${ai.description_ai},
      highlights_ai = ${sql.json(ai.highlights_ai)},
      what_to_expect_ai = ${ai.what_to_expect_ai},
      good_to_know_ai = ${ai.good_to_know_ai},
      updated_at = now()
     WHERE state_code='uk' AND slug = ${t.slug}`
    ok++
    if (ok % 25 === 0) console.log(`  ${ok}/${todo.length} done`)
    await sleep(120)
  } catch (e) { fail++; console.warn(`  ✗ ${t.name}: ${e.message}`) }
}
console.log(`\nDone: ${ok} enriched, ${fail} failed.`)
await sql.end()
