#!/usr/bin/env node
// Re-source cover/hero photos for parks + destinations from Google Places (legacy
// API, since rows already have place_id). CRITICALLY: photos go straight to R2,
// we NEVER store the photo_reference URL — those expire and that's exactly how we
// got 1,135 broken images last time.
//
// Cost guard: caps at MAX_ROWS rows total (default unlimited) and emits a cost
// estimate at the start. Idempotent — skips rows that already have an image.

import { readFileSync } from 'fs'
import postgres from 'postgres'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const url = env.DATABASE_URL_TX_POOL || env.DATABASE_URL_POOL || env.DATABASE_URL
const sql = postgres(url, { prepare: false, max: 4 })

const GKEY = env.GOOGLE_PLACES_API_KEY
if (!GKEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

const BUCKET = 'bugbitten-media'
const PUBLIC = 'https://media.bugbitten.com'
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]
}))
const ONLY = args.only          // 'parks' | 'destinations' | undefined (both)
const MAX = args.max ? parseInt(args.max, 10) : null
const DRY = !!args.dry

// --- helpers ---

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  return { status: r.status, body: await r.json().catch(() => null) }
}

async function placeDetailsPhotos(placeId) {
  const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,name&key=${GKEY}`
  const { status, body } = await fetchJSON(u)
  if (status !== 200 || body?.status !== 'OK') return { ok: false, reason: `details ${status}/${body?.status || '?'}` }
  const photos = body.result?.photos || []
  if (!photos.length) return { ok: false, reason: 'no photos' }
  return { ok: true, photoref: photos[0].photo_reference, name: body.result?.name }
}

async function findPlaceId(query) {
  const u = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${GKEY}`
  const { status, body } = await fetchJSON(u)
  if (status !== 200 || body?.status !== 'OK') return { ok: false, reason: `findplace ${status}/${body?.status || '?'}` }
  const cands = body.candidates || []
  if (!cands.length) return { ok: false, reason: 'no candidates' }
  return { ok: true, place_id: cands[0].place_id }
}

async function downloadPhotoBytes(photoref) {
  const u = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${photoref}&key=${GKEY}`
  const r = await fetch(u, { redirect: 'follow' })
  if (!r.ok) return { ok: false, reason: `photo ${r.status}` }
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 1000) return { ok: false, reason: `photo too small (${buf.length}b)` }
  return { ok: true, buf }
}

async function r2HasKey(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true }
  catch (e) { return false }
}

async function r2Put(key, buf) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buf,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}

async function processRow({ table, idCol, urlCol, getPlaceIdFn, keyPrefix, row }) {
  const key = `${keyPrefix}/${row.slug}.webp`
  if (await r2HasKey(key)) {
    // Already uploaded earlier; just point the DB at it.
    const newUrl = `${PUBLIC}/${key}`
    if (!DRY) {
      const q = `UPDATE ${table} SET ${urlCol} = $1 WHERE id = $2 AND ${urlCol} IS NULL`
      await sql.unsafe(q, [newUrl, row.id])
    }
    return { status: 'reused', url: newUrl }
  }

  const pid = await getPlaceIdFn(row)
  if (!pid.ok) return { status: 'no-place', reason: pid.reason }

  const det = await placeDetailsPhotos(pid.place_id)
  if (!det.ok) return { status: 'no-details', reason: det.reason }

  const photo = await downloadPhotoBytes(det.photoref)
  if (!photo.ok) return { status: 'no-photo', reason: photo.reason }

  let webp
  try {
    webp = await sharp(photo.buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  } catch (e) {
    return { status: 'sharp-error', reason: e.message }
  }

  if (DRY) return { status: 'dry-ok', kb: (webp.length / 1024).toFixed(0) }

  await r2Put(key, webp)
  const newUrl = `${PUBLIC}/${key}`
  const q = `UPDATE ${table} SET ${urlCol} = $1 WHERE id = $2 AND ${urlCol} IS NULL`
  await sql.unsafe(q, [newUrl, row.id])
  return { status: 'uploaded', url: newUrl, kb: (webp.length / 1024).toFixed(0), name: det.name }
}

// --- runners ---

async function runParks() {
  const rows = await sql`
    SELECT id::text AS id, slug, state_code, name, google_place_id
      FROM autravel.parks
     WHERE active AND cover_image IS NULL AND google_place_id IS NOT NULL
     ORDER BY state_code, name`
  console.log(`PARKS: ${rows.length} candidates`)
  const ROWS = MAX ? rows.slice(0, MAX) : rows
  let ok = 0, skip = 0
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i]
    const res = await processRow({
      table: 'autravel.parks', idCol: 'id', urlCol: 'cover_image',
      getPlaceIdFn: row => ({ ok: true, place_id: row.google_place_id }),
      keyPrefix: 'autravel/parks',
      row: r,
    })
    if (res.status === 'uploaded' || res.status === 'reused' || res.status === 'dry-ok') ok++
    else skip++
    console.log(`  [${i + 1}/${ROWS.length}] ${r.state_code}/${r.slug}: ${res.status}${res.reason ? ' — ' + res.reason : ''}${res.kb ? ` (${res.kb}KB)` : ''}`)
  }
  console.log(`PARKS done: ${ok} OK / ${skip} skipped`)
}

async function runDestinations() {
  const rows = await sql`
    SELECT id::text AS id, slug, state_code, name
      FROM autravel.destinations
     WHERE active AND hero_image IS NULL
     ORDER BY state_code, name`
  console.log(`DESTINATIONS: ${rows.length} candidates`)
  const ROWS = MAX ? rows.slice(0, MAX) : rows
  let ok = 0, skip = 0
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i]
    // For destinations: text-search the place name + "Australia" + state name.
    const STATE_NAMES = { nsw: 'New South Wales', vic: 'Victoria', qld: 'Queensland', tas: 'Tasmania', sa: 'South Australia', wa: 'Western Australia', nt: 'Northern Territory' }
    const query = `${r.name}, ${STATE_NAMES[r.state_code] || ''} Australia`
    const res = await processRow({
      table: 'autravel.destinations', idCol: 'id', urlCol: 'hero_image',
      getPlaceIdFn: async () => findPlaceId(query),
      keyPrefix: 'autravel/destinations',
      row: r,
    })
    if (res.status === 'uploaded' || res.status === 'reused' || res.status === 'dry-ok') ok++
    else skip++
    console.log(`  [${i + 1}/${ROWS.length}] ${r.state_code}/${r.slug}: ${res.status}${res.reason ? ' — ' + res.reason : ''}${res.kb ? ` (${res.kb}KB)` : ''}`)
  }
  console.log(`DESTINATIONS done: ${ok} OK / ${skip} skipped`)
}

// --- main ---

console.log(`Mode: ${DRY ? 'DRY RUN' : 'LIVE'}${MAX ? ` (max ${MAX} per group)` : ''}${ONLY ? ` (only=${ONLY})` : ''}`)
console.log(`Cost estimate: ~$0.024/park (details $17/1k + photo $7/1k), ~$0.041/destination (findplace + details + photo).`)
console.log('')

if (!ONLY || ONLY === 'parks') await runParks()
if (!ONLY || ONLY === 'destinations') await runDestinations()

await sql.end()
