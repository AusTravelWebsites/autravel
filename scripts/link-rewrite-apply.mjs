#!/usr/bin/env node
// APPLY the tenant-aware link rewrite to autravel article bodies.
// Backs up every changed body to autravel.articles_link_backup first.
//
//  1. Unwrap dead-sibling-domain anchors (NZ/Pacific/austtravel) -> plain text
//  2. Own-tenant absolute (http/https, www/apex) -> root-relative; .html normalised to NO trailing slash (lands direct)
//  3. .html links -> mapped target ONLY if clean (no '.html' in it); else leave as root-relative no-slash .html
//  4. Other autravel-family tenant http -> https (absolute)
//  5. External http -> https for known-https hosts only

import postgres from 'postgres'
import fs from 'node:fs'

const url = fs.readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL_TX_POOL=')).split('=').slice(1).join('=').trim()
const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 8 })
const APPLY = process.argv.includes('--apply')

const HOSTS = { qld:'qldtravel.com.au', nsw:'nswtravel.com.au', nt:'nttravel.com.au', wa:'watravel.com.au', sa:'satravel.net.au', tas:'tastravel.net.au', vic:'victravel.com.au', aunz:'aunztravel.com.au' }
const FAMILY = new Set(Object.values(HOSTS))
const DEAD = ['new-zealand-travel.com.au','pacific-islands-travel.com.au','austtravel.com.au']
const KNOWN_HTTPS_EXTERNAL = new Set(['www.bom.gov.au','bom.gov.au','www.smartraveller.gov.au','smartraveller.gov.au','www.gbrmpa.gov.au','gbrmpa.gov.au','en.wikipedia.org','www.visitvictoria.com','www.goldcoast.qld.gov.au','wikitravel.org'])
const stripWww = h => h.replace(/^www\./,'')
const norm = p => { try{p=decodeURIComponent(p)}catch{} return p.replace(/\/+$/,'').toLowerCase() }
const deadRe = new RegExp(`<a\\b[^>]*href="https?://(?:www\\.)?(?:${DEAD.map(d=>d.replace(/\./g,'\\.')).join('|')})[^"]*"[^>]*>([\\s\\S]*?)</a>`,'gi')

// clean .html lookup (only values WITHOUT '.html')
const legacyMap = new Map()
for (const a of await sql`SELECT legacy_path FROM autravel.articles WHERE status='published' AND legacy_path IS NOT NULL`)
  if (a.legacy_path && !/\.html/i.test(a.legacy_path)) legacyMap.set(norm(a.legacy_path), a.legacy_path)
for (const r of await sql`SELECT from_path,to_path FROM autravel.redirects WHERE is_active AND match_type='exact'`)
  if (!/\.html/i.test(r.to_path) && !legacyMap.has(norm(r.from_path))) legacyMap.set(norm(r.from_path), r.to_path)

function rewrite(body, st) {
  const ownHost = HOSTS[st]
  let s = body.replace(deadRe, '$1')        // 1. unwrap dead siblings
  s = s.replace(/href="([^"]+)"/gi, (m, href) => {
    let nh = href
    const am = href.match(/^(https?):\/\/([^/"]+)(\/[^"]*)?$/i)
    if (am) {
      const scheme=am[1].toLowerCase(), host=am[2].toLowerCase(), path=am[3]||'/', bare=stripWww(host)
      if (ownHost && (host===ownHost || bare===ownHost)) nh = path                 // 2. own -> relative
      else if (FAMILY.has(bare)) { if (scheme==='http') nh = 'https://'+host+(am[3]||'') } // 4. family http->https
      else if (scheme==='http' && KNOWN_HTTPS_EXTERNAL.has(host)) nh = 'https://'+host+(am[3]||'') // 5. ext
    }
    if (nh.startsWith('/') && /\.html(\/)?($|[?#])/i.test(nh)) {
      const [p,qs=''] = nh.split(/([?#].*)$/)
      const key = norm(p)
      if (legacyMap.has(key)) nh = legacyMap.get(key)                              // 3. clean map
      else nh = p.replace(/\.html\/+/i,'.html') + (qs||'')                          // else .html no trailing slash
    }
    return `href="${nh}"`
  })
  return s
}

let changed = 0, scanned = 0
const rows = await sql`SELECT slug, state_code, body_html FROM autravel.articles WHERE body_html ~ 'href='`
if (APPLY) await sql`CREATE TABLE IF NOT EXISTS autravel.articles_link_backup (slug text, body_html text, backed_up_at timestamptz DEFAULT now())`

for (const r of rows) {
  scanned++
  const nb = rewrite(r.body_html, r.state_code)
  if (nb !== r.body_html) {
    changed++
    if (APPLY) {
      await sql`INSERT INTO autravel.articles_link_backup (slug, body_html) VALUES (${r.slug}, ${r.body_html})`
      await sql`UPDATE autravel.articles SET body_html=${nb}, updated_at=now() WHERE slug=${r.slug}`
    }
  }
}
console.log(`${APPLY?'APPLIED':'DRY'} — scanned ${scanned}, changed ${changed}`)
await sql.end()
