#!/usr/bin/env node
// One-off: pull hero photos from Unsplash, optimise, upload to R2 → media.bugbitten.com/autravel/hero/<state>.webp
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// Load .env.local manually (no dotenv dep needed)
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
const BUCKET = 'bugbitten-media'           // the one served by media.bugbitten.com
const PUBLIC = 'https://media.bugbitten.com'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const HEROES = [
  { state: 'qld',  id: 'photo-1598522038344-293c492adaf0', credit: 'Whitehaven Beach, Whitsundays' },
  { state: 'nsw',  id: 'photo-1624138784614-87fd1b6528f8', credit: 'Sydney Opera House & Harbour Bridge' },
  { state: 'nt',   id: 'photo-1557214997-7eae7e0e7aaa',    credit: 'Uluru, Red Centre' },
  { state: 'wa',   id: 'photo-1598298230762-e4cbaf605f4a', credit: 'Rottnest Island lagoon' },
  { state: 'sa',   id: 'photo-1589685523979-6544ec36b055', credit: 'Kangaroos on a South Australian beach' },
  { state: 'tas',  id: 'photo-1534853878021-7fb609562749', credit: 'Cradle Mountain, Tasmania' },
  { state: 'vic',  id: 'photo-1596430222039-4a2d7b4cd767', credit: 'Twelve Apostles, Great Ocean Road' },
  { state: 'aunz', id: 'photo-1529108190281-9a4f620bc2d8', credit: 'Outback Australia' },
]

for (const h of HEROES) {
  const src = `https://images.unsplash.com/${h.id}?w=2400&q=85&auto=format&fit=crop`
  console.log(`[${h.state}] fetching ${src}`)
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer())

  // 2000w landscape webp — quality 80 is the sweet spot for hero photos.
  const out = await sharp(buf).resize(2000, 1100, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toBuffer()
  const key = `autravel/hero/${h.state}.webp`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: out,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  console.log(`  → ${PUBLIC}/${key}  (${(out.length / 1024).toFixed(0)} KB)`)
}
