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

async function getRoles(convId: string, userId: string, target: string) {
  const rows = await db`SELECT user_id, role FROM conversation_members WHERE conversation_id = ${convId} AND user_id = ANY(${[userId, target] as any}) AND left_at IS NULL`;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.user_id] = r.role;
  return { mine: map[userId] ?? null, theirs: map[target] ?? null };
}

// PATCH role — { role: 'admin' | 'member' } — owner only (can promote/demote)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { mine, theirs } = await getRoles(id, user.id, userId);
  if (mine !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  if (!theirs) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  if (theirs === 'owner') return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const role = body.role === 'admin' ? 'admin' : 'member';
  await db`UPDATE conversation_members SET role = ${role} WHERE conversation_id = ${id} AND user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}

// DELETE — remove a member. Admin/owner can remove others; any member can self-leave.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { mine, theirs } = await getRoles(id, user.id, userId);
  if (!mine) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  if (!theirs) return NextResponse.json({ error: 'Target not in group' }, { status: 404 });
  const selfLeave = user.id === userId;
  if (!selfLeave && mine !== 'owner' && mine !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  if (theirs === 'owner' && !selfLeave) return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 });
  if (theirs === 'owner' && selfLeave) return NextResponse.json({ error: 'Transfer ownership or delete the group first' }, { status: 400 });

  await db`UPDATE conversation_members SET left_at = NOW() WHERE conversation_id = ${id} AND user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
