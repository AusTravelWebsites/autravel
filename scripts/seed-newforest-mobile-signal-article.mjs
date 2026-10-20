import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'
// Guest post "Staying Connected in the New Forest" (client copy + our sections), 20 Oct 2026.
const SLUG = 'staying-connected-in-the-new-forest'
const LEGACY = `/${SLUG}/`
// The H1 keeps the client's full title; the template does not truncate it.
const TITLE = 'Staying Connected in the New Forest: A Practical Guide to Mobile Data and Signal'
// autravel's article template ellipsises seo_title over 45 chars (reference_autravel_article_meta_caps),
// which is stricter than the toolkit's 60. Use the tighter of the two.
const SEO_TITLE = 'New Forest Mobile Signal and Data Guide'
// The client's meta description, verbatim: 144 chars, inside both the 155 cap and the toolkit's 140-160.
const DESC = 'Planning a trip to the New Forest? Learn how mobile signal works across woodland and heath, your data options, and how to prepare before you go.'
const COVER = 'https://media.bugbitten.com/autravel/articles/newforest/sunlit-pine-woodland-path-1600x900.jpg'
const body = readFileSync(process.argv[2], 'utf8').trim()
if (SEO_TITLE.length > 45) { console.error(`seo_title ${SEO_TITLE.length} > 45`); process.exit(1) }
if (DESC.length < 140 || DESC.length > 155) { console.error(`desc ${DESC.length} not 140-155`); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false })
// Never clobber a different article that already owns this slug or path.
const clash = await sql`SELECT slug, legacy_path, source FROM articles
  WHERE state_code='uk' AND (slug=${SLUG} OR legacy_path=${LEGACY}) AND NOT (slug=${SLUG} AND source='manual')`
if (clash.length) { console.error('slug/path already taken:', clash); await sql.end(); process.exit(2) }
const [row] = await sql`
  INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description, author, author_slug)
  VALUES ('uk', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body}, ${COVER},
    ${sql.json(['Guides'])}, ${sql.json([])}, 'post', 'published', 'manual', now(), ${SEO_TITLE}, ${DESC},
    'Jess Rowe', 'jess-rowe')
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    author=EXCLUDED.author, author_slug=EXCLUDED.author_slug, status=EXCLUDED.status, updated_at=now()
  RETURNING slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
