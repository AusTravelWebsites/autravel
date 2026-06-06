import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/admin';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, display_name, username FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

// GET — host lists their followers (candidates to invite)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const [m] = await sql`SELECT host_id FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id !== viewer.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Followers (people who follow the host) — most likely pool to invite
  const candidates = await sql`
    SELECT u.id::text AS id, u.username, u.display_name, u.avatar_url,
      EXISTS (SELECT 1 FROM meetup_attendees ma WHERE ma.meetup_id = ${id} AND ma.user_id = u.id::text) AS already
    FROM follows f
    JOIN users u ON u.id::text = f.follower_id
    WHERE f.following_id = ${viewer.id} AND COALESCE(u.is_banned, false) = false
    ORDER BY u.display_name NULLS LAST
    LIMIT 200`;
  return NextResponse.json({ candidates });
}

// POST — host invites 1+ users. Creates meetup_attendees rows with status_extended='invited' and fires notifications.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`meetup-invite:${viewer.id}`, 20, 3600))) {
    return NextResponse.json({ error: 'Too many invites' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const [m] = await sql`SELECT host_id, title FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id !== viewer.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(body?.user_ids) ? body.user_ids.filter((x: any) => typeof x === 'string').slice(0, 50) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'user_ids required' }, { status: 400 });

  let sent = 0;
  const { notify } = await import('@/lib/notify');
  for (const uid of ids) {
    if (uid === viewer.id) continue;
    try {
      await sql`
        INSERT INTO meetup_attendees (meetup_id, user_id, status, status_extended)
        VALUES (${id}, ${uid}, 'pending', 'invited')
        ON CONFLICT (meetup_id, user_id) DO NOTHING`;
      notify({ recipientId: String(uid), actorId: String(viewer.id), type: 'meetup_invite', link: `/meetups/${id}`, preview: m.title || 'A new meetup' }).catch(() => {});
      sent++;
    } catch (e) { console.error('[meetup invite]', e); }
  }
  return NextResponse.json({ ok: true, sent });
}
