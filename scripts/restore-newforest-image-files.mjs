#!/usr/bin/env node
/**
 * restore-newforest-image-files.mjs — bulk-restore the New Forest legacy
 * /image-files/ image directory from the Wayback Machine into R2, so the old
 * image URLs (still indexed by Google Images / linked externally) resolve again
 * via a 301 to the CDN. The /image-files/ dir was a pre-WordPress static folder
 * that wasn't preserved at the rebuild; only Wayback has the originals.
 *
 *   node --env-file=.env.local scripts/restore-newforest-image-files.mjs
 *
 * Input:  /tmp/imgfiles-ts.txt  — "<wayback-timestamp> <original-url>" per line
 *         (from the Wayback CDX API, statuscode:200, mimetype image/*).
 * Output: R2 key  autravel/newforest/image-files/<exact-filename>
 *         public  https://media.bugbitten.com/autravel/newforest/image-files/<filename>
 *
 * Idempotent/resumable: HEAD-checks R2 and skips files already uploaded.
 * Polite to Wayback: low concurrency + backoff on 429/5xx.
 */
import { readFileSync } from 'node:fs'
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const env = process.env
const BUCKET = 'bugbitten-media'
const PUBLIC = 'https://media.bugbitten.com'
const PREFIX = 'autravel/newforest/image-files'
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const lines = readFileSync('/tmp/imgfiles-ts.txt', 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
// dedup by filename (keep newest timestamp per filename)
const byFile = new Map()
for (const l of lines) {
  const sp = l.indexOf(' ')
  const ts = l.slice(0, sp), url = l.slice(sp + 1)
  const fn = decodeURIComponent(url.split('/image-files/')[1] || '').split('?')[0]
  if (!fn) continue
  const prev = byFile.get(fn)
  if (!prev || ts > prev.ts) byFile.set(fn, { ts, url })
}
const items = [...byFile.entries()].map(([fn, v]) => ({ fn, ...v }))
console.log(`restoring ${items.length} distinct image-files → R2 ${PREFIX}/`)

const ctOf = fn => {
  const ext = fn.toLowerCase().split('.').pop()
  return ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true } catch { return false }
}
async function fetchWB(ts, url) {
  const wb = `http://web.archive.org/web/${ts}im_/${url}`
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(wb, { headers: { 'User-Agent': 'Mozilla/5.0 (autravel image restore)' }, signal: AbortSignal.timeout(40000) })
      if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 200) return b; return null }
      if (r.status === 429 || r.status >= 500) { await sleep([3000, 8000, 20000, 40000][a]); continue }
      return null
    } catch { await sleep([2000, 5000, 12000, 25000][a]) }
  }
  return null
}

let i = 0, ok = 0, skip = 0, fail = 0
async function worker() {
  while (i < items.length) {
    const it = items[i++]
    const key = `${PREFIX}/${it.fn}`
    try {
      if (await exists(key)) { skip++; continue }
      const buf = await fetchWB(it.ts, it.url)
      if (!buf) { fail++; if (fail <= 30) console.warn('  MISS', it.fn); continue }
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: buf, ContentType: ctOf(it.fn),
        CacheControl: 'public, max-age=31536000, immutable',
      }))
      ok++
      if ((ok + skip) % 100 === 0) console.log(`  progress: ${ok} uploaded, ${skip} skipped, ${fail} miss (${i}/${items.length})`)
      await sleep(120)
    } catch (e) { fail++; if (fail <= 30) console.warn('  ERR', it.fn, e.message) }
  }
}
await Promise.all(Array.from({ length: 5 }, worker))
console.log(`\nDONE: uploaded=${ok} skipped=${skip} failed=${fail} of ${items.length}`)
console.log(`sample: ${PUBLIC}/${PREFIX}/${items[0]?.fn}`)
