#!/usr/bin/env node
/**
 * Restore images that lost their <img> tag during the WP migration.
 *
 * 177 articles carry `<a href="…/photo.jpg"></a>` — an anchor with no content,
 * pointing at an image that is still on disk. It renders as nothing: the reader
 * loses the picture and the page gains a dead empty link. (Found while editing
 * qld /a-guide-to-international-living/, whose own featured image was missing
 * from the body this way.)
 *
 * Each orphan becomes a real <figure><img>. Alt text is derived from the
 * filename, the toolkit's own content-rules pattern. An image is only restored
 * if the URL actually resolves — a broken <img> is worse than none.
 *
 *   node --env-file=.env.local scripts/restore-orphaned-body-images.mjs [--apply] [--limit N]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
import { TENANTS } from '../src/lib/tenants.ts'

const APPLY = process.argv.includes('--apply')
const li = process.argv.indexOf('--limit')
const LIMIT = li >= 0 ? Number(process.argv[li + 1]) : null

const hostFor = sc => (Object.values(TENANTS)).find(t => t.state_code === sc)?.host
const ORPHAN = /<a href="([^"]+\.(?:jpe?g|png|webp|gif))"[^>]*>\s*<\/a>/gi

/** "A-Guide-To-International-Living-1280x852-1.jpeg" -> "A guide to international living" */
const altFrom = url => {
  let n = decodeURIComponent(url.split('/').pop().replace(/\.[a-z0-9]+$/i, ''))
  n = n.replace(/[-_]+/g, ' ').replace(/\b\d{2,4}x\d{2,4}\b/g, '').replace(/\b(scaled|copy|final|\d+)\b/gi, '')
  n = n.replace(/\s+/g, ' ').trim()
  if (!n) return 'Article illustration'
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const rows = await sql`
  SELECT id, state_code, slug, legacy_path, body_html FROM articles
  WHERE status='published' AND body_html ~ '<a href="[^"]*\.(jpe?g|png|webp|gif)"[^>]*></a>'
  ORDER BY state_code, slug ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`

const checked = new Map()
async function resolves(url) {
  if (checked.has(url)) return checked.get(url)
  let ok = false
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) })
    ok = r.ok && (r.headers.get('content-type') || '').startsWith('image/')
  } catch { ok = false }
  checked.set(url, ok)
  return ok
}

let restored = 0, skippedDead = 0, touched = 0
const perState = {}
for (const a of rows) {
  const host = hostFor(a.state_code); if (!host) continue
  const orphans = [...a.body_html.matchAll(ORPHAN)]
  let body = a.body_html, n = 0
  for (const m of orphans) {
    const raw = m[1]
    const abs = raw.startsWith('http') ? raw : `https://${host}${raw}`
    if (!(await resolves(abs))) { skippedDead++; continue }
    const alt = altFrom(raw)
    const fig = `<figure><img src="${raw}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" /></figure>`
    body = body.replace(m[0], fig)
    n++; restored++
  }
  if (n) {
    touched++
    perState[a.state_code] = (perState[a.state_code] || 0) + n
    if (APPLY) await sql`UPDATE articles SET body_html=${body}, updated_at=now() WHERE id=${a.id}`
  }
}
console.log(`articles with orphaned image anchors : ${rows.length}`)
console.log(`  images restored                    : ${restored} across ${touched} articles`)
console.log(`  skipped (file no longer resolves)  : ${skippedDead}`)
console.log(`  per tenant                         : ${JSON.stringify(perState)}`)
console.log(APPLY ? '\napplied' : '\n(dry run — pass --apply)')
await sql.end()
