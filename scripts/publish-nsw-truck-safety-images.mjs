#!/usr/bin/env node
/**
 * Images for the nswtravel truck safety guest post (31 Oct 2026) -> R2.
 *  - three real Wikimedia Commons photos (the client's doc had none, and the fleet OpenAI key is dead
 *    since 28 Oct, so no ChatGPT-connector images this time). Credit + licence go in XMP and the caption.
 *  - the toolkit diagram (SVG, site teal palette)
 * File names follow the 18 Oct rule: <what-it-shows>-<W>x<H>.<ext>. WebP only where it is lighter than
 * the JPEG. Refuses to overwrite an existing key: R2 objects are served immutable.
 * Pattern copied from publish-newforest-mobile-signal-images.mjs.
 *
 *   node scripts/publish-nsw-truck-safety-images.mjs <photo-dir> <diagram.svg>
 *   (photo-dir holds 00.jpg, 07.jpg, 11.jpg as downloaded from Commons)
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const [PHOTO_DIR, DIAGRAM] = process.argv.slice(2)
if (!PHOTO_DIR || !DIAGRAM) { console.error('usage: <photo-dir> <diagram.svg>'); process.exit(1) }
const env = Object.fromEntries(fs.readFileSync('/var/www/autravel/.env.local', 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))
const s3 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
const BUCKET = 'bugbitten-media', DIR = 'autravel/articles/nsw'
const exists = async Key => { try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key })); return true } catch { return false } }
const put = async (Key, Body, ContentType) => {
  if (await exists(Key)) { console.error(`${Key} already exists, use a new name`); process.exit(3) }
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body, ContentType, CacheControl: 'public, max-age=31536000, immutable' }))
  console.log(`${env.R2_PUBLIC_DOMAIN}/${Key}  ${Math.round(Body.length / 1024)} KB`)
}
const tmp = fs.mkdtempSync('/tmp/nsw-truck-')

// Encode at 1600x900, keep whichever of WebP/JPEG is lighter, stamp XMP, return [name, buffer, type].
async function encode(src, base, xmp, position) {
  const img = sharp(src).resize(1600, 900, { fit: 'cover', position })
  const webp = await img.clone().webp({ quality: 82 }).toBuffer()
  const jpeg = await img.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  const [ext, buf, type] = webp.length <= jpeg.length ? ['webp', webp, 'image/webp'] : ['jpg', jpeg, 'image/jpeg']
  const file = `${tmp}/${base}-1600x900.${ext}`
  fs.writeFileSync(file, buf)
  const r = spawnSync('exiftool', ['-overwrite_original', ...xmp, file], { encoding: 'utf8' })
  if (r.status !== 0) { console.error(`exiftool failed on ${file}: ${(r.stderr || '').trim()}`); process.exit(2) }
  return [`${base}-1600x900.${ext}`, fs.readFileSync(file), type, webp.length, jpeg.length]
}

const credit = (creator, rights, source) => [`-XMP-dc:Creator=${creator}`, `-XMP-dc:Rights=${rights}`,
  `-XMP-photoshop:Credit=${creator} via Wikimedia Commons`, `-XMP-dc:Source=${source}`]
const jobs = [
  [`${PHOTO_DIR}/00.jpg`, 'truck-safety-b-double-newell-highway-jerilderie', 'centre',
    credit('Kgbo', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:B-Double_road_trains_on_Newell_Highway_or_Jerilderie_Street_in_Jerilderie,_2023.jpg')],
  [`${PHOTO_DIR}/07.jpg`, 'truck-safety-road-train-corner-mungindi', 'centre',
    credit('Kgbo', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Road_trains,_Carnarvon_Highway,_St_George_Street,_Mungindi,_NSW,_2021,_04.jpg')],
  // the truck sits low in the frame: crop from the top, keep the road
  [`${PHOTO_DIR}/11.jpg`, 'truck-safety-b-double-open-inland-highway', 'south',
    credit('FotoSleuth', 'CC BY 2.0', 'https://commons.wikimedia.org/wiki/File:South_Australia_to_New_South_Wales_road_trip_(33046240682).jpg')],
]
for (const [src, base, position, xmp] of jobs) {
  const [name, body, type, w, j] = await encode(src, base, xmp, position)
  console.log(`  ${base}: webp ${Math.round(w / 1024)} KB vs jpeg ${Math.round(j / 1024)} KB`)
  await put(`${DIR}/${name}`, body, type)
}

const svg = fs.readFileSync(DIAGRAM)
const h = svg.toString().match(/<svg[^>]*\bwidth="(\d+)" height="(\d+)"/)
if (!h) { console.error('diagram has no width/height'); process.exit(2) }
await put(`${DIR}/before-you-overtake-a-truck-diagram-${h[1]}x${h[2]}.svg`, svg, 'image/svg+xml')
fs.rmSync(tmp, { recursive: true, force: true })
