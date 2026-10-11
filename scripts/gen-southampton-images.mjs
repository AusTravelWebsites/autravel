#!/usr/bin/env node
/**
 * Images for the Southampton cruise-port article, generated through the ChatGPT
 * connector (OpenAI images API) per Craig's 3 Oct standing rule — not Pexels or
 * Openverse. No people (house rule), no text/logos. Every image is labelled
 * "AI-generated image" in its caption and carries trainedAlgorithmicMedia XMP.
 * Reviewed by eye on a contact sheet before use, never by a Claude vision call.
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const KEY = fs.readFileSync('/root/.openai_key', 'utf8').match(/OPENAI_API_KEY=(\S+)/)?.[1]
if (!KEY) { console.error('no OPENAI_API_KEY in /root/.openai_key'); process.exit(1) }
const MODEL = 'gpt-image-2.5-sunburst'
const HOUSE = 'Documentary photograph in natural light, realistic, southern England setting. No people, no hands, no faces, no human figures or silhouettes. No text, no lettering, no labels, no signs, no logos, no watermarks.'

const env = Object.fromEntries(fs.readFileSync('/var/www/autravel/.env.local','utf8')
  .split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}))
const s3 = new S3Client({ region:'auto', endpoint:`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })

const SHOTS = [
  { key: 'southampton-cruise-terminal', prompt: 'A large cruise ship berthed at a working dock in Southampton, England, early morning, cranes and terminal buildings along the quayside, calm water, overcast English light.' },
  { key: 'new-forest-heath-ponies', prompt: 'Open New Forest heathland in Hampshire, England, with gorse and heather, free-roaming New Forest ponies grazing in the middle distance, a gravel track curving away, soft autumn light.' },
  { key: 'new-forest-woodland-path', prompt: 'A waymarked gravel walking path through ancient beech and oak woodland in the New Forest, Hampshire, dappled light, fallen leaves, low wooden waymarker post with no lettering.' },
]
const OUT = '/tmp/soton-img'; fs.mkdirSync(OUT, { recursive: true })

for (const s of SHOTS) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: `${s.prompt} ${HOUSE}`, size: '1536x1024', n: 1 }),
    signal: AbortSignal.timeout(240_000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.data?.[0]?.b64_json) { console.error(`${s.key}: ${res.status} ${j.error?.message || ''}`); process.exit(2) }
  const png = Buffer.from(j.data[0].b64_json, 'base64')
  fs.writeFileSync(`${OUT}/${s.key}.png`, png)
  console.log(`${s.key}: generated (${Math.round(png.length/1024)} KB)`)
}
// contact sheet for an eyes-on review before anything is published
spawnSync('montage', [`${OUT}/*.png`, '-tile', '3x1', '-geometry', '420x280+6+6', `${OUT}/contact-sheet.jpg`], { shell: true })
console.log(`\ncontact sheet: ${OUT}/contact-sheet.jpg`)
