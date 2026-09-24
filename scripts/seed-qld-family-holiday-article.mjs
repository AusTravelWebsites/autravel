import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'
const SLUG = 'essential-travel-tips-for-planning-a-queensland-family-holiday'
const LEGACY = `/${SLUG}/`
const TITLE = 'Essential Travel Tips for Planning a Queensland Family Holiday'
const SEO_TITLE = 'Planning a Queensland Family Holiday'
const DESC = 'Practical tips for a Queensland family holiday: choosing a base, real drive times, stinger season, accommodation, insurance and the costs nobody budgets.'
const body = readFileSync(process.argv[2], 'utf8').trim()
if (SEO_TITLE.length > 45 || DESC.length > 155) { console.error('meta over cap'); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [row] = await sql`
  INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description)
  VALUES ('qld', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body},
    'https://media.bugbitten.com/autravel/articles/qld/qld-family-beach.webp',
    ${sql.json(['Travel'])}, ${sql.json([])}, 'post', 'published', 'manual', now(), ${SEO_TITLE}, ${DESC})
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    status=EXCLUDED.status, updated_at=now()
  RETURNING id, slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
