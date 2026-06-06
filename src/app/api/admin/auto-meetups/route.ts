import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const logs = await sql`
    SELECT n.id::text, n.user_id, n.cluster_lat, n.cluster_lng, n.member_count, n.created_at,
           u.username, u.display_name
    FROM auto_meetup_notifications n
    LEFT JOIN users u ON u.id::text = n.user_id
    ORDER BY n.created_at DESC LIMIT 100`;
  return NextResponse.json({ logs });
}
