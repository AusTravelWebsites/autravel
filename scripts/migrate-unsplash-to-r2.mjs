#!/usr/bin/env node
// Migrate every Unsplash image referenced from autravel.{articles,parks,destinations}
// to R2 (media.bugbitten.com/autravel/photos/<photo-id>.webp) and rewrite the DB rows.
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

const BUCKET = 'bugbitten-media'
const PUBLIC = 'https://media.bugbitten.com'
const KEY_PREFIX = 'autravel/photos'
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

// 1. Pull every unsplash URL and group by canonical photo ID
const rows = await sql`
  SELECT 'autravel.articles'     AS tbl, id::text AS id, cover_image AS url FROM autravel.articles     WHERE status='published' AND cover_image LIKE '%images.unsplash.com%'
  UNION ALL
  SELECT 'autravel.parks'        AS tbl, id::text AS id, cover_image AS url FROM autravel.parks        WHERE active AND cover_image LIKE '%images.unsplash.com%'
  UNION ALL
  SELECT 'autravel.destinations' AS tbl, id::text AS id, hero_image  AS url FROM autravel.destinations WHERE active AND hero_image  LIKE '%images.unsplash.com%'
`

const photoIdRe = /images\.unsplash\.com\/(photo-\d+-[a-f0-9]+)/i
const byPhotoId = new Map()
const badRows = []
for (const r of rows) {
  const m = r.url.match(photoIdRe)
  if (!m) { badRows.push(r); continue }
  const pid = m[1]
  if (!byPhotoId.has(pid)) byPhotoId.set(pid, [])
  byPhotoId.get(pid).push(r)
}
console.log(`Unique photo IDs to upload: ${byPhotoId.size}`)
console.log(`Rows with unparseable short-permalink IDs (will be skipped — handled by NULL script): ${badRows.length}`)

// 2. For each photo ID: head R2, if missing then download + optimize + upload
async function ensureUploaded(pid) {
  const key = `${KEY_PREFIX}/${pid}.webp`
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return { key, status: 'exists' }
  } catch (e) {
    if (e.$metadata?.httpStatusCode !== 404 && e.name !== 'NotFound' && e.name !== 'NoSuchKey') throw e
  }
  const src = `https://images.unsplash.com/${pid}?w=1600&q=82&auto=format&fit=crop`
  const res = await fetch(src)
  if (!res.ok) return { key: null, status: `fetch-${res.status}` }
  const buf = Buffer.from(await res.arrayBuffer())
  const out = await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: out,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { key, status: 'uploaded', bytes: out.length }
}

const r2Urls = new Map()       // pid → R2 url
const failed = []
let i = 0
for (const [pid] of byPhotoId) {
  i++
  try {
    const { key, status, bytes } = await ensureUploaded(pid)
    if (!key) {
      console.log(`  [${i}/${byPhotoId.size}] ${pid} → SKIP (${status})`)
      failed.push(pid)
      continue
    }
    r2Urls.set(pid, `${PUBLIC}/${key}`)
    console.log(`  [${i}/${byPhotoId.size}] ${pid} → ${status}${bytes ? ` (${(bytes / 1024).toFixed(0)}KB)` : ''}`)
  } catch (e) {
    console.error(`  [${i}/${byPhotoId.size}] ${pid} → ERROR ${e.message}`)
    failed.push(pid)
  }
}
console.log(`Failed: ${failed.length} ${failed.length ? JSON.stringify(failed) : ''}`)

// 3. Rewrite every DB row that resolves to a successfully-uploaded photo ID
let updated = 0
for (const [pid, rs] of byPhotoId) {
  const newUrl = r2Urls.get(pid)
  if (!newUrl) continue
  for (const r of rs) {
    const col = r.tbl === 'autravel.destinations' ? 'hero_image' : 'cover_image'
    const q = `UPDATE ${r.tbl} SET ${col} = $1 WHERE id = $2 AND ${col} = $3`
    await sql.unsafe(q, [newUrl, r.id, r.url])
    updated++
  }
}
console.log(`DB rows rewritten: ${updated}`)

await sql.end()
