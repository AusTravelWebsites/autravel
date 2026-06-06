#!/usr/bin/env node
// DRY-RUN link analyzer for autravel article bodies. Modifies NOTHING.
// Reports how the tenant-aware rewrite rules would change links, with samples.
//
// Rules:
//  1. Own-tenant absolute (http/https, www/apex) -> root-relative /path
//  2. .html links -> canonical new URL via legacy_path/redirects lookup (else leave)
//  3. Other autravel-family tenant http -> https (keep absolute)
//  4. External http -> https only for known-https hosts (else leave)

import postgres from 'postgres'
import fs from 'node:fs'

const url = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_TX_POOL=')).split('=').slice(1).join('=').trim()
const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 8 })

const HOSTS = {
  qld: 'qldtravel.com.au', nsw: 'nswtravel.com.au', nt: 'nttravel.com.au', wa: 'watravel.com.au',
  sa: 'satravel.net.au', tas: 'tastravel.net.au', vic: 'victravel.com.au', aunz: 'aunztravel.com.au',
}
const FAMILY = new Set(Object.values(HOSTS).concat([
  // dead sibling domains seen in bodies — treat as family for scheme handling, but they 404; flag separately
  'new-zealand-travel.com.au', 'pacific-islands-travel.com.au', 'austtravel.com.au',
]))
const KNOWN_HTTPS_EXTERNAL = new Set([
  'www.bom.gov.au', 'bom.gov.au', 'www.smartraveller.gov.au', 'smartraveller.gov.au',
  'www.gbrmpa.gov.au', 'gbrmpa.gov.au', 'en.wikipedia.org', 'www.visitvictoria.com',
  'www.goldcoast.qld.gov.au', 'wikitravel.org',
])

function stripWww(h) { return h.replace(/^www\./, '') }

// Build .html / legacy -> canonical lookup.
const legacyMap = new Map() // normalized path (no trailing slash, lowercase) -> canonical url path
function norm(p) { try { p = decodeURIComponent(p) } catch {} return p.replace(/\/+$/, '').toLowerCase() }

const arts = await sql`SELECT slug, state_code, legacy_path FROM autravel.articles WHERE status='published'`
for (const a of arts) {
  if (a.legacy_path) legacyMap.set(norm(a.legacy_path), a.legacy_path) // canonical = its own legacy_path
}
const reds = await sql`SELECT state_code, from_path, to_path FROM autravel.redirects WHERE is_active AND match_type='exact'`
for (const r of reds) { if (!legacyMap.has(norm(r.from_path))) legacyMap.set(norm(r.from_path), r.to_path) }

const counts = { articles: 0, changed: 0, ownAbs: 0, htmlMapped: 0, htmlUnmapped: 0, familyHttp: 0, extHttpUpgraded: 0, extHttpLeft: 0, deadSibling: 0 }
const samples = []

const rows = await sql`SELECT slug, state_code, body_html FROM autravel.articles WHERE body_html ~ 'href=' `
for (const row of rows) {
  counts.articles++
  const ownHost = HOSTS[row.state_code]
  let changed = false
  const local = []

  const out = row.body_html.replace(/href="([^"]+)"/gi, (m, href) => {
    let nh = href
    const am = href.match(/^(https?):\/\/([^/"]+)(\/[^"]*)?$/i)
    if (am) {
      const scheme = am[1].toLowerCase(), host = am[2].toLowerCase(), path = am[3] || '/'
      const bare = stripWww(host)
      if (ownHost && (host === ownHost || bare === ownHost)) {
        nh = path; counts.ownAbs++; changed = true
      } else if (FAMILY.has(bare)) {
        if (['new-zealand-travel.com.au','pacific-islands-travel.com.au','austtravel.com.au'].includes(bare)) counts.deadSibling++
        if (scheme === 'http') { nh = 'https://' + host + (am[3] || ''); counts.familyHttp++; changed = true }
      } else if (scheme === 'http') {
        if (KNOWN_HTTPS_EXTERNAL.has(host)) { nh = 'https://' + host + (am[3] || ''); counts.extHttpUpgraded++; changed = true }
        else counts.extHttpLeft++
      }
    }
    // .html handling (after own-domain made relative => nh may be /x/y.html)
    if (/\.html(\/?$|[?#])/i.test(nh) && nh.startsWith('/')) {
      const key = norm(nh.split(/[?#]/)[0])
      if (legacyMap.has(key)) { const canon = legacyMap.get(key); if (canon !== nh) { nh = canon; counts.htmlMapped++; changed = true } }
      else counts.htmlUnmapped++
    }
    if (nh !== href && local.length < 2) local.push({ from: href, to: nh })
    return `href="${nh}"`
  })

  if (changed) {
    counts.changed++
    if (samples.length < 18 && local.length) samples.push({ slug: row.slug, st: row.state_code, ex: local })
  }
}

console.log('\n=== DRY-RUN COUNTS (no changes written) ===')
console.log(JSON.stringify(counts, null, 2))
console.log('\n=== SAMPLE BEFORE/AFTER (first 18 articles) ===')
for (const s of samples) {
  console.log(`\n[${s.st}] ${s.slug}`)
  for (const e of s.ex) console.log(`   - ${e.from}\n     -> ${e.to}`)
}
await sql.end()
