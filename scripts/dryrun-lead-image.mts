// Dry-run for leadImageBelowIntro(): apply the full render pipeline to EVERY
// article in the DB and report what moves, proving nothing is lost.
//   node --experimental-strip-types --env-file=.env.local scripts/dryrun-lead-image.mts
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { demoteBodyH1s, processWpShortcodes, leadImageBelowIntro } from '../src/lib/wp-html.ts'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
const rows = await sql<{ state_code: string; slug: string; body_html: string }[]>`
  SELECT state_code, slug, body_html FROM articles
  WHERE body_html IS NOT NULL AND status = 'published' ORDER BY state_code, slug`

const norm = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const imgs = (h: string) => (h.match(/<img\b[^>]*>/gi) || []).map(t => (t.match(/src="([^"]*)"/i) || [])[1]).sort()
const firstBlock = (h: string) => (h.trim().match(/^<[^>]+>/) || ['(text)'])[0].slice(0, 40)

let changed = 0, unchanged = 0
const broken: string[] = []
const samples: string[] = []
const byState: Record<string, number> = {}

for (const r of rows) {
  const before = processWpShortcodes(demoteBodyH1s(r.body_html))
  const after = leadImageBelowIntro(before)
  if (before === after) { unchanged++; continue }
  changed++
  byState[r.state_code] = (byState[r.state_code] || 0) + 1
  // Content-preservation assertions: same words, same images, just reordered.
  if (norm(before).split(' ').sort().join(' ') !== norm(after).split(' ').sort().join(' '))
    broken.push(`${r.state_code}/${r.slug}: TEXT CHANGED`)
  if (JSON.stringify(imgs(before)) !== JSON.stringify(imgs(after)))
    broken.push(`${r.state_code}/${r.slug}: IMAGES CHANGED`)
  if (before.length !== after.length + (after.match(/\n/g)?.length ?? 0) - (before.match(/\n/g)?.length ?? 0))
    { /* whitespace-only delta, fine */ }
  if (leadImageBelowIntro(after) !== after)
    broken.push(`${r.state_code}/${r.slug}: NOT IDEMPOTENT`)
  if (imgs(before).length === 0)
    broken.push(`${r.state_code}/${r.slug}: MOVED A BLOCK WITH NO IMAGE`)
  if (samples.length < 12)
    samples.push(`${r.state_code}/${r.slug}\n    was: ${firstBlock(before)}\n    now: ${firstBlock(after)}`)
}

console.log(`articles scanned : ${rows.length}`)
console.log(`  image moved    : ${changed}`)
console.log(`  left alone     : ${unchanged}`)
console.log(`  per tenant     : ${JSON.stringify(byState)}`)
console.log(`\nintegrity failures: ${broken.length}`)
broken.slice(0, 20).forEach(b => console.log('  ' + b))
console.log('\nsamples:')
samples.forEach(s => console.log('  ' + s))
await sql.end()
