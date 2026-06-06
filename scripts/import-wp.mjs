#!/usr/bin/env node
/**
 * import-wp.mjs — migrate every WordPress post + page from a legacy travel site
 * into the autravel `articles` table, preserving the original URL so existing
 * SEO and backlinks keep working.
 *
 * Usage:
 *   node scripts/import-wp.mjs --state qld --wp-user qldtravel [--dry-run] [--limit 50]
 *
 * Data source: reads the WP site's MySQL DB directly via the user's cPanel
 * credentials. Expects a local `wp-config.php`-equivalent in env:
 *   WP_DB_HOST, WP_DB_USER, WP_DB_PASS, WP_DB_NAME, WP_TABLE_PREFIX (default "wp_")
 * Or pass --wp-user <cpanel account> and this script will resolve wp-config.php
 * at /home/<user>/public_html/wp-config.php automatically.
 *
 * CRITICAL RULES (see /root/.claude/projects/-root/memory/feedback_never_modify_link_rels.md):
 *
 *   1. body_html is stored VERBATIM. No link rewriting. No rel manipulation.
 *      No nofollow added/removed. No href transformations. Preserve every
 *      <a> tag and its attributes exactly as the WP editor saved them.
 *
 *   2. Post status transitions: published WP posts become status='published'
 *      articles. Drafts become 'draft'. Private/trashed are SKIPPED (not imported)
 *      but we log the count so nothing is silently lost.
 *
 *   3. legacy_path is the full permalink path (e.g. "/cairns-guide/") including
 *      trailing slash to match how WP serves the page. The autravel catch-all
 *      route at src/app/[...legacy]/page.tsx matches against this.
 *
 *   4. This script is idempotent on (state_code, legacy_path) — re-runs UPDATE
 *      in place and do not create duplicates.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import mysql from 'mysql2/promise'

const args = process.argv.slice(2)
function arg(name, fallback = null) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const STATE = (arg('state') || '').toLowerCase()
const WP_USER = arg('wp-user')
const DRY = args.includes('--dry-run')
const LIMIT = Number(arg('limit', '0')) || null

if (!STATE) { console.error('Usage: node scripts/import-wp.mjs --state <qld|nsw|...> --wp-user <cpanel-acct> [--dry-run] [--limit N]'); process.exit(1) }

function parseWpConfig(file) {
  const src = fs.readFileSync(file, 'utf8')
  const grab = (name) => {
    const re = new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*['"]([^'"]*)['"]\\s*\\)`)
    const m = src.match(re); return m ? m[1] : null
  }
  const tablePrefixMatch = src.match(/\$table_prefix\s*=\s*['"]([^'"]+)['"]/)
  return {
    DB_HOST: grab('DB_HOST') || 'localhost',
    DB_USER: grab('DB_USER'),
    DB_PASSWORD: grab('DB_PASSWORD'),
    DB_NAME: grab('DB_NAME'),
    TABLE_PREFIX: tablePrefixMatch ? tablePrefixMatch[1] : 'wp_',
  }
}

let wpCfg
if (WP_USER) {
  const wpConfig = `/home/${WP_USER}/public_html/wp-config.php`
  if (!fs.existsSync(wpConfig)) { console.error(`wp-config.php not found at ${wpConfig}`); process.exit(1) }
  wpCfg = parseWpConfig(wpConfig)
} else {
  wpCfg = {
    DB_HOST: process.env.WP_DB_HOST || 'localhost',
    DB_USER: process.env.WP_DB_USER,
    DB_PASSWORD: process.env.WP_DB_PASS,
    DB_NAME: process.env.WP_DB_NAME,
    TABLE_PREFIX: process.env.WP_TABLE_PREFIX || 'wp_',
  }
}
if (!wpCfg.DB_USER || !wpCfg.DB_NAME) { console.error('Missing WP DB credentials'); process.exit(1) }

const PG_URL = process.env.DATABASE_URL
if (!PG_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post'
}

function extractFirstImage(html) {
  const m = (html || '').match(/<img[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : null
}

function stripTagsForExcerpt(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
}

async function run() {
  const started_at = new Date()
  const sql = postgres(PG_URL, { prepare: false, max: 4, connection: { search_path: 'autravel, public' } })
  const wp = await mysql.createConnection({
    host: wpCfg.DB_HOST, user: wpCfg.DB_USER, password: wpCfg.DB_PASSWORD,
    database: wpCfg.DB_NAME, charset: 'utf8mb4',
  })
  const T = wpCfg.TABLE_PREFIX

  // Pull every post/page with its status + parent. We import 'publish' and
  // 'draft'; we DO NOT trash or delete anything — 'private' and 'trash' rows
  // are counted and logged for visibility.
  const [posts] = await wp.execute(`
    SELECT p.ID, p.post_title, p.post_name, p.post_content, p.post_excerpt,
           p.post_date_gmt, p.post_modified_gmt, p.post_status, p.post_type,
           p.post_parent, p.guid,
           u.display_name AS author
    FROM ${T}posts p
    LEFT JOIN ${T}users u ON u.ID = p.post_author
    WHERE p.post_type IN ('post','page')
    ORDER BY p.post_date_gmt DESC
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}`)

  // Build a map of ID → post_name for parent-walking. Hierarchical pages
  // (WP's default parent model) have `/parent/child/` permalinks; without
  // walking the chain we'd collapse every "accommodation" child onto a single
  // slug and lose hundreds of pages.
  const byId = new Map()
  for (const p of posts) byId.set(p.ID, p)

  function pagePathFor(p) {
    // Build /grandparent/parent/child/ from the post_parent chain.
    const parts = []
    let cur = p
    const visited = new Set()
    while (cur && cur.post_name) {
      if (visited.has(cur.ID)) break
      visited.add(cur.ID)
      parts.unshift(cur.post_name)
      cur = cur.post_parent ? byId.get(cur.post_parent) : null
    }
    return parts.length ? '/' + parts.join('/') + '/' : null
  }

  console.log(` Pulled ${posts.length} WP rows from ${wpCfg.DB_NAME}`)

  // Map of post_id → [category/tag names]
  const [terms] = await wp.execute(`
    SELECT tr.object_id, t.name, tt.taxonomy
    FROM ${T}term_relationships tr
    JOIN ${T}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    JOIN ${T}terms t ON t.term_id = tt.term_id
    WHERE tt.taxonomy IN ('category','post_tag')`)
  const termsByPost = new Map()
  for (const r of terms) {
    const k = `${r.object_id}`
    if (!termsByPost.has(k)) termsByPost.set(k, { categories: [], tags: [] })
    const entry = termsByPost.get(k)
    if (r.taxonomy === 'category') entry.categories.push(r.name)
    else entry.tags.push(r.name)
  }

  // Map of post_id → featured image URL
  const [featured] = await wp.execute(`
    SELECT pm.post_id, gm.meta_value AS url
    FROM ${T}postmeta pm
    JOIN ${T}postmeta gm
      ON gm.post_id = CAST(pm.meta_value AS UNSIGNED)
      AND gm.meta_key = '_wp_attached_file'
    WHERE pm.meta_key = '_thumbnail_id'`)
  const featuredByPost = new Map(featured.map(r => [String(r.post_id), r.url]))

  // Get site URL to build legacy path
  const [siteRow] = await wp.execute(`SELECT option_value AS siteurl FROM ${T}options WHERE option_name = 'home' LIMIT 1`)
  const siteUrl = (siteRow[0]?.siteurl || '').replace(/\/$/, '')

  let ok = 0, skipped = 0, failed = 0
  const skipReasons = { auto_draft: 0, inherit: 0, other: 0 }

  for (const p of posts) {
    try {
      // Auto-drafts and revisions have no user-authored content — truly ephemeral.
      if (p.post_status === 'auto-draft' || p.post_status === 'inherit') {
        skipped++; skipReasons[p.post_status === 'auto-draft' ? 'auto_draft' : 'inherit']++; continue
      }
      // Everything else — published, draft, pending, private, trash — gets
      // imported. Craig's rule: preserve EVERY bit of WP content. Non-public
      // statuses map to autravel statuses that don't serve publicly but live
      // in the DB forever and can be restored from admin.
      //   publish  → published
      //   draft    → draft
      //   pending  → draft
      //   private  → private  (not served, preserved in DB)
      //   trash    → archived (not served, preserved in DB)
      //   future   → draft
      const STATUS_MAP = { publish: 'published', draft: 'draft', pending: 'draft', private: 'private', trash: 'archived', future: 'draft' }
      const mappedStatus = STATUS_MAP[p.post_status] || 'draft'

      // Legacy path. Hierarchical pages MUST walk the post_parent chain
      // so children don't collapse onto a shared post_name (e.g. every
      // /<dest>/accommodation/ page shares post_name='accommodation').
      // Posts use flat /%postname%/.
      let legacyPath = null
      if (p.post_type === 'page') legacyPath = pagePathFor(p)
      if (!legacyPath) legacyPath = p.post_name ? `/${p.post_name}/` : null
      // As a last resort, try to parse the GUID.
      if (!legacyPath) {
        try {
          const u = new URL(p.guid)
          if (u.pathname && u.pathname !== '/' && !u.search.includes('page_id')) {
            legacyPath = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/'
          }
        } catch {}
      }
      // Last-resort fallback: posts/pages with neither a post_name nor a pretty
      // guid still need to be preserved. Use the WP post ID as the URL so the
      // row exists somewhere on autravel (e.g. /wp-post-123/). Never drop.
      if (!legacyPath) {
        legacyPath = `/wp-${p.post_type}-${p.ID}/`
      }

      // IMPORTANT: body_html stored VERBATIM. Do NOT transform links.
      // See /root/.claude/projects/-root/memory/feedback_never_modify_link_rels.md
      const body_html = p.post_content || ''

      // Derive a unique article slug from the full legacy_path so hierarchical
      // pages don't collide. "/cairns/accommodation/" → "cairns-accommodation".
      // Suffix with WP post ID to guarantee uniqueness even across trash
      // variants / revision ghosts / encoding edge cases — never lose a row
      // to a slug collision.
      const pathSlug = slugify(legacyPath.replace(/^\/|\/$/g, '').replace(/\//g, '-'))
      const baseSlug = pathSlug || slugify(p.post_title) || `post-${p.ID}`
      const slug = `${baseSlug}-${p.ID}`
      const cover_image = featuredByPost.get(String(p.ID)) || extractFirstImage(body_html)
      const tx = termsByPost.get(String(p.ID)) || { categories: [], tags: [] }
      const excerpt = (p.post_excerpt || '').trim() || stripTagsForExcerpt(body_html)

      if (DRY) { console.log(`  (dry) ${p.post_type} ${STATE}${legacyPath}  ←  "${p.post_title}"`); ok++; continue }

      await sql`
        INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
                              categories, tags, post_type, author, status, source, source_raw,
                              published_at, updated_at_source)
        VALUES (${STATE}, ${slug}, ${legacyPath}, ${p.post_title || 'Untitled'}, ${excerpt},
                ${body_html}, ${cover_image || null},
                ${sql.json(tx.categories)}, ${sql.json(tx.tags)},
                ${p.post_type}, ${p.author || null},
                ${mappedStatus},
                'wp_import', ${sql.json({ wp_id: p.ID, wp_guid: p.guid, wp_status: p.post_status, wp_site: siteUrl })},
                ${p.post_date_gmt || null}, ${p.post_modified_gmt || null})
        ON CONFLICT (state_code, slug) DO UPDATE SET
          legacy_path = EXCLUDED.legacy_path,
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          body_html = EXCLUDED.body_html,
          cover_image = COALESCE(articles.cover_image, EXCLUDED.cover_image),
          categories = EXCLUDED.categories,
          tags = EXCLUDED.tags,
          status = EXCLUDED.status,
          source_raw = EXCLUDED.source_raw,
          updated_at_source = EXCLUDED.updated_at_source,
          updated_at = NOW()`
      ok++
    } catch (e) {
      console.warn(`  FAILED post ${p.ID} "${p.post_title}":`, e.message)
      failed++; skipReasons.other++
    }
  }

  await wp.end()

  const finished_at = new Date()
  console.log(`\n Done: imported=${ok} skipped=${skipped} failed=${failed}  (${Math.round((finished_at - started_at) / 1000)}s)`)
  console.log(`  skipped reasons:`, skipReasons)

  if (!DRY) {
    await sql`
      INSERT INTO wp_import_log (state_code, action, ok, count_ok, count_fail, details, started_at, finished_at)
      VALUES (${STATE}, 'wp:posts+pages', ${failed === 0}, ${ok}, ${failed},
              ${sql.json({ skipped, skipReasons, wp_site: siteUrl, wp_db: wpCfg.DB_NAME, wp_user: WP_USER || null })},
              ${started_at}, ${finished_at})`
  }
  await sql.end()
}

run().catch(e => { console.error(e); process.exit(1) })
