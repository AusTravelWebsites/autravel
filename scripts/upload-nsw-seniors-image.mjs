#!/usr/bin/env node
// One-off: the seniors-travel article's photo came embedded in the source doc
// (no Pexels photo-page URL was supplied), so it is converted from the doc's
// own asset rather than re-downloaded. Source is 1160x750, so no upscaling.
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('/var/www/autravel/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const SRC = process.argv[2]
const KEY = 'autravel/articles/nsw/travelling-with-seniors.webp'
const out = await sharp(readFileSync(SRC))
  .resize(1600, 900, { fit: 'cover', position: 'center', withoutEnlargement: true })
  .webp({ quality: 82 })
  .toBuffer()
const meta = await sharp(out).metadata()

await s3.send(new PutObjectCommand({
  Bucket: 'bugbitten-media', Key: KEY, Body: out,
  ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable',
}))
console.log(`https://media.bugbitten.com/${KEY}  ${meta.width}x${meta.height}  ${(out.length / 1024).toFixed(0)} KB`)
