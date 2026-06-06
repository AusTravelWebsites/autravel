import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'

// GET /api/admin/users?search=&admin=1&banned=1&page=
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const search = sp.get('search') || ''
  const adminsOnly = sp.get('admin') === '1'
  const bannedOnly = sp.get('banned') === '1'
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') || '50')))
  const offset = (page - 1) * limit
  const pat = '%' + search + '%'

  const users = await db`
    SELECT id::text, firebase_uid, username, display_name, email, avatar_url, bio, location,
           is_admin, admin_state_codes, is_banned, ban_reason, last_seen_at, created_at, updated_at
    FROM users
    WHERE (${search ? true : false}::boolean = false OR username ILIKE ${pat} OR display_name ILIKE ${pat} OR email ILIKE ${pat})
      AND (${adminsOnly ? true : false}::boolean = false OR is_admin = true)
      AND (${bannedOnly ? true : false}::boolean = false OR is_banned = true)
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [{ total }] = await db<[{ total: number }]>`
    SELECT COUNT(*)::int AS total FROM users
    WHERE (${search ? true : false}::boolean = false OR username ILIKE ${pat} OR display_name ILIKE ${pat} OR email ILIKE ${pat})
      AND (${adminsOnly ? true : false}::boolean = false OR is_admin = true)
      AND (${bannedOnly ? true : false}::boolean = false OR is_banned = true)`

  const [stats] = await db<[{ total: number; admins: number; banned: number }]>`
    SELECT COUNT(*)::int AS total,
      SUM(CASE WHEN is_admin THEN 1 ELSE 0 END)::int AS admins,
      SUM(CASE WHEN is_banned THEN 1 ELSE 0 END)::int AS banned
    FROM users`
  return NextResponse.json({ users, total, stats })
}

// PATCH { id, is_admin?, is_banned?, ban_reason?, display_name?, username? }
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const allowed = ['is_admin', 'is_banned', 'ban_reason', 'display_name', 'username', 'bio', 'location', 'admin_state_codes']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in b) updates[k] = b[k]
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'no updates' }, { status: 400 })
  updates.updated_at = new Date()
  await db`UPDATE users SET ${db(updates)} WHERE id = ${b.id}::uuid`
  await logAction(admin, 'user_update', { targetType: 'user', targetId: b.id, metadata: updates, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}

// DELETE ?id=<uuid> — hard-delete. Bans are preferred over deletes.
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db`DELETE FROM users WHERE id = ${id}::uuid`
  await logAction(admin, 'user_delete', { targetType: 'user', targetId: id, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}
