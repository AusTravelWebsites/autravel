#!/usr/bin/env node
/**
 * wayback-deep-search.mjs — for a list of paths that didn't directly match
 * Wayback captures, try VARIANT URLs (older URL formats, alternate slugs)
 * since the same content may have been published at a different URL.
 *
 * Variants tried for `/perth/accommodation/budget-accommodation/`:
 *   /perth/accommodation/budget-accommodation
 *   /perth/accommodation/budget-accommodation.html
 *   /perth/accommodation/budget-accommodation/
 *   /perth/budget-accommodation/
 *   /perth/budget-accommodation.html
 *   /perth-budget-accommodation/
 *   /perth-budget-accommodation.html
 *   /perth/accommodation.html  (parent)
 *
 * Outputs `--out <json>` with {path, found_url, timestamp} for hits.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const arg = (n, d=null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i+1] : d }
const INPUT = arg('input')
const OUT = arg('out')
const DOMAIN = arg('domain') || 'watravel.com.au'
if (!INPUT || !OUT) { console.error('need --input <paths.json> --out <out.json>'); process.exit(1) }

const paths = JSON.parse(readFileSync(INPUT, 'utf8'))
console.log(`Deep-searching Wayback for ${paths.length} paths on ${DOMAIN}`)

function variants(p) {
  const segs = p.replace(/^\/+|\/+$/g, '').split('/')
  if (segs.length === 0) return [p]
  const out = new Set()
  // Original
  out.add(p)
  out.add(p.replace(/\/$/, ''))
  out.add(p.replace(/\/$/, '.html'))
  out.add(p.replace(/\/$/, '.html/'))
  // Drop interior /accommodation/ etc — flat to dash
  if (segs.length >= 3) {
    // /perth/accommodation/budget-accommodation/ → /perth/budget-accommodation/
    out.add('/' + segs[0] + '/' + segs.slice(2).join('/') + '/')
    out.add('/' + segs[0] + '/' + segs.slice(2).join('/'))
    // → /perth-budget-accommodation/
    out.add('/' + segs[0] + '-' + segs.slice(-1)[0] + '/')
    out.add('/' + segs[0] + '-' + segs.slice(-1)[0] + '.html')
    // /perth/accommodation-budget-accommodation/
    out.add('/' + segs[0] + '/' + segs.slice(1).join('-') + '/')
    out.add('/' + segs[0] + '/' + segs.slice(1).join('-') + '.html')
  }
  // /<a>/<b>/ → /<a>-<b>/
  if (segs.length === 2) {
    out.add('/' + segs.join('-') + '/')
    out.add('/' + segs.join('-') + '.html')
  }
  // /<a>/ → /<a>.html
  if (segs.length === 1) {
    out.add('/' + segs[0] + '.html')
  }
  // Remove dupes + filter falsy/leading-double-slash etc
  return [...out].filter(v => v && v.startsWith('/'))
}

async function probe(domain, path) {
  const url = `https://archive.org/wayback/available?url=${encodeURIComponent(domain + path)}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const d = await r.json()
    const snap = d?.archived_snapshots?.closest
    return snap?.available ? { ts: snap.timestamp, original: snap.url } : null
  } catch { return null }
}

const hits = []
const misses = []
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let i = 0
for (const p of paths) {
  i++
  const vars = variants(p)
  let found = null
  for (const v of vars) {
    const r = await probe(DOMAIN, v)
    if (r) { found = { variant: v, ts: r.ts, original: r.original }; break }
    await sleep(150)
  }
  if (found) {
    hits.push({ path: p, variant: found.variant, timestamp: found.ts, archive_url: found.original })
    console.log(`  ✓ [${i}/${paths.length}] ${p}  ←  ${found.variant}  (${found.ts})`)
  } else {
    misses.push({ path: p, tried: vars })
    console.log(`  ✗ [${i}/${paths.length}] ${p}  (tried ${vars.length} variants)`)
  }
  await sleep(300)
}

writeFileSync(OUT, JSON.stringify({ hits, misses }, null, 2))
console.log(`\nDone: ${hits.length} hits, ${misses.length} misses → ${OUT}`)
