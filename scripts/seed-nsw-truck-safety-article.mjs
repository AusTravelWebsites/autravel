import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'
// Guest post "Essential Truck Safety Tips for Sharing the Road with Heavy Vehicles in Australia"
// (client Google Doc, Tokhi Driving Solutions link kept as supplied, plus our NSW sections), 31 Oct 2026.
const SLUG = 'truck-safety-tips-sharing-the-road-with-heavy-vehicles'
const LEGACY = `/${SLUG}/`
// The H1 keeps the client's full title; the template does not truncate it.
const TITLE = 'Essential Truck Safety Tips for Sharing the Road with Heavy Vehicles in Australia'
// autravel's article template ellipsises seo_title over 45 chars (reference_autravel_article_meta_caps),
// which is stricter than the toolkit's 60. Focus keyword: "truck safety tips".
const SEO_TITLE = 'Truck Safety Tips for Sharing the Road'
const DESC = 'Truck safety tips for NSW drivers: following distance, blind spots, overtaking, turning trucks, towing a caravan and using rest areas on long drives.'
const COVER = 'https://media.bugbitten.com/autravel/articles/nsw/truck-safety-b-double-newell-highway-jerilderie-1600x900.webp'
const body = readFileSync(process.argv[2], 'utf8').trim()
if (SEO_TITLE.length > 45) { console.error(`seo_title ${SEO_TITLE.length} > 45`); process.exit(1) }
if (DESC.length < 140 || DESC.length > 155) { console.error(`desc ${DESC.length} not 140-155`); process.exit(1) }
if (!body.includes(COVER)) { console.error('cover image is not in the body'); process.exit(1) }
const sql = postgres(process.env.DATABASE_URL, { prepare: false })
// Never clobber a different article that already owns this slug or path.
const clash = await sql`SELECT slug, legacy_path, source FROM articles
  WHERE state_code='nsw' AND (slug=${SLUG} OR legacy_path=${LEGACY}) AND NOT (slug=${SLUG} AND source='manual')`
if (clash.length) { console.error('slug/path already taken:', clash); await sql.end(); process.exit(2) }
const [row] = await sql`
  INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at, seo_title, seo_description, author, author_slug)
  VALUES ('nsw', ${SLUG}, ${LEGACY}, ${TITLE}, ${DESC}, ${body}, ${COVER},
    ${sql.json(['Road Trip'])}, ${sql.json([])}, 'post', 'published', 'manual', now(), ${SEO_TITLE}, ${DESC},
    'Jess Rowe', 'jess-rowe')
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path=EXCLUDED.legacy_path, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
    body_html=EXCLUDED.body_html, cover_image=EXCLUDED.cover_image, categories=EXCLUDED.categories,
    seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description,
    author=EXCLUDED.author, author_slug=EXCLUDED.author_slug, status=EXCLUDED.status, updated_at=now()
  RETURNING slug, legacy_path, published_at`
console.log('article:', row)
await sql.end()
