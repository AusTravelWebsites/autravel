#!/usr/bin/env node
/**
 * Rewrite internal `.html` links inside article bodies to their clean URL.
 *
 * After the .html public URLs were retired, every in-body link to one became a
 * redirect hop. External .html links (other people's sites) are left alone.
 *
 *   node --env-file=.env.local scripts/fix-html-body-links.mjs          # dry run
 *   node --env-file=.env.local scripts/fix-html-body-links.mjs --apply
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const HOSTS = {
  qld:'qldtravel.com.au', nsw:'nswtravel.com.au', vic:'victravel.com.au', wa:'watravel.com.au',
  nt:'nttravel.com.au', sa:'satravel.net.au', tas:'tastravel.net.au', aunz:'aunztravel.com.au',
  perth:'perthtourism.com.au', auex:'theaustralianexplorer.com.au', uk:'new-forest-national-park.com',
}
const OURS = new Set(Object.values(HOSTS).map(h => h.replace(/^www\./, '').toLowerCase()))
const clean = p => '/' + p.replace(/^\/+/, '').replace(/\.html\/?$/i, '').replace(/\/+$/, '') + '/'

// Known-good destinations per tenant. A .html link is only rewritten when its
// clean form actually resolves — otherwise the link is left alone so the
// [...legacy] dead-.html handler (which maps orphans to the nearest destination
// guide) keeps working. Rewriting a dead link would turn a soft landing into a 404.
const good = {}
for (const sc of Object.keys(HOSTS)) good[sc] = new Set()
const addAll = (rows, key) => rows.forEach(r => { if (good[r.state_code]) good[r.state_code].add(r[key]) })
addAll(await sql`SELECT state_code, legacy_path FROM articles WHERE status='published' AND legacy_path IS NOT NULL`, 'legacy_path')
addAll(await sql`SELECT COALESCE(state_code,'') AS state_code, from_path FROM redirects WHERE is_active`, 'from_path')
for (const t of await sql`SELECT state_code, '/' || slug || '/' AS p FROM destinations`) good[t.state_code]?.add(t.p)
for (const t of await sql`SELECT state_code, '/parks/' || slug || '/' AS p FROM parks`) good[t.state_code]?.add(t.p)
const resolves = (sc, path) => {
  const set = good[sc]; if (!set) return false
  return set.has(path) || set.has(path.replace(/\/$/, ''))
}
console.log('known-good paths per tenant:', Object.fromEntries(Object.entries(good).map(([k, v]) => [k, v.size])))

const rows = await sql`
  SELECT id, state_code, slug, body_html FROM articles
  WHERE status='published' AND body_html ~ 'href="[^"]*\.html'`

let internal = 0, external = 0, changedArticles = 0, unresolved = 0
const samples = [], externalHosts = {}
const updates = []

for (const r of rows) {
  const host = HOSTS[r.state_code]
  if (!host) continue
  let n = 0
  const next = r.body_html.replace(/href="([^"]*?\.html\/?)"/gi, (m, href) => {
    let path = null, prefix = ''
    if (/^https?:\/\//i.test(href)) {
      let u; try { u = new URL(href) } catch { return m }
      const bare = u.host.replace(/^www\./, '').toLowerCase()
      // Our own tenant, or a sibling site in the fleet — both are ours to fix.
      // A sibling keeps its absolute URL; only the path loses the .html.
      const isOurs = bare === host.replace(/^www\./, '').toLowerCase() || OURS.has(bare)
      if (!isOurs) { external++; externalHosts[u.host] = (externalHosts[u.host] || 0) + 1; return m }
      path = u.pathname
      if (bare !== host.replace(/^www\./, '').toLowerCase()) prefix = `${u.protocol}//${u.host}`
    } else if (href.startsWith('/')) {
      path = href
    } else {
      return m                       // document-relative: too ambiguous to touch
    }
    // For a sibling-site link, validate against THAT tenant's paths.
    const targetSc = prefix
      ? Object.keys(HOSTS).find(k => HOSTS[k].replace(/^www\./, '') === new URL(href).host.replace(/^www\./, '').toLowerCase())
      : r.state_code
    if (!targetSc || !resolves(targetSc, clean(path))) { unresolved++; return m }
    internal++; n++
    const target = prefix + clean(path)
    if (samples.length < 8) samples.push(`${r.state_code}  ${href}  ->  ${target}`)
    return `href="${target}"`
  })
  if (n > 0) { changedArticles++; updates.push({ id: r.id, body: next }) }
}

console.log(`articles scanned with a .html href : ${rows.length}`)
console.log(`  internal .html links to rewrite  : ${internal}  (across ${changedArticles} articles)`)
console.log(`  external .html links left alone  : ${external}`)
console.log(`  dead .html links left alone      : ${unresolved}  (clean form does not resolve; legacy handler keeps them soft)`)
const top = Object.entries(externalHosts).sort((a,b)=>b[1]-a[1]).slice(0,5)
if (top.length) console.log(`  top external hosts: ${top.map(([h,c])=>`${h} (${c})`).join(', ')}`)
console.log('\nsamples:'); samples.forEach(s => console.log('  ' + s))

if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); await sql.end(); process.exit(0) }
for (const u of updates) {
  await sql`UPDATE articles SET body_html=${u.body}, updated_at=now() WHERE id=${u.id}`
}
console.log(`\nupdated ${updates.length} articles`)
await sql.end()
