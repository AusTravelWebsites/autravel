import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import type { TenantConfig } from '@/lib/tenants'

export type MegaDest = { slug: string; name: string; cover_image: string | null }
export type MegaArticle = { slug: string; legacy_path: string | null; title: string; cover_image: string | null }
export type MegaAuthor = { slug: string; name: string; role: string | null; avatar_url: string | null }
export type MegaTrain = { slug: string; name: string; route_summary: string | null; is_national: boolean; is_heritage: boolean }

export type MegaMenu = {
  destinations: MegaDest[]
  recentArticles: MegaArticle[]
  authors: MegaAuthor[]
  trains: MegaTrain[]
  stateList: Array<{ host: string; name: string; stateName: string; state_code: string }>
}

// 2026-05-25 — this runs in the root layout on EVERY page request. Without
// caching it was firing 3 parallel DB queries per render across all 8 tenants,
// flooding the pool and crashing the whole app. Now cached per-tenant with a
// 10-min revalidate window. The data (destinations, recent articles, authors)
// changes rarely. A re-import or admin edit can bust by tag.

async function loadDestinationsRaw(state: string | null): Promise<MegaDest[]> {
  try {
    return await db<MegaDest[]>`
      SELECT slug, name, hero_image AS cover_image
        FROM autravel.destinations
       WHERE active
         AND (${state}::text IS NULL OR state_code = ${state}::text)
       ORDER BY is_featured DESC, display_order ASC, name ASC
       LIMIT 16`
  } catch (e) { console.warn('[mega/destinations]', (e as any)?.code || e); return [] }
}

async function loadRecentArticlesRaw(state: string | null): Promise<MegaArticle[]> {
  try {
    return await db<MegaArticle[]>`
      SELECT slug, legacy_path, title, cover_image
        FROM articles
       WHERE status='published'
         AND cover_image IS NOT NULL
         AND (${state}::text IS NULL OR state_code = ${state}::text)
       ORDER BY published_at DESC NULLS LAST
       LIMIT 4`
  } catch (e) { console.warn('[mega/articles]', (e as any)?.code || e); return [] }
}

async function loadAuthorsRaw(stateCode: string): Promise<MegaAuthor[]> {
  try {
    return await db<MegaAuthor[]>`
      SELECT slug, name, role, avatar_url
        FROM autravel.authors
       WHERE is_active = true
         AND (cardinality(state_codes) = 0 OR ${stateCode}::text = ANY(state_codes))
       ORDER BY display_order ASC, name ASC
       LIMIT 8`
  } catch (e) { console.warn('[mega/authors]', (e as any)?.code || e); return [] }
}

async function loadTrainsRaw(state: string | null): Promise<MegaTrain[]> {
  try {
    return await db<MegaTrain[]>`
      SELECT slug, name, route_summary, is_national, is_heritage
        FROM autravel.trains
       WHERE active
         AND (${state}::text IS NULL OR ${state}::text = ANY(state_codes))
       ORDER BY is_heritage ASC, display_order ASC, name ASC
       LIMIT 16`
  } catch (e) { console.warn('[mega/trains]', (e as any)?.code || e); return [] }
}

export async function loadMegaMenu(tenant: TenantConfig, stateList: MegaMenu['stateList']): Promise<MegaMenu> {
  const state = tenant.aggregator ? null : tenant.state_code
  const key = state ?? 'all'

  // Each piece cached separately so a content update on one doesn't bust the others.
  const cachedDestinations = unstable_cache(
    () => loadDestinationsRaw(state),
    ['mega-destinations', key],
    { revalidate: 600, tags: ['destinations', `destinations:${key}`] }
  )
  const cachedRecent = unstable_cache(
    () => loadRecentArticlesRaw(state),
    ['mega-recent-articles', key],
    { revalidate: 300, tags: ['articles', `articles:${key}`] }
  )
  const cachedAuthors = unstable_cache(
    () => loadAuthorsRaw(tenant.state_code),
    ['mega-authors', tenant.state_code],
    { revalidate: 86400, tags: ['authors', `authors:${tenant.state_code}`] }
  )
  const cachedTrains = unstable_cache(
    () => loadTrainsRaw(state),
    ['mega-trains', key],
    { revalidate: 3600, tags: ['trains', `trains:${key}`] }
  )

  const [destinations, recentArticles, authors, trains] = await Promise.all([
    cachedDestinations(),
    cachedRecent(),
    cachedAuthors(),
    cachedTrains(),
  ])

  return { destinations, recentArticles, authors, trains, stateList: tenant.aggregator ? stateList : [] }
}
