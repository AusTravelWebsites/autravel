import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const TARGET = '/new-forest-sporting-activities-for-outdoor-enthusiasts/'
const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const EDITS = [
  {
    slug: 'leisure-activities-1022',
    find: 'Of all the New Forest activities,',
    repl: `Of all the <a href="${TARGET}">New Forest activities</a>,`,
  },
  {
    slug: 'best-cycling-trails-in-new-forest-7862',
    find: 'Now, let’s have a closer look at these rides.</p>',
    repl: 'Now, let’s have a closer look at these rides.</p>\n'
      + '<p>Cycling is only one way to use this ground, though. If you are weighing it up against '
      + `paddling, trail running or fishing, our guide to <a href="${TARGET}">New Forest sporting activities</a> `
      + 'compares the effort, kit and conditions each one asks for.</p>',
  },
]

for (const e of EDITS) {
  const [row] = await sql`SELECT body_html FROM articles WHERE state_code='uk' AND slug=${e.slug}`
  if (!row) { console.error(`${e.slug}: NOT FOUND`); process.exit(1) }
  const n = row.body_html.split(e.find).length - 1
  if (n !== 1) { console.error(`${e.slug}: anchor found ${n}x (need exactly 1) — aborting`); process.exit(1) }
  if (row.body_html.includes(TARGET)) { console.log(`${e.slug}: already linked, skipping`); continue }
  const next = row.body_html.replace(e.find, e.repl)
  await sql`UPDATE articles SET body_html=${next}, updated_at=now() WHERE state_code='uk' AND slug=${e.slug}`
  console.log(`${e.slug}: linked (+${next.length - row.body_html.length} chars)`)
}
await sql.end()
