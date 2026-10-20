#!/usr/bin/env node
/**
 * AI images for the New Forest mobile data and signal guest post, generated
 * through the ChatGPT connector (OpenAI images API) per Craig's 3 Oct standing
 * rule. The client's real Pixabay photo is used as supplied; these two fill the
 * gaps where no real picture exists. No people, no text or logos. Each one is
 * captioned "AI-generated image" and stamped trainedAlgorithmicMedia at publish.
 * Reviewed by eye on the contact sheet, never by a Claude vision call.
 *
 *   node scripts/gen-newforest-mobile-signal-images.mjs <out-dir> [key ...]
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const KEY = fs.readFileSync('/root/.openai_key', 'utf8').match(/OPENAI_API_KEY=(\S+)/)?.[1]
if (!KEY) { console.error('no OPENAI_API_KEY in /root/.openai_key'); process.exit(1) }
const MODEL = 'gpt-image-2.5-sunburst'
const HOUSE = 'Documentary photograph in natural light, realistic, southern England setting. No people, no hands, no faces, no human figures or silhouettes, no animals in the foreground. No text, no lettering, no labels, no signs, no logos, no watermarks.'

const SHOTS = [
  { key: 'phone-and-paper-map-on-heathland-bench', prompt: 'A smartphone with a dark, blank, switched-off screen and a folded paper walking map lying on a weathered wooden bench at the edge of open New Forest heathland in Hampshire, England. A small black power bank lies beside the phone. Behind the bench, gorse and heather and a pale gravel track. Soft morning light. The map shows only green shading, blue streams and brown contour lines, with no lettering at all.' },
  { key: 'new-forest-heathland-track-and-distant-mast', prompt: 'Wide view of open New Forest heathland in Hampshire, England. A pale gravel track runs down into a shallow hollow and rises again, with gorse and heather on either side. A line of oak and beech woodland on the far side, and one slim telecommunications mast, small and far away on the distant skyline. Big sky with broken cloud, late afternoon light.' },
]
const OUT = process.argv[2]
if (!OUT) { console.error('usage: gen-newforest-mobile-signal-images.mjs <out-dir> [key ...]'); process.exit(1) }
fs.mkdirSync(OUT, { recursive: true })
const only = process.argv.slice(3)

for (const s of SHOTS.filter(s => !only.length || only.includes(s.key))) {
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
  console.log(`${s.key}: generated (${Math.round(png.length / 1024)} KB)`)
}
// contact sheet for an eyes-on review before anything is published
spawnSync('montage', [`${OUT}/*.png`, '-tile', '2x1', '-geometry', '640x427+6+6', `${OUT}/contact-sheet.jpg`], { shell: true })
console.log(`\ncontact sheet: ${OUT}/contact-sheet.jpg`)
