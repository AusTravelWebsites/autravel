#!/usr/bin/env node
/**
 * import-archive.mjs — restore a site's WP content from the Wayback Machine.
 *
 * Usage:
 *   node scripts/import-archive.mjs --state tas --domain tastravel.net.au
 *   node scripts/import-archive.mjs --state wa  --domain watravel.com.au [--limit 500] [--dry-run]
 *
 * Strategy:
 *   1. Query archive.org's CDX API for every 200/text-html snapshot of the domain.
 *   2. Collapse to unique original URLs; keep the most RECENT capture of each.
 *   3. Filter out WP admin/feed/search/category/tag aggregator URLs and static assets.
 *   4. Fetch each snapshot via the `id_` raw-mode URL (no Wayback chrome injected).
 *   5. Extract title + main content via cheerio — try common WP theme selectors in order.
 *   6. UPSERT into autravel.articles (state_code + slug unique; slug uses `-wb-<ts>`).
 *
 * CRITICAL RULES (per Craig's feedback memories):
 *   1. body_html stored VERBATIM from the main-content selector. No link rewriting,
 *      no rel mutation, no href normalisation. Preserve every <a> exactly.
 *   2. Never delete an article. ON CONFLICT DO UPDATE keeps the row; we only ever
 *      refresh in place.
 *   3. Original legacy_path preserved so URLs continue to resolve via the catch-all.
 */
import 'dotenv/config'
import postgres from 'postgres'
import * as cheerio from 'cheerio'

const args = process.argv.slice(2)
function arg(name, fallback = null) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const STATE = (arg('state') || '').toLowerCase()
const DOMAIN = arg('domain')
const LIMIT = Number(arg('limit', '0')) || null
const DRY = args.includes('--dry-run')
// Wayback soft-blocks at ~30 req/min per IP. Default to 1 worker + 1.5s delay
// between requests (~40 req/min) so a single run can complete without getting
// throttled; run imports SEQUENTIALLY per site, never in parallel.
const CONCURRENCY = Number(arg('concurrency', '1'))
const DELAY_MS = Number(arg('delay', '1500'))

if (!STATE || !DOMAIN) {
  console.error('Usage: node scripts/import-archive.mjs --state <code> --domain <site> [--limit N] [--dry-run]')
  process.exit(1)
}

const DB = process.env.DATABASE_URL_POOL || process.env.DATABASE_URL
if (!DB) { console.error('DATABASE_URL not set'); process.exit(1) }

// Paths we skip entirely (aggregator / admin / feed / search / static).
const SKIP_PATTERN = /(\/(wp-admin|wp-login|wp-json|wp-cron|xmlrpc|feed|rss|atom|sitemap|robots|search|cart|checkout|my-account|author\/|tag\/|category\/.*\/feed|page\/\d+|embed\/|404-custom|404-error|404\.html))/i
// Also skip URLs with query strings (search results, embed params, cache busters)
// and fragment identifiers.
const URL_SKIP = /[?#]/
const STATIC_EXT = /\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|pdf|xml|txt|woff2?|ttf|otf)$/i

function slugify(s, suffix) {
  const base = (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post'
  return `${base}-wb-${suffix}`
}

// Extract main article body via several strict selectors — in priority order.
// Returns null when no good match found; nothing-extracted is better than
// scraping-artifact (nav menu, sidebar) being saved as "content".
function extractBody($) {
  const candidates = [
    // Elementor / modern WP (post-2020 captures)
    '.elementor-widget-theme-post-content',
    '[data-elementor-type="wp-post"] .elementor-element-populated',
    '.elementor[data-elementor-type="wp-post"]',
    'article .entry-content',
    'main .entry-content',
    '.post-content',
    '.entry-content',
    '.td-post-content',
    // Older pre-WP tastravel/watravel static template — the right inner
    // container is explicitly `.pagecontent`. `.mobile-clear` is kept as a
    // looser fallback but the link-density check below rejects it when it's
    // actually catching a nav menu.
    '.pagecontent',
    '.container.mainsite .col-md-9.mobile-clear',
    '.container.mainsite .mobile-clear',
    '.col-md-9.pagecontent',
    '#content',
    '#main',
    '#primary',
  ]
  for (const sel of candidates) {
    const el = $(sel).first()
    if (!el.length) continue
    const html = el.html()
    if (!html) continue
    const text = el.text().trim()
    if (text.length < 120) continue
    // Reject nav-heavy captures: if > 50% of the text is inside <a> tags,
    // this is a menu / sitemap aggregator, not an article body.
    const linkText = el.find('a').text().trim()
    if (linkText.length > text.length * 0.5) continue
    // Strip chrome inside the content wrapper (kept link rels intact; only
    // removing layout elements that would re-render as broken UI).
    el.find('nav, aside, .comments-area, #respond, .post-navigation, .wp-block-post-navigation, .sharedaddy, .jp-relatedposts, form, script, style, .carousel, .head-banner, #carouselButtons, #playButton, #pauseButton, .media[align="center"]').remove()
    const cleanHtml = el.html()?.trim()
    if (cleanHtml && cleanHtml.length > 80) return cleanHtml
  }
  return null
}

function extractTitle($) {
  const candidates = ['article h1', 'h1.entry-title', 'h1.post-title', '.elementor-widget-theme-post-title h1', 'h1']
  for (const sel of candidates) {
    const t = $(sel).first().text().trim()
    if (t) return t
  }
  return $('title').first().text().replace(/\s*[|—–-].*/, '').trim() || null
}

function extractExcerpt($) {
  const m = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')
  return (m || '').trim() || null
}

function extractCover($, original) {
  const og = $('meta[property="og:image"]').attr('content')
  if (og) return og
  const firstImg = $('article img').first().attr('src')
  if (firstImg) {
    // Wayback wraps image URLs — strip the /web/<ts>im_/ prefix to get the original.
    const m = firstImg.match(/\/web\/\d+(?:im_)?\/(.+)$/)
    if (m) return m[1]
    return firstImg
  }
  return null
}

async function fetchWaybackSnapshot(timestamp, original) {
  // id_ = "identity mode": returns raw captured HTML without Wayback toolbar injection.
  const url = `https://web.archive.org/web/${timestamp}id_/${original}`
  const r = await fetch(url, { headers: { 'User-Agent': 'autravel-wayback-importer/1.0' } })
  if (!r.ok) throw new Error(`Wayback HTTP ${r.status} for ${timestamp} ${original}`)
  return await r.text()
}

async function fetchCDX(domain) {
  // Pull EVERY capture across all years — some URLs only existed in a
  // specific era (e.g. static-template 2005–2015, or post-2020 WP). For each
  // unique URL we later pick the MOST RECENT successful capture, falling
  // back to earlier ones if extraction fails.
  const url = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&filter=statuscode:200&filter=mimetype:text/html`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`CDX HTTP ${r.status}`)
  const rows = await r.json()
  if (!Array.isArray(rows) || rows.length < 2) return []
  const [, ...data] = rows
  return data.map(r => ({ timestamp: r[1], original: r[2] }))
}

// Group captures by canonical URL path; each group is sorted newest-first so
// the importer can try the best/most-recent capture first then fall back.
function groupByPath(entries) {
  const byPath = new Map()
  for (const e of entries) {
    const path = canonicalPath(e.original)
    if (!path) continue
    const arr = byPath.get(path) || []
    arr.push(e)
    byPath.set(path, arr)
  }
  for (const arr of byPath.values()) {
    arr.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) // newest first
  }
  return byPath
}

function canonicalPath(original) {
  try {
    const u = new URL(original.startsWith('http') ? original : `https://${original}`)
    let p = u.pathname
    if (!p || p === '') p = '/'
    if (!p.endsWith('/') && !STATIC_EXT.test(p)) p = p + '/'
    return p
  } catch { return null }
}

async function processPath(sql, path, captures, stats) {
  if (SKIP_PATTERN.test(path)) { stats.skipped++; return }
  if (STATIC_EXT.test(path)) { stats.skipped++; return }
  if (path === '/' || path === '/home/') { stats.skipped++; return }

  // Try captures newest-first. First one that yields a real article body wins.
  // This recovers URLs that only have a good snapshot in ONE era (e.g. the
  // pre-2015 static template) as well as URLs that have many captures over time.
  let chosen = null
  let lastError = null
  const maxAttempts = Math.min(captures.length, 3)
  for (let i = 0; i < maxAttempts; i++) {
    const { timestamp, original } = captures[i]
    if (URL_SKIP.test(original)) continue
    let html
    try {
      html = await fetchWaybackSnapshot(timestamp, original)
    } catch (e) {
      lastError = e.message
      continue
    }
    const $ = cheerio.load(html)
    const title = extractTitle($)
    const body = extractBody($)
    if (!title || !body || body.length < 120) continue
    const excerpt = extractExcerpt($)
    const cover = extractCover($, original)
    chosen = { timestamp, original, title, body, excerpt, cover }
    break
  }
  if (!chosen) {
    if (lastError) { stats.failed++; if (stats.failed < 10) console.warn('    fetch fail:', path, lastError) }
    else stats.empty++
    return
  }

  const slug = slugify(path.replace(/^\/|\/$/g, '').replace(/\//g, '-') || chosen.title, chosen.timestamp)
  if (DRY) { console.log('  (dry)', STATE, path, '←', chosen.title.slice(0, 60), `[${chosen.timestamp}]`); stats.ok++; return }

  await sql`
    INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
                          post_type, status, source, source_raw, published_at)
    VALUES (${STATE}, ${slug}, ${path}, ${chosen.title}, ${chosen.excerpt || null}, ${chosen.body},
            ${chosen.cover || null}, 'post', 'published', 'wayback',
            ${sql.json({ wayback_ts: chosen.timestamp, original: chosen.original, captures_tried: maxAttempts })},
            ${parseWaybackTs(chosen.timestamp)})
    ON CONFLICT (state_code, slug) DO UPDATE SET
      legacy_path = EXCLUDED.legacy_path,
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      cover_image = COALESCE(articles.cover_image, EXCLUDED.cover_image),
      source_raw = EXCLUDED.source_raw,
      status = 'published',
      updated_at = NOW()`
  stats.ok++
}

function parseWaybackTs(ts) {
  // YYYYMMDDhhmmss → ISO
  return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`)
}

async function run() {
  const started_at = new Date()
  console.log(` CDX query for ${DOMAIN}…`)
  let entries = await fetchCDX(DOMAIN)
  console.log(`   got ${entries.length} captures (all years)`)
  // Pre-filter junk: URLs with ? or # params (search results, embed args),
  // and clearly-not-article paths like wp-admin.
  entries = entries.filter(e => {
    const orig = e.original || ''
    if (URL_SKIP.test(orig)) return false
    const path = canonicalPath(orig)
    if (!path) return false
    if (SKIP_PATTERN.test(path)) return false
    if (STATIC_EXT.test(path)) return false
    if (path === '/' || path === '/home/') return false
    return true
  })
  console.log(`   after junk filter: ${entries.length} captures`)

  // Group by unique path so one URL with 30 captures across years becomes one
  // import job (with 30 candidate snapshots, newest-first).
  const byPath = groupByPath(entries)
  let paths = [...byPath.keys()]
  console.log(`   unique URLs: ${paths.length}`)
  if (LIMIT) paths = paths.slice(0, LIMIT)

  const sql = postgres(DB, { prepare: false, ssl: 'require', max: 4, connection: { search_path: 'autravel, public' } })
  const stats = { ok: 0, skipped: 0, empty: 0, failed: 0 }

  let idx = 0
  async function worker() {
    while (idx < paths.length) {
      const i = idx++
      const path = paths[i]
      const captures = byPath.get(path)
      await processPath(sql, path, captures, stats)
      if ((stats.ok + stats.skipped + stats.empty + stats.failed) % 25 === 0) {
        console.log(`   [${i + 1}/${paths.length}] ok=${stats.ok} skip=${stats.skipped} empty=${stats.empty} fail=${stats.failed}`)
      }
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const finished_at = new Date()
  console.log(`\n Done: ok=${stats.ok} skipped=${stats.skipped} empty=${stats.empty} failed=${stats.failed}  (${Math.round((finished_at - started_at) / 1000)}s)`)

  if (!DRY) {
    await sql`
      INSERT INTO wp_import_log (state_code, action, ok, count_ok, count_fail, details, started_at, finished_at)
      VALUES (${STATE}, 'wayback', ${stats.failed === 0}, ${stats.ok}, ${stats.failed + stats.empty},
              ${sql.json({ domain: DOMAIN, total_cdx: entries.length, skipped: stats.skipped, empty: stats.empty })},
              ${started_at}, ${finished_at})`
  }
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
