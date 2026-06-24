#!/usr/bin/env node
/**
 * gen-perth-articles.mjs — generate cornerstone editorial for the Perth Tourism
 * tenant (autravel.articles, state_code='perth') via Claude. House "we went and
 * did it" voice, assigned to the seeded Perth authors. Several carry a
 * legacy_path so the old WordPress URL is preserved (migrated, not just 301'd).
 *
 *   node --env-file=.env.local scripts/gen-perth-articles.mjs [--force]
 *
 * Idempotent: skips a slug that already exists unless --force.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const FORCE = process.argv.includes('--force')
const MODEL = 'claude-haiku-4-5-20251001'
if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }

const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 2 })

// Cornerstone set. legacy_path preserves a real old WordPress URL where one maps.
const ARTICLES = [
  { slug: 'best-walks-in-perth', author: 'tess-marlowe', legacy_path: '/perth-bicycle-walking-trails/',
    title: 'The best walks in and around Perth',
    brief: 'A guide to the best walking trails in Perth and the Perth Hills — Kings Park, the Swan River foreshore, Bibbulmun Track start at Kalamunda, Railway Reserves Heritage Trail, John Forrest National Park. Mix of easy city strolls and harder hills bushwalks. Mention links to the /walks/ explorer.' },
  { slug: 'best-bike-paths-perth', author: 'dylan-cho', legacy_path: null,
    title: 'The best bike paths in Perth',
    brief: 'A guide to Perth’s best cycling: the Principal Shared Paths (PSPs) along the freeways and rail lines, the Swan River loops, the Rottnest Island ride, and the Munda Biddi Trail start. Practical notes on flat family rides vs longer routes. Link to /walks/.' },
  { slug: 'things-to-do-swan-river', author: 'nina-forrest', legacy_path: '/things-to-do-in-swan-river/',
    title: 'Things to do along the Swan River',
    brief: 'Things to do along Perth’s Swan River and its eastern reaches (Bassendean, Bayswater, Belmont, Guildford): riverside walks and bike paths, ferries and kayaking, Guildford heritage, the Swan Valley wineries, and over 28 km of foreshore. Practical and friendly.' },
  { slug: 'avon-descent-guide', author: 'nina-forrest', legacy_path: '/avon-descent/',
    title: 'The Avon Descent: WA’s white-water classic',
    brief: 'A guide to the Avon Descent, the annual two-day power-dinghy and paddle race down the Avon and Swan rivers from Northam to Bayswater each August. History, where to watch, and walks/bike paths along the river to spectate from. Keep it factual — do not invent exact dates.' },
  { slug: 'walking-cycling-safety-wa', author: 'tess-marlowe', legacy_path: '/useful-contacts-on-trails/',
    title: 'Walking & cycling in WA: trail safety & useful contacts',
    brief: 'Practical safety guide for walking and cycling trails in Western Australia: carry water, sun and heat, bushfire risk in summer, snakes, telling someone your plan, trail grading, and who to contact (emergency 000, DBCA/Parks and Wildlife for park conditions, Trails WA for trail info). General, sensible advice — do not invent specific phone numbers.' },
]

const SYSTEM = `You write warm, practical Australian-English travel articles for Perth Tourism, a Western Australian site focused on bike paths, walks and trails. House voice: a small, real local team ("we walked it last weekend", "our team rode out to…") — friendly, specific, never salesy or clichéd. Australian spelling.

Write a complete article body as clean semantic HTML (no <html>/<head>/<body>, no markdown). Use <h2>/<h3> subheadings, <p>, <ul>/<li>, and <strong>. Aim for 1100–1500 words. Include 2–3 internal links to this site using relative hrefs from this set where relevant: /walks/ (walks & trails explorer), /tours/ (tours), /destinations/perth/, /destinations/swan-valley/, /destinations/rottnest-island/, /parks/. Include 1–2 external links to genuinely useful, non-competitor authorities (e.g. Trails WA https://trailswa.com.au, DBCA/Parks and Wildlife https://www.dbca.wa.gov.au, Tourism WA https://www.westernaustralia.com) as <a href> with rel not required. Do NOT invent precise facts (exact dates, phone numbers, distances) you aren’t sure of — speak in general terms.

Return STRICT JSON only:
{ "excerpt": string (1 sentence, ~25 words), "seo_title": string (<=60 chars), "seo_description": string (<=155 chars), "body_html": string }`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function generate(a) {
  const user = `TITLE: ${a.title}\nBRIEF: ${a.brief}\n\nWrite the JSON now.`
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3500, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    })
    if (r.ok) {
      const d = await r.json()
      const text = d.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let p = null
      try { p = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]) } catch {} } }
      if (p && p.body_html) return p
      throw new Error('bad JSON: ' + text.slice(0, 120))
    }
    if (r.status === 429 || r.status >= 500) { await sleep([2000, 5000, 15000, 30000][attempt]); continue }
    throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`)
  }
  throw new Error('retries exhausted')
}

let ok = 0
for (const a of ARTICLES) {
  if (!FORCE) {
    const [ex] = await sql`SELECT 1 FROM autravel.articles WHERE state_code=${'perth'} AND slug=${a.slug} LIMIT 1`
    if (ex) { console.log(`  skip (exists): ${a.slug}`); continue }
  }
  try {
    const g = await generate(a)
    await sql`
      INSERT INTO autravel.articles
        (state_code, slug, legacy_path, title, excerpt, body_html, author_slug, author,
         status, source, post_type, seo_title, seo_description, published_at)
      VALUES
        (${'perth'}, ${a.slug}, ${a.legacy_path}, ${a.title}, ${g.excerpt}, ${g.body_html},
         ${a.author}, ${a.author}, 'published', 'generated', 'post',
         ${g.seo_title || a.title}, ${g.seo_description || g.excerpt}, now())
      ON CONFLICT (state_code, slug) DO UPDATE SET
        legacy_path = EXCLUDED.legacy_path, title = EXCLUDED.title, excerpt = EXCLUDED.excerpt,
        body_html = EXCLUDED.body_html, author_slug = EXCLUDED.author_slug, author = EXCLUDED.author,
        seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description, updated_at = now()`
    ok++
    console.log(`  ✓ ${a.slug} (${(g.body_html.length/1000).toFixed(1)}k chars)${a.legacy_path ? ' [legacy '+a.legacy_path+']' : ''}`)
  } catch (e) { console.warn(`  ✗ ${a.slug}: ${e.message}`) }
}
console.log(`\nDone: ${ok}/${ARTICLES.length} articles.`)
await sql.end()
