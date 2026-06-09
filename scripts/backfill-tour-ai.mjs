#!/usr/bin/env node
/**
 * backfill-tour-ai.mjs — fill AI copy for tours that were imported with
 * --skip-ai, WITHOUT re-fetching Viator. Reads the Viator product already
 * stored in public.tours.source_raw and regenerates summary/highlights/etc.
 *
 *   node --env-file=.env.local scripts/backfill-tour-ai.mjs [--state uk] [--limit N]
 *
 * Resumable: only processes rows where summary_ai IS NULL. Matches the
 * import-tours.mjs prompt + categories so backfilled copy is consistent with
 * rows enriched at import time.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const args = process.argv.slice(2)
const arg = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const STATE = (arg('state') || 'uk').toLowerCase()
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity
const MODEL = 'claude-haiku-4-5-20251001'
const LANG = STATE === 'uk' ? 'en-GB' : 'en-AU'
const SPELLING = LANG === 'en-GB'
  ? 'British English (UK spellings: colour, centre, organise, traveller).'
  : 'British Australian English. No American spellings.'

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }

const CATEGORIES = [
  'food-cooking', 'culture-history', 'nature-wildlife', 'adventure-sports',
  'water-activities', 'wellness-spa', 'day-trips', 'transfers',
  'nightlife', 'shopping-markets',
]

const SYSTEM = `You rewrite tour-operator blurb into fresh original BugBitten copy and classify into one category.

HARD RULES:
- Never copy phrases verbatim from the source. Paraphrase distinctive lines.
- ${SPELLING}
- Concrete over abstract. No clichés like "immerse yourself", "once-in-a-lifetime".
- Don't invent facts not in the source.
- Write for a fellow traveller, not a tourist.

Return STRICT JSON — no markdown, no commentary:
{ "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string, "category": string }

- summary: 120-150 words, one paragraph. Opens with what the tour does. Includes location and duration if known.
- highlights: 5-8 bullets, 5-12 words each. Specific, not generic.
- whatToExpect: 80-140 words, 1-2 paragraphs. Honest walkthrough.
- goodToKnow: 40-80 words. Practical notes only.
- category: exactly one of: ${CATEGORIES.join(', ')}. Cooking class → food-cooking. Temple visit → culture-history. Waterfall/rice-terrace hike → nature-wildlife. Rafting/ATV/zipline → adventure-sports. Dive/snorkel/boat → water-activities. Massage/yoga → wellness-spa. Multi-stop sightseeing → day-trips. Airport pickup / driver → transfers.`

const sleep = ms => new Promise(r => setTimeout(r, ms))
function humanMinutes(m) {
  if (!m) return null
  if (m >= 1440) { const d = Math.round(m / 1440); return `${d} day${d > 1 ? 's' : ''}` }
  if (m >= 60) { const h = Math.floor(m / 60); const mm = m % 60; return mm ? `${h}h ${mm}m` : `${h} hour${h > 1 ? 's' : ''}` }
  return `${m} min`
}
function durationLabel(d) {
  if (!d) return null
  if (d.fixedDurationInMinutes) return humanMinutes(d.fixedDurationInMinutes)
  if (d.variableDurationFromMinutes && d.variableDurationToMinutes) return `${humanMinutes(d.variableDurationFromMinutes)} – ${humanMinutes(d.variableDurationToMinutes)}`
  if (d.variableDurationFromMinutes) return `from ${humanMinutes(d.variableDurationFromMinutes)}`
  return null
}

async function rewrite(p) {
  const label = durationLabel(p.itinerary?.duration)
  const user = [
    `TITLE: ${p.title}`,
    `LOCATION: United Kingdom`,
    label ? `DURATION: ${label}` : '',
    p.description ? `\nSOURCE DESCRIPTION (reference only, do not copy):\n${String(p.description).slice(0, 3000)}` : '',
    (p.inclusions || []).length ? `\nINCLUSIONS:\n- ${p.inclusions.map(i => i.otherDescription || i.description || i.typeDescription).filter(Boolean).join('\n- ')}` : '',
    (p.exclusions || []).length ? `\nEXCLUSIONS:\n- ${p.exclusions.map(i => i.otherDescription || i.description || i.typeDescription).filter(Boolean).join('\n- ')}` : '',
    (p.additionalInfo || []).length ? `\nADDITIONAL INFO:\n- ${p.additionalInfo.map(i => i.description).filter(Boolean).join('\n- ')}` : '',
    `\nRewrite as fresh original copy and classify. Return JSON only.`,
  ].filter(Boolean).join('\n')

  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    })
    if (r.ok) {
      const d = await r.json()
      const text = d.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let p2 = null
      try { p2 = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p2 = JSON.parse(m[0]) } catch {} } }
      if (!p2 || typeof p2.summary !== 'string') throw new Error('bad JSON: ' + text.slice(0, 120))
      const category = CATEGORIES.includes(p2.category) ? p2.category : 'day-trips'
      return {
        summary: String(p2.summary).trim(),
        highlights: (p2.highlights || []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 10),
        whatToExpect: String(p2.whatToExpect || '').trim(),
        goodToKnow: String(p2.goodToKnow || '').trim(),
        category, model: d.model || MODEL,
      }
    }
    if (r.status === 429 || r.status >= 500) { await sleep([2000, 5000, 15000, 30000][a]); continue }
    throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`)
  }
  throw new Error('retries exhausted')
}

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, { prepare: false, max: 3, connection: { search_path: 'autravel, public' } })
const rows = await sql`
  SELECT id, title, source_raw
    FROM public.tours
   WHERE state_code = ${STATE} AND summary_ai IS NULL AND source_raw IS NOT NULL`
const todo = rows.slice(0, LIMIT)
console.log(`backfilling AI for ${todo.length} ${STATE} tours…`)
let ok = 0, fail = 0
for (const row of todo) {
  try {
    const p = row.source_raw
    if (!p || !p.title) { fail++; continue }
    const ai = await rewrite(p)
    await sql`UPDATE public.tours SET
      summary_ai = ${ai.summary},
      highlights_ai = ${sql.json(ai.highlights)},
      what_to_expect_ai = ${ai.whatToExpect},
      good_to_know_ai = ${ai.goodToKnow},
      category = COALESCE(category, ${ai.category}),
      ai_rewritten_at = now(), ai_model = ${ai.model},
      updated_at = now()
     WHERE id = ${row.id}`
    ok++
    if (ok % 50 === 0) console.log(`  ${ok}/${todo.length} done`)
    await sleep(120)
  } catch (e) { fail++; console.warn(`  ✗ ${row.title?.slice(0, 50)}: ${e.message}`) }
}
console.log(`\nDone: ${ok} backfilled, ${fail} failed.`)
await sql.end()
