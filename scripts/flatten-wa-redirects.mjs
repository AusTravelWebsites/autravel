#!/usr/bin/env node
/**
 * flatten-wa-redirects.mjs — finishing pass after fix-wa-urls.
 *
 * 1. Repoint any active redirect whose to_path is a /destinations/{place}/…
 *    form onto the canonical short URL /{place}/{cleaned-rest}/ (the site already
 *    308s /destinations/{place}/ → /{place}/). Place-name duplication + legacy
 *    .html are stripped, so /destinations/wyndham/wyndham-activities/ →
 *    /wyndham/activities/ instead of dead-ending at the hub.
 * 2. Collapse multi-hop chains: follow each active redirect's to_path through
 *    the active-redirect graph to its ultimate terminus (cycle-safe) and point
 *    straight at it — one hop, no chains.
 * 3. Archive any still-published article sitting at a /destinations/{place}/…
 *    wrong-variant path (it is shadowed by a redirect and never renders).
 *
 *   node --env-file=.env.local scripts/flatten-wa-redirects.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })

const norm = p => { let s=(p||'').trim(); if(!s) return s; if(!s.startsWith('/'))s='/'+s; if(!s.endsWith('/'))s+='/'; return s }
const stripExt = s => s.replace(/\.(html?|php|aspx?)$/i, '')
const segsOf = p => p.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean)

// published canonical article paths (for validating a computed target)
const pub = new Set((await sql`
  SELECT DISTINCT legacy_path FROM autravel.articles
   WHERE state_code='wa' AND status='published' AND legacy_path IS NOT NULL`).map(r => norm(r.legacy_path)))

// The site 308s the BARE /destinations/{place}/ → /{place}/ via the
// destinations/[slug] route (not a redirect-table row, so it isn't in the chain
// graph). Collapse that one route-redirect hop here. DEEPER /destinations/{place}/…
// paths are left to their existing redirect rows — those already encode correct,
// sometimes non-obvious destinations (e.g. el-questro-wilderness-park is its own
// destination), and must NOT be second-guessed.
function destToCanonical(path) {
  const s = segsOf(path)
  if (s.length === 2 && s[0] === 'destinations') return norm('/' + s[1])  // /destinations/place/ → /place/
  return null
}

const redirects = await sql`
  SELECT id, from_path, to_path, is_active FROM autravel.redirects WHERE state_code='wa' AND is_active`

// active from_path → to_path map for chain following
const fmap = new Map()
for (const r of redirects) fmap.set(norm(r.from_path), norm(r.to_path))

// resolve a to_path to its final single-hop terminus
function resolveTerminus(to, fromSelf) {
  let cur = norm(to)
  const seen = new Set([fromSelf])
  for (let i = 0; i < 12; i++) {
    // upgrade /destinations/... intermediates to the clean canonical first
    const dest = destToCanonical(cur)
    if (dest && dest !== cur) { cur = dest; continue }
    const next = fmap.get(cur)
    if (!next || next === cur || seen.has(next)) break     // terminus or cycle guard
    seen.add(cur)
    cur = next
  }
  return cur
}

const updates = []
for (const r of redirects) {
  const from = norm(r.from_path)
  const term = resolveTerminus(r.to_path, from)
  if (term && term !== norm(r.to_path) && term !== from) updates.push({ id: r.id, from, oldTo: norm(r.to_path), newTo: term })
}

// shadowed published articles at /destinations/{place}/{place}… wrong variants
const shadowArticles = await sql`
  SELECT id, legacy_path FROM autravel.articles
   WHERE state_code='wa' AND status='published'
     AND legacy_path ~ '^/destinations/([^/]+)/\\1[-/]'`

console.log(`chain/destinations repoints: ${updates.length}`)
const N = process.argv.includes('--all') ? updates.length : 40
for (const u of updates.slice(0, N)) console.log(`  ${u.from}  |  ${u.oldTo}  →  ${u.newTo}`)
console.log(`shadowed published /destinations wrong-variant articles to archive: ${shadowArticles.length}`)
for (const a of shadowArticles) console.log(`  ${a.legacy_path}`)

if (!APPLY) { console.log('\n(dry run — add --apply)'); await sql.end(); process.exit(0) }

let up = 0, ar = 0
await sql.begin(async tx => {
  for (const u of updates) { await tx`UPDATE autravel.redirects SET to_path=${u.newTo}, updated_at=now() WHERE id=${u.id}`; up++ }
  for (const a of shadowArticles) { await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${a.id}`; ar++ }
})
console.log(`\nAPPLIED: redirects flattened=${up}, shadowed articles archived=${ar}`)
await sql.end()
