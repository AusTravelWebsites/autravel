#!/usr/bin/env node
/**
 * upload-perth-dest-images.mjs — give every Perth Tourism destination a unique,
 * relevant Unsplash photo: search via the Unsplash API, optimise to a 2000×1100
 * WebP, upload to R2 (media.bugbitten.com/autravel/destinations/<slug>.webp), and
 * set destinations.hero_image. Dedupes so no two destinations share a photo.
 *
 *   node --env-file=.env.local scripts/upload-perth-dest-images.mjs [--force]
 */
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import postgres from 'postgres'

const FORCE = process.argv.includes('--force')
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, UNSPLASH_ACCESS_KEY, DATABASE_URL } = env
const BUCKET = 'bugbitten-media', PUBLIC = 'https://media.bugbitten.com'

const s3 = new S3Client({
  region: 'auto', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})
const sql = postgres(DATABASE_URL, { prepare: false, max: 2 })

// Per-destination query chains: specific first, broader fallbacks after (some
// niche queries return zero Unsplash results, so we degrade gracefully).
const QUERIES = {
  'perth': ['Perth city skyline', 'Perth Western Australia', 'Kings Park Perth'],
  'fremantle': ['Fremantle harbour', 'Fremantle Western Australia', 'Fremantle port'],
  'rottnest-island': ['Rottnest Island', 'Rottnest beach', 'quokka beach Australia'],
  'swan-valley': ['Swan Valley vineyard', 'vineyard Western Australia', 'Australian winery vineyard'],
  'perth-hills': ['Perth Hills', 'jarrah forest Australia', 'Australian bush forest'],
  'mandurah': ['Mandurah', 'Mandurah estuary', 'Australian estuary boats'],
  'margaret-river': ['Margaret River coast', 'Margaret River', 'Western Australia surf coast'],
  'albany': ['Albany Western Australia', 'Albany coast', 'rugged coastline Western Australia'],
  'esperance': ['Esperance beach', 'Esperance Western Australia', 'white sand beach turquoise Australia'],
  'kalbarri': ['Kalbarri gorge', 'Kalbarri National Park', 'Murchison River gorge', 'red gorge Australia'],
  'exmouth-ningaloo': ['Ningaloo Reef', 'Exmouth Western Australia', 'coral reef snorkel Australia'],
  'karijini': ['Karijini gorge', 'Karijini National Park', 'Pilbara gorge', 'red rock gorge Australia'],
}

const usedIds = new Set()
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function searchOne(query) {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&content_filter=high`
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' } })
  if (!r.ok) throw new Error(`unsplash ${r.status}: ${(await r.text()).slice(0, 120)}`)
  const d = await r.json()
  return (d.results || []).find(p => !usedIds.has(p.id)) || null
}

async function searchPhoto(queries) {
  for (const q of queries) {
    const pick = await searchOne(q)
    if (pick) { usedIds.add(pick.id); return { raw: pick.urls.raw, credit: `${pick.user?.name || 'Unsplash'} / Unsplash`, id: pick.id } }
    await sleep(400)
  }
  throw new Error('no result across query chain')
}

const dests = await sql`SELECT slug FROM autravel.destinations WHERE state_code = ${'perth'} ORDER BY display_order`
let ok = 0
for (const { slug } of dests) {
  if (!FORCE) {
    const [d] = await sql`SELECT hero_image FROM autravel.destinations WHERE state_code=${'perth'} AND slug=${slug}`
    if (d?.hero_image) { console.log(`  skip (has image): ${slug}`); continue }
  }
  const queries = QUERIES[slug] || [`${slug.replace(/-/g, ' ')} Western Australia`, 'Western Australia landscape']
  try {
    const { raw, credit, id } = await searchPhoto(queries)
    const src = `${raw}&w=2400&q=85&fit=crop`
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer())
    const out = await sharp(buf).resize(2000, 1100, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toBuffer()
    const key = `autravel/destinations/${slug}.webp`
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: out, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }))
    const url = `${PUBLIC}/${key}`
    await sql`UPDATE autravel.destinations SET hero_image = ${url}, updated_at = now() WHERE state_code=${'perth'} AND slug=${slug}`
    ok++
    console.log(`  ✓ ${slug.padEnd(18)} ${(out.length / 1024).toFixed(0)}KB  [${id}] ${credit}`)
    await sleep(1200) // be polite to the Unsplash API
  } catch (e) { console.warn(`  ✗ ${slug}: ${e.message}`) }
}
console.log(`\nDone: ${ok}/${dests.length} destination images.`)
await sql.end()
