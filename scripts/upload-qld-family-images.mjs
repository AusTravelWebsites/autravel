#!/usr/bin/env node
// Pexels -> R2 for the Queensland family-holiday post. Photo page URLs are taken
// from the API response, never hand-built, so the credit links cannot 404.
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
const envOf = p => Object.fromEntries(readFileSync(p,'utf8').split('\n').filter(l=>l&&!l.startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}))
const au = envOf('/var/www/autravel/.env.local')
const PEXELS = envOf('/var/www/soundtechnology/.env.local').PEXELS_API_KEY
const s3 = new S3Client({ region:'auto', endpoint:`https://${au.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{ accessKeyId: au.R2_ACCESS_KEY_ID, secretAccessKey: au.R2_SECRET_ACCESS_KEY } })

const PHOTOS = [
  { id: 13749849, key: 'qld-family-beach' },
  { id: 35762005, key: 'qld-reef' },
  { id: 6182089,  key: 'qld-car' },
  { id: 30120545, key: 'qld-rainforest' },
]
for (const p of PHOTOS) {
  const meta = await (await fetch(`https://api.pexels.com/v1/photos/${p.id}`, { headers:{ Authorization: PEXELS } })).json()
  if (meta.error) { console.error(`#${p.id}: ${meta.error}`); process.exit(2) }
  const res = await fetch(`https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=2400`, { headers:{ 'User-Agent':'Mozilla/5.0' } })
  if (!res.ok) { console.error(`#${p.id} fetch ${res.status}`); process.exit(2) }
  const out = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(1600, 900, { fit:'cover', position:'center', withoutEnlargement:true })
    .webp({ quality:82 }).toBuffer()
  const objKey = `autravel/articles/qld/${p.key}.webp`
  await s3.send(new PutObjectCommand({ Bucket:'bugbitten-media', Key:objKey, Body:out,
    ContentType:'image/webp', CacheControl:'public, max-age=31536000, immutable' }))
  console.log(JSON.stringify({ key:p.key, photographer:meta.photographer, page:meta.url, kb:Math.round(out.length/1024) }))
}
