import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'

const SLUG = 'new-forest-sporting-activities-for-outdoor-enthusiasts'
const LEGACY = `/${SLUG}/`
const body = readFileSync('/tmp/claude-0/-root/04a47400-b067-4c43-9e32-706f5f0939e7/scratchpad/nf2/body.html', 'utf8').trim()
const DESC = 'A practical look at forest sporting activities for outdoor enthusiasts, from trail sports and paddling to gear, skill level, and safety considerations.'

const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const [row] = await sql`
  INSERT INTO articles (
    state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at,
    seo_title, seo_description
  ) VALUES (
    'uk', ${SLUG}, ${LEGACY},
    'New Forest Sporting Activities for Outdoor Enthusiasts to Try',
    ${DESC},
    ${body},
    'https://media.bugbitten.com/autravel/articles/newforest/kayaking-tidal-water.webp',
    ${sql.json(['Activities'])}, ${sql.json([])}, 'post', 'published', 'manual', now(),
    'New Forest Sporting Activities to Try',
    ${DESC}
  )
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path = EXCLUDED.legacy_path, title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
    cover_image = EXCLUDED.cover_image, categories = EXCLUDED.categories,
    seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
    status = EXCLUDED.status, updated_at = now()
  RETURNING id, slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
