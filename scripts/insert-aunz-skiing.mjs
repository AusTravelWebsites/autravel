// One-off: insert the authored NSW/VIC skiing article into the existing aunz
// draft row (slug nsw-and-vic-skiing-holidays), add byline + cover, publish.
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const FILE = process.argv[2] || '/tmp/claude-0/-root/0abf7c4b-550e-4a77-ba1a-0f2ce39c9bcb/scratchpad/aunz-skiing.json'
const COVER = 'https://aunztravel.com.au/wp-content/uploads/2021/04/Mount-Hotham-Victoria-Australia.jpeg'
const SLUG = 'nsw-and-vic-skiing-holidays'
const STATE = 'aunz'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })

const a = JSON.parse(readFileSync(FILE, 'utf8'))
if (!a.title || !a.body_html) throw new Error('missing title/body in JSON')

// Guard: body must be real HTML and free of the junk we're replacing.
if (/&lt;p&gt;/.test(a.body_html)) throw new Error('body_html is entity-encoded (contains &lt;p&gt;) — fix before insert')
if (/enable cookies/i.test(a.body_html)) throw new Error('body still contains cookie-wall junk')
if (!a.body_html.includes('<p>')) throw new Error('body_html has no real <p> tags')

// Pick a stable aunz-eligible author (empty state_codes = global, or contains aunz).
const [author] = await sql`
  SELECT slug, name, role FROM autravel.authors
   WHERE state_codes = '{}' OR 'aunz' = ANY(state_codes)
   ORDER BY slug LIMIT 1`
const byline = author
  ? `<p class="byline" style="color:#6b7280;font-size:14px;margin-bottom:18px"><em>By ${author.name} — ${author.role || 'travel writer'}</em></p>`
  : ''
const body_html = byline + a.body_html

const [row] = await sql`
  UPDATE autravel.articles SET
    title = ${a.title}, excerpt = ${a.excerpt || null}, body_html = ${body_html},
    seo_title = ${a.seo_title || null}, seo_description = ${a.seo_description || null},
    cover_image = ${COVER},
    author = ${author?.name || null}, author_slug = ${author?.slug || null},
    source = 'ai-generated | authored 2026-07-09 (skiing rewrite)',
    status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
  WHERE state_code = ${STATE} AND slug = ${SLUG}
  RETURNING id::text AS id, title, length(body_html) AS blen, author_slug, status`

console.log(row ? `✓ updated: "${row.title}" — ${row.blen} chars, author=${row.author_slug}, status=${row.status}` : '✗ no row matched — check slug/state')
await sql.end()
