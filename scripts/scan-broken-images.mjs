#!/usr/bin/env node
// HEAD-check every image URL autravel serves and write broken ones to a CSV.
// Usage: node scripts/scan-broken-images.mjs [--limit=N]
import { readFileSync, writeFileSync } from 'fs'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const url = env.DATABASE_URL_TX_POOL || env.DATABASE_URL_POOL || env.DATABASE_URL
if (!url) { console.error('no DATABASE_URL'); process.exit(1) }
const sql = postgres(url, { prepare: false, max: 4, idle_timeout: 5 })

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]
}))
const LIMIT = args.limit ? parseInt(args.limit, 10) : null
const CONCURRENCY = 24
const TIMEOUT_MS = 8000

const SOURCES = [
  { table: 'autravel.tours',        idCol: 'id', urlCol: 'cover_image', where: 'active AND cover_image IS NOT NULL' },
  { table: 'autravel.parks',        idCol: 'id', urlCol: 'cover_image', where: 'active AND cover_image IS NOT NULL' },
  { table: 'autravel.destinations', idCol: 'id', urlCol: 'hero_image',  where: 'active AND hero_image IS NOT NULL' },
  { table: 'autravel.articles',     idCol: 'id', urlCol: 'cover_image', where: "status='published' AND cover_image IS NOT NULL" },
]

async function fetchAll() {
  const rows = []
  for (const s of SOURCES) {
    const q = `SELECT ${s.idCol}::text AS id, ${s.urlCol} AS url, state_code FROM ${s.table} WHERE ${s.where}${LIMIT ? ` LIMIT ${LIMIT}` : ''}`
    const r = await sql.unsafe(q)
    for (const row of r) rows.push({ table: s.table, col: s.urlCol, id: row.id, url: row.url, state: row.state_code })
  }
  return rows
}

async function headOne(u) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try {
    let r = await fetch(u, { method: 'HEAD', signal: c.signal, redirect: 'follow' })
    // Some CDNs (esp. wordpress.com, certain GMaps configs) refuse HEAD — fall back to a tiny ranged GET.
    if (r.status === 405 || r.status === 403) {
      r = await fetch(u, { method: 'GET', signal: c.signal, redirect: 'follow', headers: { Range: 'bytes=0-1' } })
    }
    return r.status
  } catch (e) {
    return e.name === 'AbortError' ? 599 : 598
  } finally {
    clearTimeout(t)
  }
}

async function runPool(rows, fn, conc) {
  const out = new Array(rows.length)
  let i = 0
  let done = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= rows.length) return
      out[idx] = await fn(rows[idx])
      done++
      if (done % 250 === 0) process.stderr.write(`  ${done}/${rows.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))
  return out
}

console.error(`Loading image URLs from DB${LIMIT ? ` (limit ${LIMIT} per table)` : ''}...`)
const rows = await fetchAll()
console.error(`Got ${rows.length} URLs. HEAD-checking with ${CONCURRENCY} workers...`)

const t0 = Date.now()
const statuses = await runPool(rows, r => headOne(r.url), CONCURRENCY)
const elapsed = ((Date.now() - t0) / 1000).toFixed(0)

const broken = []
for (let i = 0; i < rows.length; i++) {
  const s = statuses[i]
  if (s >= 400) broken.push({ ...rows[i], status: s })
}

console.error(`\nDone in ${elapsed}s. Broken: ${broken.length} / ${rows.length}`)

// Summary by status
const byStatus = {}
for (const b of broken) byStatus[b.status] = (byStatus[b.status] || 0) + 1
console.error('Status breakdown:')
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.error(`  ${k}: ${v}`)
}

// Summary by host
const byHost = {}
for (const b of broken) {
  const host = b.url.split('://')[1]?.split('/')[0] || '?'
  byHost[host] = (byHost[host] || 0) + 1
}
console.error('Host breakdown (top 15):')
for (const [k, v] of Object.entries(byHost).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.error(`  ${v.toString().padStart(5)}  ${k}`)
}

// Summary by table
const byTable = {}
for (const b of broken) byTable[b.table] = (byTable[b.table] || 0) + 1
console.error('Table breakdown:')
for (const [k, v] of Object.entries(byTable).sort((a, b) => b[1] - a[1])) {
  console.error(`  ${v.toString().padStart(5)}  ${k}`)
}

// Write CSV for downstream fix tooling
const lines = ['table,col,id,state,status,url']
for (const b of broken) {
  lines.push([b.table, b.col, b.id, b.state || '', b.status, JSON.stringify(b.url)].join(','))
}
writeFileSync('scripts/broken-images.csv', lines.join('\n') + '\n')
console.error(`\nWrote scripts/broken-images.csv (${broken.length} rows)`)

await sql.end()
