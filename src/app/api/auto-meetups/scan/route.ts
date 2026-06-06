import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

// Auto-meetup detector.
// Finds clusters of >=5 opted-in travellers whose latest GPS check-in (last 7 days)
// puts them within 10 miles (≈16.1 km) of each other. Sends each member a one-shot
// notification, deduped by 24h-per-user.
//
// Trigger via cron / admin POST: `POST /api/auto-meetups/scan` with admin session,
// or `POST /api/auto-meetups/scan?token=<AUTO_MEETUP_TOKEN>` for unattended cron.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const expected = process.env.AUTO_MEETUP_TOKEN;
  let authed = false;
  if (expected && token && token === expected) authed = true;
  if (!authed) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cleanup: remove expired channel bans (housekeeping on every scan)
  try { await sql`DELETE FROM channel_bans WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '1 day'`; } catch {}

  // Latest fresh check-in per user (last 7 days), opted-in users only, plus blocks for safety.
  const recent = await sql`
    SELECT DISTINCT ON (c.user_id)
      c.user_id::text AS user_id, c.lat::float AS lat, c.lng::float AS lng,
      u.username, u.display_name, u.avatar_url
    FROM checkins c
    JOIN users u ON u.id::text = c.user_id::text
    WHERE c.created_at > NOW() - INTERVAL '7 days'
      AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      AND COALESCE(u.is_banned, false) = false
      AND COALESCE(u.auto_meetup_opt_in, true) = true
    ORDER BY c.user_id, c.created_at DESC`;

  const points = recent as any[];
  const RADIUS_KM = 16.1; // 10 miles

  function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  // For each user, find neighbours within radius.
  const { notify } = await import('@/lib/notify');
  let notified = 0;
  for (const p of points) {
    const neighbours = points.filter(q => q.user_id !== p.user_id && distKm(p, q) <= RADIUS_KM);
    if (neighbours.length < 4) continue; // need 5+ total (self + 4 others)

    // Dedup: skip if already notified in last 24h
    const [recentNote] = await sql`
      SELECT 1 FROM auto_meetup_notifications
      WHERE user_id = ${p.user_id} AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1`;
    if (recentNote) continue;

    const cnt = neighbours.length + 1;
    await sql`
      INSERT INTO auto_meetup_notifications (user_id, cluster_lat, cluster_lng, member_count)
      VALUES (${p.user_id}, ${p.lat}, ${p.lng}, ${cnt})`;

    // Synthetic actor = first neighbour (the notify helper requires actorId)
    const actor = neighbours[0];
    notify({
      recipientId: p.user_id,
      actorId: actor.user_id,
      type: 'auto_meetup',
      link: `/auto-meetups`,
      preview: `${cnt} travellers (including you) are within 10 miles right now. Want to meet up?`,
    }).catch(() => {});
    notified++;
  }

  return NextResponse.json({ ok: true, candidates: points.length, notified });
}
