#!/usr/bin/env node
/**
 * restore-articles-from-wayback.mjs — recover specific blog articles from
 * archive.org Wayback Machine + rehost their images on our own R2 bucket.
 *
 * Background (2026-06-13): nswtravel.com.au has ~20 article URLs that were
 * published before the autravel rebuild and never migrated. The 404 log shows
 * real traffic still hitting them (Google index + backlinks). Per Craig's
 * rule we don't redirect article URLs to category pages — we restore the
 * actual content. The content was ours, so this is recovery, not scraping.
 *
 * NEVER link to web.archive.org in the restored content. All images must be
 * downloaded and re-served from media.bugbitten.com (R2) so the article is
 * self-contained and doesn't depend on Wayback staying up.
 *
 * Usage:
 *   node --env-file=.env.local scripts/restore-articles-from-wayback.mjs \
 *        --state nsw --targets /tmp/restore-targets.json [--limit 1] [--dry-run]
 *
 * targets JSON: [{ "path": "/foo-bar/", "timestamp": "20250620140513" }, ...]
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import * as cheerio from 'cheerio'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const args = process.argv.slice(2)
function arg(name, fallback = null) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const STATE   = (arg('state') || '').toLowerCase()
const TARGETS = arg('targets')
const LIMIT   = Number(arg('limit', '0')) || null
const DRY     = args.includes('--dry-run')
const DOMAIN  = arg('domain') || 'nswtravel.com.au'
// status of restored articles: 'draft' (default — operator reviews before publish)
// or 'published' (publishes immediately, e.g. for test single article).
const STATUS  = arg('status') || 'draft'

if (!STATE || !TARGETS) { console.error('need --state and --targets <json>'); process.exit(1) }

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 4 })

// R2 — reuse the bugbitten-media bucket (same pattern as migrate-unsplash-to-r2.mjs).
const R2_BUCKET = 'bugbitten-media'
const R2_PUBLIC = 'https://media.bugbitten.com'
const R2_PREFIX = 'autravel/restored'
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})

const targets = JSON.parse(readFileSync(TARGETS, 'utf8'))
const toRun = LIMIT ? targets.slice(0, LIMIT) : targets
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function pathToSlug(p) {
  return p.replace(/^\/+|\/+$/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80)
}

// Strip Wayback's /web/<ts>im_/ wrapper from an image URL to get the ORIGINAL.
function unwrapWayback(url) {
  if (!url) return url
  const m = url.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)$/)
  return m ? m[1] : url
}

// Make an image URL absolute against a base (handles //foo, /foo, foo, fully-qualified).
function absolutise(src, baseUrl) {
  if (!src) return null
  try { return new URL(src, baseUrl).toString() } catch { return null }
}

async function fetchSnapshot(timestamp, path) {
  // id_ = identity mode (no Wayback toolbar / chrome injection).
  const url = `https://web.archive.org/web/${timestamp}id_/https://${DOMAIN}${path}`
  const r = await fetch(url, { headers: { 'User-Agent': 'autravel-restore/1.0' } })
  if (!r.ok) throw new Error(`Wayback HTTP ${r.status} for ${url}`)
  return await r.text()
}

async function fetchImage(originalUrl, fallbackTimestamp) {
  // Try the live original first (fastest, freshest). If it 404s (likely —
  // these article URLs are dead, often their images are too), fall back to
  // the Wayback im_ capture which returns the binary as archived.
  for (const u of [originalUrl, `https://web.archive.org/web/${fallbackTimestamp}im_/${originalUrl}`]) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'autravel-restore/1.0' } })
      if (!r.ok) continue
      const ct = r.headers.get('content-type') || ''
      if (!ct.startsWith('image/')) continue
      const buf = Buffer.from(await r.arrayBuffer())
      return { buf, contentType: ct }
    } catch {}
  }
  return null
}

async function uploadToR2(slug, filename, buf, contentType) {
  const key = `${R2_PREFIX}/${slug}/${filename}`
  // Skip if already uploaded (idempotent across re-runs).
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return `${R2_PUBLIC}/${key}` } catch {}
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: buf, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return `${R2_PUBLIC}/${key}`
}

function extractMain($) {
  // The Elementor "Post Content" widget is the exact article body on the old
  // nswtravel WP install — try it FIRST so we don't accidentally grab the
  // whole templated page (header + sidebar + footer + related lists).
  const selectors = [
    '.elementor-widget-theme-post-content .elementor-widget-container',
    '.elementor-widget-theme-post-content',
    'article .entry-content', '.post-content', '.single-content',
    '.ekit-template-content-markup',
    'main article', 'article', 'main', '.content',
  ]
  for (const s of selectors) {
    const el = $(s).first()
    if (el.length) {
      const html = el.html() || ''
      if (html.length > 300) return el
    }
  }
  // Last-resort fallback: largest <div> excluding chrome.
  let bestDiv = null, bestTextLen = 0
  $('body').find('div').each((_, el) => {
    const $el = $(el)
    if ($el.parents('header, footer, nav, aside, .site-header, .site-footer').length) return
    const text = $el.text().trim()
    if (text.length > bestTextLen) { bestTextLen = text.length; bestDiv = $el }
  })
  return bestDiv
}

function clean($, $main) {
  // Strip Wayback-injected chrome, scripts, styles, related-posts widgets,
  // share-bars, comments — anything that's not actual article body.
  $main.find('script, style, noscript, iframe').remove()
  $main.find('.sharedaddy, .jp-relatedposts, .yarpp-related, .related, .post-share, .post-meta, .post-tags, .author-box, .comments-area, #comments, .comment-respond, .single-author').remove()
  $main.find('[id^="wm-"], [class*="wm-"], [class*="wayback"]').remove()
  // Strip any anchors that go to archive.org.
  $main.find('a[href*="web.archive.org"], a[href*="archive.org"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href') || ''
    const m = href.match(/\/web\/\d+\/(https?:\/\/.+)$/)
    if (m) $a.attr('href', m[1])
    else $a.replaceWith($a.html() || '')
  })
}

function extractMeta($) {
  const rawTitle = $('meta[property="og:title"]').attr('content')
    || $('h1.entry-title').first().text().trim()
    || $('h1').first().text().trim()
    || $('title').text().trim()
  // Strip the site-name suffix that WordPress adds (e.g. " | NSW Travel", " – NSW Travel").
  const title = (rawTitle || '').replace(/\s*[|·\-–]\s*(NSW Travel|QLD Travel|[A-Z]{2,4} Travel|Australia.*?)\s*$/i, '').trim()
  const excerpt = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || ''
  const ogImage = $('meta[property="og:image"]').attr('content')
  const author = $('meta[name="author"]').attr('content')
    || $('.author-name, .post-author').first().text().trim()
    || null
  const publishedRaw = $('meta[property="article:published_time"]').attr('content')
    || $('time[datetime]').first().attr('datetime')
    || null
  return { title: title?.trim(), excerpt: excerpt?.trim().slice(0, 500), ogImage, author, publishedRaw }
}

async function restoreOne(target) {
  const { path, timestamp } = target
  const slug = pathToSlug(path)
  console.log(`\n→ ${path}  (slug: ${slug}, ts: ${timestamp})`)

  const html = await fetchSnapshot(timestamp, path)
  const $ = cheerio.load(html)

  const meta = extractMeta($)
  if (!meta.title) throw new Error('no title found')
  const $main = extractMain($)
  if (!$main) throw new Error('no main content found')
  clean($, $main)

  // Process images: find every <img>, get original src, upload to R2, rewrite src.
  const imgs = $main.find('img').toArray()
  console.log(`  found ${imgs.length} <img> in body`)
  for (const img of imgs) {
    const $img = $(img)
    let src = $img.attr('data-orig-file') || $img.attr('data-src') || $img.attr('src')
    if (!src) continue
    const original = unwrapWayback(absolutise(src, `https://${DOMAIN}${path}`))
    if (!original || /^data:/.test(original)) continue
    const filename = pathToSlug(original.split('/').pop().split('?')[0]).slice(0, 60)
      + '.' + ((original.split('.').pop().split(/[?#]/)[0] || 'jpg').toLowerCase().slice(0, 4))
    const fetched = await fetchImage(original, timestamp)
    if (!fetched) { console.log(`     ! image not retrievable: ${original}`); continue }
    const r2url = await uploadToR2(slug, filename, fetched.buf, fetched.contentType)
    $img.attr('src', r2url)
    $img.removeAttr('srcset')           // srcset still points at wayback CDN
    $img.removeAttr('data-src')
    $img.removeAttr('data-orig-file')
    $img.removeAttr('data-lazy-src')
    console.log(`     ✓ ${filename}  →  ${r2url}`)
    await sleep(300) // be kind to Wayback
  }

  // Resolve cover_image (og:image) to R2 too.
  let cover_image = null
  const ogOrig = unwrapWayback(meta.ogImage)
  if (ogOrig && !/^data:/.test(ogOrig)) {
    const filename = 'cover.' + ((ogOrig.split('.').pop().split(/[?#]/)[0] || 'jpg').toLowerCase().slice(0, 4))
    const fetched = await fetchImage(ogOrig, timestamp)
    if (fetched) {
      cover_image = await uploadToR2(slug, filename, fetched.buf, fetched.contentType)
      console.log(`  cover → ${cover_image}`)
    }
  }
  // Fallback to first body image if no og:image.
  if (!cover_image) {
    const firstImg = $main.find('img').first().attr('src')
    if (firstImg) cover_image = firstImg
  }

  const body_html = $.html($main).trim()
  const published_at = meta.publishedRaw ? new Date(meta.publishedRaw) : null

  if (DRY) {
    console.log(`  DRY: would insert "${meta.title}" (${body_html.length} chars body, cover=${cover_image ? 'yes' : 'no'})`)
    return { ok: true, slug, dry: true }
  }

  await sql`
    INSERT INTO autravel.articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
                                   post_type, status, source, source_raw, author, published_at)
    VALUES (${STATE}, ${slug}, ${path}, ${meta.title}, ${meta.excerpt || null}, ${body_html}, ${cover_image},
            'post', ${STATUS}, 'wayback-restore',
            ${sql.json({ wayback_timestamp: timestamp, original_url: `https://${DOMAIN}${path}`, restored_at: new Date().toISOString() })},
            ${meta.author}, ${published_at})
    ON CONFLICT (state_code, slug) DO UPDATE SET
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      cover_image = COALESCE(autravel.articles.cover_image, EXCLUDED.cover_image),
      legacy_path = EXCLUDED.legacy_path,
      source = EXCLUDED.source,
      source_raw = EXCLUDED.source_raw,
      updated_at = NOW()`

  // Remove any existing bad redirect that pointed this URL at /, /destinations/, etc.
  await sql`
    DELETE FROM autravel.redirects
    WHERE state_code = ${STATE} AND from_path = ${path}
      AND to_path IN ('/','/destinations/','/articles/','/blog/')`

  return { ok: true, slug }
}

let ok = 0, fail = 0
for (const t of toRun) {
  try {
    await restoreOne(t)
    ok++
    await sleep(1500) // pace Wayback fetches across articles
  } catch (e) {
    fail++
    console.log(`  ✗ ${t.path}: ${e.message}`)
  }
}
console.log(`\nDone: ok=${ok} fail=${fail}`)
await sql.end()
