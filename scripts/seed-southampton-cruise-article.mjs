import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'
const SLUG = 'cruises-from-southampton-what-to-do-before-you-sail'
const LEGACY = `/${SLUG}/`
const TITLE = 'Southampton: Make the most of the city where cruises set sail'
// autravel's article template ellipsises seo_title over 45 chars (reference_autravel_article_meta_caps),
// which is stricter than the toolkit's 60. Use the tighter of the two.
const SEO_TITLE = 'Cruises from Southampton: the day before'
const DESC = 'Taking one of the cruises from Southampton? Use the day before: the New Forest by train, short waymarked walks, where to stay inland and when to board.'
const body = readFileSync(process.argv[2], 'utf8').trim()
if (SEO_TITLE.length > 45) { console.error(`seo_title ${SEO_TITLE.length} > 45`); process.exit(1) }
if (DESC.length < 140 || DESC.length > 160) { console.error(`desc ${DESC.length} not 140-160`); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [row] = await sql`
  INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description)
  VALUES ('uk', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body},
    'https://media.bugbitten.com/autravel/articles/newforest/southampton-cruise-terminal.webp',
    ${sql.json(['Travel'])}, ${sql.json([])}, 'post', 'published', 'manual', now(), ${SEO_TITLE}, ${DESC})
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    status=EXCLUDED.status, updated_at=now()
  RETURNING slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
