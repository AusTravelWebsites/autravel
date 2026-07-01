#!/usr/bin/env node
/**
 * kimberley-consolidate.mjs — collapse the two overlapping Kimberley URL trees
 * onto the canonical destination slug `the-kimberley`, with clean category URLs.
 *
 *  source A: /kimberley/{rest}/            (clean nested pages — the good content)
 *  source B: /the-kimberley/kimberley-X/   (ugly flat duplicates)
 *  canonical: /the-kimberley/{category}/   (+ nested), per Craig's URL rule
 *
 * A-pages MOVE to /the-kimberley/{rest}/ (legacy_path rename) and their old URL
 * 301s across. B-pages that duplicate an A-page are archived + 301'd to it;
 * B-pages with no A equivalent are renamed to /the-kimberley/{stripped}/. The
 * /kimberley/ and /the-kimberley/ hub articles are archived (the destination row
 * renders the hub) and 301'd to /the-kimberley/.
 *
 *   node --env-file=.env.local scripts/kimberley-consolidate.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })

const CANON = 'the-kimberley'
const TOKENS = ['the-kimberley', 'kimberley'] // dup tokens stripped from child segments
const segsOf = p => p.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean)
const norm = p => { let s=(p||'').trim(); if(!s.startsWith('/'))s='/'+s; if(!s.endsWith('/'))s+='/'; return s }
const stripExt = s => s.replace(/\.(html?|php|aspx?)$/i,'')

const rows = await sql`
  SELECT id, legacy_path, title, post_type, status, coalesce(length(body_html),0) blen, updated_at
    FROM autravel.articles
   WHERE state_code='wa' AND status='published' AND legacy_path IS NOT NULL
     AND (legacy_path LIKE '/kimberley/%' OR legacy_path='/kimberley/'
          OR legacy_path LIKE '/the-kimberley/%' OR legacy_path='/the-kimberley/')`

const byPath = new Map()
for (const r of rows) { const k=norm(r.legacy_path); if(!byPath.has(k)) byPath.set(k,[]); byPath.get(k).push(r) }

// clean a child path's segments after the leading place slug → canonical /the-kimberley/…
function toCanonical(path) {
  const s = segsOf(path)
  const rest = s.slice(1).map(seg => {
    let e = stripExt(seg)
    for (const t of TOKENS) { if (e === t) return ''; if (e.startsWith(t+'-')) { e = e.slice(t.length+1); break } }
    return e
  }).filter(Boolean)
  return { canonical: norm('/' + [CANON, ...rest].join('/')), leaf: rest[rest.length-1] || '', restLen: rest.length }
}

// A-moves: /kimberley/{rest}/ → /the-kimberley/{rest}/  (rest already clean)
const aMoves = []            // { path, target }
const canonicalPaths = new Set()
const leafIndex = new Map()  // leaf → [target]
for (const [path, list] of byPath) {
  const s = segsOf(path)
  if (s[0] !== 'kimberley') continue
  if (s.length === 1) continue // hub handled separately
  const { canonical, leaf } = toCanonical(path)
  aMoves.push({ path, target: canonical, rows: list })
  canonicalPaths.add(canonical)
  if (!leafIndex.has(leaf)) leafIndex.set(leaf, [])
  leafIndex.get(leaf).push(canonical)
}

const bestOf = paths => paths[0] // A-targets are unique per leaf here; simple

// B-pages: /the-kimberley/kimberley-X/  → resolve to canonical
const plan = []   // { path, target, action:'DUP'|'RENAME', rows }
const renameClaims = new Set()
for (const [path, list] of byPath) {
  const s = segsOf(path)
  if (s[0] !== 'the-kimberley') continue
  if (s.length === 1) continue // hub handled separately
  const { canonical, leaf, restLen } = toCanonical(path)
  let target=null, action=null
  if (restLen === 0) { target = norm('/'+CANON); action='DUP' }
  else if (canonicalPaths.has(canonical)) { target = canonical; action='DUP' }
  else if (leafIndex.has(leaf)) { target = bestOf(leafIndex.get(leaf)); action='DUP' }
  else if (!renameClaims.has(canonical)) { target = canonical; action='RENAME'; renameClaims.add(canonical) }
  else { target = canonical; action='DUP' } // collision → treat as dup of the claimed rename
  if (target !== path) plan.push({ path, target, action, rows: list })
}

// hub articles (/kimberley/ and /the-kimberley/) → archive + redirect to /the-kimberley/
const hubPaths = ['/kimberley/','/the-kimberley/'].filter(h => byPath.has(h))

// report
console.log(`A-moves (/kimberley/… → /the-kimberley/…): ${aMoves.length}`)
console.log(`B-resolve (/the-kimberley/kimberley-… ): ${plan.length}  [DUP=${plan.filter(p=>p.action==='DUP').length} RENAME=${plan.filter(p=>p.action==='RENAME').length}]`)
console.log(`hub articles to archive+redirect: ${hubPaths.length} (${hubPaths.join(', ')})`)
console.log('\n-- A moves --'); for (const a of aMoves.sort((x,y)=>x.path.localeCompare(y.path))) console.log(`  ${a.path}  →  ${a.target}`)
console.log('\n-- B resolve --'); for (const p of plan.sort((x,y)=>x.path.localeCompare(y.path))) console.log(`  ${p.path}  →  ${p.target}  [${p.action}]`)

if (!APPLY) { console.log('\n(dry run — add --apply)'); await sql.end(); process.exit(0) }

const RD = (from,to,note) => sql`
  INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
  VALUES ('wa', ${from}, ${to}, 301, 'exact', true, ${note})
  ON CONFLICT (COALESCE(state_code,''::text), from_path)
  DO UPDATE SET to_path=EXCLUDED.to_path, is_active=true, redirect_type=301, match_type='exact', notes=EXCLUDED.notes, updated_at=now()`

let moved=0, dupArch=0, renamed=0, redir=0, hubArch=0
await sql.begin(async tx => {
  const RDx = (from,to,note)=>tx`
    INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
    VALUES ('wa', ${from}, ${to}, 301, 'exact', true, ${note})
    ON CONFLICT (COALESCE(state_code,''::text), from_path)
    DO UPDATE SET to_path=EXCLUDED.to_path, is_active=true, redirect_type=301, match_type='exact', notes=EXCLUDED.notes, updated_at=now()`
  // A: move best row to target (published), archive extras; redirect old→new
  for (const a of aMoves) {
    const ranked = a.rows.slice().sort((x,y)=> ((y.post_type==='page')-(x.post_type==='page')) || (y.blen-x.blen))
    await tx`UPDATE autravel.articles SET legacy_path=${a.target}, status='published', updated_at=now() WHERE id=${ranked[0].id}`; moved++
    for (const r of ranked.slice(1)) { await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${r.id}`; }
    await RDx(a.path, a.target, 'kimberley-consolidate move'); redir++
  }
  // B: DUP → archive + redirect; RENAME → move + redirect
  for (const p of plan) {
    if (p.action === 'RENAME') {
      const ranked = p.rows.slice().sort((x,y)=> (((y.status==='published')?1:0)-((x.status==='published')?1:0)) || ((y.post_type==='page')-(x.post_type==='page')) || (y.blen-x.blen))
      await tx`UPDATE autravel.articles SET legacy_path=${p.target}, status='published', updated_at=now() WHERE id=${ranked[0].id}`; renamed++
      for (const r of ranked.slice(1)) await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${r.id}`
    } else {
      for (const r of p.rows.filter(r=>r.status==='published')) { await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${r.id}`; dupArch++ }
    }
    await RDx(p.path, p.target, 'kimberley-consolidate '+p.action); redir++
  }
  // hubs
  for (const h of hubPaths) {
    for (const r of byPath.get(h)) { await tx`UPDATE autravel.articles SET status='archived', updated_at=now() WHERE id=${r.id}`; hubArch++ }
    if (h !== norm('/'+CANON)) { await RDx(h, norm('/'+CANON), 'kimberley-consolidate hub'); redir++ }
  }
})
console.log(`\nAPPLIED: A-moved=${moved}, B-renamed=${renamed}, B-dupArchived=${dupArch}, hubArchived=${hubArch}, redirects=${redir}`)
await sql.end()
