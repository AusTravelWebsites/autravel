#!/usr/bin/env node
// One-off: source the Malaga article's photos from Pexels (free licence, no
// attribution required — we credit anyway) and put them on R2.
//
// The Pexels key is READ AT RUNTIME from the project that already holds it,
// deliberately not copied into autravel/.env.local — one secret, one home.
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const envOf = p => Object.fromEntries(readFileSync(p, 'utf8').split('\n')
  .filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))
const au = envOf('/var/www/autravel/.env.local')
const PEXELS = envOf('/var/www/soundtechnology/.env.local').PEXELS_API_KEY
if (!PEXELS) { console.error('no Pexels key'); process.exit(1) }

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${au.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: au.R2_ACCESS_KEY_ID, secretAccessKey: au.R2_SECRET_ACCESS_KEY },
})

const PHOTOS = [
  { id: 22033738, key: 'malaga-cityscape' },
  { id: 26754747, key: 'malaga-alcazaba' },
  { id: 39625501, key: 'malaga-port' },
  { id: 16753358, key: 'malaga-beach' },
  { id: 6872184,  key: 'malaga-espetos' },
]

for (const p of PHOTOS) {
  const meta = await (await fetch(`https://api.pexels.com/v1/photos/${p.id}`, { headers: { Authorization: PEXELS } })).json()
  if (meta.error) { console.error(`#${p.id}: ${meta.error}`); process.exit(2) }
  const src = `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=2400`
  const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) { console.error(`#${p.id} fetch ${res.status}`); process.exit(2) }
  const out = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(1600, 900, { fit: 'cover', position: 'center', withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer()
  const dim = await sharp(out).metadata()
  const objKey = `autravel/articles/newforest/${p.key}.webp`
  await s3.send(new PutObjectCommand({
    Bucket: 'bugbitten-media', Key: objKey, Body: out,
    ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable',
  }))
  console.log(JSON.stringify({
    key: p.key, url: `https://media.bugbitten.com/${objKey}`,
    w: dim.width, h: dim.height, kb: Math.round(out.length / 1024),
    photographer: meta.photographer, page: meta.url, alt: meta.alt,
  }))
}
