#!/usr/bin/env node
// polish-audit-deep.mjs — broken-link + broken-image + JSON-LD validity + 404 hygiene checks.
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

const CONCURRENCY = 8

async function fetchPage(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' })
    const text = await r.text()
    return { status: r.status, text, url: r.url }
  } catch (e) { return { error: e.message } }
}

async function checkHead(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return r.status
  } catch { return 0 }
}

// ---- 1) 404 page hygiene ----
async function check404Page(host) {
  const r = await fetchPage(`https://${host}/this-definitely-does-not-exist-${Math.random().toString(36).slice(2)}/`)
  const issues = []
  if (r.error) return [`fetch failed: ${r.error}`]
  if (r.status !== 404) issues.push(`status=${r.status} (expected 404)`)
  const $ = cheerio.load(r.text)
  if (!$('h1').first().text().trim()) issues.push('no h1')
  if (!/not found|404|page.{0,5}not.{0,5}found/i.test($('body').text())) issues.push('no "not found" message')
  if (!$('a[href="/"]').length && !$('a[href*="home"]').length) issues.push('no link home')
  return issues
}

// ---- 2) JSON-LD validity ----
function checkJsonLd($) {
  const issues = []
  const blocks = $('script[type="application/ld+json"]')
  if (!blocks.length) return ['no JSON-LD']
  for (const el of blocks.toArray()) {
    try {
      const parsed = JSON.parse($(el).html())
      // schema.org-ish sanity: must have @type or @graph
      if (!parsed['@type'] && !parsed['@graph']) issues.push('JSON-LD missing @type/@graph')
    } catch { issues.push('JSON-LD parse error') }
  }
  return issues
}

// ---- 3) broken internal links + broken images ----
async function auditPage(host, path) {
  const r = await fetchPage(`https://${host}${path}`)
  if (r.error) return { fatal: r.error }
  const $ = cheerio.load(r.text)
  const issues = []
  issues.push(...checkJsonLd($))
  // collect internal hrefs (same host or relative)
  const links = new Set()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    if (href.startsWith('/') || href.includes(host)) {
      const u = href.startsWith('/') ? `https://${host}${href}` : href
      links.add(u.split('#')[0])
    }
  })
  // collect cover/og images
  const imgs = new Set()
  const og = $('meta[property="og:image"]').attr('content')
  if (og) imgs.add(og)
  // hero/cover image - first <img> with src on same domain or external
  const firstImg = $('img').first().attr('src')
  if (firstImg) imgs.add(firstImg.startsWith('//') ? 'https:' + firstImg : firstImg)
  return { links: [...links], imgs: [...imgs], issues, status: r.status }
}

// ---- run ----
console.log('=== 404 page hygiene ===')
for (const host of Object.values(TENANT_HOSTS)) {
  const issues = await check404Page(host)
  console.log(`  ${issues.length === 0 ? '✓' : '⚠'} ${host}${issues.length ? '  ['+issues.join(', ')+']' : ''}`)
}

console.log('\n=== sample-page deep audit (4 page types × 8 tenants = 32 pages) ===')
const samples = []
for (const [state, host] of Object.entries(TENANT_HOSTS)) {
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

const allLinks = new Map() // url -> [{host,path,type}, ...]
const allImgs = new Map()  // url -> [{host,path}, ...]
const pageIssues = []

for (const s of samples) {
  const r = await auditPage(s.host, s.path)
  if (r.fatal) { console.log(`  ✗ ${s.host}${s.path} — ${r.fatal}`); continue }
  if (r.issues.length) {
    pageIssues.push({ ...s, issues: r.issues })
  }
  for (const l of r.links) {
    if (!allLinks.has(l)) allLinks.set(l, [])
    allLinks.get(l).push(s)
  }
  for (const i of r.imgs) {
    if (!allImgs.has(i)) allImgs.set(i, [])
    allImgs.get(i).push(s)
  }
}
console.log(`  collected ${allLinks.size} unique internal links, ${allImgs.size} unique images`)
if (pageIssues.length) {
  console.log('\n  JSON-LD / structure issues:')
  for (const p of pageIssues) console.log(`    ⚠ ${p.host} ${p.type} ${p.path.slice(0,55)} → ${p.issues.join(', ')}`)
}

// ---- 4) broken-link probe ----
console.log('\n=== broken-link probe ===')
const linkUrls = [...allLinks.keys()]
const broken = []
let done = 0
async function worker(queue, results) {
  while (queue.length) {
    const u = queue.shift()
    const status = await checkHead(u)
    if (status === 0 || status >= 400) results.push({ url: u, status })
    done++
  }
}
const lq = [...linkUrls]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(lq, broken)))
console.log(`  checked ${done} links, ${broken.length} broken`)
for (const b of broken.slice(0, 30)) console.log(`    ⚠ ${b.status}  ${b.url}  (referrers: ${allLinks.get(b.url).map(s => s.host+s.path).slice(0,2).join(', ')})`)

// ---- 5) broken-image probe ----
console.log('\n=== broken-image probe ===')
const imgUrls = [...allImgs.keys()]
const brokenImgs = []
let imgDone = 0
async function imgWorker(queue, results) {
  while (queue.length) {
    const u = queue.shift()
    const status = await checkHead(u)
    if (status === 0 || status >= 400) results.push({ url: u, status })
    imgDone++
  }
}
const iq = [...imgUrls]
await Promise.all(Array.from({ length: CONCURRENCY }, () => imgWorker(iq, brokenImgs)))
console.log(`  checked ${imgDone} images, ${brokenImgs.length} broken`)
for (const b of brokenImgs.slice(0, 30)) console.log(`    ⚠ ${b.status}  ${b.url.slice(0,80)}  (referrers: ${allImgs.get(b.url).map(s => s.host+s.path).slice(0,2).join(', ')})`)

await sql.end()
