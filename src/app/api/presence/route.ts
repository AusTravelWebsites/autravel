import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value;
  if (!session) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    const [u] = await db`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { country, country_code, city } = await req.json().catch(() => ({} as any));
  await db`
    INSERT INTO user_presence (user_id, country, country_code, city, last_seen, is_online)
    VALUES (${user.id}, ${country || null}, ${country_code || null}, ${city || null}, NOW(), true)
    ON CONFLICT (user_id) DO UPDATE SET
      country = EXCLUDED.country, country_code = EXCLUDED.country_code,
      city = EXCLUDED.city, last_seen = NOW(), is_online = true`;
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ online: [] });
  const online = await db`
    SELECT u.id, u.username, u.display_name, u.avatar_url, p.country, p.city, p.last_seen
    FROM user_presence p
    JOIN users u ON u.id::text = p.user_id
    WHERE p.is_online = true
      AND p.last_seen > NOW() - INTERVAL '10 minutes'
      AND p.user_id <> ${user.id}
      AND (
        p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ${user.id})
        OR p.user_id IN (SELECT follower_id  FROM follows WHERE following_id = ${user.id})
      )
    ORDER BY p.last_seen DESC LIMIT 20`;
  return NextResponse.json({ online });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false });
  await db`UPDATE user_presence SET is_online = false WHERE user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
