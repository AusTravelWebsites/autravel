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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const placeId  = searchParams.get('place_id')
    const username = searchParams.get('username')
    const id       = searchParams.get('id')
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    let rows
    if (id) {
      rows = await db`SELECT r.*, u.username, u.display_name, u.avatar_url, p.name as place_name, p.city, p.country, p.slug as place_slug FROM reviews r JOIN users u ON u.id::text = r.user_id JOIN places p ON p.id=r.place_id WHERE r.id=${id} LIMIT 1`
    } else if (placeId) {
      rows = await db`SELECT r.*, u.username, u.display_name, u.avatar_url FROM reviews r JOIN users u ON u.id::text = r.user_id WHERE r.place_id=(SELECT id FROM places WHERE slug=${placeId} OR id::text=${placeId} LIMIT 1) ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    } else if (username) {
      rows = await db`SELECT r.*, u.username, u.display_name, u.avatar_url, p.name as place_name, p.city, p.country, p.slug as place_slug FROM reviews r JOIN users u ON u.id::text = r.user_id JOIN places p ON p.id=r.place_id WHERE u.username=${username} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    } else {
      rows = await db`SELECT r.*, u.username, u.display_name, u.avatar_url, p.name as place_name, p.city, p.country, p.slug as place_slug FROM reviews r JOIN users u ON u.id::text = r.user_id JOIN places p ON p.id=r.place_id ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    }
    return NextResponse.json({ reviews: rows })
  } catch (e) { console.error('[reviews]', e); return serverError(e, 'reviews', req) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    if (!(await rateLimit(`review:${user.id}`, 10, 3600))) {
      return NextResponse.json({ error: 'Review limit: 10/hour.' }, { status: 429 })
    }

    const body = await req.json()
    const { place_id, rating, gps_verified } = body
    const title = stripExternalLinks(body.title)
    const content = stripExternalLinks(body.body)
    const visitDate: string | null = body.visit_date && /^\d{4}-\d{2}-\d{2}$/.test(body.visit_date) ? body.visit_date : null
    const tagged: string[] = Array.isArray(body.tagged_user_ids)
      ? body.tagged_user_ids.filter((id: any) => typeof id === 'string').slice(0, 20)
      : []

    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'rating 1-5 required' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

    // Resolve place by slug or UUID
    const places = await db`SELECT id FROM places WHERE slug = ${place_id} OR id::text = ${place_id} LIMIT 1`
    if (!places[0]) return NextResponse.json({ error: 'Place not found' }, { status: 404 })
    const placeUuid = places[0].id

    // Check for duplicate review
    const existing = await db`SELECT id FROM reviews WHERE user_id = ${user.id}::text AND place_id = ${placeUuid} LIMIT 1`
    if (existing[0]) return NextResponse.json({ error: 'Review already exists' }, { status: 409 })

    // Insert review using exact schema columns
    const rows = await db`
      INSERT INTO reviews (user_id, place_id, rating, overall_rating, title, body, gps_verified, visit_date, tagged_user_ids)
      VALUES (${user.id}::text, ${placeUuid}, ${rating}, ${rating}, ${title ?? null}, ${content}, ${gps_verified ?? false}, ${visitDate}, ${tagged as any})
      RETURNING *`

    if (tagged.length > 0) {
      const { notify } = await import('@/lib/notify')
      for (const tid of tagged as string[]) {
        if (tid === user.id) continue
        notify({ recipientId: tid, actorId: String(user.id), type: 'tag_review', entryId: rows[0].id, link: '/', preview: rows[0]?.title || rows[0]?.body }).catch(() => {})
      }
    }

    return NextResponse.json({ review: rows[0] }, { status: 201 })
  } catch (e) { console.error('[reviews]', e); return serverError(e, 'reviews', req) }
}


export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM reviews WHERE id::text = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const title = body.title === undefined ? undefined : (stripExternalLinks(body.title) || null)
    const text  = body.body  === undefined ? undefined : (stripExternalLinks(body.body)  || null)
    const rating = typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5 ? body.rating : undefined
    const updated = await db`
      UPDATE reviews SET
        title          = COALESCE(${title === undefined ? null : title}, title),
        body           = COALESCE(${text === undefined ? null : text}, body),
        rating         = COALESCE(${rating ?? null}, rating),
        overall_rating = COALESCE(${rating ?? null}, overall_rating),
        updated_at     = NOW()
      WHERE id::text = ${id} RETURNING *`
    return NextResponse.json({ review: updated[0] })
  } catch (e: any) { console.error('[reviews PATCH]', e); return serverError(e, 'reviews', req) }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM reviews WHERE id::text = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await db`DELETE FROM reviews WHERE id=${id}`
    return NextResponse.json({ ok: true })
  } catch (e) { console.error('[reviews]', e); return serverError(e, 'reviews', req) }
}
