// Dry-run for insertAdUnits(): run the FULL render pipeline over every article
// with ads configured, and assert the placement rules hold.
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { demoteBodyH1s, processWpShortcodes, leadImageBelowIntro, externalLinksNewTab, insertAdUnits } from '../src/lib/wp-html.ts'
import { TENANTS } from '../src/lib/tenants.ts'

const AD = (p: string) => `<div class="at-ad" data-placement="${p}"><span class="at-ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block;width:100%;height:280px" data-ad-client="ca-pub-TEST" data-ad-slot="1234567890" data-ad-format="rectangle" data-full-width-responsive="false"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
const ADS = { in_article_1: AD('in_article_1'), in_article_2: AD('in_article_2'), content_end: AD('content_end') }

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
const rows = await sql<{ state_code: string; slug: string; body_html: string }[]>`
  SELECT state_code, slug, body_html FROM articles
  WHERE body_html IS NOT NULL AND status='published' ORDER BY state_code, slug`
const hostFor = (sc: string) => (Object.values(TENANTS) as any[]).find(t => t.state_code === sc)?.host

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const problems: string[] = []
let withAds = 0, noAds = 0, one = 0, two = 0, three = 0
const perTenant: Record<string, number> = {}

for (const r of rows) {
  const host = hostFor(r.state_code); if (!host) continue
  const before = externalLinksNewTab(leadImageBelowIntro(processWpShortcodes(demoteBodyH1s(r.body_html))), host)
  const after = insertAdUnits(before, ADS)
  const n = (after.match(/class="at-ad"/g) || []).length
  if (n === 0) { noAds++; continue }
  withAds++; perTenant[r.state_code] = (perTenant[r.state_code] || 0) + n
  if (n === 1) one++; else if (n === 2) two++; else if (n === 3) three++
  const id = `${r.state_code}/${r.slug}`

  if (n > 3) problems.push(`${id}: ${n} ads (max 3)`)
  // body copy must survive untouched
  const stripAds = after.replace(/<div class="at-ad"[\s\S]*?<\/div>/g, '')
  if (text(stripAds) !== text(before)) problems.push(`${id}: BODY TEXT CHANGED`)
  // images must survive
  if ((stripAds.match(/<img\b/gi) || []).length !== (before.match(/<img\b/gi) || []).length)
    problems.push(`${id}: IMAGE COUNT CHANGED`)
  // never inside a list, figure or table
  for (const m of after.matchAll(/<(ul|ol|figure|table|blockquote)\b[\s\S]*?<\/\1>/gi))
    if (m[0].includes('class="at-ad"')) problems.push(`${id}: AD INSIDE <${m[1]}>`)
  // never stacked directly against an image or another ad
  // Must match the END of an ad block, not any stray </div> in the body copy.
  if (/<\/script><\/div>\s*<div class="at-ad"/.test(after)) problems.push(`${id}: TWO ADS ADJACENT`)
  // content_end is appended after ALL content by design, so a figure directly
  // above it is not a placement defect. Only the in-article slots are checked.
  const inArticleAdjacent =
    /<\/figure>\s*<div class="at-ad" data-placement="in_article/.test(after) ||
    /<div class="at-ad" data-placement="in_article[\s\S]*?<\/script><\/div>\s*<figure/.test(after)
  if (inArticleAdjacent) problems.push(`${id}: AD ADJACENT TO IMAGE`)
  // no ad may sit in the opening: at least 600 chars of copy must precede the first
  const firstAd = after.indexOf('<div class="at-ad"')
  if (firstAd > -1) {
    const above = text(after.slice(0, firstAd)).length
    if (above > 0 && above < 600) problems.push(`${id}: first ad after only ${above} chars of copy`)
  }
  // thin articles must be skipped entirely
  const words = text(before).split(' ').filter(Boolean).length
  if (words < 500) problems.push(`${id}: ads on a ${words}-word article`)
}

console.log(`articles scanned : ${rows.length}`)
console.log(`  carry ads      : ${withAds}   (1 ad: ${one}, 2: ${two}, 3: ${three})`)
console.log(`  skipped (thin) : ${noAds}`)
console.log(`  ad impressions per tenant: ${JSON.stringify(perTenant)}`)
console.log(`\nproblems: ${problems.length}`)
problems.slice(0, 20).forEach(p => console.log('  ' + p))
await sql.end()
