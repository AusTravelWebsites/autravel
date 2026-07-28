#!/usr/bin/env node
// apply-wa-content-refresh.mjs — watravel.com.au (wa tenant) content pillar
// rollout, part of the 2026-07-28 full seo/404/site/coding audit.
//
// UPDATEs 8 existing WA destinations that were far under the site's
// established 1500-2200 word standard — two (exmouth-ningaloo,
// pinnacles-desert) had a NULL body (a completely blank page for two of
// WA's biggest tourism icons); the other six (perth, fremantle,
// rottnest-island, albany, broome, margaret-river) were 120-550-word stubs,
// including the state capital itself.
//
// All content drafted by subagents against a shared style brief + the site's
// own live Derby page as a WA-specific voice reference. Source files:
//   /tmp/claude-0/-root/f8b2fedd-8901-402f-9ec3-3c99bbc35053/scratchpad/wa-new/<slug>.{html,json}
//
// Dry-run by default. Pass --apply to write.
import { readFileSync } from 'fs'
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false })
const DIR = '/tmp/claude-0/-root/f8b2fedd-8901-402f-9ec3-3c99bbc35053/scratchpad/wa-new'

function load(slug) {
  const body = readFileSync(`${DIR}/${slug}.html`, 'utf8').trim()
  const meta = JSON.parse(readFileSync(`${DIR}/${slug}.json`, 'utf8'))
  return { body, ...meta }
}

const SLUGS = [
  'exmouth-ningaloo', 'pinnacles-desert',
  'perth', 'fremantle', 'rottnest-island', 'albany', 'broome', 'margaret-river',
]

async function run() {
  console.log(`[wa content refresh] ${SLUGS.length} destinations`)
  for (const slug of SLUGS) {
    const c = load(slug)
    console.log(`  ~ ${slug}  (${c.body.length} chars body)`)
    if (APPLY) {
      await sql`
        UPDATE autravel.destinations
        SET intro = ${c.intro}, body = ${c.body},
            seo_title = ${c.seo_title}, seo_description = ${c.seo_description},
            updated_at = now()
        WHERE state_code = 'wa' AND slug = ${slug}`
    }
  }
}

await run()
console.log(APPLY ? '\nApplied.' : '\nDry run only — pass --apply to write.')
await sql.end()
