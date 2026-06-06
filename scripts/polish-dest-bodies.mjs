#!/usr/bin/env node
// One-off: polish destination body HTML across all today-built rows.
//  • Rewrite single-word /destinations/<slug>/ anchors to multi-word phrasings
//    ("our X guide", "the X region", "X area" etc.) — sensitive to preceding word.
//  • Cap total internal /destinations/ links at 6 per body. Anything beyond gets
//    its <a> tag stripped (text remains as-is).
//
// Idempotent: re-running on a polished body is a no-op (re-runs preserve already
// multi-word anchors, and the cap only removes when actively over the limit).
import postgres from 'postgres'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('/var/www/autravel/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const sql = postgres(env.DATABASE_URL || env.DATABASE_URL_POOL, { prepare: false })

const MAX_DEST_LINKS = 6

// Regex for an internal destinations link with the FULL match captured separately
const A_TAG_RE = /<a\s+href="(\/destinations\/[^"]+)"([^>]*)>([^<]+)<\/a>/g

// Decide a multi-word phrasing for a single-word place name based on the word(s)
// immediately preceding the anchor in the surrounding prose.
function multiWordAnchor(prev, placeWord) {
  const p = prev.toLowerCase().replace(/[^a-z' ]/g, '').trim()
  const lastWord = p.split(/\s+/).pop() || ''
  // Determiner heuristics — pick the phrasing that flows naturally given context
  if (['our', 'a', 'an', 'their', 'my', 'your', 'his', 'her', 'this', 'that'].includes(lastWord)) {
    return `${placeWord} travel guide`
  }
  if (['the', 'to', 'in', 'from', 'across', 'around', 'visit', 'visited', 'see'].includes(lastWord)) {
    return `${placeWord} area`
  }
  if (['at', 'on', 'near', 'beyond', 'over', 'past'].includes(lastWord)) {
    return `the ${placeWord} area`
  }
  // Sentence-start (period before) or unknown context — default to "our ... guide"
  return `our ${placeWord} guide`
}

function polishBody(body) {
  if (!body) return body
  let working = body
  let changed = false

  // Pass 1: rewrite single-word anchors with context-aware multi-word phrasings.
  // We do this via replaceAll-like iteration using exec so we can inspect text-before.
  const matches = []
  A_TAG_RE.lastIndex = 0
  let m
  while ((m = A_TAG_RE.exec(working)) !== null) {
    matches.push({ index: m.index, length: m[0].length, href: m[1], rest: m[2], text: m[3] })
  }
  // Process in reverse so indices stay valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const t = matches[i]
    const words = t.text.trim().split(/\s+/)
    if (words.length >= 2) continue // already multi-word — leave alone
    // 60 chars of context before the anchor (strip tags so we look at prose)
    const ctxRaw = working.slice(Math.max(0, t.index - 60), t.index)
    const ctxText = ctxRaw.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
    const newText = multiWordAnchor(ctxText, t.text.trim())
    if (newText === t.text.trim()) continue
    const newTag = `<a href="${t.href}"${t.rest}>${newText}</a>`
    working = working.slice(0, t.index) + newTag + working.slice(t.index + t.length)
    changed = true
  }

  // Pass 2: cap total /destinations/ links at MAX_DEST_LINKS.
  // We strip the <a> wrapper on the EXTRA occurrences (keeping the anchor text).
  // Prefer to keep the FIRST occurrence of each unique destination link, then
  // additional uniques up to the cap, dropping later duplicates first.
  const m2 = []
  A_TAG_RE.lastIndex = 0
  while ((m = A_TAG_RE.exec(working)) !== null) {
    m2.push({ index: m.index, length: m[0].length, href: m[1], text: m[3] })
  }
  if (m2.length > MAX_DEST_LINKS) {
    // Mark which to KEEP: first occurrence of each unique href, then additional
    // uniques in order until cap.
    const seen = new Set()
    const keepIdx = new Set()
    for (let i = 0; i < m2.length && keepIdx.size < MAX_DEST_LINKS; i++) {
      if (!seen.has(m2[i].href)) {
        seen.add(m2[i].href)
        keepIdx.add(i)
      }
    }
    // If still under cap, keep additional duplicates from the start
    for (let i = 0; i < m2.length && keepIdx.size < MAX_DEST_LINKS; i++) {
      keepIdx.add(i)
    }
    // Strip <a> wrapper on dropped occurrences, in reverse
    for (let i = m2.length - 1; i >= 0; i--) {
      if (keepIdx.has(i)) continue
      const t = m2[i]
      working = working.slice(0, t.index) + t.text + working.slice(t.index + t.length)
      changed = true
    }
  }

  return { body: working, changed }
}

const rows = await sql`
  SELECT id, state_code, slug, body
    FROM autravel.destinations
   WHERE updated_at > NOW() - INTERVAL '36 hours' AND body IS NOT NULL
   ORDER BY state_code, slug`

console.log(`Polishing ${rows.length} destination bodies…\n`)
let touched = 0
for (const r of rows) {
  const { body: newBody, changed } = polishBody(r.body)
  if (!changed) { console.log(`  [skip] ${r.state_code}/${r.slug} — no changes`); continue }
  await sql`UPDATE autravel.destinations SET body = ${newBody}, updated_at = now() WHERE id = ${r.id}`
  // Count post-fix internal links for the log line
  const after = (newBody.match(/<a\s+href="\/destinations\//g) || []).length
  console.log(`  [fix ] ${r.state_code}/${r.slug} — internal links now ${after}`)
  touched++
}
console.log(`\nDone — ${touched}/${rows.length} bodies updated.`)
await sql.end()
