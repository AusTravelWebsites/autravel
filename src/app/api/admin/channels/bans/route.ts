import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT b.id, b.user_id, b.ip, b.reason, b.expires_at, b.created_at,
           u.username, u.display_name
    FROM channel_bans b
    LEFT JOIN users u ON u.id::text = b.user_id
    WHERE (b.expires_at IS NULL OR b.expires_at > NOW())
    ORDER BY b.created_at DESC LIMIT 200`;
  return NextResponse.json({ bans: rows });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await sql`DELETE FROM channel_bans WHERE id = ${id}`;
  await logAction(admin, 'channel_ban_lift', { targetType: 'channel_ban', targetId: id, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
