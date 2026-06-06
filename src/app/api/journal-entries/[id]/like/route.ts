import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const rows = await db`SELECT id, is_banned FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return rows[0] ?? null
  } catch { return null }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  try {
    const existing = await db`SELECT id FROM likes WHERE user_id = ${user.id}::text AND entry_id = ${id} LIMIT 1`
    let liked: boolean
    if (existing[0]) {
      await db`DELETE FROM likes WHERE id = ${existing[0].id}`
      await db`UPDATE journal_entries SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${id}`
      liked = false
    } else {
      await db`INSERT INTO likes (user_id, entry_id) VALUES (${user.id}::text, ${id})`
      await db`UPDATE journal_entries SET like_count = like_count + 1 WHERE id = ${id}`
      liked = true
      const [author] = await db`SELECT user_id FROM journal_entries WHERE id = ${id} LIMIT 1`
      if (author && author.user_id !== user.id) {
        const { notify } = await import('@/lib/notify')
        notify({ recipientId: String(author.user_id), actorId: String(user.id), type: 'like', entryId: id, link: `/journal-entries/${id}` }).catch(() => {})
      }
    }
    const [row] = await db`SELECT like_count FROM journal_entries WHERE id = ${id} LIMIT 1`
    return NextResponse.json({ ok: true, liked, count: Number(row?.like_count ?? 0) })
  } catch (e: any) {
    console.error('[entry like]', e)
    return serverError(e, 'journal-entries/[id]/like', req)
  }
}
