#!/usr/bin/env node
/**
 * format-article-html.mjs — fix legacy "text dump" articles by adding proper
 * HTML structure (paragraphs, headings, list normalisation) and stripping
 * dead WordPress cruft (.area_links navigation tables, empty wrappers).
 *
 * Problem: ~3,200 migrated articles store body_html as either:
 *   1. Old WP table-layout cruft + naked prose ("text dumps")
 *   2. Naked prose with \n\n separators but no <p> tags
 *   3. Mix of structured HTML (tables, lists) + naked prose
 *
 * Browser only respects HTML structure, so naked prose renders as one wall
 * of text regardless of newlines. Cure: walk the DOM, find loose text
 * between blocks, and wrap each \n\n-separated chunk in <p>. Detect
 * heading-like leading lines and promote to <h2>.
 *
 * Usage:
 *   node --env-file=.env.local scripts/format-article-html.mjs --state qld [--dry-run] [--limit 5]
 *
 * Idempotent: re-running on already-formatted articles is a no-op (text
 * already inside <p>/<h2> stays untouched).
 */
import 'dotenv/config'
import postgres from 'postgres'
import * as cheerio from 'cheerio'

const args = process.argv.slice(2)
const arg = (name, dflt = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt }
const STATE = (arg('state') || '').toLowerCase()
const LIMIT = Number(arg('limit', '0')) || null
const DRY = args.includes('--dry-run')
const SHOW_DIFF = args.includes('--show-diff')

if (!STATE) { console.error('need --state'); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })

// Heading detection: a short line (≤60 chars), Title Case, no trailing punctuation,
// followed by a paragraph break — looks like an unmarked section heading.
const HEADING_RE = /^([A-Z][A-Za-z0-9'’\-&,. ]{3,60})$/

// Block-level tags. Loose text outside any of these needs wrapping.
const BLOCK = new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','blockquote','pre','figure','article','section','header','footer','aside','div','nav','address','dl','dt','dd','hr'])

// Selectors to strip outright — pure legacy navigation cruft with no content value.
const STRIP_SELECTORS = [
  '.area_links',          // old WP "<destination> listings" tables
  '.related-posts-shortcode',
  '.sharedaddy', '.jp-relatedposts', '.yarpp-related',
  '.post-tags', '.post-meta', '.comments-area', '#comments',
  'script', 'style', 'noscript', 'iframe[src*="addthis"]',
]

// Detect "this body needs reformatting": no <p> tags AND substantial text.
function needsFormat(html) {
  if (!html || html.length < 200) return false
  const hasP = /<p[\s>]/i.test(html)
  if (hasP) return false
  // Strip tags to count actual prose chars
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 200
}

function formatHtml(input) {
  const $ = cheerio.load(`<div id="__root">${input}</div>`, null, false)
  const $root = $('#__root')

  // 1. Strip dead WP cruft
  for (const sel of STRIP_SELECTORS) $root.find(sel).remove()

  // 2. Walk top-level children: any text node OR inline-only element gets
  //    accumulated into a buffer; when a block element is hit, flush the
  //    buffer as paragraphs first.
  const newChildren = []
  let buffer = []
  function flushBuffer() {
    if (buffer.length === 0) return
    // Each buffer entry is an HTML fragment (text or inline tag). Join, then
    // split on double-newline OR double-<br> to find paragraph boundaries.
    const joined = buffer.map(b => typeof b === 'string' ? b : $.html(b)).join('').trim()
    if (!joined) { buffer = []; return }
    const blocks = joined
      .replace(/(<br\s*\/?>\s*){2,}/gi, '\n\n')  // double <br> = paragraph break
      .split(/\n\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    for (const block of blocks) {
      // Heading detection: standalone short title-case line.
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length === 1 && HEADING_RE.test(lines[0]) && !/<[^>]+>/.test(lines[0])) {
        newChildren.push(`<h2>${lines[0]}</h2>`)
      } else {
        // Convert single \n inside a paragraph to space so it doesn't break mid-line.
        const para = block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
        newChildren.push(`<p>${para}</p>`)
      }
    }
    buffer = []
  }

  $root.contents().each((_, node) => {
    if (node.type === 'text') {
      if (node.data && node.data.trim()) buffer.push(node.data)
      else if (node.data && /\n\s*\n/.test(node.data)) buffer.push(node.data)
      return
    }
    if (node.type === 'tag') {
      const tag = (node.tagName || node.name || '').toLowerCase()
      if (BLOCK.has(tag)) {
        flushBuffer()
        newChildren.push($.html(node))
      } else {
        // Inline — accumulate
        buffer.push(node)
      }
    }
  })
  flushBuffer()

  // 3. Trim leftover empty <div> wrappers that contain nothing
  const out = newChildren.join('\n').trim()
  const $clean = cheerio.load(`<div id="__c">${out}</div>`, null, false)
  $clean('div:empty, div').each((_, el) => {
    const $el = $clean(el)
    if ($el.attr('id') === '__c') return
    if (!$el.html()?.trim()) $el.remove()
  })
  return $clean('#__c').html().trim()
}

async function main() {
  const rows = await sql`
    SELECT id, slug, body_html
    FROM articles
    WHERE state_code = ${STATE}
      AND status = 'published'
      AND body_html IS NOT NULL
      AND LENGTH(body_html) > 200
    ORDER BY id
    ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`
  console.log(`Scanning ${rows.length} ${STATE} articles`)

  let need = 0, ok = 0, unchanged = 0
  for (const r of rows) {
    if (!needsFormat(r.body_html)) { unchanged++; continue }
    need++
    const formatted = formatHtml(r.body_html)
    if (formatted === r.body_html) { unchanged++; continue }
    if (SHOW_DIFF) {
      console.log(`\n--- ${r.slug} ---`)
      console.log('BEFORE (first 300):', r.body_html.slice(0, 300).replace(/\n/g,'\\n'))
      console.log('AFTER  (first 300):', formatted.slice(0, 300).replace(/\n/g,'\\n'))
    }
    if (!DRY) {
      await sql`UPDATE articles SET body_html = ${formatted}, updated_at = NOW() WHERE id = ${r.id}`
    }
    ok++
    if (ok % 100 === 0) console.log(`  ${ok} formatted...`)
  }
  console.log(`\nDone. ${STATE}: needed=${need}, formatted=${ok}, unchanged=${unchanged}`)
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
