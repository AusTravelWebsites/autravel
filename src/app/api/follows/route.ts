import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/admin'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const rows = await db`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return rows[0] ?? null
  } catch { return null }
}

// GET /api/follows?username=x&type=followers|following
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  // ?mutual=1  return users who follow each other with current user
  if (sp.get('mutual') === '1') {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const users = await db`
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.location AS home_location, u.travel_status,
               u.last_seen_at, u.verification_status, u.home_country,
               ll.place_name AS last_place_name, ll.country_name AS last_country_name, ll.created_at AS last_location_at
        FROM follows f1
        JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = ${user.id}::text
        JOIN users u ON u.id::text = f1.following_id
        LEFT JOIN LATERAL (
          SELECT place_name, country_name, created_at
          FROM user_locations
          WHERE user_id = u.id::text AND is_public = true
          ORDER BY created_at DESC LIMIT 1
        ) ll ON true
        WHERE f1.follower_id = ${user.id}::text
        ORDER BY u.display_name`
      return NextResponse.json({ users })
    } catch (e: any) { return serverError(e, 'follows', req) }
  }
  // ?me=1  return who current user follows
  if (sp.get('me') === '1') {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const following = await db`
        SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM follows f JOIN users u ON u.id::text = f.following_id
        WHERE f.follower_id = ${user.id}::text ORDER BY u.display_name`
      return NextResponse.json({ following })
    } catch (e: any) { return serverError(e, 'follows', req) }
  }
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    const type     = searchParams.get('type') ?? 'following'
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset   = parseInt(searchParams.get('offset') ?? '0')
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })
    const target = await db`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    let rows
    if (type === 'followers') {
      rows = await db`
        SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM follows f JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ${target[0].id}
        ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      rows = await db`
        SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM follows f JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ${target[0].id}
        ORDER BY f.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    }
    const counts = await db`
      SELECT
        (SELECT COUNT(*) FROM follows WHERE follower_id  = ${target[0].id}) as following_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = ${target[0].id}) as follower_count
    `
    return NextResponse.json({ users: rows, ...counts[0] })
  } catch (e) {
    console.error('[follows GET]', e)
    return serverError(e, 'follows', req)
  }
}

// POST /api/follows
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!(await rateLimit(`follow:${user.id}`, 60, 60))) {
      return NextResponse.json({ error: 'Follow limit: 60/min.' }, { status: 429 })
    }
    const body = await req.json().catch(() => ({} as any))
    const { username, following_id } = body
    if (!username && !following_id) return NextResponse.json({ error: 'username or following_id required' }, { status: 400 })
    const target = following_id
      ? await db`SELECT id FROM users WHERE id::text = ${following_id} LIMIT 1`
      : await db`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target[0].id === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    await db`INSERT INTO follows (follower_id, following_id) VALUES (${user.id}, ${target[0].id}) ON CONFLICT DO NOTHING`
    // Look up actor's username so we can deep-link to the profile
    const [meRow] = await db`SELECT username FROM users WHERE id::text = ${user.id} LIMIT 1`
    notify({ recipientId: String(target[0].id), actorId: String(user.id), type: 'follow', link: meRow?.username ? `/${meRow.username}` : '/' }).catch(() => {})
    return NextResponse.json({ ok: true, following: true })
  } catch (e) {
    console.error('[follows POST]', e)
    return serverError(e, 'follows', req)
  }
}

// DELETE /api/follows  — accepts ?username=x, ?following_id=x, or JSON body
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const sp = new URL(req.url).searchParams
    let username = sp.get('username')
    let following_id = sp.get('following_id')
    if (!username && !following_id) {
      const body = await req.json().catch(() => ({} as any))
      username = body.username ?? null
      following_id = body.following_id ?? null
    }
    if (!username && !following_id) return NextResponse.json({ error: 'username or following_id required' }, { status: 400 })
    const target = following_id
      ? await db`SELECT id FROM users WHERE id::text = ${following_id} LIMIT 1`
      : await db`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    await db`DELETE FROM follows WHERE follower_id = ${user.id} AND following_id = ${target[0].id}`
    return NextResponse.json({ ok: true, following: false })
  } catch (e) {
    console.error('[follows DELETE]', e)
    return serverError(e, 'follows', req)
  }
}
