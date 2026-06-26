#!/usr/bin/env node
/**
 * publish-drafts-staggered.mjs — drips wayback-restored / AI-generated drafts
 * to status='published' at a rate that doesn't look like a bulk-publish event.
 *
 * Per the "Stagger SEO/content changes — never bulk" rule:
 *   - At most MAX_PER_DAY_PER_STATE published per state per calendar day
 *   - At most 1 per cron tick (randomised odds so not every tick publishes)
 *   - Only between PUBLISH_HOURS_START..END AEST
 *   - Oldest drafts first (FIFO so the queue drains naturally)
 *
 * Cron: every hour between 09 and 17 AEST → one tick per hour.
 *   0 9-17 * * * /usr/local/bin/node --env-file=.env.local \
 *     /var/www/autravel/scripts/publish-drafts-staggered.mjs \
 *     >> /var/www/autravel/logs/publish-staggered.log 2>&1
 *
 * Tunable per-state via DB row in autravel.admin_settings (key 'publish_max_per_day').
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })

const MAX_PER_DAY_PER_STATE = Number(process.env.PUBLISH_MAX_PER_DAY || 3)
const TICK_PROBABILITY = Number(process.env.PUBLISH_TICK_PROBABILITY || 0.45)
const STATES = ['nsw', 'wa', 'qld', 'vic', 'sa', 'tas', 'nt', 'aunz', 'uk']

const ts = () => new Date().toISOString()
const log = (...a) => console.log(`[publish ${ts()}]`, ...a)

async function publishedTodayCount(state) {
  const [{ c }] = await sql`
    SELECT COUNT(*)::int AS c FROM articles
    WHERE state_code = ${state}
      AND status = 'published'
      AND published_at >= date_trunc('day', NOW() AT TIME ZONE 'Australia/Brisbane')
      AND source IN ('wayback-restore','ai-generated','staggered-publish')`
  return c
}

async function pickOldestDraft(state) {
  // Pick the oldest draft created from wayback-restore or AI-generated.
  // Skip user-created drafts (would have source NULL or 'admin').
  const [row] = await sql`
    SELECT id, slug, legacy_path, state_code, title FROM articles
    WHERE state_code = ${state}
      AND status = 'draft'
      AND source IN ('wayback-restore','ai-generated')
    ORDER BY created_at ASC LIMIT 1`
  return row || null
}

async function publish(article) {
  await sql.begin(async tx => {
    await tx`
      UPDATE articles
      SET status = 'published',
          published_at = COALESCE(published_at, NOW()),
          updated_at = NOW(),
          source = source || ' | staggered'
      WHERE id = ${article.id}`
    // If a redirect was previously pointing this legacy path at a lazy target
    // (root, /tours/, /destinations/, etc), delete it now that the actual
    // article serves at this URL. The catch-all checks redirects BEFORE
    // articles, so a stale redirect would suppress the freshly-published page.
    if (article.legacy_path) {
      await tx`
        DELETE FROM autravel.redirects
        WHERE COALESCE(state_code,'') IN ('', ${article.state_code ?? ''})
          AND from_path = ${article.legacy_path}
          AND is_active = true`
    }
  })
}

async function main() {
  // Roll the dice — most ticks do nothing (avoids "exactly every hour" pattern).
  if (Math.random() > TICK_PROBABILITY) {
    log(`tick skipped (random p=${TICK_PROBABILITY.toFixed(2)})`)
    await sql.end(); return
  }

  let totalPublished = 0
  for (const state of STATES) {
    const done = await publishedTodayCount(state)
    if (done >= MAX_PER_DAY_PER_STATE) continue
    const draft = await pickOldestDraft(state)
    if (!draft) continue
    await publish(draft)
    log(`${state}: published "${draft.title}" (slug=${draft.slug}, legacy=${draft.legacy_path}) — ${done + 1}/${MAX_PER_DAY_PER_STATE} today`)
    totalPublished++
  }
  if (totalPublished === 0) log('nothing to publish (queue drained or daily caps met)')
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
