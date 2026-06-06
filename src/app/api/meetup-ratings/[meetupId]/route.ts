import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/admin';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u as { id: string };
  } catch { return null; }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ meetupId: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`meetup-rate:${viewer.id}`, 20, 3600))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const { meetupId } = await ctx.params;

  const [m] = await sql`SELECT id, host_id, meetup_date FROM meetups WHERE id = ${meetupId} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id === viewer.id) return NextResponse.json({ error: 'Cannot rate your own meetup' }, { status: 400 });

  const hoursSince = (Date.now() - new Date(m.meetup_date).getTime()) / 3600000;
  if (hoursSince < 24) return NextResponse.json({ error: 'Ratings open 24h after a meetup ends' }, { status: 400 });
  if (hoursSince > 24 * 14) return NextResponse.json({ error: 'Rating window closed (14 days)' }, { status: 400 });

  // Must have been a "going" attendee
  const [att] = await sql`SELECT status FROM meetup_attendees WHERE meetup_id = ${meetupId} AND user_id = ${viewer.id} LIMIT 1`;
  if (!att || att.status !== 'going') {
    return NextResponse.json({ error: 'Only attendees who went can rate' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const stars = parseInt(body?.stars);
  const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 500) : null;
  if (!(stars >= 1 && stars <= 5)) return NextResponse.json({ error: 'Stars must be 1-5' }, { status: 400 });

  await sql`
    INSERT INTO user_ratings (rater_id, ratee_id, context, context_id, stars, comment)
    VALUES (${viewer.id}, ${m.host_id}, 'meetup', ${meetupId}, ${stars}, ${comment})
    ON CONFLICT (rater_id, ratee_id, context, COALESCE(context_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, created_at = NOW()`;

  const [agg] = await sql`SELECT COUNT(*)::int AS c, COALESCE(AVG(stars), 0)::numeric(3,2) AS avg
    FROM user_ratings WHERE ratee_id = ${m.host_id}`;
  await sql`UPDATE users SET bb_rating = ${agg.avg}, bb_rating_count = ${agg.c} WHERE id::text = ${m.host_id}`;

  return NextResponse.json({ ok: true, rating: Number(agg.avg), count: agg.c });
}
