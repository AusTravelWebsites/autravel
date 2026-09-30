#!/usr/bin/env node
// Pexels -> R2 for the aunz "moving to Australia / English ready" guest post.
// Craig asked for New Zealand photos from a free photo site (not Unsplash) in
// place of the client's supplied images. SEO toolkit sizes: 1280x720 WebP q85
// plus a 640x360 variant for srcset. Photo page URLs come from the API
// response, never hand-built, so the credit links cannot 404. Refuses to
// overwrite an existing key: R2 objects are served immutable.
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
const envOf = p => Object.fromEntries(readFileSync(p,'utf8').split('\n').filter(l=>l&&!l.startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}))
const au = envOf('/var/www/autravel/.env.local')
const PEXELS = envOf('/var/www/soundtechnology/.env.local').PEXELS_API_KEY
const s3 = new S3Client({ region:'auto', endpoint:`https://${au.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{ accessKeyId: au.R2_ACCESS_KEY_ID, secretAccessKey: au.R2_SECRET_ACCESS_KEY } })
const BUCKET = 'bugbitten-media', DIR = 'autravel/articles/aunz'

// trimLeft: fraction of the width to drop before fitting (removes a lone
// pedestrian at the left edge of the Arts Centre frame — no people in photos).
const PHOTOS = [
  { id: 17824133, key: 'things-to-do-before-moving-to-australia-english-ready-featured' },
  { id: 34725008, key: 'moving-to-australia-christchurch-arts-centre', trimLeft: 0.07 },
  { id: 3709415,  key: 'moving-to-australia-wellington-harbour' },
]
const exists = async Key => { try { await s3.send(new HeadObjectCommand({ Bucket:BUCKET, Key })); return true } catch { return false } }

for (const p of PHOTOS) {
  const meta = await (await fetch(`https://api.pexels.com/v1/photos/${p.id}`, { headers:{ Authorization: PEXELS } })).json()
  if (meta.error || !meta.url) { console.error(`#${p.id}: ${meta.error || 'no meta'}`); process.exit(2) }
  const res = await fetch(`https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=2600`, { headers:{ 'User-Agent':'Mozilla/5.0' } })
  if (!res.ok) { console.error(`#${p.id} fetch ${res.status}`); process.exit(2) }
  let img = sharp(Buffer.from(await res.arrayBuffer()))
  if (p.trimLeft) {
    const { width, height } = await img.metadata()
    const left = Math.round(width * p.trimLeft)
    img = sharp(await img.extract({ left, top: 0, width: width - left, height }).toBuffer())
  }
  const src = await img.toBuffer()
  for (const [w, h, suffix] of [[1280, 720, ''], [640, 360, '-640']]) {
    const Key = `${DIR}/${p.key}${suffix}.webp`
    if (await exists(Key)) { console.error(`${Key} already exists — use a new (hashed) name`); process.exit(3) }
    const out = await sharp(src).resize(w, h, { fit:'cover', position:'center', withoutEnlargement:true })
      .webp({ quality:85 }).toBuffer()
    await s3.send(new PutObjectCommand({ Bucket:BUCKET, Key, Body:out,
      ContentType:'image/webp', CacheControl:'public, max-age=31536000, immutable' }))
    console.log(JSON.stringify({ key:Key, photographer:meta.photographer, page:meta.url, kb:Math.round(out.length/1024) }))
  }
}
