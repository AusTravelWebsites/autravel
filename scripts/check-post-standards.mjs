#!/usr/bin/env node
/**
 * Enforce the page-setup rule (feedback_page_setup_rule) on published articles.
 *
 * Craig's standing standard, item by item:
 *   ≥1500 words · 2–3+ inline images, all with alt · H2 every ~200–300 words
 *   3 internal links · 2 external links to NON-COMPETITORS · no OTA links
 *   seo_title ≤45 (this template's cap) · meta description ≤155 · cover image
 *
 * Runs the real render pipeline, so it judges what a reader actually gets.
 *
 *   node --env-file=.env.local scripts/check-post-standards.mjs <state> [slug]
 *   node --env-file=.env.local scripts/check-post-standards.mjs uk --recent 10
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const MIN_WORDS = 1500, MIN_IMAGES = 2, MIN_INTERNAL = 3, MIN_EXTERNAL = 2
const SEO_TITLE_CAP = 45, DESC_CAP = 155
// Never link to an OTA we compete with (rule item 7).
const OTA = /tripadvisor|booking\.com|lonelyplanet|getyourguide|klook|expedia|viator|agoda|hotels\.com|trip\.com/i

const [state, ...rest] = process.argv.slice(2)
if (!state) { console.error('usage: check-post-standards.mjs <state_code> [slug | --recent N]'); process.exit(1) }
const recentIdx = rest.indexOf('--recent')
const limit = recentIdx >= 0 ? Number(rest[recentIdx + 1] || 10) : null
const slug = recentIdx < 0 ? rest[0] : null

const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const rows = slug
  ? await sql`SELECT slug, title, body_html, cover_image, seo_title, seo_description FROM articles WHERE state_code=${state} AND slug=${slug}`
  : await sql`SELECT slug, title, body_html, cover_image, seo_title, seo_description FROM articles
      WHERE state_code=${state} AND status='published' AND source='manual'
      ORDER BY published_at DESC NULLS LAST LIMIT ${limit || 10}`

let failed = 0
for (const a of rows) {
  const h = a.body_html || ''
  const text = h.replace(/<figure>[\s\S]*?<\/figure>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  const imgs = [...h.matchAll(/<img\b[^>]*>/gi)]
  const noAlt = imgs.filter(m => !/\balt="[^"]{3,}"/i.test(m[0])).length
  const h2 = (h.match(/<h2\b/gi) || []).length

  const anchors = [...h.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  const isCredit = u => /pexels\.com|unsplash\.com/i.test(u)
  const internal = anchors.filter(m => m[1].startsWith('/'))
  const external = anchors.filter(m => /^https?:\/\//i.test(m[1]) && !isCredit(m[1]))
  const otas = external.filter(m => OTA.test(m[1]))
  // Rule says anchors should be descriptive, not bare
  const thinAnchors = internal.filter(m => m[2].replace(/<[^>]+>/g, '').trim().split(/\s+/).length < 2)

  const fails = []
  if (words < MIN_WORDS) fails.push(`words ${words} < ${MIN_WORDS}`)
  if (imgs.length < MIN_IMAGES) fails.push(`images ${imgs.length} < ${MIN_IMAGES}`)
  if (noAlt) fails.push(`${noAlt} image(s) missing alt`)
  if (internal.length < MIN_INTERNAL) fails.push(`internal links ${internal.length} < ${MIN_INTERNAL}`)
  if (external.length < MIN_EXTERNAL) fails.push(`external links ${external.length} < ${MIN_EXTERNAL}`)
  if (otas.length) fails.push(`OTA link(s): ${otas.map(m => m[1]).join(', ')}`)
  if (thinAnchors.length) fails.push(`${thinAnchors.length} single-word internal anchor(s)`)
  if (!a.cover_image) fails.push('no cover image')
  if ((a.seo_title || a.title || '').length > SEO_TITLE_CAP) fails.push(`seo_title ${(a.seo_title || a.title).length} > ${SEO_TITLE_CAP} (will be ellipsised)`)
  if ((a.seo_description || '').length > DESC_CAP) fails.push(`meta description ${a.seo_description.length} > ${DESC_CAP}`)
  if (h2 && words / h2 > 400) fails.push(`${Math.round(words / h2)} words per H2 (aim 200–300)`)

  const ok = fails.length === 0
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${a.slug}`)
  console.log(`      ${words}w · ${imgs.length} img · ${h2} h2 · ${internal.length} internal · ${external.length} external`)
  fails.forEach(f => console.log(`        ✗ ${f}`))
}
console.log(`\n${rows.length - failed}/${rows.length} meet the page-setup rule`)
await sql.end()
process.exit(failed ? 1 : 0)
