import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { stripExternalLinks } from '@/lib/sanitize';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

// GET /api/conversations — list groups the user is a member of
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await db`
    SELECT c.id, c.name, c.description, c.avatar_url, c.created_by, c.is_group, c.created_at,
           cm.role AS my_role, cm.last_read_at,
           (SELECT COUNT(*)::int FROM conversation_members x WHERE x.conversation_id = c.id AND x.left_at IS NULL) AS member_count,
           (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
           (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
           (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')) AS unread_count
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ${user.id}::text AND cm.left_at IS NULL
    WHERE c.is_group = true
    ORDER BY COALESCE(last_message_at, c.created_at) DESC LIMIT 100`;
  return NextResponse.json({ conversations: rows });
}

// POST /api/conversations — create a group { name, description?, member_ids: string[] }
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const name = stripExternalLinks(body.name);
  const description = stripExternalLinks(body.description) ?? null;
  const memberIds: string[] = Array.isArray(body.member_ids)
    ? body.member_ids.filter((x: any) => typeof x === 'string' && x !== user.id).slice(0, 200)
    : [];
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const [conv] = await db`
    INSERT INTO conversations (name, description, created_by, is_group)
    VALUES (${name.trim()}, ${description}, ${user.id}::text, true)
    RETURNING *`;

  // Owner
  await db`INSERT INTO conversation_members (conversation_id, user_id, role, last_read_at) VALUES (${conv.id}, ${user.id}::text, 'owner', NOW())`;
  // Members
  for (const uid of memberIds) {
    try { await db`INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (${conv.id}, ${uid}, 'member') ON CONFLICT DO NOTHING`; } catch {}
  }
  return NextResponse.json({ conversation: conv }, { status: 201 });
}
