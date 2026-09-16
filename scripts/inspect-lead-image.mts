import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { demoteBodyH1s, processWpShortcodes, leadImageBelowIntro } from '../src/lib/wp-html.ts'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
const outline = (h: string) => {
  const b: string[] = []
  const re = /<(figure|img|h2|h3|p|ul|ol)\b[^>]*>/gi
  let m, n = 0
  while ((m = re.exec(h)) && n < 26) {
    const t = m[1].toLowerCase()
    if (t === 'p' || t === 'ul' || t === 'ol') {
      const txt = h.slice(m.index).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 44)
      b.push(`${t}: ${txt}…`)
    } else if (t === 'figure' || t === 'img') b.push('*** IMAGE ***')
    else b.push(`${t.toUpperCase()}: ${h.slice(m.index).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,44)}`)
    n++
  }
  return b
}
for (const slug of process.argv.slice(2)) {
  const [r] = await sql<{ body_html: string }[]>`SELECT body_html FROM articles WHERE state_code='uk' AND slug=${slug}`
  if (!r) { console.log(`${slug}: NOT FOUND`); continue }
  const before = processWpShortcodes(demoteBodyH1s(r.body_html))
  const after = leadImageBelowIntro(before)
  console.log(`\n${'='.repeat(70)}\n${slug}   ${before === after ? '(unchanged)' : '(image moved)'}\n${'='.repeat(70)}`)
  const A = outline(before), B = outline(after)
  for (let i = 0; i < Math.max(A.length, B.length); i++)
    console.log(`  ${(A[i] || '').padEnd(52).slice(0, 52)} | ${(B[i] || '').slice(0, 52)}`)
}
await sql.end()
