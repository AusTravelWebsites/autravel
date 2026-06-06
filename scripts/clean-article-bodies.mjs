#!/usr/bin/env node
// Strip Elementor lightbox cruft + dead WP-uploads links + orphan \r line endings
// from autravel.articles bodies. Idempotent.
//
// Targets the ~3000 legacy WP-imported articles that have:
//   1. Empty <a data-elementor-open-lightbox="..." ...></a> wrappers (no <img> inside)
//   2. Broken external links to https://www.qldtravel.com.au/wp-content/uploads/...
//   3. Loose \r line endings polluting the rendered HTML
//
// Does NOT add headings or rewrite structure — that's deliberately conservative
// since the <ArticleRelated /> component already gives every article a clean
// hub-and-spoke link surface at the bottom. Body cleanup is just removing noise.
import postgres from 'postgres'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('/var/www/autravel/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
// Use a connection with a relaxed statement timeout — body_html updates on rows
// with cover_images and full prose can legitimately take a few seconds under load.
const sql = postgres(env.DATABASE_URL || env.DATABASE_URL_POOL, {
  prepare: false,
  max: 4,
  connection: { statement_timeout: '60000', idle_in_transaction_session_timeout: '60000' },
})

// Patterns to strip
const STRIPPERS = [
  // 1. Empty Elementor lightbox <a> wrappers — `<a data-elementor-open-lightbox="…" …></a>` (no inner content other than whitespace)
  { re: /<a\s+href="[^"]*"[^>]*data-elementor-open-lightbox="[^"]*"[^>]*>\s*<\/a>/g, label: 'elementor-empty-a' },
  { re: /<a\s+[^>]*data-elementor-open-lightbox="[^"]*"[^>]*>\s*<\/a>/g,            label: 'elementor-empty-a-alt' },
  // 2. Any <a> tag whose only inner content is the matching closing tag (i.e. truly empty), regardless of data-attrs
  { re: /<a\s+[^>]*>\s*<\/a>/g, label: 'empty-a-any' },
  // 3. Bare \r without \n (Windows CRLF that lost its LF during import) — collapse to space
  { re: /\r(?!\n)/g, label: 'orphan-cr' },
  // 4. Long runs of empty paragraphs <p>&nbsp;</p> or <p></p> from old WP
  { re: /<p>\s*(&nbsp;| )?\s*<\/p>/g, label: 'empty-p' },
]

// Image URLs to strip references to: dead WP uploads on the old apex
const BROKEN_IMG_HOST = /https?:\/\/(?:www\.)?(qldtravel|nswtravel|victravel|nttravel|watravel|satravel|tastravel)\.(?:com\.au|net\.au)\/wp-content\/uploads\/[^"\s)]+/g

function cleanBody(html) {
  if (!html) return { body: html, stripped: 0 }
  let working = html
  let total = 0
  for (const { re } of STRIPPERS) {
    const before = working.length
    working = working.replace(re, '')
    const removed = before - working.length
    if (removed > 0) total += removed
  }
  // Replace broken WP-uploads <img> tags with nothing (the linked image is 404).
  // Note: many of these were already orphaned wrappers stripped above; this catches the inline img cases.
  working = working.replace(/<img[^>]+src="[^"]*\/wp-content\/uploads\/[^"]*"[^>]*\/?>/g, '')
  // Collapse triple+ newlines to double
  working = working.replace(/\n{3,}/g, '\n\n')
  // Trim trailing whitespace per line
  working = working.split('\n').map(l => l.replace(/\s+$/, '')).join('\n')
  return { body: working, stripped: total }
}

const rows = await sql`
  SELECT id, state_code, slug, body_html
    FROM autravel.articles
   WHERE status = 'published'
     AND body_html IS NOT NULL
     AND (
       body_html LIKE '%data-elementor-open-lightbox%'
       OR body_html ~ '<a\\s+[^>]*>\\s*</a>'
       OR body_html ~ '\\r'
       OR body_html LIKE '%wp-content/uploads/%'
     )`
console.log(`Found ${rows.length} candidate articles to clean.\n`)

let updated = 0
let skipped = 0
let failed = 0
let totalStripped = 0
for (const r of rows) {
  const { body, stripped } = cleanBody(r.body_html)
  if (body === r.body_html) { skipped++; continue }
  try {
    await sql`UPDATE autravel.articles SET body_html = ${body}, updated_at = now() WHERE id = ${r.id}`
    updated++
    totalStripped += stripped
  } catch (e) {
    failed++
    console.error(`  [fail] ${r.state_code}/${r.slug}: ${e.code || e.message}`)
  }
  if ((updated + failed) % 100 === 0) console.log(`  progress: ${updated} updated, ${skipped} skipped, ${failed} failed`)
}
console.log(`\nDone — ${updated} updated, ${skipped} skipped, ${failed} failed. Stripped ${(totalStripped / 1024).toFixed(1)} KB of cruft total.`)
await sql.end()
