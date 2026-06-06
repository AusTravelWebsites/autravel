#!/usr/bin/env node
// polish-audit-wide.mjs — larger random sample per tenant to catch edge cases.
import postgres from 'postgres'
import * as cheerio from 'cheerio'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const TENANT_HOSTS = {
  qld: 'qldtravel.com.au', nsw: 'nswtravel.com.au', vic: 'victravel.com.au',
  wa: 'watravel.com.au', tas: 'tastravel.net.au', nt: 'nttravel.com.au',
  sa: 'satravel.net.au', aunz: 'aunztravel.com.au',
}

const CONCURRENCY = 6

async function check(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' })
    const text = await r.text()
    const $ = cheerio.load(text)
    const issues = []
    if (r.status !== 200) issues.push('status=' + r.status)
    if (!$('title').text()) issues.push('no <title>')
    if (!$('meta[name="description"]').attr('content')) issues.push('no meta desc')
    if (!$('link[rel="canonical"]').attr('href')) issues.push('no canonical')
    if (!$('meta[property="og:image"]').attr('content')) issues.push('no og:image')
    if (!$('h1').first().text().trim()) issues.push('no h1')
    if ($('h1').length > 1) issues.push(`${$('h1').length} h1s`)
    const bodyClone = $('body').clone()
    bodyClone.find('script, style').remove()
    const visibleText = bodyClone.text().replace(/media\.bugbitten\.com[^\s"'\\]*/g, '')
    if (/\bBugBitten\b/i.test(visibleText)) issues.push('BugBitten leak')
    if (/Lorem ipsum/i.test(visibleText)) issues.push('lorem placeholder')
    // article / post body shouldn't be empty
    const imgs = $('img').length
    if (imgs === 0) issues.push('no images')
    return { status: r.status, issues }
  } catch (e) { return { error: e.message } }
}

const samples = []
for (const [state, host] of Object.entries(TENANT_HOSTS)) {
  const stateCond = state === 'aunz' ? sql`TRUE` : sql`state_code=${state}`
  const tours = await sql`SELECT slug FROM tours WHERE ${stateCond} AND active ORDER BY random() LIMIT 3`
  const parks = await sql`SELECT slug FROM parks WHERE ${stateCond} AND active ORDER BY random() LIMIT 3`
  const dests = await sql`SELECT slug FROM destinations WHERE ${stateCond} AND active ORDER BY random() LIMIT 3`
  const articles = await sql`SELECT legacy_path FROM articles WHERE ${stateCond} AND status='published' AND legacy_path IS NOT NULL ORDER BY random() LIMIT 20`
  for (const t of tours) samples.push({ host, type: 'tour', path: `/tours/${t.slug}/` })
  for (const p of parks) samples.push({ host, type: 'park', path: `/parks/${p.slug}/` })
  for (const d of dests) samples.push({ host, type: 'dest', path: `/destinations/${d.slug}/` })
  for (const a of articles) samples.push({ host, type: 'article', path: a.legacy_path })
}

console.log(`Auditing ${samples.length} pages across ${Object.keys(TENANT_HOSTS).length} tenants…`)

// concurrent worker pool
const issueByTenant = {}
let pass = 0, warn = 0, err = 0
async function worker(queue) {
  while (queue.length) {
    const s = queue.shift()
    const r = await check(`https://${s.host}${s.path}`)
    if (r.error) { err++; console.log(`  ERR  ${s.host}${s.path}: ${r.error}`); continue }
    if (r.issues.length === 0) { pass++; continue }
    warn++
    const key = s.host
    ;(issueByTenant[key] ||= []).push(`${s.type.padEnd(7)} ${s.path.slice(0,60)}  [${r.issues.join(', ')}]`)
  }
}
const queue = [...samples]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))

console.log(`\n✓ ${pass} pass   ⚠ ${warn} warn   ✗ ${err} err`)
for (const [host, msgs] of Object.entries(issueByTenant)) {
  console.log(`\n— ${host}`)
  for (const m of msgs) console.log(`  ⚠ ${m}`)
}

await sql.end()
