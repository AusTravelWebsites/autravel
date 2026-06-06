#!/usr/bin/env node
// Generic, resumable Viator importer.
//   node --env-file=.env.local scripts/import-tours.mjs bali
//   node --env-file=.env.local scripts/import-tours.mjs bali australia
//   node --env-file=.env.local scripts/import-tours.mjs bali --limit 1000
//   node --env-file=.env.local scripts/import-tours.mjs australia --force  (re-ingest even if already in DB)
//
// Resumability: skips any product_code already in `tours` unless --force.
// Rate-limit: exponential backoff on 429/5xx; single-threaded at 200ms/tour baseline.

import { setDefaultResultOrder } from 'node:dns'
setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

// autravel destination IDs — per AU state. Each maps to a Viator destination
// that covers the whole state; city-level imports can be added later. State
// tag is also written on every tour so the multi-tenant queries filter
// correctly without any post-processing.
const DESTINATIONS = {
  qld:  { id: 122, name: 'Queensland',         country: 'Australia', iso2: 'AU', state_code: 'qld'  },
  nsw:  { id: 120, name: 'New South Wales',    country: 'Australia', iso2: 'AU', state_code: 'nsw'  },
  vic:  { id: 125, name: 'Victoria',           country: 'Australia', iso2: 'AU', state_code: 'vic'  },
  wa:   { id: 126, name: 'Western Australia',  country: 'Australia', iso2: 'AU', state_code: 'wa'   },
  sa:   { id: 123, name: 'South Australia',    country: 'Australia', iso2: 'AU', state_code: 'sa'   },
  tas:  { id: 124, name: 'Tasmania',           country: 'Australia', iso2: 'AU', state_code: 'tas'  },
  nt:   { id: 121, name: 'Northern Territory', country: 'Australia', iso2: 'AU', state_code: 'nt'   },
  // aunz aggregator imports from the country-level Australia destination.
  aunz: { id: 22,  name: 'Australia',          country: 'Australia', iso2: 'AU', state_code: null   },
}

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIMIT_IDX = args.indexOf('--limit')
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity
const SKIP_AI = args.includes('--skip-ai') || !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith('sk-placeholder')
const dests = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a) && DESTINATIONS[a.toLowerCase()])
if (!dests.length) {
  console.error(`usage: node scripts/import-tours.mjs <dest>... [--limit N] [--force]\n  dests: ${Object.keys(DESTINATIONS).join(', ')}`)
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

const SYSTEM = `You rewrite tour-operator blurb into fresh original BugBitten copy and classify into one category.

HARD RULES:
- Never copy phrases verbatim from the source. Paraphrase distinctive lines.
- British Australian English. No American spellings.
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

function viatorHeaders() {
  return {
    'exp-api-key': process.env.VIATOR_API_KEY,
    'Accept': 'application/json;version=2.0',
    'Accept-Language': 'en-AU',
    'Content-Type': 'application/json',
  }
}

// fetch with backoff on 429 / 5xx. Max 4 retries.
async function fetchSafe(url, init, label) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, init)
    if (r.ok) return r
    if (r.status === 429 || r.status >= 500) {
      const delay = [2000, 5000, 15000, 30000][i]
      console.warn(`  ↻ ${label} HTTP ${r.status}, retrying in ${delay}ms…`)
      await sleep(delay)
      continue
    }
    const text = await r.text().catch(() => '')
    throw new Error(`${label} ${r.status}: ${text.slice(0, 300)}`)
  }
  throw new Error(`${label}: max retries exceeded`)
}

async function searchProducts(destId, start, count) {
  const body = {
    filtering: { destination: String(destId) },
    sorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
    pagination: { start, count: Math.min(count, 50) },
    currency: CURRENCY,
  }
  const r = await fetchSafe(VIATOR_BASE + '/products/search', { method: 'POST', headers: viatorHeaders(), body: JSON.stringify(body) }, 'search')
  return r.json()
}

async function getProduct(code) {
  const r = await fetchSafe(`${VIATOR_BASE}/products/${encodeURIComponent(code)}?currency=${CURRENCY}`, { headers: viatorHeaders() }, `product ${code}`)
  return r.json()
}

function bestImage(imgs, maxW = 1200) {
  if (!imgs?.length) return null
  const cover = imgs.find(i => i.isCover) || imgs[0]
  if (!cover?.variants?.length) return null
  const sorted = [...cover.variants].sort((a, b) => b.width - a.width)
  return (sorted.find(v => v.width <= maxW) || sorted[sorted.length - 1]).url
}

function allImageUrls(imgs, maxW = 1600) {
  if (!imgs?.length) return []
  return imgs.map(img => {
    const sorted = [...(img.variants || [])].sort((a, b) => b.width - a.width)
    const match = sorted.find(v => v.width <= maxW) || sorted[0]
    return match?.url
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

async function rewriteAndCategorize(product, destName) {
  const { label } = durationInfo(product.itinerary?.duration)
  const user = [
    `TITLE: ${product.title}`,
    `LOCATION: ${destName}`,
    label ? `DURATION: ${label}` : '',
    product.description ? `\nSOURCE DESCRIPTION (reference only, do not copy):\n${product.description.slice(0, 3000)}` : '',
    (product.inclusions || []).length ? `\nINCLUSIONS:\n- ${product.inclusions.map(i => i.otherDescription || i.description || i.typeDescription).filter(Boolean).join('\n- ')}` : '',
    (product.exclusions || []).length ? `\nEXCLUSIONS:\n- ${product.exclusions.map(i => i.otherDescription || i.description || i.typeDescription).filter(Boolean).join('\n- ')}` : '',
    (product.additionalInfo || []).length ? `\nADDITIONAL INFO:\n- ${product.additionalInfo.map(i => i.description).filter(Boolean).join('\n- ')}` : '',
    `\nRewrite as fresh original copy and classify. Return JSON only.`,
  ].filter(Boolean).join('\n')
  const r = await fetchSafe('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
  }, 'anthropic')
  const d = await r.json()
  const text = d.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim()
  let parsed = null
  try { parsed = JSON.parse(text) } catch {
    const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
  }
  if (!parsed || typeof parsed.summary !== 'string') throw new Error(`bad Claude JSON: ${text.slice(0, 200)}`)
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

async function importDestination(sql, destKey) {
  const dest = DESTINATIONS[destKey]
  console.log(`\n━━━ ${dest.name} (destId=${dest.id}) ━━━`)

  // Collect every product code for this destination.
  // Viator caps search pagination at end position 10050 — stop before we exceed that.
  const PAGINATION_CAP = 10000
  const codes = []
  let start = 1
  let total = Infinity
  const batch = 50
  while (codes.length < LIMIT && start <= total && start + batch - 1 <= PAGINATION_CAP) {
    const s = await searchProducts(dest.id, start, batch)
    if (start === 1) { total = s.totalCount; console.log(`[search] destination has ${total} total products (Viator paginates up to ${PAGINATION_CAP})`) }
    if (!s.products?.length) break
    for (const p of s.products) { codes.push(p); if (codes.length >= LIMIT) break }
    start += batch
    await sleep(200)
  }
  console.log(`[search] collected ${codes.length} codes`)

  // Skip codes already imported unless --force.
  let existing = new Set()
  if (!FORCE) {
    const codeList = codes.map(c => c.productCode)
    const rows = await sql`SELECT source_product_code FROM tours WHERE source = 'viator' AND source_product_code IN ${sql(codeList)}`
    existing = new Set(rows.map(r => r.source_product_code))
  }
  const todo = codes.filter(c => !existing.has(c.productCode))
  console.log(`[skip] ${existing.size} already in DB, ${todo.length} to import`)

  const [{ id: runId }] = await sql`INSERT INTO tour_sync_log (source, action, ok, details)
    VALUES ('viator', 'import', true, ${sql.json({ destKey, destId: dest.id, total, todo: todo.length })}) RETURNING id`

  const started = Date.now()
  let ok = 0, fail = 0
  for (const summary of todo) {
    const code = summary.productCode
    const n = ok + fail + 1
    const pctDone = n / todo.length
    const elapsed = (Date.now() - started) / 1000
    const eta = pctDone > 0 ? Math.round(elapsed / pctDone - elapsed) : 0
    try {
      const p = await getProduct(code)
      const { min, label } = durationInfo(p.itinerary?.duration || summary.duration)
      // AI rewrite is optional — when --skip-ai is set (or ANTHROPIC_API_KEY
      // is missing/placeholder), import tours with null AI fields. Can be
      // backfilled later via a re-run without --skip-ai. Tour detail pages
      // are null-safe for every AI column.
      const ai = SKIP_AI
        ? { summary: null, highlights: null, whatToExpect: null, goodToKnow: null, category: null, model: null }
        : await rewriteAndCategorize(p, dest.name)
      const slug = slugify(p.title, code)
      const coverImage = bestImage(p.images, 1200)
      const images = allImageUrls(p.images, 1600).slice(0, 12)
      const bookingUrl = p.productUrl
      if (!bookingUrl) throw new Error('missing productUrl')
      await sql`
        INSERT INTO tours (
          source, source_product_code, slug, state_code, title,
          country, country_code, city, category,
          duration_min, duration_label,
          price_from, currency,
          rating, review_count,
          cover_image, images, booking_url, tags,
          summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai,
          ai_rewritten_at, ai_model,
          source_raw, source_fetched_at
        ) VALUES (
          'viator', ${code}, ${slug}, ${dest.state_code}, ${p.title},
          ${dest.country}, ${dest.iso2}, ${null}, ${ai.category},
          ${min}, ${label},
          ${summary.pricing?.summary?.fromPrice ?? null}, ${summary.pricing?.currency || CURRENCY},
          ${p.reviews?.combinedAverageRating ?? summary.reviews?.combinedAverageRating ?? null},
          ${p.reviews?.totalReviews ?? summary.reviews?.totalReviews ?? null},
          ${coverImage}, ${sql.json(images)}, ${bookingUrl}, ${sql.json(p.tags || [])},
          ${ai.summary}, ${ai.highlights ? sql.json(ai.highlights) : null}, ${ai.whatToExpect}, ${ai.goodToKnow},
          ${ai.model ? new Date() : null}, ${ai.model},
          ${sql.json(p)}, NOW()
        )
        ON CONFLICT (source, source_product_code) DO UPDATE SET
          slug = EXCLUDED.slug, title = EXCLUDED.title,
          state_code = EXCLUDED.state_code,
          country = EXCLUDED.country, country_code = EXCLUDED.country_code,
          category = EXCLUDED.category,
          duration_min = EXCLUDED.duration_min, duration_label = EXCLUDED.duration_label,
          price_from = EXCLUDED.price_from, currency = EXCLUDED.currency,
          rating = EXCLUDED.rating, review_count = EXCLUDED.review_count,
          cover_image = EXCLUDED.cover_image, images = EXCLUDED.images,
          booking_url = EXCLUDED.booking_url, tags = EXCLUDED.tags,
          summary_ai = EXCLUDED.summary_ai, highlights_ai = EXCLUDED.highlights_ai,
          what_to_expect_ai = EXCLUDED.what_to_expect_ai, good_to_know_ai = EXCLUDED.good_to_know_ai,
          ai_rewritten_at = EXCLUDED.ai_rewritten_at, ai_model = EXCLUDED.ai_model,
          source_raw = EXCLUDED.source_raw, source_fetched_at = NOW(),
          updated_at = NOW()`
      ok++
      if (ok % 10 === 0 || ok === todo.length) {
        console.log(`[${n}/${todo.length}] ok=${ok} fail=${fail} elapsed=${Math.round(elapsed)}s eta=${Math.round(eta / 60)}m — ${code}`)
      }
      await sleep(200)
    } catch (e) {
      fail++
      console.error(`  ✗ ${code}: ${e.message}`)
      // On repeat failures let the queue drain rather than stalling the whole run.
    }
  }
  await sql`UPDATE tour_sync_log SET count_ok = ${ok}, count_fail = ${fail}, finished_at = NOW() WHERE id = ${runId}`
  console.log(`\n=== ${dest.name} done === ok=${ok} fail=${fail} elapsed=${Math.round((Date.now() - started) / 1000)}s`)
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
    ssl: 'require', prepare: false, max: 1,
    connection: { search_path: 'autravel, public' },
  })
  try {
    for (const d of dests) await importDestination(sql, d.toLowerCase())
  } finally {
    await sql.end()
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
