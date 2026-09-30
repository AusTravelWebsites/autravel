import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'
// aunz guest post (client copy, Superprof placement). NZ photos per Craig, see
// upload-moving-to-australia-english-images.mjs. aunz rows use state_code 'aunz'.
const SLUG = 'things-to-do-before-moving-to-australia-english-ready'
const LEGACY = `/${SLUG}/`
const TITLE = '7 Things to Do Before Moving to Australia to Make Sure Your English Is Ready'
const SEO_TITLE = 'Moving to Australia? Get Your English Ready'
const DESC = 'Moving to Australia? Seven steps to get your English ready: visa test scores, Aussie slang, a study plan that sticks, workplace writing and free help.'
const COVER = 'https://media.bugbitten.com/autravel/articles/aunz/things-to-do-before-moving-to-australia-english-ready-featured.webp'
const body = readFileSync(process.argv[2], 'utf8').trim()
if (SEO_TITLE.length > 45 || DESC.length > 155) { console.error('meta over cap'); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false })
const [author] = await sql`SELECT slug, name FROM autravel.authors WHERE slug = 'jess-rowe' AND is_active`
if (!author) { console.error('author jess-rowe missing'); process.exit(1) }
const [row] = await sql`
  INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description, author, author_slug)
  VALUES ('aunz', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body}, ${COVER},
    ${sql.json(['Travel', 'Travel Tips'])}, ${sql.json([])}, 'post', 'published', 'manual', now(),
    ${SEO_TITLE}, ${DESC}, ${author.name}, ${author.slug})
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    author=EXCLUDED.author, author_slug=EXCLUDED.author_slug, status=EXCLUDED.status, updated_at=now()
  RETURNING id, slug, legacy_path, published_at, author_slug`
console.log('article:', row)
await sql.end()
