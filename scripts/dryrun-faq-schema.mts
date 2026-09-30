// Dry-run for extractFaq(): which published articles would gain FAQPage JSON-LD,
// and does every extracted Q&A look like a real visible question and answer?
//   node --experimental-strip-types --env-file=.env.local scripts/dryrun-faq-schema.mts
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { demoteBodyH1s, processWpShortcodes, extractFaq } from '../src/lib/wp-html.ts'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
const rows = await sql<{ state_code: string; slug: string; body_html: string }[]>`
  SELECT state_code, slug, body_html FROM articles
  WHERE body_html IS NOT NULL AND status = 'published' ORDER BY state_code, slug`
let hits = 0, faqHeads = 0
for (const r of rows) {
  const body = processWpShortcodes(demoteBodyH1s(r.body_html))
  if (/<h2\b[^>]*>\s*(?:<[^>]+>\s*)*(?:FAQs?|Frequently asked questions)\b/i.test(body)) faqHeads++
  const faq = extractFaq(body)
  if (!faq.length) continue
  hits++
  console.log(`${r.state_code}/${r.slug}: ${faq.length} Q&A`)
  for (const f of faq) console.log(`   Q ${f.question.slice(0, 90)}\n   A ${f.answer.slice(0, 110)}${f.answer.length > 110 ? '…' : ''}`)
}
console.log(`\n${rows.length} published articles · ${faqHeads} with an FAQ heading · ${hits} gain FAQPage`)
await sql.end()
