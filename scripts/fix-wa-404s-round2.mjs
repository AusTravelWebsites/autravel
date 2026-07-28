#!/usr/bin/env node
// fix-wa-404s-round2.mjs — watravel.com.au (wa tenant) redirect cleanup,
// round 2 (the big cleanup was 2026-07-01, see project_watravel_url_cleanup
// memory; these are new issues that accumulated since then).
//
// 1. Flattens 31 double-hop redirect chains whose to_path still points at
//    the pre-2026-06-24 /destinations/<slug>/ URL. Simple 2-segment targets
//    flatten to /<slug>/ directly; deeper sub-page targets (no equivalent
//    content exists, e.g. /destinations/wyndham/wyndham-accommodation/)
//    retarget straight to the parent destination /<slug>/.
// 2. Inserts new redirects for real 404s in autravel.redirect_404s: destination
//    sub-pages -> parent destination, legacy WP utility pages -> their
//    current equivalent, old sitemap sub-files -> /sitemap.xml, and 3
//    cross-tenant hits (surfers-paradise/gold-coast/port-douglas are real
//    QLD destinations people are hitting on the WA domain) -> the sister
//    qldtravel.com.au page.
//
// Dry-run by default. Pass --apply to write.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false })

async function flattenChains() {
  const rows = await sql`
    SELECT id, from_path, to_path FROM autravel.redirects
    WHERE state_code = 'wa' AND to_path LIKE '/destinations/%'`
  console.log(`\n[flatten] ${rows.length} double-hop redirects found`)
  for (const r of rows) {
    const stripped = r.to_path.replace(/^\/destinations/, '')
    // Deeper sub-page targets (3+ segments) have no equivalent content —
    // retarget to the parent destination instead of just stripping the prefix.
    const segments = stripped.split('/').filter(Boolean)
    const flat = segments.length > 1 ? `/${segments[0]}/` : stripped
    console.log(`  ${r.from_path}  ::  ${r.to_path} -> ${flat}`)
    if (APPLY) await sql`UPDATE autravel.redirects SET to_path = ${flat}, updated_at = now() WHERE id = ${r.id}`
  }
}

const NEW_REDIRECTS = [
  // Destination sub-pages -> canonical destination
  ['/fitzroy-crossing/accommodation/resorts/', '/fitzroy-crossing/'],
  ['/coral-bay/accommodation/hotels/', '/coral-bay/'],
  ['/wyndham/accommodation/resorts/', '/wyndham/'],
  ['/broome/activities/broome-diving/', '/broome/'],
  ['/kununurra/specials/', '/kununurra/'],
  ['/derby/accommodation/hotels/', '/derby/'],
  ['/halls-creek/accommodation/apartments/', '/halls-creek/'],
  ['/el-questro-wilderness-park/emma-gorge-resort/', '/el-questro-wilderness-park/'],

  // Site-utility legacy pages -> current equivalent
  ['/contact-us/', '/contact/'],
  ['/terms-and-conditions/', '/terms/'],
  ['/locations/', '/destinations/'],
  ['/blogs/', '/articles/'],
  ['/page-sitemap.xml', '/sitemap.xml'],
  ['/sitemap_index.xml', '/sitemap.xml'],
  ['/post-sitemap.xml', '/sitemap.xml'],
]

// Cross-tenant: real QLD destinations getting hit on the WA domain (probably
// old bookmarks/backlinks from before the sites were properly siloed by
// state). Absolute redirect to the sister tenant, matching the established
// cross-tenant-link convention (see feedback_proper_and_secure "External
// content rules" in project_autravel memory).
const CROSS_TENANT_REDIRECTS = ['surfers-paradise', 'gold-coast', 'port-douglas']

async function insertNew() {
  console.log(`\n[new-redirects] ${NEW_REDIRECTS.length} same-tenant rows`)
  for (const [from, to] of NEW_REDIRECTS) {
    console.log(`  ${from} -> ${to}`)
    if (APPLY) {
      await sql`
        INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
        VALUES ('wa', ${from}, ${to}, 301, 'exact', true, 'watravel 2026-07-28 404 sweep round 2')
        ON CONFLICT (COALESCE(state_code, ''), from_path) DO UPDATE
          SET to_path = EXCLUDED.to_path, is_active = true, updated_at = now()`
    }
  }

  console.log(`\n[cross-tenant redirects] ${CROSS_TENANT_REDIRECTS.length} rows -> qldtravel.com.au`)
  for (const slug of CROSS_TENANT_REDIRECTS) {
    const to = `https://qldtravel.com.au/${slug}/`
    console.log(`  /${slug}/ -> ${to}`)
    if (APPLY) {
      await sql`
        INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
        VALUES ('wa', ${'/' + slug + '/'}, ${to}, 301, 'exact', true, 'watravel 2026-07-28 404 sweep round 2 - cross-tenant QLD destination')
        ON CONFLICT (COALESCE(state_code, ''), from_path) DO UPDATE
          SET to_path = EXCLUDED.to_path, is_active = true, updated_at = now()`
    }
  }
}

await flattenChains()
await insertNew()

console.log(APPLY ? '\nApplied.' : '\nDry run only — pass --apply to write.')
await sql.end()
