import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { stripExternalLinks } from '@/lib/sanitize';
import { rateLimit } from '@/lib/admin';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

async function isMember(convId: string, userId: string) {
  const [m] = await db`SELECT 1 FROM conversation_members WHERE conversation_id = ${convId} AND user_id = ${userId}::text AND left_at IS NULL LIMIT 1`;
  return !!m;
}

// POST — send message to group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isMember(id, user.id))) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  if (!(await rateLimit(`conv-msg:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: 'Sending messages too fast, please slow down.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as any));
  const text = stripExternalLinks(body.body);
  if (!text?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });

  const [msg] = await db`
    INSERT INTO messages (from_user_id, conversation_id, body)
    VALUES (${user.id}::text, ${id}, ${text.trim()})
    RETURNING *`;
  await db`UPDATE conversations SET updated_at = NOW() WHERE id = ${id}`;
  // Mark sender's own last_read so unread count reflects correctly
  await db`UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = ${id} AND user_id = ${user.id}::text`;
  return NextResponse.json({ message: msg }, { status: 201 });
}
