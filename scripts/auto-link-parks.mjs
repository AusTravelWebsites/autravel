#!/usr/bin/env node
// auto-link-parks.mjs — link first mention of each caravan park's name in
// articles within the same state. Same conservative approach as
// auto-link-destinations.mjs (max 3 park links per article since most articles
// only mention 1–2 parks).
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const DRY = process.argv.includes('--dry-run')
const STATE_FILTER = process.argv.find(a => a.startsWith('--state='))?.split('=')[1]
const MAX_PER_ARTICLE = 3
const MIN_NAME_LEN = 12 // skip very short / generic park names like "Top Park"

function autoLink(html, term, href) {
  const lower = html.toLowerCase()
  const target = term.toLowerCase()
  let i = 0, inA = 0, inH = 0, inSkip = 0
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
    if (lower.startsWith(target, i)) {
      const before = i === 0 ? '' : html[i - 1]
      const afterIdx = i + target.length
      const after = afterIdx < html.length ? html[afterIdx] : ''
      if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) {
        const matched = html.slice(i, i + target.length)
        return html.slice(0, i) + `<a href="${href}">${matched}</a>` + html.slice(i + target.length)
      }
    }
    i++
  }
  return null
}

async function processState(state) {
  const parks = await sql`
    SELECT slug, name FROM parks
    WHERE active = true AND state_code = ${state}
      AND length(name) >= ${MIN_NAME_LEN}
    ORDER BY length(name) DESC
  `
  console.log(`[${state}] ${parks.length} parks (length>=${MIN_NAME_LEN})`)
  const articles = await sql`
    SELECT id, slug, body_html FROM articles
    WHERE state_code = ${state} AND status='published' AND body_html IS NOT NULL
  `
  let processed = 0, linked = 0
  for (const a of articles) {
    let body = a.body_html
    let added = 0
    for (const p of parks) {
      if (added >= MAX_PER_ARTICLE) break
      const href = `/parks/${p.slug}/`
      if (body.includes(`href="${href}"`)) continue
      const next = autoLink(body, p.name, href)
      if (next) { body = next; added++ }
    }
    if (added > 0) {
      if (!DRY) await sql`UPDATE articles SET body_html = ${body} WHERE id = ${a.id}`
      linked += added
    }
    processed++
    if (processed % 500 === 0) console.log(`[${state}]   ${processed} done, ${linked} links added`)
  }
  console.log(`[${state}] ${processed} articles processed, ${linked} new park links`)
  return { state, processed, linked }
}

const states = STATE_FILTER ? [STATE_FILTER] : ['qld','nsw','vic','wa','tas','nt','sa']
const results = []
for (const state of states) results.push(await processState(state))
console.log('\nTOTAL:', results.reduce((a, b) => a + b.linked, 0), 'park links added across', results.reduce((a, b) => a + b.processed, 0), 'articles')
await sql.end()
