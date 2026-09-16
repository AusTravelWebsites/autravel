import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import { readFileSync } from 'fs'
import postgres from 'postgres'

const SLUG = 'how-visitors-change-wildfire-risk-on-open-heath'
const LEGACY = `/${SLUG}/`
const DOC_SLUG = 'how-visitors-change-wildfire-risk-on-open-heath-new-forest-national-park-com'
const body = readFileSync('/tmp/claude-0/-root/04a47400-b067-4c43-9e32-706f5f0939e7/scratchpad/nf/body.html', 'utf8').trim()

const sql = postgres(process.env.DATABASE_URL, { prepare: false })

const [row] = await sql`
  INSERT INTO articles (
    state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
    categories, tags, post_type, status, source, published_at,
    seo_title, seo_description
  ) VALUES (
    'uk', ${SLUG}, ${LEGACY},
    'How Visitors Change Wildfire Risk On Open Heath',
    'Heathland burns differently from forest, and most ignitions are human. What starts these fires, why access decides the outcome, and what parking has to do with it.',
    ${body},
    'https://media.bugbitten.com/autravel/articles/newforest/heathland-gorse-summer-sky.webp',
    ${sql.json(['Guides'])}, ${sql.json([])}, 'post', 'published', 'manual', now(),
    'How Visitors Change Wildfire Risk On Heath',
    'Heathland burns differently from forest, and most ignitions are human. What starts these fires, why access decides the outcome, and why parking matters.'
  )
  ON CONFLICT (state_code, slug) DO UPDATE SET
    legacy_path = EXCLUDED.legacy_path, title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
    cover_image = EXCLUDED.cover_image, categories = EXCLUDED.categories,
    seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
    status = EXCLUDED.status, updated_at = now()
  RETURNING id, slug, legacy_path, published_at`
console.log('article:', row)

// Safety net: the source doc specified a slug with the site domain appended.
// Serve the clean URL, 301 the doc's version to it so both resolve.
const [r] = await sql`
  INSERT INTO redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
  VALUES ('uk', ${`/${DOC_SLUG}/`}, ${LEGACY}, 301, 'exact', true,
          'Source-doc slug had the site domain appended; canonical is the clean slug.')
  ON CONFLICT (COALESCE(state_code, ''), from_path) DO UPDATE SET
    to_path = EXCLUDED.to_path, is_active = true, updated_at = now()
  RETURNING from_path, to_path, redirect_type`
console.log('redirect:', r)

await sql.end()
