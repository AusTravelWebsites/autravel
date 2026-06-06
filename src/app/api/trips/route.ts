import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
import { upsertPlaceFromLocation } from '@/lib/google-places'
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

// GET /api/trips?username=x | ?id=x
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    const id       = searchParams.get('id')
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
    const offset   = parseInt(searchParams.get('offset') ?? '0')

    let rows
    if (id) {
      rows = await db`
        SELECT t.*, u.username, u.display_name, u.avatar_url,
          (SELECT COUNT(*) FROM journal_entries je WHERE je.trip_id = t.id) as entry_count
        FROM trips t
        JOIN users u ON u.id::text = t.user_id
        WHERE t.id = ${id} LIMIT 1
      `
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ trip: rows[0] })
    }

    if (username) {
      rows = await db`
        SELECT t.*, u.username, u.display_name, u.avatar_url,
          (SELECT COUNT(*) FROM journal_entries je WHERE je.trip_id = t.id) as entry_count
        FROM trips t
        JOIN users u ON u.id::text = t.user_id
        WHERE u.username = ${username} AND t.is_public = true
        ORDER BY t.start_date DESC NULLS LAST, t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      rows = await db`
        SELECT t.*, u.username, u.display_name, u.avatar_url,
          (SELECT COUNT(*) FROM journal_entries je WHERE je.trip_id = t.id) as entry_count
        FROM trips t
        JOIN users u ON u.id::text = t.user_id
        WHERE t.is_public = true
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }
    return NextResponse.json({ trips: rows })
  } catch (e) {
    console.error('[trips GET]', e)
    return serverError(e, 'trips', req)
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'trip'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    if (!(await rateLimit(`trip:${user.id}`, 10, 3600))) {
      return NextResponse.json({ error: 'Trip limit: 10/hour.' }, { status: 429 })
    }
    const body = await req.json()
    const { start_date, end_date, is_public, cover_image, cover_emoji } = body
    const title = stripExternalLinks(body.title)
    const description = stripExternalLinks(body.description)
    const location_name = stripExternalLinks(body.location_name ?? body.location) ?? null
    const tagged: string[] = Array.isArray(body.tagged_user_ids)
      ? body.tagged_user_ids.filter((x: any) => typeof x === 'string').slice(0, 30)
      : []
    const gallery: string[] = Array.isArray(body.gallery)
      ? body.gallery.filter((x: any) => typeof x === 'string').slice(0, 10)
      : []
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    if (!location_name?.trim()) return NextResponse.json({ error: 'location required' }, { status: 400 })
    let place_id: string | null = null
    try {
      const upserted = await upsertPlaceFromLocation(location_name, db)
      if (upserted) place_id = upserted.id
    } catch (e: any) { console.error('[trips POST place upsert]', e?.message) }
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`
    // Use first gallery photo as cover if no explicit cover provided
    const cover = cover_image ?? body.cover_url ?? gallery[0] ?? null
    const rows = await db`
      INSERT INTO trips (user_id, title, slug, description, location_name, place_id, start_date, end_date, is_public, cover_image, cover_emoji, tagged_user_ids, gallery)
      VALUES (${user.id}, ${title.trim()}, ${slug}, ${description ?? null}, ${location_name.trim()}, ${place_id},
              ${start_date ?? null}, ${end_date ?? null},
              ${is_public ?? true}, ${cover}, ${cover_emoji ?? null},
              ${tagged as any}, ${gallery as any})
      RETURNING *
    `
    if (tagged.length > 0) {
      const { notify } = await import('@/lib/notify')
      const [me] = await db`SELECT username FROM users WHERE id::text = ${user.id} LIMIT 1`
      const tripUrl = me?.username && rows[0]?.slug ? `/${me.username}/trips/${rows[0].slug}` : '/'
      for (const tid of tagged as string[]) {
        if (tid === user.id) continue
        notify({ recipientId: tid, actorId: String(user.id), type: 'tag_trip', link: tripUrl, preview: rows[0]?.title }).catch(() => {})
      }
    }
    return NextResponse.json({ trip: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[trips POST]', e)
    return serverError(e, 'trips', req)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM trips WHERE id = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { start_date, end_date, is_public, cover_image, cover_emoji } = body
    const title = stripExternalLinks(body.title)
    const description = stripExternalLinks(body.description)
    const location_name = stripExternalLinks(body.location_name ?? body.location) ?? null
    const cover = cover_image ?? body.cover_url ?? null
    const tagged = Array.isArray(body.tagged_user_ids)
      ? body.tagged_user_ids.filter((x: any) => typeof x === 'string').slice(0, 30)
      : null
    const gallery = Array.isArray(body.gallery)
      ? body.gallery.filter((x: any) => typeof x === 'string').slice(0, 10)
      : null

    let place_id_update: string | null | undefined = undefined
    if (location_name) {
      try {
        const upserted = await upsertPlaceFromLocation(location_name, db)
        if (upserted) place_id_update = upserted.id
      } catch (e: any) { console.error('[trips PATCH place upsert]', e?.message) }
    }

    const updated = await db`
      UPDATE trips SET
        title            = COALESCE(${title       ?? null}, title),
        description      = COALESCE(${description ?? null}, description),
        location_name    = COALESCE(${location_name ?? null}, location_name),
        place_id         = COALESCE(${place_id_update ?? null}, place_id),
        start_date       = COALESCE(${start_date  ?? null}, start_date),
        end_date         = COALESCE(${end_date    ?? null}, end_date),
        is_public        = COALESCE(${is_public   ?? null}, is_public),
        cover_image      = COALESCE(${cover}, cover_image),
        cover_emoji      = COALESCE(${cover_emoji ?? null}, cover_emoji),
        tagged_user_ids  = COALESCE(${(tagged ?? null) as any}, tagged_user_ids),
        gallery          = COALESCE(${(gallery ?? null) as any}, gallery),
        updated_at       = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json({ trip: updated[0] })
  } catch (e) {
    console.error('[trips PATCH]', e)
    return serverError(e, 'trips', req)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM trips WHERE id = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await db`DELETE FROM trips WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[trips DELETE]', e)
    return serverError(e, 'trips', req)
  }
}
