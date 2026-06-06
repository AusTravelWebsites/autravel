import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
import { rateLimit } from '@/lib/admin'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const rows = await db`SELECT id, is_banned FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return rows[0] ?? null
  } catch { return null }
}

// GET /api/checkins?username=x&limit=20&offset=0
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    const placeId   = searchParams.get('place_id')
    const me        = searchParams.get('me') === '1'
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    let rows
    if (me) {
      const viewer = await getUser(req)
      if (!viewer) return NextResponse.json({ checkins: [] })
      rows = await db`
        SELECT c.*, u.username, u.display_name, u.avatar_url,
               p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug, p.id as place_id
        FROM checkins c
        JOIN users  u ON u.id::text = c.user_id
        JOIN places p ON p.id = c.place_id
        WHERE c.user_id::text = ${viewer.id}::text
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (username) {
      rows = await db`
        SELECT c.*, u.username, u.display_name, u.avatar_url,
               p.name as place_name, p.city, p.country, p.slug as place_slug
        FROM checkins c
        JOIN users  u ON u.id::text = c.user_id
        JOIN places p ON p.id = c.place_id
        WHERE u.username = ${username}
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (placeId) {
      rows = await db`
        SELECT c.*, u.username, u.display_name, u.avatar_url
        FROM checkins c
        JOIN users u ON u.id::text = c.user_id
        WHERE c.place_id = ${placeId}
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      rows = await db`
        SELECT c.*, u.username, u.display_name, u.avatar_url,
               p.name as place_name, p.city, p.country, p.slug as place_slug
        FROM checkins c
        JOIN users  u ON u.id::text = c.user_id
        JOIN places p ON p.id = c.place_id
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }
    return NextResponse.json({ checkins: rows })
  } catch (e) {
    console.error('[checkins GET]', e)
    return serverError(e, 'checkins', req)
  }
}

// POST /api/checkins
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    if (!(await rateLimit(`checkin:${user.id}`, 20, 3600))) {
      return NextResponse.json({ error: 'Check-in limit: 20/hour.' }, { status: 429 })
    }

    const body = await req.json()
    const { place_id, lat, lng, photo_url } = body
    const note = stripExternalLinks(body.note)
    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    if (lat == null || lng == null) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })

    const places = await db`SELECT id FROM places WHERE slug = ${place_id} OR id::text = ${place_id} LIMIT 1`
    if (!places[0]) return NextResponse.json({ error: 'Place not found' }, { status: 404 })

    const recent = await db`
      SELECT id FROM checkins
      WHERE user_id = ${user.id}::text AND place_id = ${places[0].id}
        AND created_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `
    if (recent[0]) return NextResponse.json({ error: 'Already checked in recently' }, { status: 409 })

    const rows = await db`
      INSERT INTO checkins (user_id, place_id, gps_lat, gps_lng, lat, lng, note, photo_url, gps_verified, verified_at)
      VALUES (${user.id}::text, ${places[0].id}, ${lat}, ${lng}, ${lat}, ${lng},
              ${note ?? null}, ${photo_url ?? null}, true, NOW())
      RETURNING *
    `
    return NextResponse.json({ checkin: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[checkins POST]', e)
    return serverError(e, 'checkins', req)
  }
}
