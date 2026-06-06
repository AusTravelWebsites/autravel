#!/usr/bin/env node
// scan-404s.mjs — produce a per-tenant 404 report, filtering out bots/crawlers.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const TENANTS = {
  qld: 'qldtravel.com.au', nsw: 'nswtravel.com.au', vic: 'victravel.com.au',
  wa: 'watravel.com.au', tas: 'tastravel.net.au', nt: 'nttravel.com.au',
  sa: 'satravel.net.au', aunz: 'aunztravel.com.au',
}

// Recognised bot/crawler/security-scan user agents — stripped from the report.
const BOT_RE = /(bot\b|crawler|spider|slurp|search|fetch|preview|monitoring|uptime|pingdom|wget|curl\/|python-requests|axios|libwww|httpclient|java\/|go-http|okhttp|scrap|scanner|nuclei|sqlmap|nmap|nikto|wpscan|masscan|petalbot|semrush|ahrefs|moz\.com|dotbot|exabot|yandex|baidu|duckduckbot|applebot|linkdex|mj12|seznam|rogerbot|screaming|coccoc|redditbot|telegrambot|whatsapp|facebookexternalhit|facebot|linkedinbot|twitterbot|skypeuripreview|discordbot|googlebot|bingbot|aolbuild|sogou|qwantify|gluten free crawler|netcraftsurveyagent|spbot|ningalls|barkrowler|monsido|dataforseoBot)/i
// Common WP-attack and obvious-noise paths — also filter these even if UA looks human.
const NOISE_PATH_RE = /(\/(wp-login|wp-includes|xmlrpc|wp-admin|administrator|cgi-bin|\.env|\.git|phpmyadmin|adminer|setup-config|console)|\.php(\?|$|\/)|\.aspx?(\?|$|\/)|\.asp(\?|$|\/)|\.cgi(\?|$|\/)|\.jsp(\?|$|\/)|\.bak(\?|$|\/)|wp-config|sitemap_index)/i

function isBot(ua) {
  if (!ua) return true // empty UA → bot
  if (ua.length < 20) return true // way too short for any real browser
  if (BOT_RE.test(ua)) return true
  return false
}

function isNoise(path) {
  return NOISE_PATH_RE.test(path)
}

function classify(path) {
  if (/^\/wp-/.test(path) || /\.php/.test(path) || /\.aspx?/.test(path)) return 'wp-attack'
  if (/^\/(\.|admin|administrator)/.test(path)) return 'attack-probe'
  if (/^\/feed\/?$/.test(path) || /^\/rss/.test(path) || /\/feed\//.test(path)) return 'rss-leftover'
  if (/^\/category\//.test(path) || /^\/tag\//.test(path)) return 'wp-taxonomy'
  if (/^\/author\//.test(path)) return 'wp-author'
  if (/\.html?$/i.test(path)) return 'old-html'
  if (/^\/[^/]+\.(jpg|jpeg|png|gif|webp|svg|ico|pdf)$/i.test(path)) return 'asset-leftover'
  return 'content'
}

const rows = await sql`
  SELECT state_code, path, hit_count, first_seen_at, last_seen_at, user_agent, referrer
  FROM redirect_404s
  ORDER BY hit_count DESC NULLS LAST, last_seen_at DESC
`

const real = rows.filter(r => !isBot(r.user_agent) && !isNoise(r.path))
const bots = rows.length - real.length

console.log(`# 404 report — autravel\n`)
console.log(`Total 404 records: **${rows.length}**`)
console.log(`Cumulative hits:   **${rows.reduce((a, r) => a + (r.hit_count || 0), 0)}**`)
console.log(`After filtering bots / WP-attacks: **${real.length}** unique URLs, **${real.reduce((a, r) => a + (r.hit_count || 0), 0)}** hits`)
console.log(`(Stripped ${bots} bot/noise records.)\n`)

// Per-tenant report
const byTenant = {}
for (const r of real) (byTenant[r.state_code] ||= []).push(r)

const sorted = Object.entries(byTenant).sort((a, b) =>
  b[1].reduce((x, r) => x + (r.hit_count || 0), 0) -
  a[1].reduce((x, r) => x + (r.hit_count || 0), 0)
)

for (const [state, items] of sorted) {
  const host = TENANTS[state] || state
  const tenantHits = items.reduce((a, r) => a + (r.hit_count || 0), 0)
  console.log(`\n## ${host}  —  ${items.length} URL${items.length === 1 ? '' : 's'}, ${tenantHits} hit${tenantHits === 1 ? '' : 's'}\n`)
  console.log('| Hits | Last seen | Path | Type |')
  console.log('|------|-----------|------|------|')
  for (const r of items.slice(0, 30)) {
    const last = new Date(r.last_seen_at).toISOString().slice(0, 10)
    const type = classify(r.path)
    const path = r.path.length > 70 ? r.path.slice(0, 70) + '…' : r.path
    console.log(`| ${r.hit_count || 1} | ${last} | \`${path}\` | ${type} |`)
  }
  if (items.length > 30) console.log(`\n_… and ${items.length - 30} more (showing top 30)._`)
}

// Top-N across all tenants by hit count
console.log('\n\n## Top URLs across all tenants (real traffic)\n')
const top = real.slice().sort((a, b) => (b.hit_count || 0) - (a.hit_count || 0)).slice(0, 25)
console.log('| Hits | Tenant | Path | Type |')
console.log('|------|--------|------|------|')
for (const r of top) {
  const type = classify(r.path)
  const path = r.path.length > 60 ? r.path.slice(0, 60) + '…' : r.path
  console.log(`| ${r.hit_count || 1} | ${r.state_code} | \`${path}\` | ${type} |`)
}

// Type distribution
const byType = {}
for (const r of real) {
  const t = classify(r.path)
  if (!byType[t]) byType[t] = { records: 0, hits: 0 }
  byType[t].records++
  byType[t].hits += r.hit_count || 0
}
console.log('\n## Type distribution\n')
console.log('| Type | URLs | Hits |')
console.log('|------|------|------|')
for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].hits - a[1].hits)) {
  console.log(`| ${t} | ${v.records} | ${v.hits} |`)
}

// Suggested redirects: any 404 with ≥2 hits, smart-matched against existing
// parks/destinations/articles in the same state.
console.log('\n## Suggested redirects (≥2 hits, smart-matched)\n')

// Pre-load slugs per state for matching
const parkBySlug = {}, destBySlug = {}, destByName = {}
for (const p of await sql`SELECT state_code, slug FROM parks WHERE active`) {
  parkBySlug[`${p.state_code}:${p.slug}`] = p.slug
}
for (const d of await sql`SELECT state_code, slug, name FROM destinations WHERE active`) {
  destBySlug[`${d.state_code}:${d.slug}`] = d.slug
  destByName[`${d.state_code}:${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`] = d.slug
}

function suggest(state, path) {
  // Strip query
  const clean = path.split('?')[0]
  // Old WP `/dir(...)/listing/<slug>/` → /parks/<slug>/ if the slug matches a park
  let m = clean.match(/^\/(?:directory[^/]*|directory-listing|lis)\/(?:listing\/)?([^/]+?)\/?$/)
  if (m) {
    const slug = m[1]
    if (parkBySlug[`${state}:${slug}`]) return `/parks/${slug}/`
  }
  // /lis/<region>/<slug>/ → /parks/<slug>/
  m = clean.match(/^\/lis\/[^/]+\/([^/]+)\/?$/)
  if (m && parkBySlug[`${state}:${m[1]}`]) return `/parks/${m[1]}/`
  // <slug>.html → <slug>/  (then check if any matching dest)
  if (/\.html?$/i.test(clean)) {
    const slugged = clean.replace(/\.html?$/i, '').replace(/^\//, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (destByName[`${state}:${slugged}`]) return `/destinations/${destByName[`${state}:${slugged}`]}/`
    return clean.replace(/\.html?$/i, '/')
  }
  // Author archive
  if (/^\/author\//.test(clean)) return '/authors/'
  // /feed | /tag/* | /category/* | /sitemap/* | mentions-legales | nous-contacter (FR)
  if (/^\/feed/.test(clean)) return '/'
  if (/^\/(tag|category|sitemap)\//.test(clean)) return '/'
  if (/^\/(mentions-legales|nous-contacter|contactez-nous|legal)\/?$/.test(clean)) return '/contact/'
  // /<destination>/<topic>/ — strip topic and try to match destination
  m = clean.match(/^\/([a-z0-9-]+)\/[a-z0-9-]+\/?$/)
  if (m && destByName[`${state}:${m[1]}`]) return `/destinations/${destByName[`${state}:${m[1]}`]}/`
  // /<destination-with-topic>-<thing>/  e.g. /katherine-accommodation/
  m = clean.match(/^\/([a-z0-9-]+?)-(?:accommodation|apartments|backpackers|cruises|tours|hotels|resorts|history|weather|map|attractions|car-hire|holidays-with-kids|holidays|dining|day-tours|campervans-and-motorhomes|tours-and-rentals|travel-guide|specials|everything|getting-there|airport-accommodation|fishing|developments|real-estate|wineries|conferences|luxury-accommodation|budget-accommodation|snow-accommodation|airport)\/?$/)
  if (m && destByName[`${state}:${m[1]}`]) return `/destinations/${destByName[`${state}:${m[1]}`]}/`
  // /<destination>-something/ where destination matches
  m = clean.match(/^\/([a-z0-9-]+?)-[a-z0-9-]+\/?$/)
  if (m && destByName[`${state}:${m[1]}`]) return `/destinations/${destByName[`${state}:${m[1]}`]}/`
  return null
}

const suggestions = real.filter(r => (r.hit_count || 0) >= 2 && classify(r.path) !== 'wp-attack')
console.log('| Hits | Tenant | Path | Suggested target |')
console.log('|------|--------|------|------------------|')
let autoMatched = 0
for (const r of suggestions.slice(0, 40)) {
  const target = suggest(r.state_code, r.path)
  if (target) autoMatched++
  console.log(`| ${r.hit_count} | ${r.state_code} | \`${r.path.slice(0, 70)}\` | ${target ? '`' + target + '`' : '(needs review)'} |`)
}
console.log(`\n_Auto-matched **${autoMatched}** of the top ${Math.min(40, suggestions.length)} (≥2-hit) URLs to an existing park/destination/contact._`)

await sql.end()
