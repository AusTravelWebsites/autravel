import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

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

// POST add { user_id } — admin/owner only
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await getMyRole(id, user.id);
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const target = typeof body.user_id === 'string' ? body.user_id : null;
  if (!target) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  // If previously left, re-activate
  const [existing] = await db`SELECT id, left_at FROM conversation_members WHERE conversation_id = ${id} AND user_id = ${target} LIMIT 1`;
  if (existing) {
    if (!existing.left_at) return NextResponse.json({ ok: true, already: true });
    await db`UPDATE conversation_members SET left_at = NULL, role = 'member', joined_at = NOW() WHERE id = ${existing.id}`;
  } else {
    await db`INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (${id}, ${target}, 'member')`;
  }
  return NextResponse.json({ ok: true });
}
