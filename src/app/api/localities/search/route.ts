import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/localities/search?q=bondi&state=nsw[&limit=10]
// Public, tenant-state filtered, prefix + contains match. Returns up to `limit`
// rows ordered: prefix matches first, then population desc (cities/towns
// first), then alpha. Cached at the edge for 5 min via Cache-Control.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const state = (url.searchParams.get('state') || '').trim().toLowerCase()
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10))
  if (!state || !/^[a-z]{2,4}$/.test(state)) {
    return NextResponse.json({ results: [] })
  }
  try {
    if (!q) {
      // Empty query: return top localities by population (cities/towns only).
      const rows = await db<Array<{ name: string; slug: string; place_type: string }>>`
        SELECT name, slug, place_type
        FROM autravel.localities
        WHERE state_code = ${state}
          AND place_type IN ('city','town','suburb')
        ORDER BY population DESC NULLS LAST, name ASC
        LIMIT ${limit}`
      return NextResponse.json({ results: rows }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } })
    }
    const prefix = q.toLowerCase() + '%'
    const contains = '%' + q.toLowerCase() + '%'
    const rows = await db<Array<{ name: string; slug: string; place_type: string }>>`
      SELECT name, slug, place_type
      FROM autravel.localities
      WHERE state_code = ${state}
        AND lower(name) LIKE ${contains}
      ORDER BY
        CASE WHEN lower(name) LIKE ${prefix} THEN 0 ELSE 1 END,
        CASE place_type WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'suburb' THEN 2 WHEN 'village' THEN 3 WHEN 'hamlet' THEN 4 ELSE 5 END,
        population DESC NULLS LAST,
        name ASC
      LIMIT ${limit}`
    return NextResponse.json({ results: rows }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } })
  } catch (e) {
    console.error('[api/localities/search]', e)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
