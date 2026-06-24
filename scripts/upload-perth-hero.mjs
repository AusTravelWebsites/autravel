#!/usr/bin/env node
// One-off: upload the Perth Tourism hero (a WA woodland-trail photo) to R2 →
// media.bugbitten.com/autravel/hero/perth.webp. Net-new asset, not reused from
// the wa/watravel tenant (scrub-on-fork). Source: Unsplash (Denmark, WA).
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#'))
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

// Woodland trail, Denmark WA (Tom Öhlin / Unsplash).
const SRC = 'https://images.unsplash.com/photo-1589528273921-4b05d77df624?w=2400&q=85&auto=format&fit=crop'
console.log(`fetching ${SRC}`)
const buf = Buffer.from(await (await fetch(SRC)).arrayBuffer())
const out = await sharp(buf).resize(2000, 1100, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toBuffer()
const key = 'autravel/hero/perth.webp'
await s3.send(new PutObjectCommand({
  Bucket: BUCKET, Key: key, Body: out, ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}))
console.log(`  → ${PUBLIC}/${key}  (${(out.length / 1024).toFixed(0)} KB)`)
