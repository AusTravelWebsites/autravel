#!/usr/bin/env node
// polish-audit-details.mjs — verify tour/park/destination/article detail pages on multiple tenants.
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
    if (!$('script[type="application/ld+json"]').length) issues.push('no JSON-LD')
    // Only flag BugBitten in visible prose, not CDN URLs in scripts/RSC payload
    const bodyClone = $('body').clone()
    bodyClone.find('script, style').remove()
    const visibleText = bodyClone.text().replace(/media\.bugbitten\.com[^\s"'\\]*/g, '')
    if (/\bBugBitten\b/i.test(visibleText)) issues.push('BugBitten leak')
    return { status: r.status, issues, title: $('title').text().trim() }
  } catch (e) { return { error: e.message } }
}

const samples = []
for (const [state, host] of Object.entries(TENANT_HOSTS)) {
  // aunz is the aggregator — pull samples regardless of state_code
  const stateCond = state === 'aunz' ? sql`TRUE` : sql`state_code=${state}`
  const [tour] = await sql`SELECT slug FROM tours WHERE ${stateCond} AND active LIMIT 1`
  const [park] = await sql`SELECT slug FROM parks WHERE ${stateCond} AND active LIMIT 1`
  const [dest] = await sql`SELECT slug FROM destinations WHERE ${stateCond} AND active LIMIT 1`
  const [article] = await sql`SELECT legacy_path FROM articles WHERE ${stateCond} AND status='published' AND legacy_path IS NOT NULL LIMIT 1`
  if (tour) samples.push({ host, type: 'tour', path: `/tours/${tour.slug}/` })
  if (park) samples.push({ host, type: 'park', path: `/parks/${park.slug}/` })
  if (dest) samples.push({ host, type: 'dest', path: `/destinations/${dest.slug}/` })
  if (article) samples.push({ host, type: 'article', path: article.legacy_path })
}

for (const s of samples) {
  const r = await check(`https://${s.host}${s.path}`)
  if (r.error) { console.log(`  ERR  ${s.host}${s.path}: ${r.error}`); continue }
  const mark = r.issues.length === 0 ? '✓' : '⚠'
  const note = r.issues.length ? `  [${r.issues.join(', ')}]` : ''
  console.log(`  ${mark}  ${r.status}  ${s.type.padEnd(7)}  ${s.host.padEnd(18)} ${s.path.slice(0, 55)}${note}`)
}

await sql.end()
