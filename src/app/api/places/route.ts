import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { db } from '@/lib/db'

// GET /api/places?slug=x | ?id=x | ?q|search=text&country=x&category=x&limit=20
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug     = searchParams.get('slug')
    const id       = searchParams.get('id')
    const q        = searchParams.get('q') || searchParams.get('search')
    const country  = searchParams.get('country')
    const city     = searchParams.get('city')
    const category = searchParams.get('category')
    const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 50)
    const offset   = parseInt(searchParams.get('offset') ?? '0')

    if (slug) {
      const rows = await db`
        SELECT p.*,
          (SELECT COUNT(*) FROM reviews  r WHERE r.place_id = p.id) as review_count,
          (SELECT AVG(rating) FROM reviews r WHERE r.place_id = p.id) as avg_rating,
          (SELECT COUNT(*) FROM checkins c WHERE c.place_id = p.id) as checkin_count
        FROM places p WHERE p.slug = ${slug} LIMIT 1`
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ place: rows[0] })
    }
    if (id) {
      const rows = await db`
        SELECT p.*,
          (SELECT COUNT(*) FROM reviews  r WHERE r.place_id = p.id) as review_count,
          (SELECT AVG(rating) FROM reviews r WHERE r.place_id = p.id) as avg_rating,
          (SELECT COUNT(*) FROM checkins c WHERE c.place_id = p.id) as checkin_count
        FROM places p WHERE p.id::text = ${id} LIMIT 1`
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ place: rows[0] })
    }

    const qPattern = q ? '%' + q + '%' : null

    // Optional ?near=lat,lng — sort by haversine distance (places without coords go last)
    const nearRaw = searchParams.get('near')
    let near: { lat: number; lng: number } | null = null
    if (nearRaw) {
      const m = nearRaw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)
      if (m) { const lat = parseFloat(m[1]); const lng = parseFloat(m[2]); if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) near = { lat, lng } }
    }

    const rows = near
      ? await db`
        SELECT p.*,
          (SELECT COUNT(*) FROM reviews r WHERE r.place_id = p.id) as review_count,
          (SELECT AVG(rating) FROM reviews r WHERE r.place_id = p.id) as avg_rating,
          (SELECT COUNT(*) FROM checkins c WHERE c.place_id = p.id) as checkin_count,
          CASE WHEN p.lat IS NULL OR p.lng IS NULL THEN NULL
               ELSE 6371 * acos(
                 LEAST(1.0, GREATEST(-1.0,
                   cos(radians(${near.lat})) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(${near.lng}))
                   + sin(radians(${near.lat})) * sin(radians(p.lat))
                 ))
               ) END AS distance_km
        FROM places p
        WHERE (${qPattern}::text IS NULL
               OR p.name ILIKE ${qPattern} OR p.city ILIKE ${qPattern} OR p.country ILIKE ${qPattern})
          AND (${country  ?? null}::text IS NULL OR p.country  = ${country  ?? ''})
          AND (${city     ?? null}::text IS NULL OR p.city     = ${city     ?? ''})
          AND (${category ?? null}::text IS NULL OR p.category = ${category ?? ''})
        ORDER BY distance_km ASC NULLS LAST, p.name ASC
        LIMIT ${limit} OFFSET ${offset}`
      : await db`
        SELECT p.*,
          (SELECT COUNT(*) FROM reviews r WHERE r.place_id = p.id) as review_count,
          (SELECT AVG(rating) FROM reviews r WHERE r.place_id = p.id) as avg_rating,
          (SELECT COUNT(*) FROM checkins c WHERE c.place_id = p.id) as checkin_count
        FROM places p
        WHERE (${qPattern}::text IS NULL
               OR p.name ILIKE ${qPattern} OR p.city ILIKE ${qPattern} OR p.country ILIKE ${qPattern})
          AND (${country  ?? null}::text IS NULL OR p.country  = ${country  ?? ''})
          AND (${city     ?? null}::text IS NULL OR p.city     = ${city     ?? ''})
          AND (${category ?? null}::text IS NULL OR p.category = ${category ?? ''})
        ORDER BY review_count DESC NULLS LAST, p.name ASC
        LIMIT ${limit} OFFSET ${offset}`
    return NextResponse.json({ places: rows })
  } catch (e) {
    console.error('[places GET]', e)
    return serverError(e, 'places', req)
  }
}
