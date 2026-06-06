#!/usr/bin/env node
/**
 * backfill-images.mjs — fill hero_image / cover_image for every row that's
 * missing one with a content-relevant photo.
 *
 * Strategy per type:
 *   • destinations → Unsplash search "<name> <state_name>"; cache-friendly
 *     since destinations are a small curated list (~96 rows).
 *   • parks (missing cover) → Unsplash search "<name>" fallback
 *     "caravan park <region>"
 *   • articles → first image found inside body_html; if none, Unsplash search
 *     "<title>" (limited to 1 request per article to stay under API quota).
 *
 * Usage:
 *   node scripts/backfill-images.mjs --what destinations [--limit N] [--dry-run]
 *   node scripts/backfill-images.mjs --what articles --limit 500
 *   node scripts/backfill-images.mjs --what parks
 */
import 'dotenv/config'
import postgres from 'postgres'
import * as cheerio from 'cheerio'

const args = process.argv.slice(2)
function arg(n, d = null) { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const WHAT = arg('what') || 'destinations'
const LIMIT = Number(arg('limit', '0')) || null
const DRY = args.includes('--dry-run')
const DELAY = Number(arg('delay', '1200'))

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY
const DB = process.env.DATABASE_URL_POOL || process.env.DATABASE_URL
if (!DB) { console.error('DATABASE_URL not set'); process.exit(1) }
if (!UNSPLASH_KEY) { console.error('UNSPLASH_ACCESS_KEY not set'); process.exit(1) }

const STATE_NAMES = {
  qld: 'Queensland', nsw: 'New South Wales', vic: 'Victoria',
  wa: 'Western Australia', sa: 'South Australia', tas: 'Tasmania',
  nt: 'Northern Territory', aunz: 'Australia',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function unsplashSearch(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const r = await fetch(url, { headers: { 'Authorization': `Client-ID ${UNSPLASH_KEY}` } })
  if (!r.ok) {
    if (r.status === 403) console.warn('    unsplash 403 — rate limited, backing off 30s')
    return null
  }
  const d = await r.json()
  const first = d.results?.[0]
  if (!first) return null
  // Use `regular` size (~1080w) — good balance of quality and bandwidth.
  return first.urls?.regular || first.urls?.small || first.urls?.full || null
}

function extractFirstImgFromBody(html) {
  if (!html) return null
  try {
    const $ = cheerio.load(html)
    const imgs = $('img')
    for (let i = 0; i < imgs.length; i++) {
      const src = $(imgs[i]).attr('src')
      if (!src) continue
      if (src.startsWith('data:')) continue
      // Prefer absolute URLs
      if (/^https?:\/\//.test(src)) return src
      // Relative — skip for now (broken on autravel)
    }
  } catch {}
  return null
}

async function main() {
  const sql = postgres(DB, { prepare: false, ssl: 'require', max: 4, connection: { search_path: 'autravel, public' } })
  const started = Date.now()
  let ok = 0, skipped = 0, failed = 0

  if (WHAT === 'destinations') {
    const rows = await sql`SELECT state_code, slug, name FROM destinations WHERE hero_image IS NULL AND active ORDER BY state_code, name${LIMIT ? sql` LIMIT ${LIMIT}` : sql``}`
    console.log(`destinations to backfill: ${rows.length}`)
    for (const d of rows) {
      const query = `${d.name} ${STATE_NAMES[d.state_code] || ''} Australia travel`
      const url = await unsplashSearch(query)
      if (!url) { failed++; console.warn('   no match:', d.state_code, d.slug); await sleep(DELAY); continue }
      if (DRY) { console.log('  (dry)', d.slug, '←', url.slice(0, 80)); ok++; await sleep(DELAY); continue }
      await sql`UPDATE destinations SET hero_image = ${url}, updated_at = NOW() WHERE state_code = ${d.state_code} AND slug = ${d.slug}`
      ok++
      if (ok % 10 === 0) console.log(`   [${ok}/${rows.length}] last: ${d.slug}`)
      await sleep(DELAY)
    }
  }

  else if (WHAT === 'parks') {
    const rows = await sql`SELECT id::text, state_code, slug, name, region FROM parks WHERE (cover_image IS NULL OR cover_image = '') AND active${LIMIT ? sql` LIMIT ${LIMIT}` : sql``}`
    console.log(`parks to backfill: ${rows.length}`)
    for (const p of rows) {
      const url = await unsplashSearch(`${p.name} ${p.region || ''} caravan park Australia`)
      if (!url) { failed++; await sleep(DELAY); continue }
      if (DRY) { console.log('  (dry)', p.slug, '←', url.slice(0, 80)); ok++; await sleep(DELAY); continue }
      await sql`UPDATE parks SET cover_image = ${url}, updated_at = NOW() WHERE id = ${p.id}::uuid`
      ok++
      await sleep(DELAY)
    }
  }

  else if (WHAT === 'articles') {
    // Pre-load destination hero images keyed by (state_code, slug) for quick lookup.
    const destRows = await sql`SELECT state_code, slug, hero_image FROM destinations WHERE hero_image IS NOT NULL AND active`
    const destHero = new Map()
    for (const d of destRows) destHero.set(`${d.state_code}:${d.slug}`, d.hero_image)

    // Per-state fallback: pick ANY destination hero for each state (prefer
    // featured + low display_order, but accept any).
    const stateFallback = new Map()
    const featuredRows = await sql`SELECT DISTINCT ON (state_code) state_code, hero_image FROM destinations WHERE hero_image IS NOT NULL AND active ORDER BY state_code, is_featured DESC, display_order, name`
    for (const r of featuredRows) stateFallback.set(r.state_code, r.hero_image)
    // aunz (aggregator) has no destinations of its own — fall back to a random QLD hero.
    if (!stateFallback.has('aunz')) {
      const [q] = await sql`SELECT hero_image FROM destinations WHERE state_code='qld' AND hero_image IS NOT NULL ORDER BY is_featured DESC, display_order LIMIT 1`
      if (q?.hero_image) stateFallback.set('aunz', q.hero_image)
    }

    const rows = await sql`SELECT id::text, state_code, slug, title, destination_slug, body_html FROM articles
      WHERE status = 'published' AND (cover_image IS NULL OR cover_image = '')${LIMIT ? sql` LIMIT ${LIMIT}` : sql``}`
    console.log(`articles to backfill: ${rows.length}`)
    let sBody = 0, sDest = 0, sState = 0, sUnsplash = 0
    for (const a of rows) {
      // Stage 1: body HTML image (no API).
      let url = extractFirstImgFromBody(a.body_html)
      let stage = 'body'
      // Stage 2: linked destination's hero.
      if (!url && a.destination_slug) {
        url = destHero.get(`${a.state_code}:${a.destination_slug}`)
        stage = 'destination'
      }
      // Stage 3: state-level featured destination fallback.
      if (!url) {
        url = stateFallback.get(a.state_code)
        stage = 'state-fallback'
      }
      // Stage 4: Unsplash (costs API quota). Only use when everything else fails.
      if (!url) {
        url = await unsplashSearch(`${a.title} Australia travel`)
        stage = 'unsplash'
        await sleep(DELAY)
      }
      if (!url) { failed++; continue }
      if (!DRY) await sql`UPDATE articles SET cover_image = ${url}, updated_at = NOW() WHERE id = ${a.id}::uuid`
      ok++
      if (stage === 'body') sBody++
      else if (stage === 'destination') sDest++
      else if (stage === 'state-fallback') sState++
      else sUnsplash++
      if ((ok + failed) % 100 === 0) console.log(`   [${ok + failed}/${rows.length}] body=${sBody} dest=${sDest} state=${sState} unsplash=${sUnsplash} fail=${failed}`)
    }
    console.log(`   body=${sBody} dest=${sDest} state=${sState} unsplash=${sUnsplash} failed=${failed}`)
  }

  else {
    console.error('Unknown --what:', WHAT)
    process.exit(1)
  }

  const elapsed = Math.round((Date.now() - started) / 1000)
  console.log(`\n Done [${WHAT}]: ok=${ok} skipped=${skipped} failed=${failed} (${elapsed}s)`)
  await sql.end()
}
main().catch(e => { console.error(e); process.exit(1) })
