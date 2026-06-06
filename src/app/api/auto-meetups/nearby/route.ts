import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getMutedIds } from '@/lib/blocks';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, auto_meetup_opt_in FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

const RADIUS_KM = 16.1; // 10 miles

export async function GET(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Please log in' }, { status: 401 });

  // Viewer's latest fresh checkin
  const [me] = await sql`
    SELECT lat::float AS lat, lng::float AS lng, created_at
    FROM checkins WHERE user_id::text = ${viewer.id} AND lat IS NOT NULL
    ORDER BY created_at DESC LIMIT 1`;
  if (!me) return NextResponse.json({ travellers: [], reason: 'No recent check-in. Use /check-in to share where you are.' });

  // Other opted-in users with a fresh check-in, distance via SQL
  const muted = await getMutedIds(viewer.id);
  const rows = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (c.user_id)
        c.user_id::text AS user_id,
        u.username, u.display_name, u.avatar_url, u.bb_rating, u.verification_status,
        c.lat::float AS lat, c.lng::float AS lng, c.created_at,
        (6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${me.lat}::float)) * cos(radians(c.lat::float)) *
          cos(radians(c.lng::float) - radians(${me.lng}::float)) +
          sin(radians(${me.lat}::float)) * sin(radians(c.lat::float))
        )))) AS distance_km
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id::text
      WHERE c.created_at > NOW() - INTERVAL '7 days'
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        AND c.user_id::text <> ${viewer.id}
        AND COALESCE(u.is_banned, false) = false
        AND COALESCE(u.auto_meetup_opt_in, true) = true
        AND (${muted.length === 0 ? true : false}::boolean = true OR u.id::text <> ALL(${muted as any}::text[]))
      ORDER BY c.user_id, c.created_at DESC
    ) sub
    WHERE distance_km <= ${RADIUS_KM}
    ORDER BY distance_km ASC LIMIT 100`;

  return NextResponse.json({ travellers: rows, my_lat: me.lat, my_lng: me.lng, opted_in: viewer.auto_meetup_opt_in !== false });
}
