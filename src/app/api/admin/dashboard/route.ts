import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const states = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']
  const rows = await Promise.all(states.map(async s => {
    const [x] = await db<[{ d: number; p: number; t: number; a: number; r: number; n404: number; redirect_hits: number; recent_404s: number }]>`
      SELECT
        (SELECT COUNT(*)::int FROM destinations WHERE state_code=${s}) AS d,
        (SELECT COUNT(*)::int FROM parks WHERE state_code=${s} AND active) AS p,
        (SELECT COUNT(*)::int FROM tours WHERE state_code=${s} AND active) AS t,
        (SELECT COUNT(*)::int FROM articles WHERE state_code=${s} AND status='published') AS a,
        (SELECT COUNT(*)::int FROM redirects WHERE state_code=${s} AND is_active) AS r,
        (SELECT COUNT(*)::int FROM redirect_404s WHERE state_code=${s}) AS n404,
        (SELECT COALESCE(SUM(hit_count),0)::int FROM redirects WHERE state_code=${s} AND is_active) AS redirect_hits,
        (SELECT COUNT(*)::int FROM redirect_404s WHERE state_code=${s} AND last_seen_at > NOW() - INTERVAL '7 days') AS recent_404s`
    return { state_code: s, ...x }
  }))

  // Recent activity: last 10 admin actions
  const activity = await db`
    SELECT admin_user, action, target_type, target_id, details, created_at
    FROM admin_actions
    ORDER BY created_at DESC
    LIMIT 10`.catch(() => [])

  // Top 5 404s across all tenants in last 7 days
  const top404s = await db`
    SELECT state_code, path, hit_count, last_seen_at
    FROM redirect_404s
    WHERE last_seen_at > NOW() - INTERVAL '7 days'
    ORDER BY hit_count DESC
    LIMIT 5`.catch(() => [])

  const [totalUsers] = await db<[{ n: number; admins: number; banned: number }]>`
    SELECT COUNT(*)::int AS n,
      SUM(CASE WHEN is_admin THEN 1 ELSE 0 END)::int AS admins,
      SUM(CASE WHEN is_banned THEN 1 ELSE 0 END)::int AS banned
    FROM users`.catch(() => [{ n: 0, admins: 0, banned: 0 }] as any)

  return NextResponse.json({ perTenant: rows, activity, top404s, users: totalUsers })
}
