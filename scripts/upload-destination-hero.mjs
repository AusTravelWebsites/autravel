#!/usr/bin/env node
// Upload one destination hero photo from Unsplash to R2 at
// media.bugbitten.com/autravel/destinations/<slug>.webp.
//
// Usage:
//   node scripts/upload-destination-hero.mjs <slug> <unsplash-photo-id> "<credit>"
// Examples:
//   node scripts/upload-destination-hero.mjs surfers-paradise photo-1671418087163-9a29e29caefa "Surfers Paradise skyline, Gold Coast"
//
// The photo-id is the slug from the Unsplash CDN URL, e.g.
//   https://images.unsplash.com/photo-1671418087163-9a29e29caefa
// pass "photo-1671418087163-9a29e29caefa".
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const [, , slug, photoId, credit] = process.argv
if (!slug || !photoId) {
  console.error('usage: upload-destination-hero.mjs <slug> <photo-id> [credit]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
const BUCKET = 'bugbitten-media'
const PUBLIC = 'https://media.bugbitten.com'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const src = `https://images.unsplash.com/${photoId}?w=2400&q=85&auto=format&fit=crop`
console.log(`[${slug}] ${credit || photoId}\n  fetching ${src}`)
const res = await fetch(src)
if (!res.ok) { console.error('  fetch failed:', res.status); process.exit(2) }
const buf = Buffer.from(await res.arrayBuffer())

const out = await sharp(buf)
  .resize(2000, 1100, { fit: 'cover', position: 'center' })
  .webp({ quality: 80 })
  .toBuffer()

const key = `autravel/destinations/${slug}.webp`
await s3.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: key,
  Body: out,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}))

const url = `${PUBLIC}/${key}`
console.log(`  → ${url}  (${(out.length / 1024).toFixed(0)} KB)`)
console.log(url)
