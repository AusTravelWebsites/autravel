#!/usr/bin/env node
/**
 * Images for the New Forest mobile data and signal guest post -> R2.
 *  - the client's Pixabay photo (Nowaja, Pixabay Content License), as embedded in their doc
 *  - two ChatGPT-connector images (AI provenance stamped as XMP)
 *  - the toolkit diagram (SVG)
 * File names follow the 18 Oct rule: <what-it-shows>-<W>x<H>.<ext>. WebP only where it is
 * lighter than the JPEG. Refuses to overwrite an existing key: R2 objects are served immutable.
 *
 *   node scripts/publish-newforest-mobile-signal-images.mjs <photo.jpg> <ai-png-dir> <diagram.svg>
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const [PHOTO, AI_DIR, DIAGRAM] = process.argv.slice(2)
if (!PHOTO || !AI_DIR || !DIAGRAM) { console.error('usage: <photo.jpg> <ai-png-dir> <diagram.svg>'); process.exit(1) }
const env = Object.fromEntries(fs.readFileSync('/var/www/autravel/.env.local', 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))
const s3 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
const BUCKET = 'bugbitten-media', DIR = 'autravel/articles/newforest'
const exists = async Key => { try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key })); return true } catch { return false } }
const put = async (Key, Body, ContentType) => {
  if (await exists(Key)) { console.error(`${Key} already exists, use a new name`); process.exit(3) }
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body, ContentType, CacheControl: 'public, max-age=31536000, immutable' }))
  console.log(`${env.R2_PUBLIC_DOMAIN}/${Key}  ${Math.round(Body.length / 1024)} KB`)
}
const tmp = fs.mkdtempSync('/tmp/nf-mobile-')

// Encode at 1600x900, keep whichever of WebP/JPEG is lighter, stamp XMP, return [ext, buffer, type].
async function encode(src, base, xmp) {
  const img = sharp(src).resize(1600, 900, { fit: 'cover', position: 'center' })
  const webp = await img.clone().webp({ quality: 82 }).toBuffer()
  const jpeg = await img.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  const [ext, buf, type] = webp.length <= jpeg.length ? ['webp', webp, 'image/webp'] : ['jpg', jpeg, 'image/jpeg']
  const file = `${tmp}/${base}-1600x900.${ext}`
  fs.writeFileSync(file, buf)
  const r = spawnSync('exiftool', ['-overwrite_original', ...xmp, file], { encoding: 'utf8' })
  if (r.status !== 0) { console.error(`exiftool failed on ${file}: ${(r.stderr || '').trim()}`); process.exit(2) }
  return [`${base}-1600x900.${ext}`, fs.readFileSync(file), type, webp.length, jpeg.length]
}

const jobs = [
  [PHOTO, 'sunlit-pine-woodland-path', ['-XMP-dc:Creator=Nowaja', '-XMP-dc:Rights=Pixabay Content License',
    '-XMP-photoshop:Credit=Nowaja via Pixabay', '-XMP-dc:Source=https://pixabay.com/photos/forest-trees-sunlight-the-path-7179046/']],
  ...['phone-and-paper-map-on-heathland-bench', 'new-forest-heathland-track-and-distant-mast'].map(k =>
    [`${AI_DIR}/${k}.png`, k, ['-XMP-iptcExt:DigitalSourceType=trainedAlgorithmicMedia',
      '-XMP-dc:Creator=AI-generated (OpenAI gpt-image)', '-XMP-dc:Rights=AI-generated image']]),
]
for (const [src, base, xmp] of jobs) {
  const [name, body, type, w, j] = await encode(src, base, xmp)
  console.log(`  ${base}: webp ${Math.round(w / 1024)} KB vs jpeg ${Math.round(j / 1024)} KB`)
  await put(`${DIR}/${name}`, body, type)
}

const svg = fs.readFileSync(DIAGRAM)
const h = svg.toString().match(/<svg[^>]*\bwidth="(\d+)" height="(\d+)"/)
if (!h) { console.error('diagram has no width/height'); process.exit(2) }
await put(`${DIR}/mobile-data-options-overseas-visitors-diagram-${h[1]}x${h[2]}.svg`, svg, 'image/svg+xml')
fs.rmSync(tmp, { recursive: true, force: true })
