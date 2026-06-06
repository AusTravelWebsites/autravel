import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit, getIP } from '@/lib/admin';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id::text as id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u as { id: string };
  } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [u] = await db`SELECT id::text AS id, bb_rating, bb_rating_count FROM users WHERE username = ${username} LIMIT 1`;
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const viewer = await getViewer(req);
  let my: any = null;
  if (viewer && viewer.id !== u.id) {
    const [r] = await db`SELECT stars, comment, created_at FROM user_ratings
      WHERE rater_id = ${viewer.id} AND ratee_id = ${u.id} AND context = 'general' AND context_id IS NULL LIMIT 1`;
    my = r || null;
  }
  const recent = await db`
    SELECT ur.stars, ur.comment, ur.created_at, u.username, u.display_name, u.avatar_url
    FROM user_ratings ur JOIN users u ON u.id::text = ur.rater_id
    WHERE ur.ratee_id = ${u.id} AND ur.is_public = true
    ORDER BY ur.created_at DESC LIMIT 20`;
  return NextResponse.json({
    rating: u.bb_rating ? Number(u.bb_rating) : null,
    count: u.bb_rating_count || 0,
    my,
    recent,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const ip = getIP(req) || 'unknown';
  if (!(await rateLimit(`rate:${viewer.id}`, 10, 3600))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const { username } = await params;
  const body = await req.json().catch(() => ({}));
  const stars = parseInt(body?.stars);
  const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 500) : null;
  if (!(stars >= 1 && stars <= 5)) return NextResponse.json({ error: 'Stars must be 1-5' }, { status: 400 });

  const [ratee] = await db`SELECT id::text AS id FROM users WHERE username = ${username} LIMIT 1`;
  if (!ratee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (ratee.id === viewer.id) return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 });

  await db`
    INSERT INTO user_ratings (rater_id, ratee_id, context, context_id, stars, comment)
    VALUES (${viewer.id}, ${ratee.id}, 'general', NULL, ${stars}, ${comment})
    ON CONFLICT (rater_id, ratee_id, context, COALESCE(context_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, created_at = NOW()`;

  // Recompute denormalised cache
  const [agg] = await db`SELECT COUNT(*)::int AS c, COALESCE(AVG(stars), 0)::numeric(3,2) AS avg
    FROM user_ratings WHERE ratee_id = ${ratee.id}`;
  await db`UPDATE users SET bb_rating = ${agg.avg}, bb_rating_count = ${agg.c} WHERE id::text = ${ratee.id}`;

  return NextResponse.json({ ok: true, rating: Number(agg.avg), count: agg.c });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { username } = await params;
  const [ratee] = await db`SELECT id::text AS id FROM users WHERE username = ${username} LIMIT 1`;
  if (!ratee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db`DELETE FROM user_ratings WHERE rater_id = ${viewer.id} AND ratee_id = ${ratee.id} AND context = 'general' AND context_id IS NULL`;
  const [agg] = await db`SELECT COUNT(*)::int AS c, COALESCE(AVG(stars), 0)::numeric(3,2) AS avg
    FROM user_ratings WHERE ratee_id = ${ratee.id}`;
  await db`UPDATE users SET bb_rating = ${agg.c > 0 ? agg.avg : null}, bb_rating_count = ${agg.c} WHERE id::text = ${ratee.id}`;
  return NextResponse.json({ ok: true });
}
