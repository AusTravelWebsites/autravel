#!/usr/bin/env node
/**
 * enrich-wa-trails.mjs — generate Australian-English descriptive copy for the
 * Perth Tourism trails dataset (autravel.trails, state_code='perth') via Claude.
 *
 *   node --env-file=.env.local scripts/enrich-wa-trails.mjs [--limit N] [--force] [--routes-only]
 *
 * Resumable: only fills rows where description_ai IS NULL unless --force.
 * --routes-only restricts to named ROUTE relations + cycle/walking routes so a
 * first pass can enrich the marquee trails cheaply before fanning out to the
 * long tail. Difficulty/distance/duration are computed at import time; this adds
 * description_ai, highlights_ai, what_to_expect_ai, good_to_know_ai.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ROUTES_ONLY = args.includes('--routes-only')
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity
const MODEL = 'claude-haiku-4-5-20251001'
const STATE = 'perth'

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }

const SYSTEM = `You write concise, accurate Australian-English copy about walking, cycling and riding trails in Western Australia.

You are given a trail's FACTS (name, type, distance, difficulty, nearest town, surface, access). Write helpful copy grounded in those facts plus general, well-known knowledge of Western Australian outdoor terrain and character — jarrah, marri and karri forest in the South-West, granite outcrops and wildflowers in spring, coastal heath and limestone along the Indian Ocean, the red earth and gorges of the Pilbara and Kimberley, and shared-use bike paths (PSPs) along Perth's rivers and rail corridors.

HARD RULES:
- Australian English spelling (colour, centre, metres, kilometre, bushwalk, signposted).
- Use Australian terms: bushwalk/walk (not "ramble"), shared path or PSP, car park, trailhead, lookout.
- Do NOT invent specific named landmarks, car parks, distances or facilities you were not given — keep specifics to what's provided and otherwise describe the trail's general character honestly.
- No clichés ("nestled", "hidden gem", "immerse yourself"). Write plainly for someone planning a walk or ride.
- Reflect the trail TYPE: a cycle route/PSP is for bikes; a walk trail is on foot; a long route may be multi-day.
- Be season-aware where relevant: WA summers are hot and trails carry bushfire risk; spring (Aug–Oct) is wildflower season; carry water.

Return STRICT JSON only:
{ "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string }
- summary: 80-130 words, one or two short paragraphs.
- highlights: 4-6 bullets, 4-10 words each, specific to the type/terrain.
- whatToExpect: 60-110 words — terrain underfoot, gradient feel, signposting, shade/exposure.
- goodToKnow: 40-70 words — practical notes (carry water, sun/heat, bushfire risk in summer, dogs often not allowed in national parks, suitable footwear/bike, best season).`

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
    t.waymarked ? 'SIGNPOSTED: yes' : '',
    t.dog_friendly === true ? 'DOGS: allowed' : (t.dog_friendly === false ? 'DOGS: not allowed' : ''),
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
   WHERE state_code = ${STATE}
     ${FORCE ? sql`` : sql`AND description_ai IS NULL`}
     ${ROUTES_ONLY ? sql`AND trail_type LIKE ${'%route%'}` : sql``}
   ORDER BY (trail_type LIKE '%route%') DESC, length_m DESC NULLS LAST`
const todo = rows.slice(0, LIMIT)
console.log(`enriching ${todo.length} trails (state_code='${STATE}')…`)
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
     WHERE state_code=${STATE} AND slug = ${t.slug}`
    ok++
    if (ok % 25 === 0) console.log(`  ${ok}/${todo.length} done`)
    await sleep(120)
  } catch (e) { fail++; console.warn(`  ✗ ${t.name}: ${e.message}`) }
}
console.log(`\nDone: ${ok} enriched, ${fail} failed.`)
await sql.end()
