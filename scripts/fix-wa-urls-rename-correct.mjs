#!/usr/bin/env node
/**
 * One-off correction: the first fix-wa-urls apply ranked RENAME keepers by body
 * length only, so where the longest row was an archived Wayback snapshot it
 * renamed THAT (leaving it archived) and archived the originally-published row —
 * 12 clean URLs ended up 404ing. This reconstructs every RENAME target from the
 * pre-change backup: the originally-published (best) row becomes the single
 * published article at the clean URL; siblings are archived back at the source.
 *
 *   node --env-file=.env.local scripts/fix-wa-urls-rename-correct.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })
const SP = '/tmp/claude-0/-root/2389789c-3c0b-40f9-b1a0-0522fc7a2ea7/scratchpad'

// original statuses, keyed by id  (id|status|legacy_path)
const backup = new Map()          // id → { status, legacy_path }
const bySource = new Map()         // original legacy_path → [ids]
const bkFile = readFileSync(SP + '/backup-wa-articles-20260701-135727.tsv', 'utf8')
for (const l of bkFile.split('\n')) {
  const [id, status, legacy_path] = l.split('|')
  if (!id) continue
  backup.set(id, { status, legacy_path })
  if (!bySource.has(legacy_path)) bySource.set(legacy_path, [])
  bySource.get(legacy_path).push(id)
}

// RENAME pairs from the saved plan report:  "SOURCE  →  TARGET"
const plan = readFileSync(SP + '/wa_url_plan.txt', 'utf8').split('\n')
let inRename = false
const pairs = []
for (const l of plan) {
  if (l.startsWith('## RENAME')) { inRename = true; continue }
  if (l.startsWith('## ') && inRename) break
  if (inRename) { const m = l.match(/^(\S+)\s+→\s+(\S+)/); if (m) pairs.push({ source: m[1], target: m[2] }) }
}
console.log(`RENAME pairs parsed: ${pairs.length}`)

// current body lengths for tie-breaking
const lenRows = await sql`SELECT id, coalesce(length(body_html),0) blen, post_type FROM autravel.articles WHERE state_code='wa'`
const meta = new Map(lenRows.map(r => [r.id, { blen: Number(r.blen), post_type: r.post_type }]))

const ops = []
for (const { source, target } of pairs) {
  const ids = bySource.get(source) || []
  if (!ids.length) { console.warn(`  ! no backup rows for source ${source}`); continue }
  // keeper: originally published first, then page, then longest body
  const ranked = ids.slice().sort((a, b) => {
    const pa = backup.get(a).status === 'published' ? 1 : 0
    const pb = backup.get(b).status === 'published' ? 1 : 0
    const ma = meta.get(a) || { blen: 0, post_type: '' }
    const mb = meta.get(b) || { blen: 0, post_type: '' }
    return (pb - pa) || ((mb.post_type === 'page') - (ma.post_type === 'page')) || (mb.blen - ma.blen)
  })
  const keep = ranked[0]
  ops.push({ target, source, keep, others: ranked.slice(1), keepWasPub: backup.get(keep).status === 'published' })
}

// report
let noPub = ops.filter(o => !o.keepWasPub)
console.log(`targets to reconstruct: ${ops.length}`)
console.log(`  keepers that were NOT originally published (force-publish, review): ${noPub.length}`)
for (const o of noPub) console.log(`    ${o.source} → ${o.target}  (keep ${o.keep.slice(0,8)})`)

if (!APPLY) { console.log('\n(dry run — add --apply)'); await sql.end(); process.exit(0) }

let pub = 0, arch = 0
await sql.begin(async tx => {
  for (const o of ops) {
    await tx`UPDATE autravel.articles SET legacy_path=${o.target}, status='published', updated_at=now() WHERE id=${o.keep}`
    pub++
    for (const id of o.others) {
      await tx`UPDATE autravel.articles SET legacy_path=${o.source}, status='archived', updated_at=now() WHERE id=${id}`
      arch++
    }
  }
})
console.log(`\nAPPLIED: published-at-clean-URL=${pub}, siblings-archived=${arch}`)
await sql.end()
