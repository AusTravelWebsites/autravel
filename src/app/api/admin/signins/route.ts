import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const window = sp.get('window') || '24h'; // 15m | 24h | 7d
  const interval = window === '15m' ? '15 minutes' : window === '7d' ? '7 days' : '24 hours';
  const search = (sp.get('search') || '').trim();
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const limit = Math.min(100, Math.max(5, parseInt(sp.get('limit') || '20')));
  const offset = (page - 1) * limit;
  const pat = '%' + search + '%';

  const rows = await db.unsafe(`
    SELECT s.id::text AS id, s.user_id, s.ip, s.user_agent, s.created_at,
           u.username, u.display_name, u.avatar_url, u.is_banned
    FROM sign_ins s
    LEFT JOIN users u ON u.id::text = s.user_id
    WHERE s.created_at > NOW() - INTERVAL '${interval}'
      AND ($1 = '' OR u.username ILIKE $2 OR u.display_name ILIKE $2 OR s.ip ILIKE $2)
    ORDER BY s.created_at DESC LIMIT $3 OFFSET $4`, [search, pat, limit, offset] as any);
  const [count] = await db.unsafe(`SELECT COUNT(*)::int AS c FROM sign_ins WHERE created_at > NOW() - INTERVAL '${interval}'`) as any;
  return NextResponse.json({ signins: rows, total: count.c, page, limit, window });
}
