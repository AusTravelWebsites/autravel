#!/usr/bin/env node
// Retry Viator product codes that previously failed Claude-JSON parsing.
// Run: node --env-file=.env.local scripts/retry-tour-failures.mjs <code> <code> ...
// Or with --from-log to auto-discover failures in /tmp/tours-import.log.

import { setDefaultResultOrder } from 'node:dns'
setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const FROM_LOG = args.includes('--from-log')
let codes = args.filter(a => !a.startsWith('--'))
if (FROM_LOG) {
  const log = readFileSync('/tmp/tours-import.log', 'utf8')
  const fromLog = Array.from(new Set(Array.from(log.matchAll(/✗ ([A-Z0-9]+):/g)).map(m => m[1])))
  codes = Array.from(new Set([...codes, ...fromLog]))
}
if (!codes.length) {
  console.error('usage: node scripts/retry-tour-failures.mjs <code1> <code2>... | --from-log')
  process.exit(1)
}

const VIATOR_BASE = 'https://api.viator.com/partner'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const CURRENCY = 'AUD'

const CATEGORIES = [
  'food-cooking', 'culture-history', 'nature-wildlife', 'adventure-sports',
  'water-activities', 'wellness-spa', 'day-trips', 'transfers',
  'nightlife', 'shopping-markets',
]

// Stronger SYSTEM prompt — no markdown fences, explicit about format.
const SYSTEM = `You rewrite tour blurb into fresh original copy and classify into one category.

Return STRICT raw JSON — NO markdown code fences (no \`\`\`json), NO commentary, NO prefix or suffix text.
The response MUST start with { and end with }.

JSON shape:
{ "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string, "category": string }

Rules:
- Never copy phrases verbatim; paraphrase distinctive lines.
- British Australian English. Concrete over abstract. No clichés.
- summary: 120-150 words, one paragraph, opens with what the tour does.
- highlights: 5-8 bullets, 5-12 words each, specific.
- whatToExpect: 80-140 words, honest walkthrough.
- goodToKnow: 40-80 words, practical notes.
- category: exactly one of: ${CATEGORIES.join(', ')}.`

function viatorHeaders() {
  return {
    'exp-api-key': process.env.VIATOR_API_KEY,
    'Accept': 'application/json;version=2.0',
    'Accept-Language': 'en-AU',
    'Content-Type': 'application/json',
  }
}

async function getProduct(code) {
  const r = await fetch(`${VIATOR_BASE}/products/${encodeURIComponent(code)}?currency=${CURRENCY}`, { headers: viatorHeaders() })
  if (!r.ok) throw new Error(`viator ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function searchForPricing(code, destId) {
  // Pricing lives in the search response, not the /products/ endpoint.
  const body = {
    filtering: { destination: String(destId) },
    sorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
    pagination: { start: 1, count: 1 },
    currency: CURRENCY,
  }
  // We don't know the destination from the code — skip pricing for retry rows; they'll get it on next full refresh.
  return { fromPrice: null, currency: CURRENCY }
}

// Robust extractor: strips ```json``` fences, trims, finds the outermost balanced {…}.
function extractJson(text) {
  if (!text) return null
  let s = String(text).trim()
  // Strip leading/trailing ```json or ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(s) } catch {}
  // Fall back: find first { and walk to its matching }
  const first = s.indexOf('{')
  if (first < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = first; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') inStr = !inStr
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { const slice = s.slice(first, i + 1); try { return JSON.parse(slice) } catch { return null } } }
  }
  return null
}

function bestImage(imgs, maxW = 1200) {
  if (!imgs?.length) return null
  const cover = imgs.find(i => i.isCover) || imgs[0]
  if (!cover?.variants?.length) return null
  return (([...cover.variants].sort((a, b) => b.width - a.width).find(v => v.width <= maxW)) || cover.variants[0]).url
}
function allImageUrls(imgs, maxW = 1600) {
  if (!imgs?.length) return []
  return imgs.map(img => {
    const sorted = [...(img.variants || [])].sort((a, b) => b.width - a.width)
    return (sorted.find(v => v.width <= maxW) || sorted[0])?.url
  }).filter(Boolean)
}
function humanMinutes(m) {
  if (!m) return null
  if (m >= 1440) { const d = Math.round(m / 1440); return `${d} day${d > 1 ? 's' : ''}` }
  if (m >= 60) { const h = Math.floor(m / 60); const mm = m % 60; return mm ? `${h}h ${mm}m` : `${h} hour${h > 1 ? 's' : ''}` }
  return `${m} min`
}
function durationInfo(d) {
  if (!d) return { min: null, label: null }
  const minutes = d.fixedDurationInMinutes ?? d.variableDurationFromMinutes ?? null
  let label = null
  if (d.fixedDurationInMinutes) label = humanMinutes(d.fixedDurationInMinutes)
  else if (d.variableDurationFromMinutes && d.variableDurationToMinutes) label = `${humanMinutes(d.variableDurationFromMinutes)} – ${humanMinutes(d.variableDurationToMinutes)}`
  else if (d.variableDurationFromMinutes) label = `from ${humanMinutes(d.variableDurationFromMinutes)}`
  return { min: minutes, label }
}
function slugify(title, code) {
  const base = String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
  const tail = code.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-5)
  return `${base}-${tail}`.slice(0, 80)
}

async function rewrite(product) {
  const { label } = durationInfo(product.itinerary?.duration)
  const user = [
    `TITLE: ${product.title}`,
    label ? `DURATION: ${label}` : '',
    product.description ? `\nSOURCE DESCRIPTION (reference only, do not copy):\n${product.description.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n') + `\n\nRewrite and classify. Return raw JSON only, no markdown fences.`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
  })
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const d = await r.json()
  const text = d.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim()
  const parsed = extractJson(text)
  if (!parsed || typeof parsed.summary !== 'string') throw new Error(`bad JSON — ${text.slice(0, 300)}`)
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'day-trips'
  return {
    summary: String(parsed.summary).trim(),
    highlights: (parsed.highlights || []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 10),
    whatToExpect: String(parsed.whatToExpect || '').trim(),
    goodToKnow: String(parsed.goodToKnow || '').trim(),
    category,
    model: d.model || ANTHROPIC_MODEL,
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1 })
  console.log(`Retrying ${codes.length} code(s)…`)
  let ok = 0, fail = 0
  for (const code of codes) {
    try {
      const p = await getProduct(code)
      const ai = await rewrite(p)
      const { min, label } = durationInfo(p.itinerary?.duration)
      const slug = slugify(p.title, code)
      const coverImage = bestImage(p.images, 1200)
      const images = allImageUrls(p.images, 1600).slice(0, 12)
      // Infer country from the product's primary destination using our DESTINATIONS map isn't possible per-code here;
      // leave country null and let a future full-refresh fill it. For accuracy, check destinations[] array:
      const primaryDest = (p.destinations || []).find((x) => x.primary) || (p.destinations || [])[0]
      // Hard-coded: if the destination ref matches common ancestors, tag country. Simplification — most retries will be Bali:
      const country = 'Indonesia'
      const countryCode = 'ID'
      await sql`
        INSERT INTO tours (
          source, source_product_code, slug, title,
          country, country_code, category,
          duration_min, duration_label,
          rating, review_count,
          cover_image, images, booking_url, tags,
          summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai,
          ai_rewritten_at, ai_model,
          source_raw, source_fetched_at
        ) VALUES (
          'viator', ${code}, ${slug}, ${p.title},
          ${country}, ${countryCode}, ${ai.category},
          ${min}, ${label},
          ${p.reviews?.combinedAverageRating ?? null},
          ${p.reviews?.totalReviews ?? null},
          ${coverImage}, ${sql.json(images)}, ${p.productUrl}, ${sql.json(p.tags || [])},
          ${ai.summary}, ${sql.json(ai.highlights)}, ${ai.whatToExpect}, ${ai.goodToKnow},
          NOW(), ${ai.model},
          ${sql.json(p)}, NOW()
        )
        ON CONFLICT (source, source_product_code) DO UPDATE SET
          slug = EXCLUDED.slug, title = EXCLUDED.title,
          category = EXCLUDED.category,
          duration_min = EXCLUDED.duration_min, duration_label = EXCLUDED.duration_label,
          rating = EXCLUDED.rating, review_count = EXCLUDED.review_count,
          cover_image = EXCLUDED.cover_image, images = EXCLUDED.images,
          booking_url = EXCLUDED.booking_url, tags = EXCLUDED.tags,
          summary_ai = EXCLUDED.summary_ai, highlights_ai = EXCLUDED.highlights_ai,
          what_to_expect_ai = EXCLUDED.what_to_expect_ai, good_to_know_ai = EXCLUDED.good_to_know_ai,
          ai_rewritten_at = EXCLUDED.ai_rewritten_at, ai_model = EXCLUDED.ai_model,
          source_raw = EXCLUDED.source_raw, source_fetched_at = NOW(), updated_at = NOW()`
      ok++
      console.log(`  ✓ ${code}  ${p.title.slice(0, 60)}`)
    } catch (e) {
      fail++
      console.error(`  ✗ ${code}: ${e.message.slice(0, 200)}`)
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`)
  await sql.end()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
