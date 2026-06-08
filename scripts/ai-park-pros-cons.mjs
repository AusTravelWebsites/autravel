#!/usr/bin/env node
/**
 * Generate "What guests love / Could be better" pro/con bullet pairs for each
 * caravan/holiday/tourist park, sourced from the Google reviews we already
 * cached in `parks.source_raw.reviews`. Uses Claude as the summariser.
 *
 * Writes parks.ai_pros (jsonb array of strings), parks.ai_cons (jsonb array),
 * and parks.ai_review_summary (one-paragraph overview).
 *
 * Usage:
 *   node --env-file=.env.local scripts/ai-park-pros-cons.mjs [--state qld] [--limit 12] [--only-new]
 *   --only-new : skip parks that already have ai_pros set
 *
 * Cost: ~$0.005 per park (haiku 4.5).
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const STATE = arg('state') || null
const LIMIT = Number(arg('limit', '200'))
const ONLY_NEW = args.includes('--only-new')

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You summarise traveller reviews of Australian caravan/holiday parks into a tight pro/con list.

Rules:
- Output STRICT JSON: { "pros": string[], "cons": string[], "summary": string }
- pros: 3-5 short bullets (3-9 words each) of what guests consistently love.
- cons: 2-4 short bullets of issues guests consistently raise. If no real cons, return ["No common complaints reported"]
- summary: one neutral, plain-English paragraph (~50 words) — what kind of park it is, who it suits.
- Use British/Australian English (spelling and tone).
- No marketing fluff. No exclamation marks. No hashtags. No "guests rave about" — just the thing itself.
- Examples of good pros: "Spotless amenities block", "Friendly on-site managers", "Walking distance to the beach"
- Examples of good cons: "Sites are tight for big rigs", "Pool closed in cooler months"
- If reviews are sparse or low-quality, still produce a reasonable list. Never invent specifics that aren't supported.
- Return ONLY the JSON object. No prose, no code fence.`

async function summarise(name, suburb, reviews, rating) {
  if (!reviews || reviews.length === 0) {
    return { pros: [], cons: [], summary: '' }
  }
  const reviewText = reviews
    .filter(r => r.text && r.text.length > 20)
    .slice(0, 15)
    .map(r => `(${r.rating || '?'}/5) ${r.text}`)
    .join('\n---\n')
  if (!reviewText) return { pros: [], cons: [], summary: '' }

  const userPrompt = `Park: ${name}${suburb ? ` (${suburb})` : ''}
Average rating: ${rating || 'unknown'}/5

Recent Google reviews:
${reviewText.slice(0, 12000)}`

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = resp.content[0]?.text || ''
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) throw new Error(`no JSON in model response: ${text.slice(0,200)}`)
  let obj
  try { obj = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) }
  catch (e) { throw new Error(`bad JSON: ${e.message} :: ${text.slice(jsonStart, jsonStart+300)}`) }
  return {
    pros: Array.isArray(obj.pros) ? obj.pros.filter(s => typeof s === 'string').slice(0, 5) : [],
    cons: Array.isArray(obj.cons) ? obj.cons.filter(s => typeof s === 'string').slice(0, 4) : [],
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 500) : '',
  }
}

async function run() {
  const where = []
  if (STATE) where.push(sql`state_code = ${STATE}`)
  if (ONLY_NEW) where.push(sql`ai_pros IS NULL`)
  where.push(sql`park_type IN ('caravan','holiday','tourist')`)
  where.push(sql`source_raw IS NOT NULL`)
  const whereSql = where.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`, sql``)

  const parks = await sql`
    SELECT id, slug, name, suburb, avg_rating, source_raw
    FROM parks
    WHERE ${whereSql}
    ORDER BY review_count DESC NULLS LAST
    LIMIT ${LIMIT}`
  console.log(`Generating pros/cons for ${parks.length} parks`)

  let ok = 0, fail = 0
  for (const p of parks) {
    try {
      let src = p.source_raw
      if (typeof src === 'string') { try { src = JSON.parse(src) } catch { src = null } }
      const reviews = src?.reviews || []
      if (reviews.length === 0) { console.log(`  - ${p.slug} (no reviews on Google)`); continue }
      const result = await summarise(p.name, p.suburb, reviews, p.avg_rating)
      if (!result.pros.length && !result.summary) {
        console.log(`  - ${p.slug} (model returned empty — ${reviews.length} reviews available)`)
        continue
      }
      await sql`
        UPDATE parks
        SET ai_pros = ${sql.json(result.pros)},
            ai_cons = ${sql.json(result.cons)},
            ai_review_summary = ${result.summary},
            ai_reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${p.id}`
      ok++
      console.log(`  ✓ ${p.slug}  (${result.pros.length} pros, ${result.cons.length} cons)`)
    } catch (e) {
      fail++
      console.log(`  ✗ ${p.slug}: ${e.message}`)
    }
  }
  console.log(`\nDone: ok=${ok} fail=${fail}`)
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
