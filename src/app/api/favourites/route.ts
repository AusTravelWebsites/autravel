import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import sql from '@/lib/db'
import { rateLimit } from '@/lib/admin'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await sql`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const username = url.searchParams.get('username')
  const idsOnly = url.searchParams.get('ids') === '1'
  try {
    let targetId: string = user.id
    if (username) {
      const [target] = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
      if (!target) return NextResponse.json({ favourites: [] })
      targetId = target.id
    }
    if (idsOnly) {
      const rows = await sql`SELECT place_id FROM favourites WHERE user_id = ${targetId}`
      return NextResponse.json({ ids: rows.map((r: any) => r.place_id) })
    }
    const favs = await sql`
      SELECT
        p.id::text         AS id,
        p.slug             AS slug,
        p.name             AS name,
        p.country          AS country,
        p.city             AS city,
        p.category         AS category,
        p.cover_image      AS image_url,
        p.bb_review_count  AS review_count,
        p.bb_rating        AS avg_rating,
        f.created_at       AS favourited_at
      FROM favourites f
      JOIN places p ON p.id::text = f.place_id
      WHERE f.user_id = ${targetId}
      ORDER BY f.created_at DESC`
    return NextResponse.json({ favourites: favs })
  } catch (e: any) { return serverError(e, 'favourites', req) }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`fav:${user.id}`, 60, 60))) {
    return NextResponse.json({ error: 'Favourite limit: 60/min.' }, { status: 429 })
  }
  const { place_id } = await req.json().catch(() => ({} as any))
  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
  try {
    await sql`
      INSERT INTO favourites (user_id, place_id)
      VALUES (${user.id}, ${place_id})
      ON CONFLICT (user_id, place_id) DO NOTHING`
    return NextResponse.json({ ok: true, favourited: true })
  } catch (e: any) { return serverError(e, 'favourites', req) }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let place_id: string | null = new URL(req.url).searchParams.get('place_id')
  if (!place_id) {
    const body = await req.json().catch(() => ({} as any))
    place_id = body?.place_id || null
  }
  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
  try {
    await sql`DELETE FROM favourites WHERE user_id = ${user.id} AND place_id = ${place_id}`
    return NextResponse.json({ ok: true, favourited: false })
  } catch (e: any) { return serverError(e, 'favourites', req) }
}
