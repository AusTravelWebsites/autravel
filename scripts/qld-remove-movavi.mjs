import { config } from 'dotenv'
import postgres from 'postgres'
import { setDefaultResultOrder } from 'dns'

config({ path: '/var/www/autravel/.env.local' })
setDefaultResultOrder('ipv4first')

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  ssl: 'require',
  prepare: false,
  connection: { search_path: 'autravel, public' },
})

const ID = 'e09353b1-dc76-4b3a-8742-51c02f54679f'
const NEEDLE = '<a href="http://www.movavi.com/support/how-to/how-to-add-voiceover-to-video.html" target="_blank" rel="noopener"><span style="font-weight: 400;">add voice to the video</span></a>'
const REPLACEMENT = '<span style="font-weight: 400;">add voice to the video</span>'

const [row] = await sql`SELECT body_html FROM articles WHERE id = ${ID}`
const before = row.body_html
if (!before.includes(NEEDLE)) {
  console.error('Exact link pattern not found — aborting (no change made)')
  await sql.end()
  process.exit(1)
}
const after = before.split(NEEDLE).join(REPLACEMENT)
const stillHasUrl = after.includes('movavi.com/support/how-to/how-to-add-voiceover-to-video.html')
console.log(`Replacements: ${(before.match(new RegExp(NEEDLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length}`)
console.log(`Length: ${before.length} -> ${after.length}`)
console.log(`Residual movavi link in body? ${stillHasUrl}`)
if (stillHasUrl) {
  console.error('Residual link still present — aborting')
  await sql.end()
  process.exit(1)
}

await sql`UPDATE articles SET body_html = ${after}, updated_at = NOW() WHERE id = ${ID}`
console.log('UPDATE applied')

const [verify] = await sql`SELECT body_html FROM articles WHERE id = ${ID}`
console.log(`Post-update contains URL: ${verify.body_html.includes('movavi.com/support/how-to/how-to-add-voiceover-to-video.html')}`)
await sql.end()
