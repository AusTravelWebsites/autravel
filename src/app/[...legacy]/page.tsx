/**
 * Legacy WP URL catch-all.
 *
 * Matches any path not handled by a static route (/tours, /parks, etc.). If an
 * article has a matching `legacy_path`, we render it here so old WP URLs like
 * `/cairns-guide/` or `/best-beaches-qld/` keep working after the rebuild.
 *
 * If no article matches, return notFound() — Next.js will render not-found.tsx.
 *
 * IMPORTANT: this route sits *below* everything else in Next.js's matcher
 * priority, so static routes still win. Never add logic here that mutates
 * state or makes external calls beyond the single article lookup.
 */
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'
import { ArticleView } from '@/app/articles/[slug]/page'

// Look up an admin-configured redirect row for this path, tenant-scoped.
// Returns the destination path or null if no match.
async function findRedirect(pathWithSlash: string, pathNoSlash: string, state: StateCode | null): Promise<string | null> {
  try {
    const [row] = await db<any[]>`
      SELECT to_path FROM redirects
      WHERE match_type = 'exact'
        AND is_active = true
        AND (state_code = ${state} OR state_code IS NULL)
        AND from_path = ANY(${[pathWithSlash, pathNoSlash]}::text[])
      ORDER BY state_code NULLS LAST
      LIMIT 1`
    return row?.to_path || null
  } catch { return null }
}

// Legacy `.html` URLs (the pre-WordPress static-site era, ~2008+) were never
// migrated with a slug. They still appear as dead internal links inside
// migrated article bodies. Rather than 404, map the path to its closest
// destination guide — the first path segment that matches a destination slug.
async function findHtmlFallback(segments: string[], state: StateCode | null): Promise<string | null> {
  const candidates = segments
    .map(s => decodeURIComponent(s).replace(/\.html$/i, '').toLowerCase())
    .filter(Boolean)
  if (!candidates.length) return null
  try {
    const rows = await db<any[]>`
      SELECT slug FROM destinations
      WHERE (${state}::text IS NULL OR state_code = ${state}::text)
        AND slug = ANY(${candidates}::text[])`
    const hit = new Set(rows.map(r => r.slug))
    // Prefer the earliest (most general) segment that is a destination.
    for (const c of candidates) {
      if (hit.has(c)) return `/${c}/`
    }
  } catch { /* fall through */ }
  return null
}

function normalisePath(segments: string[]): string[] {
  // Try with and without trailing slash; WP typically uses trailing slashes.
  const joined = '/' + segments.join('/')
  const withSlash = joined.endsWith('/') ? joined : joined + '/'
  const withoutSlash = joined.endsWith('/') ? joined.slice(0, -1) : joined
  return [withSlash, withoutSlash]
}

async function getByLegacyPath(segments: string[], state: StateCode | null) {
  const candidates = normalisePath(segments)
  try {
    const [row] = await db<any[]>`
      SELECT * FROM articles
      WHERE status = 'published'
        AND (${state}::text IS NULL OR state_code = ${state}::text)
        AND legacy_path = ANY(${candidates}::text[])
      LIMIT 1`
    return row || null
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ legacy: string[] }> }): Promise<Metadata> {
  const { legacy } = await params
  const tenant = await getTenant()
  const a = await getByLegacyPath(legacy, stateFilterValue(tenant))
  if (!a) return {}
  // Layout's title template adds " · {tenant.name}" (~13–17 chars) — budget ≤45 raw chars to keep total ≤60.
  const rawTitle = a.seo_title || a.title
  const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
  const bodyFirst = a.body_html ? String(a.body_html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/).slice(0, 2).join(' ') : ''
  const rawDesc = a.seo_description
    || a.excerpt
    || (bodyFirst && bodyFirst.length > 60 ? bodyFirst : '')
    || `${a.title} — travel guide for ${tenant.stateName} from ${tenant.name}.`
  const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
  const url = `https://${tenant.host}${a.legacy_path || `/articles/${a.slug}/`}`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: a.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description: desc, type: 'article', url, images: a.cover_image ? [a.cover_image] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: a.cover_image ? [a.cover_image] : [] },
  }
}

export default async function LegacyRoute({ params }: { params: Promise<{ legacy: string[] }> }) {
  const { legacy } = await params
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)

  // 1. Admin-configured redirects (from the `redirects` table — includes the
  //    auto-seeded .html → /slug/ rules). Checked first so we never render
  //    article content at a URL we've decided is redundant.
  const joined = '/' + legacy.join('/')
  const withSlash = joined.endsWith('/') ? joined : joined + '/'
  const noSlash = joined.endsWith('/') ? joined.slice(0, -1) : joined
  const redirectTarget = await findRedirect(withSlash, noSlash, state)
  if (redirectTarget) permanentRedirect(redirectTarget)

  // 2. Otherwise serve the article at its original URL.
  const article = await getByLegacyPath(legacy, state)
  if (article) {
    let author = null
    try {
      const rows = await db<Array<{ slug: string; name: string; role: string | null; bio: string | null; avatar_url: string | null }>>`
        SELECT slug, name, role, bio, avatar_url FROM autravel.authors
         WHERE is_active = true AND (slug = ${article.author_slug ?? ''} OR name = ${article.author ?? ''})
         LIMIT 1`
      author = rows[0] || null
    } catch {}
    return <ArticleView article={article} tenant={tenant} author={author}/>
  }

  // 3. Dead legacy `.html` URL with no article — redirect to the closest
  //    destination guide, or the homepage, instead of 404ing.
  const last = legacy[legacy.length - 1] || ''
  if (last.toLowerCase().endsWith('.html')) {
    const dest = await findHtmlFallback(legacy, state)
    permanentRedirect(dest || '/')
  }

  notFound()
}
