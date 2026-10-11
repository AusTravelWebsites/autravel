#!/usr/bin/env node
// Convert the generated PNGs to the house WebP format, stamp AI provenance
// (IPTC DigitalSourceType trainedAlgorithmicMedia) and push to R2.
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
const env = Object.fromEntries(fs.readFileSync('/var/www/autravel/.env.local','utf8')
  .split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}))
const s3 = new S3Client({ region:'auto', endpoint:`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
const SRC = '/tmp/soton-img'
for (const key of ['southampton-cruise-terminal','new-forest-heath-ponies','new-forest-woodland-path']) {
  const webp = await sharp(`${SRC}/${key}.png`).resize(1600, 900, { fit:'cover', position:'center' })
    .webp({ quality: 82 }).toBuffer()
  const tmp = `${SRC}/${key}.webp`; fs.writeFileSync(tmp, webp)
  // AI provenance — survives as XMP on the object we store
  const r = spawnSync('exiftool', ['-overwrite_original',
    '-XMP-iptcExt:DigitalSourceType=trainedAlgorithmicMedia',
    '-XMP-dc:Creator=AI-generated (OpenAI gpt-image)',
    '-XMP-dc:Rights=AI-generated image', tmp], { encoding:'utf8' })
  const body = fs.readFileSync(tmp)
  const objKey = `autravel/articles/newforest/${key}.webp`
  await s3.send(new PutObjectCommand({ Bucket:'bugbitten-media', Key:objKey, Body:body,
    ContentType:'image/webp', CacheControl:'public, max-age=31536000, immutable' }))
  console.log(`${objKey}  ${Math.round(body.length/1024)} KB  xmp=${r.status === 0 ? 'stamped' : 'SKIPPED (' + (r.stderr||'').trim().slice(0,40) + ')'}`)
}
