#!/usr/bin/env node
// Upload one article hero photo from Unsplash to R2 at
// media.bugbitten.com/autravel/articles/<key>.webp.
//
// Usage:
//   node scripts/upload-article-hero.mjs <key> <unsplash-photo-id>
// Example:
//   node scripts/upload-article-hero.mjs bike-cyclist photo-1631276893368-554b60393efb
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const [, , key, photoId] = process.argv
if (!key || !photoId) {
  console.error('usage: upload-article-hero.mjs <key> <photo-id>')
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
console.log(`[${key}] fetching ${src}`)
const res = await fetch(src)
if (!res.ok) { console.error('  fetch failed:', res.status); process.exit(2) }
const buf = Buffer.from(await res.arrayBuffer())

const out = await sharp(buf)
  .resize(1600, 900, { fit: 'cover', position: 'center' })
  .webp({ quality: 80 })
  .toBuffer()

const objKey = `autravel/articles/perth-trails/${key}.webp`
await s3.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: objKey,
  Body: out,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}))

const url = `${PUBLIC}/${objKey}`
console.log(`  -> ${url}  (${(out.length / 1024).toFixed(0)} KB)`)
console.log(url)
