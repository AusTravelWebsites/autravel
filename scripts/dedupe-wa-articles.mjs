#!/usr/bin/env node
/**
 * dedupe-wa-articles.mjs — collapse duplicate PUBLISHED rows that share the
 * exact same (clean, canonical) legacy_path. getByLegacyPath() does LIMIT 1 with
 * no ORDER BY, so when a canonical URL has several published rows the renderer
 * picks arbitrarily — sometimes the rich curated page, sometimes a thin Wayback
 * stub. Keep the best row (a real `page` beats a `post`; then longest body; then
 * newest) and archive the rest. Wrong-variant paths are skipped (already handled
 * by fix-wa-urls). Reversible: losers are archived, never deleted.
 *
 *   node --env-file=.env.local scripts/dedupe-wa-articles.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })
const segsOf = p => p.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean)

function isWrongVariant(path) {
  const s = segsOf(path)
  if (s.length < 2) return false
  const place = s[0]
  return s.slice(1).some(seg => seg === place || seg.startsWith(place + '-'))
}

const rows = await sql`
  SELECT id, legacy_path, title, post_type, coalesce(length(body_html),0) blen, updated_at
    FROM autravel.articles
   WHERE state_code='wa' AND status='published' AND legacy_path IS NOT NULL`

const byPath = new Map()
for (const r of rows) {
  if (isWrongVariant(r.legacy_path)) continue
  if (!byPath.has(r.legacy_path)) byPath.set(r.legacy_path, [])
  byPath.get(r.legacy_path).push(r)
}

const groups = []
for (const [path, list] of byPath) {
  if (list.length < 2) continue
  const ranked = list.slice().sort((a, b) =>
    ((b.post_type === 'page') - (a.post_type === 'page')) ||
    // a generic "Western Australia Travel" stub is the low-value duplicate
    ((/^western australia travel$/i.test(a.title||'') ? 1 : 0) - (/^western australia travel$/i.test(b.title||'') ? 1 : 0)) ||
    (b.blen - a.blen) ||
    (new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
  )
  groups.push({ path, keep: ranked[0], archive: ranked.slice(1) })
}

const totalArchive = groups.reduce((n, g) => n + g.archive.length, 0)
console.log(`canonical URLs with duplicate published rows: ${groups.length}`)
console.log(`rows to archive: ${totalArchive}   (rows kept: ${groups.length})`)
console.log('\nsample (keep ⇐ vs archived):')
for (const g of groups.slice(0, 15))
  console.log(`  ${g.path}\n     keep: [${g.keep.post_type} ${g.keep.blen}] ${String(g.keep.title).slice(0,45)}\n     arch: ${g.archive.map(a=>`[${a.post_type} ${a.blen}] ${String(a.title).slice(0,30)}`).join(' | ')}`)

if (!APPLY) { console.log('\n(dry run — add --apply)'); await sql.end(); process.exit(0) }

let archived = 0
await sql.begin(async tx => {
  for (const g of groups) for (const r of g.archive) {
    await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${r.id}`
    archived++
  }
})
console.log(`\nAPPLIED: duplicate rows archived=${archived}, canonical URLs deduped=${groups.length}`)
await sql.end()
