// Dry-run for externalLinksNewTab(): apply the full render pipeline to every
// article and prove (a) every off-site link gets target=_blank + noopener,
// (b) no internal link is touched, (c) hrefs and rel tokens are preserved.
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { demoteBodyH1s, processWpShortcodes, leadImageBelowIntro, externalLinksNewTab } from '../src/lib/wp-html.ts'
import { TENANTS } from '../src/lib/tenants.ts'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
const rows = await sql<{ state_code: string; slug: string; body_html: string }[]>`
  SELECT state_code, slug, body_html FROM articles
  WHERE body_html IS NOT NULL AND status='published' ORDER BY state_code, slug`

const hostFor = (sc: string) => (Object.values(TENANTS) as any[]).find(t => t.state_code === sc)?.host

const anchors = (h: string) => [...h.matchAll(/<a\b([^>]*)>/gi)].map(m => m[1])
// hrefs in migrated WP bodies use single quotes as often as double — match both,
// or single-quoted external links get misread as internal.
const hrefOf = (a: string) =>
  (a.match(/href\s*=\s*"([^"]*)"/i) || a.match(/href\s*=\s*'([^']*)'/i) || [])[1] || ''
const isExt = (href: string, host: string) => {
  if (!href || /^(?:#|\/|\?|mailto:|tel:|sms:|javascript:|data:)/i.test(href.trim())) return false
  if (!/^(https?:)?\/\//i.test(href.trim())) return false
  try {
    const u = new URL(href.trim().startsWith('//') ? 'https:' + href.trim() : href.trim())
    return u.host.replace(/^www\./, '').toLowerCase() !== host.replace(/^www\./, '').toLowerCase()
  } catch { return false }
}

let ext = 0, opened = 0, alreadyTargeted = 0, internalTouched = 0, hrefLost = 0, relLost = 0, scanned = 0
const problems: string[] = []

for (const r of rows) {
  const host = hostFor(r.state_code); if (!host) continue
  scanned++
  const before = leadImageBelowIntro(processWpShortcodes(demoteBodyH1s(r.body_html)))
  const after = externalLinksNewTab(before, host)
  const A = anchors(before), B = anchors(after)
  if (A.length !== B.length) { problems.push(`${r.state_code}/${r.slug}: ANCHOR COUNT ${A.length}→${B.length}`); continue }
  for (let i = 0; i < A.length; i++) {
    const href = hrefOf(A[i])
    if (hrefOf(B[i]) !== href) { hrefLost++; problems.push(`${r.state_code}/${r.slug}: href changed`) }
    const relBefore = ((A[i].match(/rel\s*=\s*"([^"]*)"/i) || A[i].match(/rel\s*=\s*'([^']*)'/i) || [])[1] || '').split(/\s+/).filter(Boolean)
    const relAfter = new Set(((B[i].match(/rel\s*=\s*"([^"]*)"/i) || [])[1] || '').split(/\s+/).filter(Boolean))
    if (!relBefore.every(t => relAfter.has(t))) { relLost++; problems.push(`${r.state_code}/${r.slug}: rel token dropped`) }
    if (isExt(href, host)) {
      ext++
      if (/target\s*=/i.test(A[i])) alreadyTargeted++
      else if (/target\s*=\s*"_blank"/i.test(B[i]) && /noopener/i.test(B[i])) opened++
      else problems.push(`${r.state_code}/${r.slug}: EXTERNAL NOT OPENED → ${href.slice(0, 70)}`)
    } else if (A[i] !== B[i]) {
      internalTouched++
      problems.push(`${r.state_code}/${r.slug}: INTERNAL LINK MODIFIED → ${href.slice(0, 70)}`)
    }
  }
}

console.log(`articles scanned      : ${scanned}`)
console.log(`external links found  : ${ext}`)
console.log(`  newly opened        : ${opened}`)
console.log(`  already had target  : ${alreadyTargeted}`)
console.log(`internal links touched: ${internalTouched}`)
console.log(`hrefs changed         : ${hrefLost}`)
console.log(`rel tokens dropped    : ${relLost}`)
console.log(`\nproblems: ${problems.length}`)
problems.slice(0, 15).forEach(p => console.log('  ' + p))
await sql.end()
