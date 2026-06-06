#!/usr/bin/env node
// polish-audit-schema.mjs — inspect SEO + JSON-LD coverage on each page type per tenant.
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

function flattenSchema(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { node.forEach(n => flattenSchema(n, out)); return out }
  if (node['@graph']) flattenSchema(node['@graph'], out)
  if (node['@type']) out.push(node)
  return out
}

function audit(html, url) {
  const $ = cheerio.load(html)
  const issues = []
  const info = {}

  // Title length
  const title = $('title').text().trim()
  info.title = title
  info.titleLen = title.length
  if (!title) issues.push('no <title>')
  else if (title.length > 65) issues.push(`title too long (${title.length})`)
  else if (title.length < 15) issues.push(`title too short (${title.length})`)

  // Description
  const desc = $('meta[name="description"]').attr('content') || ''
  info.descLen = desc.length
  if (!desc) issues.push('no meta description')
  else if (desc.length > 170) issues.push(`description too long (${desc.length})`)
  else if (desc.length < 50) issues.push(`description too short (${desc.length})`)

  // Canonical absolute
  const canon = $('link[rel="canonical"]').attr('href') || ''
  info.canon = canon
  if (!canon) issues.push('no canonical')
  else if (!canon.startsWith('http')) issues.push('canonical not absolute')

  // OG
  if (!$('meta[property="og:image"]').attr('content')) issues.push('no og:image')
  if (!$('meta[property="og:type"]').attr('content')) issues.push('no og:type')
  if (!$('meta[property="og:url"]').attr('content')) issues.push('no og:url')
  if (!$('meta[name="twitter:card"]').attr('content')) issues.push('no twitter:card')

  // Robots
  const robots = $('meta[name="robots"]').attr('content') || ''
  if (/noindex/i.test(robots)) info.noindex = true

  // viewport
  if (!$('meta[name="viewport"]').attr('content')) issues.push('no viewport meta')

  // Single h1
  const h1Count = $('h1').length
  if (h1Count > 1) issues.push(`${h1Count} h1s`)

  // JSON-LD types
  const types = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html())
      flattenSchema(parsed).forEach(n => {
        const t = Array.isArray(n['@type']) ? n['@type'].join('+') : n['@type']
        types.push(t)
      })
    } catch { issues.push('JSON-LD parse error') }
  })
  info.types = types
  return { issues, info }
}

async function fetchPage(host, path) {
  const url = `https://${host}${path}`
  try {
    const r = await fetch(url, { redirect: 'follow' })
    return { url, status: r.status, html: await r.text() }
  } catch (e) { return { url, error: e.message } }
}

const samples = []
for (const [state, host] of Object.entries(TENANT_HOSTS)) {
  const cond = state === 'aunz' ? sql`TRUE` : sql`state_code=${state}`
  const [tour] = await sql`SELECT slug FROM tours WHERE ${cond} AND active LIMIT 1`
  const [park] = await sql`SELECT slug FROM parks WHERE ${cond} AND active LIMIT 1`
  const [dest] = await sql`SELECT slug FROM destinations WHERE ${cond} AND active LIMIT 1`
  const [article] = await sql`SELECT legacy_path FROM articles WHERE ${cond} AND status='published' AND legacy_path IS NOT NULL LIMIT 1`
  samples.push({ host, type: 'home',     path: '/' })
  samples.push({ host, type: 'tours',    path: '/tours/' })
  samples.push({ host, type: 'parks',    path: '/parks/' })
  samples.push({ host, type: 'destins',  path: '/destinations/' })
  if (tour)    samples.push({ host, type: 'tour',    path: `/tours/${tour.slug}/` })
  if (park)    samples.push({ host, type: 'park',    path: `/parks/${park.slug}/` })
  if (dest)    samples.push({ host, type: 'dest',    path: `/destinations/${dest.slug}/` })
  if (article) samples.push({ host, type: 'article', path: article.legacy_path })
}

console.log(`Auditing ${samples.length} pages…\n`)

// type -> set of all schema types seen
const typeCoverage = {}
const allIssues = []
for (const s of samples) {
  const r = await fetchPage(s.host, s.path)
  if (r.error) { console.log(`  ✗ ${s.host} ${s.type} ${s.path}: ${r.error}`); continue }
  const { issues, info } = audit(r.html, r.url)
  const tag = `${s.type}`
  typeCoverage[tag] ||= { types: new Set(), issues: {}, sample: 0 }
  typeCoverage[tag].sample++
  for (const t of info.types) typeCoverage[tag].types.add(t)
  for (const i of issues) typeCoverage[tag].issues[i] = (typeCoverage[tag].issues[i] || 0) + 1
  if (issues.length) allIssues.push({ ...s, issues, info })
}

console.log('=== schema type coverage by page type ===')
for (const [type, c] of Object.entries(typeCoverage)) {
  console.log(`  ${type.padEnd(10)} (${c.sample}): types=[${[...c.types].join(', ')}]`)
  for (const [issue, n] of Object.entries(c.issues)) console.log(`     ⚠ ${n}× ${issue}`)
}

if (allIssues.length === 0) console.log('\n✓ No SEO/JSON-LD issues found.')
else {
  console.log(`\n=== ${allIssues.length} pages with issues ===`)
  for (const p of allIssues.slice(0, 20)) {
    console.log(`  ${p.host} ${p.type} ${p.path}`)
    console.log(`    title=${p.info.titleLen}c  desc=${p.info.descLen}c  types=[${(p.info.types||[]).join(',')}]`)
    console.log(`    ⚠ ${p.issues.join('; ')}`)
  }
}

await sql.end()
