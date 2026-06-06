import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const rows = await sql`
    SELECT b.blocked_id AS id, u.username, u.display_name, u.avatar_url, b.created_at, b.reason
    FROM user_blocks b
    LEFT JOIN users u ON u.id::text = b.blocked_id
    WHERE b.blocker_id = ${viewer.id}
    ORDER BY b.created_at DESC`;
  return NextResponse.json({ blocks: rows });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
  let targetId = userId;
  if (!targetId && username) {
    const [u] = await sql`SELECT id::text AS id FROM users WHERE username = ${username} LIMIT 1`;
    if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    targetId = u.id;
  }
  if (!targetId) return NextResponse.json({ error: 'username or user_id required' }, { status: 400 });
  if (targetId === viewer.id) return NextResponse.json({ error: "Can't block yourself" }, { status: 400 });

  await sql`
    INSERT INTO user_blocks (blocker_id, blocked_id, reason)
    VALUES (${viewer.id}, ${targetId}, ${reason})
    ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason`;
  // Remove any mutual follows
  await sql`DELETE FROM follows WHERE (follower_id = ${viewer.id} AND following_id = ${targetId}) OR (follower_id = ${targetId} AND following_id = ${viewer.id})`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const url = new URL(req.url);
  const username = (url.searchParams.get('username') || '').trim();
  const userId = (url.searchParams.get('user_id') || '').trim();
  let targetId = userId;
  if (!targetId && username) {
    const [u] = await sql`SELECT id::text AS id FROM users WHERE username = ${username} LIMIT 1`;
    if (u) targetId = u.id;
  }
  if (!targetId) return NextResponse.json({ error: 'username or user_id required' }, { status: 400 });
  await sql`DELETE FROM user_blocks WHERE blocker_id = ${viewer.id} AND blocked_id = ${targetId}`;
  return NextResponse.json({ ok: true });
}
