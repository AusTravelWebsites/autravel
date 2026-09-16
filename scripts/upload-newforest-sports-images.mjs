#!/usr/bin/env node
// One-off: upload the three Pexels photos for the New Forest sporting-activities
// article to R2 (media.bugbitten.com/autravel/articles/newforest/<key>.webp).
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('/var/www/autravel/.env.local', 'utf8')
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

const PHOTOS = [
  { key: 'kayaking-tidal-water',         id: '7972408'  },
  { key: 'outdoor-shooting-range',       id: '30042213' },
  { key: 'mountain-biking-forest-trail', id: '8926944'  },
]

for (const p of PHOTOS) {
  const src = `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=2400`
  const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) { console.error(`[${p.key}] fetch failed: ${res.status}`); process.exit(2) }
  const raw = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(raw).metadata()
  const out = await sharp(raw)
    .resize(1600, 900, { fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toBuffer()

  const objKey = `autravel/articles/newforest/${p.key}.webp`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: objKey, Body: out,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  console.log(`${PUBLIC}/${objKey}  (src ${meta.width}x${meta.height} -> ${(out.length / 1024).toFixed(0)} KB)`)
}
