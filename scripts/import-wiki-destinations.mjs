#!/usr/bin/env node
// import-wiki-destinations.mjs — backfill destinations.body with Wikipedia
// extract for the same place. Uses the public REST summary endpoint
// (free, no key, CC-BY-SA + CC0 metadata). Adds attribution + canonical-friendly
// markup. Idempotent — only fills empty body unless --force.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const STATE_HINT = {
  qld: 'Queensland', nsw: 'New South Wales', vic: 'Victoria', wa: 'Western Australia',
  sa: 'South Australia', tas: 'Tasmania', nt: 'Northern Territory', aunz: 'Australia',
}

async function searchTitle(query) {
  // Use OpenSearch to find the closest title
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=${encodeURIComponent(query)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'autravel-importer/1.0 (team@growthfactory.com.au)' } })
  if (!r.ok) return null
  const j = await r.json()
  return (j[1] || [])[0] || null
}

async function summary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'autravel-importer/1.0 (team@growthfactory.com.au)' } })
  if (!r.ok) return null
  const j = await r.json()
  if (j.type !== 'standard') return null
  return j
}

async function extract(title) {
  // Get the lead extract — first ~2 paragraphs, plain HTML
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=1&explaintext=0&exsectionformat=plain&redirects=1&titles=${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'autravel-importer/1.0 (team@growthfactory.com.au)' } })
  if (!r.ok) return null
  const j = await r.json()
  const pages = j?.query?.pages || {}
  const first = pages[Object.keys(pages)[0]]
  return first?.extract || null
}

const dests = await sql`
  SELECT id, slug, name, state_code FROM destinations
  WHERE active = true ${FORCE ? sql`` : sql`AND (body IS NULL OR length(coalesce(body, '')) < 200)`}
  ORDER BY state_code, name
`
console.log(`destinations to backfill: ${dests.length}`)

let processed = 0, skipped = 0, failed = 0
for (const d of dests) {
  try {
    // Search with state hint to disambiguate "Brisbane" -> "Brisbane, Queensland"
    const stateName = STATE_HINT[d.state_code]
    // Try multiple search strategies, fetching extract for each candidate
    const candidates = [
      `${d.name}, ${stateName}`,
      `${d.name} ${stateName}`,
      `${d.name} Australia`,
      d.name, // last-ditch: just the bare name
    ]
    let title = null, body = null, sum = null
    for (const q of candidates) {
      const t = await searchTitle(q)
      if (!t) continue
      const s = await summary(t)
      if (!s) continue
      const b = await extract(t)
      if (!b || b.length < 200) continue
      title = t; body = b; sum = s
      break
    }
    if (!title || !body || !sum) {
      skipped++
      console.log(`  − ${d.state_code}/${d.slug} — no usable Wikipedia match`)
      continue
    }
    const wikiUrl = sum.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
    const attribution = `<p class="wiki-attribution" style="font-size:12px;color:#6b7280;margin:14px 0 0;border-top:1px solid #e5e7eb;padding-top:10px">Background information about ${d.name} adapted from <a href="${wikiUrl}" target="_blank" rel="noopener" style="color:#0d9488">Wikipedia</a>, available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener" style="color:#0d9488">CC&nbsp;BY-SA&nbsp;4.0</a>.</p>`
    const finalBody = body + attribution
    await sql`UPDATE destinations SET body = ${finalBody}, updated_at = now() WHERE id = ${d.id}`
    processed++
    if (processed % 10 === 0) console.log(`  ${processed} done…`)
    await new Promise(r => setTimeout(r, 800)) // wikipedia is fine with reasonable rates but be polite
  } catch (e) {
    failed++
    console.log(`  ✗ ${d.state_code}/${d.slug} — ${e.message}`)
  }
}
console.log(`\n${processed} processed, ${skipped} skipped, ${failed} failed`)
await sql.end()
