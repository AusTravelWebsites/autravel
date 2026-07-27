#!/usr/bin/env node
// null-tracking-pixel-covers.mjs
//
// Found during the 2026-07-27 nttravel.com.au 404/polish audit: 160 articles
// fleet-wide (35 on nt) have cover_image pointing at
// .../restored/<slug>/jso8-bids-367701-4-subid-0-type-4-gridnum-11.4&su —
// a 43-byte 1x1 tracking-pixel GIF picked up by the Wayback-restore image
// scraper, not a real photo. Confirmed via `curl -I`: content-type image/gif,
// content-length 43. Effects: broken/blank hero image on the article page,
// a tracking pixel served as the og:image/twitter:image social-share image,
// and (until the sitemap.ts XML-escaping fix landed the same day) invalid
// sitemap XML from the raw & in the URL.
//
// This just NULLs cover_image on the affected rows — same remediation as the
// existing "trivial-body articles -> archived" pattern elsewhere in this
// scripts/ directory. Nothing else about the row changes; article body/title
// are unaffected.
//
// Dry-run by default. Pass --apply to write. Pass --state=nt to scope to one
// tenant (default: all tenants, since the same bad pattern is fleet-wide).
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const APPLY = process.argv.includes('--apply')
const STATE = process.argv.find(a => a.startsWith('--state='))?.split('=')[1] || null
const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false })

const rows = await sql`
  SELECT id, state_code, slug FROM autravel.articles
  WHERE cover_image LIKE '%jso8-bids%'
    AND (${STATE}::text IS NULL OR state_code = ${STATE}::text)
  ORDER BY state_code, slug`

console.log(`${rows.length} rows${STATE ? ` (state=${STATE})` : ' (all tenants)'}`)
for (const r of rows) console.log(`  ${r.state_code}/${r.slug}`)

if (APPLY) {
  const result = await sql`
    UPDATE autravel.articles SET cover_image = NULL
    WHERE cover_image LIKE '%jso8-bids%'
      AND (${STATE}::text IS NULL OR state_code = ${STATE}::text)`
  console.log(`\nUpdated ${result.count} rows.`)
} else {
  console.log('\nDry run only — pass --apply to write.')
}
await sql.end()
