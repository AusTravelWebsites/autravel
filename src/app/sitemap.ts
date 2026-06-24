import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { trailsCopy } from '@/lib/trails'

export const revalidate = 3600

type Entry = MetadataRoute.Sitemap[number]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const SITE = `https://${tenant.host}`
  const now = new Date()

  const staticPages: Entry[] = [
    { url: `${SITE}/`,              changeFrequency: 'daily',   priority: 1.0,  lastModified: now },
    { url: `${SITE}/destinations/`, changeFrequency: 'daily',   priority: 0.95, lastModified: now },
    { url: `${SITE}/parks/`,        changeFrequency: 'daily',   priority: 0.95, lastModified: now },
    { url: `${SITE}/tours/`,        changeFrequency: 'daily',   priority: 0.95, lastModified: now },
    { url: `${SITE}/distances/`,    changeFrequency: 'weekly',  priority: 0.7,  lastModified: now },
    { url: `${SITE}/about/`,        changeFrequency: 'monthly', priority: 0.6,  lastModified: now },
    { url: `${SITE}/contact/`,      changeFrequency: 'monthly', priority: 0.5,  lastModified: now },
    { url: `${SITE}/authors/`,      changeFrequency: 'monthly', priority: 0.5,  lastModified: now },
    { url: `${SITE}/authors/mick-gallagher/`, changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${SITE}/authors/beth-hartley/`,   changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${SITE}/authors/sam-davies/`,     changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${SITE}/authors/jess-rowe/`,      changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    ...(tenant.aggregator ? [{ url: `${SITE}/states/`, changeFrequency: 'monthly' as const, priority: 0.6, lastModified: now }] : []),
    { url: `${SITE}/privacy/`,      changeFrequency: 'yearly',  priority: 0.4,  lastModified: now },
    { url: `${SITE}/terms/`,        changeFrequency: 'yearly',  priority: 0.4,  lastModified: now },
    { url: `${SITE}/cookies/`,      changeFrequency: 'yearly',  priority: 0.4,  lastModified: now },
  ]

  let destinations: Entry[] = []
  let parks: Entry[] = []
  let tours: Entry[] = []
  let articles: Entry[] = []

  try {
    const rows = await db`
      SELECT slug, hero_image, COALESCE(updated_at, created_at) AS lm
      FROM destinations
      WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
      LIMIT 5000`
    destinations = (rows as any[]).map(d => {
      const e: Entry = { url: `${SITE}/${d.slug}/`, lastModified: d.lm ? new Date(d.lm) : now, changeFrequency: 'weekly', priority: 0.9 }
      if (d.hero_image) e.images = [d.hero_image]
      return e
    })
  } catch {}

  try {
    const rows = await db`
      SELECT slug, cover_image, COALESCE(updated_at, created_at) AS lm
      FROM parks
      WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT 20000`
    parks = (rows as any[]).map(p => {
      const e: Entry = { url: `${SITE}/parks/${p.slug}/`, lastModified: p.lm ? new Date(p.lm) : now, changeFrequency: 'weekly', priority: 0.8 }
      if (p.cover_image) e.images = [p.cover_image]
      return e
    })
  } catch {}

  try {
    const rows = await db`
      SELECT slug, cover_image, COALESCE(updated_at, source_fetched_at, created_at) AS lm
      FROM tours
      WHERE active = true AND (${state}::text IS NULL OR state_code = ${state}::text)
      ORDER BY COALESCE(updated_at, source_fetched_at, created_at) DESC
      LIMIT 20000`
    tours = (rows as any[]).map(t => {
      const e: Entry = { url: `${SITE}/tours/${t.slug}/`, lastModified: t.lm ? new Date(t.lm) : now, changeFrequency: 'weekly', priority: 0.75 }
      if (t.cover_image) e.images = [t.cover_image]
      return e
    })
  } catch {}

  try {
    // Preserved WP URLs: legacy_path is the canonical public URL (served by
    // the [...legacy] catch-all). When an article has no legacy_path, it was
    // created fresh on autravel and lives at /articles/<slug>/.
    const rows = await db`
      SELECT slug, legacy_path, cover_image, noindex,
             COALESCE(published_at, updated_at, created_at) AS lm
      FROM articles
      WHERE status = 'published'
        AND (noindex IS NULL OR noindex = false)
        AND (${state}::text IS NULL OR state_code = ${state}::text)
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 50000`
    articles = (rows as any[]).map(a => {
      const path = a.legacy_path || `/articles/${a.slug}/`
      const e: Entry = { url: `${SITE}${path}`, lastModified: a.lm ? new Date(a.lm) : now, changeFrequency: 'monthly', priority: 0.7 }
      if (a.cover_image) e.images = [a.cover_image]
      return e
    })
  } catch {}

  let distances: Entry[] = []
  try {
    const rows = await db`
      SELECT state_code, from_slug, to_slug, updated_at
      FROM distance_pairs
      WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      LIMIT 5000`
    distances = (rows as any[]).flatMap(p => {
      const lm = p.updated_at ? new Date(p.updated_at) : now
      return [
        { url: `${SITE}/distances/${p.state_code}/${p.from_slug}-to-${p.to_slug}/`, lastModified: lm, changeFrequency: 'monthly' as const, priority: 0.6 },
        { url: `${SITE}/distances/${p.state_code}/${p.to_slug}-to-${p.from_slug}/`, lastModified: lm, changeFrequency: 'monthly' as const, priority: 0.5 },
      ]
    })
  } catch {}

  // Walks / trails explorer — any tenant with a trailsRoute (New Forest /park-maps,
  // Perth /walks, etc.). Public URLs use the tenant's own base path.
  let trails: Entry[] = []
  const tc = trailsCopy(tenant)
  if (tc.enabled) {
    const tState = state ?? tenant.state_code
    staticPages.push({ url: `${SITE}${tc.base}/`, changeFrequency: 'weekly', priority: 0.9, lastModified: now })
    try {
      const rows = await db`
        SELECT slug, COALESCE(updated_at, created_at) AS lm
        FROM autravel.trails
        WHERE state_code = ${tState} AND active = true
        LIMIT 5000`
      trails = (rows as any[]).map(t => ({
        url: `${SITE}${tc.base}/${t.slug}/`,
        lastModified: t.lm ? new Date(t.lm) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    } catch {}
  }

  return [...staticPages, ...destinations, ...parks, ...tours, ...articles, ...distances, ...trails]
}
