#!/usr/bin/env node
// fix-nt-404s.mjs — nttravel.com.au (nt tenant) redirect cleanup.
//
// Two jobs, both scoped to state_code='nt':
//  1. Flatten ~51 double-hop redirect chains: to_path pointed at the old
//     /destinations/<slug>/ URL, which itself now 308s to /<slug>/ (see the
//     2026-06-26 URL-flatten project). Rewrites to_path to the flat form
//     directly so visitors get a single 301, not two hops.
//  2. Insert new redirects for real 404s surfaced in autravel.redirect_404s
//     (production traffic logs) that have no redirect row yet — sub-pages of
//     an existing destination, dead tour-operator/itinerary pages, hub pages,
//     and legacy map-PDF links. Categorised by hand against the live log
//     (see /tmp/.../scratchpad/nt-404-full.txt from the 2026-07-27 site audit).
//
// Dry-run by default (prints what would change). Pass --apply to write.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false })

// --- Job 1: flatten double-hop chains -------------------------------------
async function flattenChains() {
  const rows = await sql`
    SELECT id, from_path, to_path FROM autravel.redirects
    WHERE state_code = 'nt' AND to_path LIKE '/destinations/%'`
  console.log(`\n[flatten] ${rows.length} double-hop redirects found`)
  for (const r of rows) {
    const flat = r.to_path.replace(/^\/destinations/, '')
    console.log(`  ${r.from_path}  ::  ${r.to_path} -> ${flat}`)
    if (APPLY) await sql`UPDATE autravel.redirects SET to_path = ${flat}, updated_at = now() WHERE id = ${r.id}`
  }
}

// --- Job 1b: reactivate + retarget the two kings-canyon-resort rows -------
// These were deactivated when an article briefly occupied the path; the
// article is gone / was never published at this exact path, and the URL is
// live-404ing (1 hit in the log). Reactivate pointing straight at the flat
// destination URL instead of the old /destinations/ prefix.
async function fixKingsCanyonResort() {
  console.log(`\n[kings-canyon-resort] reactivate + retarget`)
  for (const from of ['/kings-canyon-resort', '/kings-canyon-resort/']) {
    console.log(`  ${from} -> /kings-canyon/ (is_active=true)`)
    if (APPLY) await sql`
      UPDATE autravel.redirects SET to_path = '/kings-canyon/', is_active = true, updated_at = now()
      WHERE state_code = 'nt' AND from_path = ${from}`
  }
}

// --- Job 2: new redirects for logged 404s with no existing row -----------
const NEW_REDIRECTS = [
  // Category A — destination sub-pages -> canonical destination
  ['/alice-springs-activities/', '/alice-springs/'],
  ['/alice-springs-everything/', '/alice-springs/'],
  ['/alice-springs-history/', '/alice-springs/'],
  ['/alice-springs-resorts/', '/alice-springs/'],
  ['/alice-springs-travel-guide/', '/alice-springs/'],
  ['/country/alice-springs/', '/alice-springs/'],
  ['/darwin-accommodation/', '/darwin/'],
  ['/darwin-campervans-motorhomes/', '/darwin/'],
  ['/darwin-fishing-charters/', '/darwin/'],
  ['/darwin-hotels/', '/darwin/'],
  ['/darwin-travel-guide/', '/darwin/'],
  ['/darwin-weather/', '/darwin/'],
  ['/borroloola-and-gulf-everything/', '/borroloola/'],
  ['/borroloola-and-gulf/dining/', '/borroloola/'],
  ['/borroloola-and-gulf/diving/', '/borroloola/'],
  ['/cobourg-peninsula-everything/', '/cobourg-peninsula/'],
  ['/gove-peninsula-everything/', '/gove-peninsula/'],
  ['/kakadu/accommodation/', '/kakadu/'],
  ['/kakadu-arnhem-land/', '/kakadu/'],
  ['/kakadu-national-park-apartments/', '/kakadu/'],
  ['/kakadu-national-park-campervans-and-motorhomes/', '/kakadu/'],
  ['/kakadu-national-park-how-to-get-there/', '/kakadu/'],
  ['/kakadu-national-park-jim-jim-falls/', '/kakadu/'],
  ['/kakadu-national-park-nourlangie-rock/', '/kakadu/'],
  ['/kakadu-national-park-resorts/', '/kakadu/'],
  ['/kakadu-national-park-travel-guide/', '/kakadu/'],
  ['/kakadu-national-park-yellow-water/', '/kakadu/'],
  ['/katherine-accommodation/', '/katherine/'],
  ['/katherine-town/tours-and-rentals/motor-homes-campervan-hire/', '/katherine/'],
  ['/kings-canyon-activities/', '/kings-canyon/'],
  ['/kings-canyon-how-to-get-there/', '/kings-canyon/'],
  ['/kings-canyon/kings-canyon-map/', '/kings-canyon/'],
  ['/litchfield-national-park/tours-and-transfers/extended-tours/', '/litchfield/'],
  ['/uluru-ayers-rock-campervans-and-motorhomes/', '/uluru/'],
  ['/uluru-ayers-rock-history/', '/uluru/'],
  ['/uluru-ayers-rock/tours-and-rentals/extended-tours/', '/uluru/'],
  ['/uluru-ayers-rock-weather/', '/uluru/'],
  ['/central-australia/', '/destinations/'],

  // Category B — dead tour-operator / itinerary / enquiry pages -> /tours/
  ['/aat-kings-short-breaks-darwin-3-day-tours/', '/tours/'],
  ['/adventure-tours-australia-21-day-darwin-sydney/', '/tours/'],
  ['/adventure-tours-australia-3-day-4wd-kakadu-litchfield-safari/', '/tours/'],
  ['/adventure-tours-australia-6-day-alice-springs-darwin-uluru/', '/tours/'],
  ['/adventure-tours-australia-northern-territory/darwin-alice-springs-kakadu/', '/tours/'],
  ['/adventure-tours-australia-northern-territory/darwin-alice-springs-uluru/', '/tours/'],
  ['/enquire/', '/tours/'], // matches both logged ?p_id=... querystrings (redirect matches pathname only)

  // Voyages/Ayers Rock Resort + Peppers Seven Spirit Bay — resort-specific
  // content maps to the destination it's the accommodation base for.
  ['/voyages-ayers-rock-resort-conferences-and-facilities/', '/uluru/'],
  ['/voyages-ayers-rock-resort/conferences-and-facilities/', '/uluru/'],
  ['/voyages-ayers-rock-resort/dining-options/', '/uluru/'],
  ['/tariffs/peppers-seven-spirit-bay/', '/cobourg-peninsula/'],

  // Category C — hub / aggregator pages
  ['/all-northern-territory-destinations/', '/destinations/'],
  ['/all-northern-territory-accommodation/alice-springs-accommodation/', '/alice-springs/'],
  ['/all-northern-territory-accommodation/kakadu-accommodation/', '/kakadu/'],
  ['/all-northern-territory-accommodation/uluru-accommodation/', '/uluru/'],

  // Category D — legacy map PDFs -> destination page (matches the existing
  // active row for kings-canyon-map.pdf)
  ['/images/maps/darwin/map.pdf', '/darwin/'],
  ['/images/maps/kakadu-national-park-map.pdf', '/kakadu/'],
  ['/images/maps/uluru-map.pdf', '/uluru/'],

  // NOTE: /victoria-river/ (10 hits) is deliberately NOT redirected — it's
  // becoming a real destination page in this same pass (see nt-new/victoria-river.html).
]

async function insertNew() {
  console.log(`\n[new-redirects] ${NEW_REDIRECTS.length} rows`)
  for (const [from, to] of NEW_REDIRECTS) {
    console.log(`  ${from} -> ${to}`)
    if (APPLY) {
      await sql`
        INSERT INTO autravel.redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
        VALUES ('nt', ${from}, ${to}, 301, 'exact', true, 'nttravel 2026-07-27 404 sweep')
        ON CONFLICT (COALESCE(state_code, ''), from_path) DO UPDATE
          SET to_path = EXCLUDED.to_path, is_active = true, updated_at = now()`
    }
  }
}

await flattenChains()
await fixKingsCanyonResort()
await insertNew()

console.log(APPLY ? '\nApplied.' : '\nDry run only — pass --apply to write.')
await sql.end()
