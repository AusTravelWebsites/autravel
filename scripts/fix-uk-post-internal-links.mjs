#!/usr/bin/env node
/**
 * Bring two earlier New Forest guest posts up to the page-setup rule: 3 internal
 * links each, every anchor multi-word. Both were shipped with 2, and the wildfire
 * post used single-word anchors ("destinations", "parks") taken verbatim from the
 * brief. Craig's standing rule overrides the brief on anchor wording.
 * Every edit asserts its target appears exactly once.
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const EDITS = [
  { slug: 'how-visitors-change-wildfire-risk-on-open-heath', changes: [
      // widen both single-word anchors onto phrases already in the copy
      { find: `the park's <a href="/destinations/">destinations</a>`,
        repl: `<a href="/destinations/">the park's destinations</a>` },
      { find: 'to other <a href="/parks/">parks</a>',
        repl: 'to <a href="/parks/">other national parks</a>' },
      // third internal link — trails are the right neighbour for a heath-access piece
      { find: 'Much of this ground has no road frontage.',
        repl: 'Much of this ground has no road frontage, and <a href="/park-maps/">the tracks and trails that cross it</a> were never built for fire appliances.' },
    ] },
  { slug: 'new-forest-sporting-activities-for-outdoor-enthusiasts', changes: [
      { find: 'someone comfortable walking continuously for 60 minutes can start with a short, marked loop',
        repl: 'someone comfortable walking continuously for 60 minutes can start with <a href="/park-maps/">a short, waymarked loop</a>' },
    ] },
]

for (const e of EDITS) {
  const [row] = await sql`SELECT body_html FROM articles WHERE state_code='uk' AND slug=${e.slug}`
  if (!row) { console.error(`${e.slug}: NOT FOUND`); process.exit(1) }
  let body = row.body_html
  for (const c of e.changes) {
    const n = body.split(c.find).length - 1
    if (n !== 1) { console.error(`${e.slug}: "${c.find.slice(0, 50)}…" appears ${n}x — aborting`); process.exit(1) }
    body = body.replace(c.find, c.repl)
  }
  const internal = (body.match(/href="\//g) || []).length
  console.log(`${e.slug}: ${(row.body_html.match(/href="\//g) || []).length} -> ${internal} internal links`)
  if (APPLY) await sql`UPDATE articles SET body_html=${body}, updated_at=now() WHERE state_code='uk' AND slug=${e.slug}`
}
console.log(APPLY ? 'applied' : '(dry run — pass --apply)')
await sql.end()
