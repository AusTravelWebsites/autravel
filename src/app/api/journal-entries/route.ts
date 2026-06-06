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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tripId = searchParams.get('trip_id')
    const username = searchParams.get('username')
    const id = searchParams.get('id')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    let rows
    if (id) {
      rows = await db`
        SELECT je.*, u.username, u.display_name, u.avatar_url, t.title as trip_title
        FROM journal_entries je
        JOIN users u ON u.id::text = je.user_id
        LEFT JOIN trips t ON t.id = je.trip_id
        WHERE je.id = ${id} LIMIT 1
      `
    } else if (tripId) {
      rows = await db`
        SELECT je.*, u.username, u.display_name, u.avatar_url
        FROM journal_entries je
        JOIN users u ON u.id::text = je.user_id
        WHERE je.trip_id = ${tripId}
        ORDER BY je.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    } else if (username) {
      rows = await db`
        SELECT je.*, u.username, u.display_name, u.avatar_url, t.title as trip_title
        FROM journal_entries je
        JOIN users u ON u.id::text = je.user_id
        LEFT JOIN trips t ON t.id = je.trip_id
        WHERE u.username = ${username} AND je.is_public = true
        ORDER BY je.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      rows = await db`
        SELECT je.*, u.username, u.display_name, u.avatar_url, t.title as trip_title
        FROM journal_entries je
        JOIN users u ON u.id::text = je.user_id
        LEFT JOIN trips t ON t.id = je.trip_id
        WHERE je.is_public = true
        ORDER BY je.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    }
    return NextResponse.json({ entries: rows })
  } catch (e) {
    console.error('[journal-entries GET]', e)
    return serverError(e, 'journal-entries', req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    if (!(await rateLimit(`journal:${user.id}`, 30, 3600))) {
      return NextResponse.json({ error: 'Journal limit: 30/hour.' }, { status: 429 })
    }
    const body = await req.json()
    const text: string | undefined = stripExternalLinks(body.body ?? body.content) ?? undefined
    if (!text?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })
    const trip_id = body.trip_id ?? null
    let place_id = body.place_id ?? null
    const location_name = stripExternalLinks(body.location_name ?? body.location) ?? null

    // If a free-text location was given but no explicit place_id, resolve it via Google
    // and auto-create the place row (verified, image, placeholder description) so the
    // location renders as a link to a real place page.
    if (!place_id && location_name) {
      try {
        const upserted = await upsertPlaceFromLocation(location_name, db)
        if (upserted) place_id = upserted.id
      } catch (e: any) {
        console.error('[journal-entries place upsert]', e?.message)
      }
    }
    const media = Array.isArray(body.media_urls) ? body.media_urls
                : Array.isArray(body.photo_urls) ? body.photo_urls
                : []
    const is_public = body.is_public ?? true
    const rows = await db`
      INSERT INTO journal_entries (user_id, trip_id, place_id, body, location_name, media_urls, is_public, posted_at)
      VALUES (${user.id}, ${trip_id}, ${place_id}, ${text.trim()}, ${location_name}, ${media as any}, ${is_public}, NOW())
      RETURNING *
    `
    return NextResponse.json({ entry: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[journal-entries POST]', e)
    return serverError(e, 'journal-entries', req)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM journal_entries WHERE id = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const text = stripExternalLinks(body.body ?? body.content) ?? null
    const location_name = stripExternalLinks(body.location_name ?? body.location) ?? null
    const media = Array.isArray(body.media_urls) ? body.media_urls
                : Array.isArray(body.photo_urls) ? body.photo_urls
                : null

    // Resolve location → place upsert when a new location name is provided
    let place_id_update: string | null | undefined = undefined
    if (location_name) {
      try {
        const upserted = await upsertPlaceFromLocation(location_name, db)
        if (upserted) place_id_update = upserted.id
      } catch (e: any) {
        console.error('[journal-entries PATCH place upsert]', e?.message)
      }
    }

    const updated = await db`
      UPDATE journal_entries SET
        body          = COALESCE(${text}, body),
        location_name = COALESCE(${location_name}, location_name),
        place_id      = COALESCE(${place_id_update ?? null}, place_id),
        media_urls    = COALESCE(${media as any}, media_urls),
        is_public     = COALESCE(${body.is_public ?? null}, is_public)
      WHERE id = ${id} RETURNING *
    `
    return NextResponse.json({ entry: updated[0] })
  } catch (e) {
    console.error('[journal-entries PATCH]', e)
    return serverError(e, 'journal-entries', req)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const rows = await db`SELECT user_id FROM journal_entries WHERE id = ${id} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await db`DELETE FROM journal_entries WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[journal-entries DELETE]', e)
    return serverError(e, 'journal-entries', req)
  }
}