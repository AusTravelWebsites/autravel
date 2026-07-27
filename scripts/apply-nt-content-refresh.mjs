#!/usr/bin/env node
// apply-nt-content-refresh.mjs — nttravel.com.au (nt tenant) content pillar rollout,
// part of the 2026-07-27 full 404/polish audit.
//
// 1. INSERTs 3 new destination rows — Palmerston and Tennant Creek (2 of NT's
//    5 gazetted cities, alongside the already-live Darwin/Alice Springs/Katherine)
//    and Victoria River (real, demonstrated 404 demand — 10 hits in
//    autravel.redirect_404s with no existing page). Hero images already
//    uploaded to R2 (media.bugbitten.com/autravel/destinations/<slug>.webp).
// 2. UPDATEs 7 existing NT destinations that were far under the site's
//    established 1500-2200 word destination-guide standard (Darwin ~400w,
//    Alice Springs ~270w, Katherine ~320w, Uluru ~220w, Kings Canyon/
//    Litchfield ~130w stubs, MacDonnell Ranges ~250w) with full-length
//    replacement bodies matching the Borroloola reference quality bar.
//
// All body/metadata content was drafted by subagents against a shared style
// guide (see /tmp/.../scratchpad/borroloola-reference.html) and reviewed by
// hand for HTML entity correctness, valid internal-link slugs, and no
// duplicate "our writer" names across pages. Source files:
//   /tmp/claude-0/-root/f8b2fedd-8901-402f-9ec3-3c99bbc35053/scratchpad/nt-new/<slug>.{html,json}
//
// Dry-run by default. Pass --apply to write.
import { readFileSync } from 'fs'
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false })
const DIR = '/tmp/claude-0/-root/f8b2fedd-8901-402f-9ec3-3c99bbc35053/scratchpad/nt-new'

function load(slug) {
  const body = readFileSync(`${DIR}/${slug}.html`, 'utf8').trim()
  const meta = JSON.parse(readFileSync(`${DIR}/${slug}.json`, 'utf8'))
  return { body, ...meta }
}

// New destinations: slug -> { name, region, lat, lng, radius_km, hero_image, display_order }
const NEW = {
  palmerston: {
    name: 'Palmerston', region: 'Top End',
    lat: -12.4818, lng: 130.9829, radius_km: 25,
    hero_image: 'https://media.bugbitten.com/autravel/destinations/palmerston.webp',
    display_order: 40,
  },
  'tennant-creek': {
    name: 'Tennant Creek', region: 'Barkly',
    lat: -19.6500, lng: 134.1900, radius_km: 110,
    hero_image: 'https://media.bugbitten.com/autravel/destinations/tennant-creek.webp',
    display_order: 60,
  },
  'victoria-river': {
    name: 'Victoria River', region: 'Top End',
    lat: -15.6167, lng: 131.0167, radius_km: 90,
    hero_image: 'https://media.bugbitten.com/autravel/destinations/victoria-river.webp',
    display_order: 70,
  },
}

// Existing destinations getting a full body/metadata replacement (name/region/
// lat/lng/hero/display_order untouched — only content columns updated).
const THICKEN = ['darwin', 'alice-springs', 'katherine', 'uluru', 'kings-canyon', 'litchfield', 'macdonnell-ranges']

async function insertNew() {
  console.log(`\n[new destinations] ${Object.keys(NEW).length}`)
  for (const [slug, meta] of Object.entries(NEW)) {
    const c = load(slug)
    console.log(`  + ${slug}  (${c.body.length} chars body, hero=${meta.hero_image})`)
    if (APPLY) {
      await sql`
        INSERT INTO autravel.destinations
          (state_code, slug, name, region, intro, body, lat, lng, radius_km,
           hero_image, active, seo_title, seo_description, display_order)
        VALUES
          ('nt', ${slug}, ${meta.name}, ${meta.region}, ${c.intro}, ${c.body},
           ${meta.lat}, ${meta.lng}, ${meta.radius_km},
           ${meta.hero_image}, true, ${c.seo_title}, ${c.seo_description}, ${meta.display_order})
        ON CONFLICT (state_code, slug) DO UPDATE SET
          intro = EXCLUDED.intro, body = EXCLUDED.body,
          seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
          updated_at = now()`
    }
  }
}

async function updateThickened() {
  console.log(`\n[thickened destinations] ${THICKEN.length}`)
  for (const slug of THICKEN) {
    const c = load(slug)
    console.log(`  ~ ${slug}  (${c.body.length} chars body)`)
    if (APPLY) {
      await sql`
        UPDATE autravel.destinations
        SET intro = ${c.intro}, body = ${c.body},
            seo_title = ${c.seo_title}, seo_description = ${c.seo_description},
            updated_at = now()
        WHERE state_code = 'nt' AND slug = ${slug}`
    }
  }
}

await insertNew()
await updateThickened()

console.log(APPLY ? '\nApplied.' : '\nDry run only — pass --apply to write.')
await sql.end()
