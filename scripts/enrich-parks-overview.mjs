#!/usr/bin/env node
/**
 * enrich-parks-overview.mjs — generate a factual "About this park" overview
 * (parks.description_ai) for each caravan/holiday/tourist park, the same way
 * tours get summary_ai. Australian English, grounded in the park's facts +
 * general knowledge of its location, plus any cached guest reviews. Resumable.
 *
 *   node --env-file=.env.local scripts/enrich-parks-overview.mjs --state perth [--limit N] [--force]
 *
 * Cost: ~$0.004 per park (haiku 4.5).
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const args = process.argv.slice(2)
const arg = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const STATE = arg('state') || null
const LIMIT = Number(arg('limit', '300'))
const FORCE = args.includes('--force')

const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 2 })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_LABEL = { caravan: 'caravan park', holiday: 'holiday park', tourist: 'tourist park', national_park: 'national-park campground' }

const SYSTEM = `You write concise, factual Australian-English "about this park" overviews for caravan/holiday parks.

Ground every overview in the FACTS provided plus general, well-known knowledge of the town/region's setting (coast, river, outback, forest, wine country, near a national park, etc.). Australian spelling and terms (powered sites, camp kitchen, ensuite, big rigs, dump point).

HARD RULES:
- Do NOT invent specific facilities, prices, site counts, distances or policies you weren't given. Speak in general terms ("typically offers", "many parks in the area…") and tell the reader to confirm details with the park.
- No clichés ("nestled", "hidden gem", "home away from home"). Plain, useful prose for someone planning where to stay.
- 110–170 words, 2 short paragraphs. First paragraph: what/where the park is and its setting; second: who it suits and a line to check current availability/rates with the park directly.

Return STRICT JSON only: { "overview": string }`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function overview(p) {
  const reviews = (p.source_raw?.reviews || []).slice(0, 4).map(r => `"${(r.text || '').slice(0, 200)}"`).join('\n')
  const facts = [
    `NAME: ${p.name}`,
    `TYPE: ${TYPE_LABEL[p.park_type] || 'caravan park'}`,
    p.suburb ? `TOWN/SUBURB: ${p.suburb}` : '',
    p.region ? `AREA: ${p.region}` : '',
    `STATE: Western Australia`,
    p.avg_rating ? `GUEST RATING: ${p.avg_rating}/5 from ${p.review_count || 0} reviews` : '',
    reviews ? `A FEW GUEST REVIEW SNIPPETS (for tone/context only — do not quote verbatim):\n${reviews}` : '',
    '\nWrite the JSON now.',
  ].filter(Boolean).join('\n')

  for (let a = 0; a < 4; a++) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: SYSTEM,
        messages: [{ role: 'user', content: facts }],
      })
      const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let parsed = null
      try { parsed = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]) } catch {} } }
      if (parsed?.overview) return String(parsed.overview).trim()
      throw new Error('bad JSON')
    } catch (e) {
      if (a === 3) throw e
      await sleep([1500, 4000, 10000][a])
    }
  }
}

const rows = await sql`
  SELECT slug, name, park_type, suburb, region, avg_rating, review_count, source_raw
  FROM parks
  WHERE active = true
    ${STATE ? sql`AND state_code = ${STATE}` : sql``}
    ${FORCE ? sql`` : sql`AND description_ai IS NULL`}
  ORDER BY avg_rating DESC NULLS LAST
  LIMIT ${LIMIT}`
console.log(`generating overviews for ${rows.length} parks…`)
let ok = 0, fail = 0
for (const p of rows) {
  try {
    const text = await overview(p)
    await sql`UPDATE parks SET description_ai = ${text}, updated_at = now() WHERE slug = ${p.slug} AND state_code = ${STATE}`
    ok++
    if (ok % 25 === 0) console.log(`  ${ok}/${rows.length}`)
    await sleep(120)
  } catch (e) { fail++; console.warn(`  ✗ ${p.name}: ${e.message}`) }
}
console.log(`\nDone: ${ok} overviews, ${fail} failed.`)
await sql.end()
