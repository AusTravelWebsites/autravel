#!/usr/bin/env node
// auto-link-destinations.mjs — for each tenant, take its list of destinations,
// then walk every published article in that state and auto-link the FIRST
// occurrence of each destination name in the body (skipping anchors that
// already exist, headings, and code/script blocks).
//
// Conservative: max 1 link per destination per article so we never over-link;
// total cap of 8 added links per article. Idempotent — re-runs are safe
// because we skip text that's already inside an <a>.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const DRY = process.argv.includes('--dry-run')
const STATE_FILTER = process.argv.find(a => a.startsWith('--state='))?.split('=')[1]
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null
const MAX_LINKS_PER_ARTICLE = 8

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Replace the first regex match that is NOT inside <a>...</a>, <h1..h3>, or <script>/<style>.
// We walk a token state machine across the body to find a safe span.
function autoLink(html, term, href) {
  const lower = html.toLowerCase()
  const target = term.toLowerCase()
  let i = 0
  // skip blocks: anchors, h1-h3, headings, script, style, code
  let inA = 0, inH = 0, inSkip = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i)
      if (close < 0) break
      const tag = html.slice(i + 1, close).toLowerCase()
      const isClose = tag.startsWith('/')
      const name = (isClose ? tag.slice(1) : tag).split(/[\s>]/)[0]
      if (name === 'a') { isClose ? inA = Math.max(0, inA - 1) : inA++ }
      if (/^h[1-6]$/.test(name)) { isClose ? inH = Math.max(0, inH - 1) : inH++ }
      if (['script','style','code','pre'].includes(name)) { isClose ? inSkip = Math.max(0, inSkip - 1) : inSkip++ }
      i = close + 1
      continue
    }
    if (inA || inH || inSkip) { i++; continue }
    // word-boundary match for the term, case-insensitive
    if (lower.startsWith(target, i)) {
      const before = i === 0 ? '' : html[i - 1]
      const afterIdx = i + target.length
      const after = afterIdx < html.length ? html[afterIdx] : ''
      const isWordBefore = /[a-z0-9]/i.test(before)
      const isWordAfter = /[a-z0-9]/i.test(after)
      if (!isWordBefore && !isWordAfter) {
        const matched = html.slice(i, i + target.length)
        const replacement = `<a href="${href}">${matched}</a>`
        return html.slice(0, i) + replacement + html.slice(i + target.length)
      }
    }
    i++
  }
  return null // no safe match found
}

async function processState(state) {
  const dests = await sql`
    SELECT slug, name FROM destinations
    WHERE active = true AND state_code = ${state}
    ORDER BY length(name) DESC, name -- longest first so "Blue Mountains" wins over "Blue"
  `
  if (!dests.length) return { state, processed: 0, linked: 0 }
  console.log(`[${state}] ${dests.length} destinations`)

  const articleQuery = LIMIT
    ? sql`SELECT id, slug, body_html FROM articles WHERE state_code = ${state} AND status='published' AND body_html IS NOT NULL ORDER BY random() LIMIT ${LIMIT}`
    : sql`SELECT id, slug, body_html FROM articles WHERE state_code = ${state} AND status='published' AND body_html IS NOT NULL`
  const articles = await articleQuery
  console.log(`[${state}] ${articles.length} articles to scan`)

  let processed = 0, linked = 0
  for (const a of articles) {
    let body = a.body_html
    let added = 0
    for (const d of dests) {
      if (added >= MAX_LINKS_PER_ARTICLE) break
      const href = `/destinations/${d.slug}/`
      // Skip if already linked to this destination
      if (body.includes(`href="${href}"`)) continue
      // Skip if the article IS this destination's slug (don't self-link articles too tightly)
      const next = autoLink(body, d.name, href)
      if (next) { body = next; added++ }
    }
    if (added > 0) {
      if (!DRY) await sql`UPDATE articles SET body_html = ${body} WHERE id = ${a.id}`
      linked += added
    }
    processed++
    if (processed % 200 === 0) console.log(`[${state}]   ${processed} done, ${linked} links added`)
  }
  console.log(`[${state}] ${processed} articles processed, ${linked} new internal links`)
  return { state, processed, linked }
}

const states = STATE_FILTER ? [STATE_FILTER] : ['qld','nsw','vic','wa','tas','nt','sa']
const results = []
for (const state of states) {
  results.push(await processState(state))
}
console.log('\nTOTAL:', results.reduce((a, b) => a + b.linked, 0), 'links added across', results.reduce((a, b) => a + b.processed, 0), 'articles')
await sql.end()
