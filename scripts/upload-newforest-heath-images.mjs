#!/usr/bin/env node
// One-off: upload the two Unsplash photos for the New Forest heath-wildfire
// article to R2 (media.bugbitten.com/autravel/articles/newforest/<key>.webp).
// Also pings Unsplash's download_location endpoint, as the API guidelines require.
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('/var/www/autravel/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, UNSPLASH_ACCESS_KEY } = env
const BUCKET = 'bugbitten-media'
const PUBLIC = 'https://media.bugbitten.com'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const PHOTOS = [
  { key: 'heathland-gorse-summer-sky', id: 'Z_hb94o_zTw', path: 'photo-1764109003853-96e078b7cc37' },
  { key: 'narrow-track-open-heath',    id: 'o9atY2Ub4i4', path: 'photo-1770823920207-c4736e4bfcde' },
]

for (const p of PHOTOS) {
  const src = `https://images.unsplash.com/${p.path}?w=2400&q=85&auto=format&fit=crop`
  const res = await fetch(src)
  if (!res.ok) { console.error(`[${p.key}] fetch failed: ${res.status}`); process.exit(2) }
  const out = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(1600, 900, { fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toBuffer()

  const objKey = `autravel/articles/newforest/${p.key}.webp`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: objKey, Body: out,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  // Unsplash attribution requirement: register the download.
  await fetch(`https://api.unsplash.com/photos/${p.id}/download`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  }).catch(() => {})

  console.log(`${PUBLIC}/${objKey}  (${(out.length / 1024).toFixed(0)} KB)`)
}
