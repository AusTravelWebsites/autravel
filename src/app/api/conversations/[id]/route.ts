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

async function getMyRole(convId: string, userId: string) {
  const [m] = await db`SELECT role FROM conversation_members WHERE conversation_id = ${convId} AND user_id = ${userId}::text AND left_at IS NULL LIMIT 1`;
  return m?.role ?? null;
}

// GET /api/conversations/[id] — conversation metadata + members + messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getMyRole(id, user.id);
  if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const [conv] = await db`SELECT * FROM conversations WHERE id = ${id} LIMIT 1`;
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const members = await db`
    SELECT cm.user_id, cm.role, cm.joined_at,
           u.username, u.display_name, u.avatar_url
    FROM conversation_members cm
    JOIN users u ON u.id::text = cm.user_id
    WHERE cm.conversation_id = ${id} AND cm.left_at IS NULL
    ORDER BY (CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END), u.display_name`;

  const msgs = await db`
    SELECT m.id, m.body, m.created_at, m.from_user_id,
           u.username, u.display_name, u.avatar_url
    FROM messages m
    JOIN users u ON u.id::text = m.from_user_id
    WHERE m.conversation_id = ${id}
    ORDER BY m.created_at ASC LIMIT 500`;

  // Mark as read
  await db`UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = ${id} AND user_id = ${user.id}::text`;

  return NextResponse.json({ conversation: conv, members, messages: msgs, my_role: role });
}

// PATCH /api/conversations/[id] — { name?, description?, avatar_url? } — admin only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getMyRole(id, user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const name = stripExternalLinks(body.name);
  const description = stripExternalLinks(body.description);
  const avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url : null;

  const [upd] = await db`
    UPDATE conversations SET
      name        = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      avatar_url  = COALESCE(${avatar_url}, avatar_url),
      updated_at  = NOW()
    WHERE id = ${id} RETURNING *`;
  return NextResponse.json({ conversation: upd });
}

// DELETE /api/conversations/[id] — owner only deletes the whole group
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getMyRole(id, user.id);
  if (role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  await db`DELETE FROM conversations WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
