#!/usr/bin/env node
/**
 * cluster-consolidate.mjs — merge several overlapping slug trees for one region
 * onto a single canonical destination slug with clean /{slug}/{category}/ URLs.
 * Best row per canonical URL wins (published > page > longest body); the rest are
 * archived; every non-canonical source path 301s to its canonical. Hub articles
 * are archived (the destination row renders the hub) and 301'd to the canonical.
 *
 * Config below is for the South West WA cluster (canonical = south-west).
 *
 *   node --env-file=.env.local scripts/cluster-consolidate.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })

const CANON = 'south-west'
const SOURCES = ['south-west', 'south-west-of-western-australia', 'south-west-western-australia']
const TOKENS = ['south-west-of-western-australia', 'south-west-western-australia', 'south-west'] // longest first

const segsOf = p => p.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean)
const norm = p => { let s=(p||'').trim(); if(!s.startsWith('/'))s='/'+s; if(!s.endsWith('/'))s+='/'; return s }
const stripExt = s => s.replace(/\.(html?|php|aspx?)$/i,'')

const likeClauses = SOURCES.map(s => `legacy_path LIKE '/${s}/%' OR legacy_path='/${s}/'`).join(' OR ')
const rows = await sql.unsafe(`
  SELECT id, legacy_path, title, post_type, status, coalesce(length(body_html),0) blen, updated_at
    FROM autravel.articles
   WHERE state_code='wa' AND status='published' AND legacy_path IS NOT NULL AND (${likeClauses})`)

function toCanonical(path) {
  const s = segsOf(path)
  const rest = s.slice(1).map(seg => {
    let e = stripExt(seg)
    for (const t of TOKENS) { if (e === t) return ''; if (e.startsWith(t+'-')) { e = e.slice(t.length+1); break } }
    return e
  }).filter(Boolean)
  return { target: norm('/' + [CANON, ...rest].join('/')), restLen: rest.length }
}

const hubRows = []          // rows whose path is a source hub
const groups = new Map()    // canonical target → [rows] (with their source path)
for (const r of rows) {
  const { target, restLen } = toCanonical(r.legacy_path)
  if (restLen === 0) { hubRows.push(r); continue }
  if (!groups.has(target)) groups.set(target, [])
  groups.get(target).push(r)
}

// Build plan
const moves = []      // { id, target }  (best row → canonical, published)
const archives = []   // ids to archive
const redirects = []  // { from, to }
for (const [target, list] of groups) {
  const ranked = list.slice().sort((a,b)=>
    (((b.status==='published')?1:0)-((a.status==='published')?1:0)) ||
    ((b.post_type==='page')-(a.post_type==='page')) || (b.blen-a.blen))
  const keep = ranked[0]
  moves.push({ id: keep.id, target, fromPath: norm(keep.legacy_path) })
  for (const r of ranked.slice(1)) archives.push(r.id)
  // redirect every distinct SOURCE path in this group (that isn't already the canonical) → target
  const srcPaths = new Set(list.map(r => norm(r.legacy_path)))
  for (const sp of srcPaths) if (sp !== target) redirects.push({ from: sp, to: target })
}
// hub: archive all hub articles; redirect EVERY non-canonical source hub → /canon/
// (even ones with no article, e.g. the 404ing /south-west-western-australia/).
const canonHub = norm('/'+CANON)
for (const r of hubRows) archives.push(r.id)
const hubFroms = new Set([...hubRows.map(r=>norm(r.legacy_path)), ...SOURCES.map(s=>norm('/'+s))])
for (const hp of hubFroms) if (hp !== canonHub) redirects.push({ from: hp, to: canonHub })

console.log(`canonical targets: ${groups.size}`)
console.log(`moves (best row → canonical): ${moves.length}`)
console.log(`archives (duplicate/hub rows): ${archives.length}`)
console.log(`redirects: ${redirects.length}`)
console.log('\n-- canonical targets & winners --')
for (const m of moves.sort((a,b)=>a.target.localeCompare(b.target))) console.log(`  ${m.fromPath}  ⇒  ${m.target}`)
console.log('\n-- redirects --')
for (const r of redirects.sort((a,b)=>a.from.localeCompare(b.from))) console.log(`  ${r.from}  →  ${r.to}`)

if (!APPLY) { console.log('\n(dry run — add --apply)'); await sql.end(); process.exit(0) }

let mv=0, ar=0, rd=0
await sql.begin(async tx => {
  for (const m of moves) { await tx`UPDATE autravel.articles SET legacy_path=${m.target}, status='published', updated_at=now() WHERE id=${m.id}`; mv++ }
  for (const id of archives) { await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${id}`; ar++ }
  for (const r of redirects) {
    await tx`
      INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
      VALUES ('wa', ${r.from}, ${r.to}, 301, 'exact', true, 'south-west-consolidate')
      ON CONFLICT (COALESCE(state_code,''::text), from_path)
      DO UPDATE SET to_path=EXCLUDED.to_path, is_active=true, redirect_type=301, match_type='exact', notes=EXCLUDED.notes, updated_at=now()`
    rd++
  }
})
console.log(`\nAPPLIED: moved=${mv}, archived=${ar}, redirects=${rd}`)
await sql.end()
