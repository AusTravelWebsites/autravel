import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/admin';

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value;
  if (!session) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    const [u] = await db`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const withUser = searchParams.get('with');
  if (withUser) {
    const msgs = await db`
      SELECT m.*,
        uf.username as from_username, uf.display_name as from_display_name, uf.avatar_url as from_avatar,
        ut.username as to_username
      FROM messages m
      JOIN users uf ON uf.id::text = m.from_user_id
      JOIN users ut ON ut.id::text = m.to_user_id
      WHERE (m.from_user_id = ${user.id} AND m.to_user_id = ${withUser})
         OR (m.from_user_id = ${withUser} AND m.to_user_id = ${user.id})
      ORDER BY m.created_at ASC LIMIT 100`;
    await db`UPDATE messages SET read = true WHERE to_user_id = ${user.id} AND from_user_id = ${withUser} AND read = false`;
    return NextResponse.json({ messages: msgs });
  }
  const threads = await db`
    SELECT DISTINCT ON (other_user)
      CASE WHEN m.from_user_id = ${user.id} THEN m.to_user_id ELSE m.from_user_id END as other_user,
      m.body, m.created_at, m.read, m.from_user_id,
      u.username, u.display_name, u.avatar_url
    FROM messages m
    JOIN users u ON u.id::text = CASE WHEN m.from_user_id = ${user.id} THEN m.to_user_id ELSE m.from_user_id END
    WHERE m.from_user_id = ${user.id} OR m.to_user_id = ${user.id}
    ORDER BY other_user, m.created_at DESC`;
  const unread = await db`SELECT COUNT(*) as count FROM messages WHERE to_user_id = ${user.id} AND read = false`;
  return NextResponse.json({ threads, unread_count: Number(unread[0]?.count || 0) });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // 30 DMs per minute per user — well above any legit typing burst
  if (!(await rateLimit(`dm:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: 'Sending messages too fast, please slow down.' }, { status: 429 });
  }
  const { to_user_id, body } = await req.json().catch(() => ({} as any));
  if (!to_user_id || !body?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (to_user_id === user.id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  const target = await db`SELECT id FROM users WHERE id::text = ${to_user_id} LIMIT 1`;
  if (!target[0]) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  const [msg] = await db`
    INSERT INTO messages (from_user_id, to_user_id, body)
    VALUES (${user.id}, ${to_user_id}, ${body.trim()})
    RETURNING *`;
  return NextResponse.json({ message: msg });
}
