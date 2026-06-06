import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const dynamic = 'force-dynamic'

// Unified autravel search across destinations, parks, tours, and articles.
// GET /api/search?q=...&limit=10
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ destinations: [], parks: [], tours: [], articles: [] })
  const limit = Math.min(parseInt(sp.get('limit') || '10'), 25)
  const pat = `%${q}%`
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)

  const [destinations, parks, tours, articles] = await Promise.all([
    db`SELECT slug, name, region, intro, hero_image
       FROM destinations
       WHERE active AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND (name ILIKE ${pat} OR region ILIKE ${pat} OR intro ILIKE ${pat})
       ORDER BY (name ILIKE ${q + '%'}) DESC, is_featured DESC, display_order
       LIMIT ${limit}`.catch(() => []),
    db`SELECT slug, name, region, suburb, park_type, cover_image, price_from, currency, avg_rating
       FROM parks
       WHERE active AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND (name ILIKE ${pat} OR region ILIKE ${pat} OR suburb ILIKE ${pat})
       ORDER BY (name ILIKE ${q + '%'}) DESC, featured DESC, avg_rating DESC NULLS LAST
       LIMIT ${limit}`.catch(() => []),
    db`SELECT slug, title, city, cover_image, rating, review_count, price_from, currency
       FROM tours
       WHERE active AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND (title ILIKE ${pat} OR city ILIKE ${pat} OR summary_ai ILIKE ${pat})
       ORDER BY (title ILIKE ${q + '%'}) DESC, featured DESC, rating DESC NULLS LAST
       LIMIT ${limit}`.catch(() => []),
    db`SELECT slug, legacy_path, title, excerpt, cover_image, published_at, destination_slug
       FROM articles
       WHERE status = 'published' AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND (title ILIKE ${pat} OR excerpt ILIKE ${pat} OR body_html ILIKE ${pat})
       ORDER BY (title ILIKE ${q + '%'}) DESC, published_at DESC NULLS LAST
       LIMIT ${limit}`.catch(() => []),
  ])

  return NextResponse.json({ destinations, parks, tours, articles })
}
