import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
  // All-time counts
  const [totals] = await db`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE COALESCE(is_banned,false) = false) AS users_active,
      (SELECT COUNT(*)::int FROM users WHERE is_banned = true) AS users_banned,
      (SELECT COUNT(*)::int FROM users WHERE is_admin = true) AS users_admin,
      (SELECT COUNT(*)::int FROM journal_entries) AS posts,
      (SELECT COUNT(*)::int FROM reviews) AS reviews,
      (SELECT COUNT(*)::int FROM places) AS places,
      (SELECT COUNT(*)::int FROM trips) AS trips,
      (SELECT COUNT(*)::int FROM blocklist) AS blocklist,
      (SELECT COUNT(*)::int FROM channels) AS channels,
      (SELECT COUNT(*)::int FROM channel_messages WHERE is_hidden = false) AS channel_messages,
      (SELECT COUNT(*)::int FROM channel_messages WHERE is_hidden = true) AS channel_hidden,
      (SELECT COUNT(*)::int FROM channel_bans WHERE expires_at IS NULL OR expires_at > NOW()) AS channel_bans,
      (SELECT COUNT(*)::int FROM meetups WHERE COALESCE(status, 'open') <> 'cancelled') AS meetups,
      (SELECT COUNT(*)::int FROM meetups WHERE meetup_date > NOW()) AS meetups_upcoming,
      (SELECT COUNT(*)::int FROM blog_posts WHERE status = 'published') AS blogs_published,
      (SELECT COUNT(*)::int FROM user_blocks) AS user_blocks,
      (SELECT COUNT(*)::int FROM tours WHERE active = true) AS tours_active,
      (SELECT COUNT(*)::int FROM tours) AS tours_total,
      (SELECT COUNT(DISTINCT country)::int FROM tours WHERE active = true AND country IS NOT NULL) AS tour_countries`;

  // Rolling-window counts
  const [windowStats] = await db`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '24 hours') AS signups_24h,
      (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '7 days')  AS signups_7d,
      (SELECT COUNT(*)::int FROM journal_entries WHERE created_at > NOW() - INTERVAL '24 hours') AS posts_24h,
      (SELECT COUNT(*)::int FROM reviews WHERE created_at > NOW() - INTERVAL '24 hours') AS reviews_24h,
      (SELECT COUNT(*)::int FROM sign_ins WHERE created_at > NOW() - INTERVAL '15 minutes') AS online_now,
      (SELECT COUNT(*)::int FROM sign_ins WHERE created_at > NOW() - INTERVAL '24 hours') AS signins_24h`;

  // 14-day activity timeseries — signups, posts, reviews per day
  let series: any[] = [];
  try {
    series = await db`
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval)::date AS d
      ),
      s AS (SELECT created_at::date AS d, COUNT(*)::int AS c FROM users WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1),
      p AS (SELECT created_at::date AS d, COUNT(*)::int AS c FROM journal_entries WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1),
      r AS (SELECT created_at::date AS d, COUNT(*)::int AS c FROM reviews WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1)
      SELECT days.d::text AS day,
             COALESCE(s.c, 0) AS signups,
             COALESCE(p.c, 0) AS posts,
             COALESCE(r.c, 0) AS reviews
      FROM days
      LEFT JOIN s ON s.d = days.d
      LEFT JOIN p ON p.d = days.d
      LEFT JOIN r ON r.d = days.d
      ORDER BY days.d` as any;
  } catch (e) { console.error('[stats series]', e); }

  // Suspicious signups: 3+ accounts on one IP in last 7 days
  const ipClusters = await db`
    SELECT signup_ip AS ip, COUNT(*)::int AS c, array_agg(username ORDER BY created_at DESC) AS usernames
    FROM users
    WHERE signup_ip IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY signup_ip HAVING COUNT(*) >= 3
    ORDER BY c DESC LIMIT 10`;

  // Currently online (signed in in last 15 min)
  const online = await db`
    SELECT DISTINCT ON (u.id) u.id::text AS id, u.username, u.display_name, u.avatar_url, s.ip, s.created_at AS last_seen_at
    FROM sign_ins s JOIN users u ON u.id::text = s.user_id
    WHERE s.created_at > NOW() - INTERVAL '15 minutes'
    ORDER BY u.id, s.created_at DESC
    LIMIT 50`;

    return NextResponse.json({ totals, windowStats, ipClusters, online, series });
  } catch (e: any) {
    console.error('[admin/stats]', e);
    return NextResponse.json({ error: e.message, totals: {}, windowStats: {}, ipClusters: [], online: [], series: [] }, { status: 500 });
  }
}
