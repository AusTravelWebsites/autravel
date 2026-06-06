import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import sql from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
import { rateLimit } from '@/lib/admin'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [user] = await sql`SELECT id, display_name, avatar_url, username FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return user || null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entry_id = searchParams.get('entry_id')
  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })
  try {
    const comments = await sql`
      SELECT c.id, c.body, c.created_at, u.display_name, u.avatar_url, u.username
      FROM comments c JOIN users u ON u.id::text = c.user_id
      WHERE c.entry_id = ${entry_id} ORDER BY c.created_at ASC`
    return NextResponse.json({ comments })
  } catch (e: any) { return serverError(e, 'comments', req) }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`comment:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: 'Commenting too fast, please slow down.' }, { status: 429 })
  }
  const raw = await req.json()
  const entry_id = raw.entry_id
  const body = stripExternalLinks(raw.body) ?? ''
  if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })
  try {
    const [comment] = await sql`
      INSERT INTO comments (user_id, entry_id, body)
      VALUES (${user.id}, ${entry_id}, ${body.trim()})
      RETURNING id, body, created_at`
    await sql`UPDATE journal_entries SET comment_count = comment_count + 1 WHERE id = ${entry_id}`
    const [author] = await sql`SELECT user_id FROM journal_entries WHERE id = ${entry_id} LIMIT 1`
    if (author && author.user_id !== user.id) {
      const { notify } = await import('@/lib/notify')
      notify({ recipientId: String(author.user_id), actorId: String(user.id), type: 'comment', entryId: entry_id, link: `/journal-entries/${entry_id}`, preview: body }).catch(() => {})
    }
    return NextResponse.json({ comment: { ...comment, display_name: user.display_name, avatar_url: user.avatar_url, username: user.username } })
  } catch (e: any) { return serverError(e, 'comments', req) }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await sql`DELETE FROM comments WHERE id = ${id} AND user_id = ${user.id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) { return serverError(e, 'comments', req) }
}
