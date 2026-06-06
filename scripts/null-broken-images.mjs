#!/usr/bin/env node
// Read broken-images.csv (produced by scan-broken-images.mjs) and NULL every
// matching DB row. We match by id AND by current URL value, so if a URL has
// been fixed since the scan (e.g. Unsplash → R2), we won't overwrite it.
import { readFileSync } from 'fs'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const url = env.DATABASE_URL_TX_POOL || env.DATABASE_URL_POOL || env.DATABASE_URL
const sql = postgres(url, { prepare: false, max: 4 })

const csv = readFileSync('scripts/broken-images.csv', 'utf8').trim().split('\n')
csv.shift() // header

const rows = csv.map(line => {
  // Parse CSV: table,col,id,state,status,url(JSON-quoted)
  const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]*),([^,]+),(.*)$/)
  if (!m) return null
  return { table: m[1], col: m[2], id: m[3], state: m[4], status: Number(m[5]), url: JSON.parse(m[6]) }
}).filter(Boolean)

console.log(`Loaded ${rows.length} broken rows from CSV`)

let nulled = 0, skipped = 0
const byTable = {}
for (const r of rows) {
  const q = `UPDATE ${r.table} SET ${r.col} = NULL WHERE id::text = $1 AND ${r.col} = $2`
  const result = await sql.unsafe(q, [r.id, r.url])
  if (result.count > 0) {
    nulled++
    byTable[r.table] = (byTable[r.table] || 0) + 1
  } else {
    skipped++
  }
}

console.log(`NULL'd: ${nulled}`)
console.log(`Skipped (URL changed since scan): ${skipped}`)
console.log('By table:')
for (const [t, n] of Object.entries(byTable).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${t}`)

await sql.end()
