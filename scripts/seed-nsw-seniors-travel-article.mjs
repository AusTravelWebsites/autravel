import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'

const SLUG = '4-tips-for-travelling-with-seniors-in-nsw'
const LEGACY = `/${SLUG}/`
const TITLE = '4 Tips for Travelling with Seniors in NSW'
const DESC = 'Travelling with elderly parents or friends in NSW? Tips on itineraries, medical and comfort needs, seniors card discounts and packing for the weather.'
const body = readFileSync(process.argv[2], 'utf8').trim()

// The article template truncates seo_title >45 and seo_description >155.
if (TITLE.length > 45 || DESC.length > 155) { console.error('meta over cap — would be ellipsised'); process.exit(1) }

const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [row] = await sql`
  INSERT INTO articles (
    state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description
  ) VALUES (
    'nsw', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body},
    'https://media.bugbitten.com/autravel/articles/nsw/travelling-with-seniors.webp',
    ${sql.json(['Travel Ideas'])}, ${sql.json([])}, 'post', 'published', 'manual', now(), ${TITLE}, ${DESC}
  )
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    status=EXCLUDED.status, updated_at=now()
  RETURNING id, slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
