#!/usr/bin/env node
/**
 * Retire every `.html` / `.html/` public URL on the autravel fleet.
 *
 * These are pre-WordPress static-site URLs (~2008) carried through the WP
 * migration. Each one is either a duplicate of a clean-slug article or the only
 * copy of a scraped page dump. Either way no public URL should end in .html.
 *
 * For each article served at a .html URL:
 *   - a published clean-slug twin exists -> clear legacy_path (content stays
 *     reachable at /articles/<slug>/) and 301 the .html URL to the twin
 *   - no twin -> rename legacy_path to the clean path and 301 .html -> clean
 *
 * Nothing is deleted and nothing is unpublished.
 *   node --env-file=.env.local scripts/html-url-cleanup.mjs           # dry run
 *   node --env-file=.env.local scripts/html-url-cleanup.mjs --apply
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const clean = p => '/' + p.replace(/^\/+/, '').replace(/\.html\/?$/i, '').replace(/\/+$/, '') + '/'

const rows = await sql`
  SELECT id, state_code, slug, legacy_path FROM articles
  WHERE status='published' AND legacy_path ~ '\.html/?$'
  ORDER BY state_code, legacy_path`

const plan = []
for (const r of rows) {
  const target = clean(r.legacy_path)
  const [twin] = await sql`
    SELECT id, slug FROM articles
     WHERE state_code=${r.state_code} AND legacy_path=${target}
       AND status='published' AND id<>${r.id} LIMIT 1`
  plan.push({ ...r, target, twin: twin ? twin.slug : null })
}

// A target that already redirects away would make the new rule a CHAIN, and
// would also shadow the article (the legacy route checks redirects before it
// renders). Follow the chain to its real destination and aim there instead.
async function resolve(stateCode, path, seen = new Set()) {
  if (seen.has(path) || seen.size > 5) return path
  seen.add(path)
  const [r] = await sql`
    SELECT to_path FROM redirects
     WHERE (state_code=${stateCode} OR state_code IS NULL)
       AND from_path=${path} AND is_active LIMIT 1`
  return r ? resolve(stateCode, r.to_path, seen) : path
}
const loops = plan.filter(p => /\.html\/?$/i.test(p.target))
const redirected = []
for (const p of plan) {
  const final = await resolve(p.state_code, p.target)
  if (final !== p.target) {
    redirected.push({ ...p, existing: final })
    p.final = final
    p.shadowed = true      // its own path is taken by a redirect; don't rename onto it
  } else {
    p.final = p.target
  }
}

const byState = {}
for (const p of plan) byState[p.state_code] = (byState[p.state_code] || 0) + 1
console.log(`.html URLs to retire : ${plan.length}   ${JSON.stringify(byState)}`)
console.log(`  duplicate of a clean twin : ${plan.filter(p => p.twin).length}  (legacy_path cleared, 301 to twin)`)
console.log(`  only copy                 : ${plan.filter(p => !p.twin).length}  (renamed to clean path, 301 added)`)
console.log(`\nloop risks — target still .html      : ${loops.length}`)
console.log(`loop risks — target already redirects : ${redirected.length}`)
redirected.slice(0, 8).forEach(r => console.log(`    ${r.target} -> ${r.existing}  (aiming .html straight here)`))

if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); await sql.end(); process.exit(0) }
if (loops.length) { console.error('\nABORT: targets still end in .html'); await sql.end(); process.exit(1) }

let renamed = 0, cleared = 0, redirects = 0
for (const p of plan) {
  const from = p.legacy_path.replace(/\/$/, '')          // store the no-slash form;
                                                          // findRedirect matches both
  if (p.twin || p.shadowed) {
    await sql`UPDATE articles SET legacy_path=NULL, updated_at=now() WHERE id=${p.id}`
    cleared++
  } else {
    await sql`UPDATE articles SET legacy_path=${p.target}, updated_at=now() WHERE id=${p.id}`
    renamed++
  }
  await sql`
    INSERT INTO redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
    VALUES (${p.state_code}, ${from}, ${p.final}, 301, 'exact', true, 'legacy .html URL retired')
    ON CONFLICT (COALESCE(state_code,''), from_path)
      DO UPDATE SET to_path=EXCLUDED.to_path, is_active=true, updated_at=now()`
  redirects++
}
console.log(`\nrenamed legacy_path : ${renamed}`)
console.log(`cleared legacy_path : ${cleared}`)
console.log(`redirects written   : ${redirects}`)
await sql.end()
