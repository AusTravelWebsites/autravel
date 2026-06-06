import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '100'), 500);
  const offset = parseInt(sp.get('offset') || '0');
  const rows = await db`
    SELECT a.id::text, a.action, a.target_type, a.target_id, a.metadata, a.ip, a.created_at,
           u.username, u.display_name
    FROM admin_actions a
    LEFT JOIN users u ON u.id::text = a.admin_id
    ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return NextResponse.json({ items: rows });
}
