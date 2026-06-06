import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const [m] = await sql`SELECT host_id FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id !== viewer.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pending = await sql`
    SELECT ma.user_id, ma.created_at, u.username, u.display_name, u.avatar_url, u.verification_status, u.bb_rating, u.bb_rating_count
    FROM meetup_attendees ma JOIN users u ON u.id::text = ma.user_id
    WHERE ma.meetup_id = ${id} AND (ma.status_extended = 'requested' OR ma.status_extended = 'waitlist')
    ORDER BY ma.created_at ASC`;
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({} as any));
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const action = body?.action === 'reject' ? 'reject' : 'approve';
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const [m] = await sql`SELECT host_id, max_attendees FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id !== viewer.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'reject') {
    await sql`UPDATE meetup_attendees SET status = 'rejected', status_extended = 'rejected' WHERE meetup_id = ${id} AND user_id = ${userId}`;
    try {
      const { notify } = await import('@/lib/notify');
      notify({ recipientId: String(userId), actorId: String(viewer.id), type: 'meetup_approved', link: `/meetups/${id}`, preview: 'Your join request was declined' }).catch(() => {});
    } catch {}
    return NextResponse.json({ ok: true, action });
  }

  // Approve: enforce capacity
  if (m.max_attendees != null) {
    const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM meetup_attendees WHERE meetup_id = ${id} AND status = 'going' AND user_id <> ${userId}`;
    if (c >= m.max_attendees) return NextResponse.json({ error: 'Meetup is full' }, { status: 400 });
  }
  await sql`UPDATE meetup_attendees SET status = 'going', status_extended = NULL, approved_at = NOW(), approved_by = ${viewer.id} WHERE meetup_id = ${id} AND user_id = ${userId}`;
  try {
    const { notify } = await import('@/lib/notify');
    notify({ recipientId: String(userId), actorId: String(viewer.id), type: 'meetup_approved', link: `/meetups/${id}`, preview: "You're in! The host approved your request." }).catch(() => {});
  } catch {}
  return NextResponse.json({ ok: true, action });
}
