#!/usr/bin/env node
/**
 * qldtravel /essential-travel-tips-for-planning-a-queensland-family-holiday/ —
 * put a space before the "personal loan calculator" anchor and point it at the
 * calculator page instead of the loancalculator.com.au homepage (Craig,
 * 2026-09-30). The Smartraveller anchor in the same post had the same missing
 * space ("marketing page.<a>") and is fixed alongside it.
 *
 *   node --env-file=.env.local scripts/edit-qld-family-holiday-loan-link.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { writeFileSync } from 'fs'
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const SLUG = 'essential-travel-tips-for-planning-a-queensland-family-holiday'
const EDITS = [
  ['through a<a href="https://www.loancalculator.com.au">personal loan calculator</a>',
   'through a <a href="https://loancalculator.com.au/personal-loan-calculator/">personal loan calculator</a>'],
  ['the marketing page.<a href="https://www.smartraveller.gov.au">Smartraveller</a>',
   'the marketing page. <a href="https://www.smartraveller.gov.au">Smartraveller</a>'],
]

const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [row] = await sql`SELECT id, body_html FROM articles WHERE state_code='qld' AND slug=${SLUG}`
if (!row) { console.error('article not found'); process.exit(1) }

let next = row.body_html
for (const [find, repl] of EDITS) {
  const n = next.split(find).length - 1
  if (n !== 1) { console.error(`matched ${n}x (need exactly 1): ${find.slice(0, 50)}… — aborting`); process.exit(1) }
  next = next.replace(find, repl)
}
const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
for (const want of ['Running the numbers through a personal loan calculator is a painless way',
                    'not just the marketing page. Smartraveller is a decent independent starting point.']) {
  if (!strip(next).includes(want)) { console.error(`rendered text missing: ${want}`); process.exit(1) }
}
if (/[A-Za-z0-9.,;:!?)]<a\b/.test(next)) { console.error('a link is still glued to the preceding word'); process.exit(1) }

console.log('both anchors matched once; rendered text reads correctly; no glued links remain')
if (!APPLY) { console.log('\n(dry run — pass --apply)'); await sql.end(); process.exit(0) }
writeFileSync('/tmp/claude-0/qld-family-holiday-before.html', row.body_html)
await sql`UPDATE articles SET body_html=${next}, updated_at=now() WHERE id=${row.id}`
console.log('\napplied (previous body saved to /tmp/claude-0/qld-family-holiday-before.html)')
await sql.end()
