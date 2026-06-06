import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const rows = await db`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return rows[0] ?? null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const rows = await db`
      SELECT  n.*,
              u.username as actor_username, u.display_name as actor_name, u.avatar_url as actor_avatar
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = ${user.id}
        AND (${unreadOnly} = false OR n.read = false)
      ORDER BY n.created_at DESC
      LIMIT ${limit}
    `
    const unreadCount = await db`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.id} AND read = false
    `
    return NextResponse.json({ notifications: rows, unread_count: Number(unreadCount[0]?.count ?? 0) })
  } catch (e) {
    console.error('[notifications GET]', e)
    return serverError(e, 'notifications', req)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    const { id, all } = await req.json()
    if (all) {
      await db`UPDATE notifications SET read = true WHERE user_id = ${user.id}`
    } else if (id) {
      await db`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${user.id}`
    } else {
      return NextResponse.json({ error: 'id or all required' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notifications PATCH]', e)
    return serverError(e, 'notifications', req)
  }
}
