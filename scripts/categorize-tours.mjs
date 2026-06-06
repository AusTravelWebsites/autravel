#!/usr/bin/env node
// Assign a category to every tour where category IS NULL.
// Uses Claude Haiku to pick from a fixed taxonomy (so we can build clean filter chips).
//
// Run: node --env-file=.env.local scripts/categorize-tours.mjs [--force]

import { setDefaultResultOrder } from 'node:dns'
setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const FORCE = process.argv.includes('--force')
const MODEL = 'claude-haiku-4-5-20251001'

// Fixed taxonomy — tours get exactly one of these. Slugs are lowercase-hyphen-kebab.
export const CATEGORIES = [
  { slug: 'food-cooking',      label: 'Food & Cooking',     emoji: '🍜' },
  { slug: 'culture-history',   label: 'Culture & History',  emoji: '🛕' },
  { slug: 'nature-wildlife',   label: 'Nature & Wildlife',  emoji: '🌿' },
  { slug: 'adventure-sports',  label: 'Adventure & Sports', emoji: '🏔' },
  { slug: 'water-activities',  label: 'Water Activities',   emoji: '🐠' },
  { slug: 'wellness-spa',      label: 'Wellness & Spa',     emoji: '🧖' },
  { slug: 'day-trips',         label: 'Day Trips & Sightseeing', emoji: '🚌' },
  { slug: 'transfers',         label: 'Transfers',          emoji: '✈' },
  { slug: 'nightlife',         label: 'Nightlife',          emoji: '🍹' },
  { slug: 'shopping-markets',  label: 'Shopping & Markets', emoji: '🛍' },
]

const SYSTEM = `You classify a tour into exactly one BugBitten category. Reply with ONLY the category slug — no quotes, no prose, no markdown. No explanation. Pick the single best match. If two seem equal, pick the more specific one.

Allowed slugs: ${CATEGORIES.map(c => c.slug).join(', ')}

Rules of thumb:
- A cooking class → food-cooking (not culture)
- Temple / historical site visits → culture-history
- Hiking, volcano, rice-terrace walks, waterfall tours → nature-wildlife
- Rafting, ATV, ziplining, quad biking, bungee → adventure-sports
- Snorkel, dive, boat tours, surfing, fishing → water-activities
- Massage, yoga retreats → wellness-spa
- "Highlights", multi-stop sightseeing → day-trips
- Airport pickup / private driver → transfers`

async function classify(tour) {
  const prompt = `TITLE: ${tour.title}
DURATION: ${tour.duration_label || 'unknown'}
SUMMARY: ${tour.summary_ai || ''}
TAG HINTS: ${JSON.stringify(tour.tags || []).slice(0, 200)}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 30,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const d = await r.json()
  const text = d.content.filter(c => c.type === 'text').map(c => c.text || '').join('').trim().toLowerCase()
  // Tolerate quoting / trailing punctuation from the model.
  const clean = text.replace(/[^a-z-]/g, '').trim()
  const match = CATEGORIES.find(c => c.slug === clean)
  if (!match) throw new Error(`unknown category: "${text}"`)
  return match.slug
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1 })
  const rows = FORCE
    ? await sql`SELECT source_product_code, title, duration_label, summary_ai, tags FROM tours WHERE active = true`
    : await sql`SELECT source_product_code, title, duration_label, summary_ai, tags FROM tours WHERE active = true AND category IS NULL`
  console.log(`Classifying ${rows.length} tour(s)…`)
  let ok = 0, fail = 0
  for (const t of rows) {
    try {
      const cat = await classify(t)
      await sql`UPDATE tours SET category = ${cat}, updated_at = NOW() WHERE source_product_code = ${t.source_product_code}`
      ok++
      console.log(`  ✓ ${t.source_product_code.padEnd(12)} ${cat.padEnd(20)} ${t.title.slice(0, 60)}`)
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      fail++
      console.error(`  ✗ ${t.source_product_code}: ${e.message}`)
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`)
  await sql.end()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
