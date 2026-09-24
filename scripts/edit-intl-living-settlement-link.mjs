#!/usr/bin/env node
/**
 * qldtravel /a-guide-to-international-living/ — reword one sentence and add a
 * link on "property settlement timeline" (Craig, 2026-09-24).
 *
 * The sentence already carries an existing calgary.com link on "online
 * resources", which was NOT part of the brief — it is preserved exactly,
 * target/rel and all. The new anchor gets no hand-written target: the render
 * pipeline adds target="_blank" rel="noopener" to every external link.
 *
 *   node --env-file=.env.local scripts/edit-intl-living-settlement-link.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { writeFileSync } from 'fs'
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const PATH_ = '/a-guide-to-international-living/'
const CALGARY = 'https://www.calgary.com/blog/tips-for-first-time-home-sellers-to-sell-their-first-home/'
const TARGET = 'https://www.townsvilleconveyancingcentre.com.au/blog/how-long-after-house-settlement-do-i-get-paid/'
const SPAN = '<span style="font-weight: 400;">'

const FIND =
  `${SPAN}Even though we won't delve into specific tips, it's advisable to scour various </span>` +
  `<a href="${CALGARY}" target="_blank" rel="noopener">${SPAN}online resources</span></a>` +
  `${SPAN} for general advice on how to successfully sell your property.&nbsp;</span>`

const REPL =
  `${SPAN}Even though we will not delve into specific tips, it is worth exploring a range of </span>` +
  `<a href="${CALGARY}" target="_blank" rel="noopener">${SPAN}online resources</span></a>` +
  `${SPAN} for general advice on selling your property successfully, including information about the </span>` +
  `<a href="${TARGET}">${SPAN}property settlement timeline</span></a>` +
  `${SPAN} so you can plan your finances accordingly.&nbsp;</span>`

const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [row] = await sql`SELECT id, body_html FROM articles WHERE state_code='qld' AND legacy_path=${PATH_}`
if (!row) { console.error('article not found'); process.exit(1) }

const n = row.body_html.split(FIND).length - 1
if (n !== 1) { console.error(`source sentence matched ${n}x (need exactly 1) — aborting`); process.exit(1) }
const next = row.body_html.replace(FIND, REPL)

const strip = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const WANT = 'Even though we will not delve into specific tips, it is worth exploring a range of online resources for general advice on selling your property successfully, including information about the property settlement timeline so you can plan your finances accordingly.'
if (!strip(next).includes(WANT)) { console.error('rendered text does not match the requested wording'); process.exit(1) }
if (!next.includes(CALGARY)) { console.error('existing calgary.com link was lost'); process.exit(1) }

console.log('source sentence  : matched once')
console.log('new wording      : exact match')
console.log('existing link    : preserved')
console.log('new anchor       : "property settlement timeline" ->', TARGET.slice(0, 60) + '…')
if (!APPLY) { console.log('\n(dry run — pass --apply)'); await sql.end(); process.exit(0) }
writeFileSync('/tmp/intl-living-before.html', row.body_html)
await sql`UPDATE articles SET body_html=${next}, updated_at=now() WHERE id=${row.id}`
console.log('\napplied (previous body saved to /tmp/intl-living-before.html)')
await sql.end()
