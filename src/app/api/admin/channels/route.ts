import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT c.id, c.slug, c.city_name, c.country, c.member_count, c.message_count, c.last_activity_at, c.is_locked,
           (SELECT COUNT(*)::int FROM channel_messages WHERE channel_id = c.id AND is_hidden = true) AS hidden_count
    FROM channels c ORDER BY c.last_activity_at DESC NULLS LAST`;
  return NextResponse.json({ channels: rows });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  if (!body?.slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  await sql`UPDATE channels SET is_locked = ${!!body.is_locked} WHERE slug = ${body.slug}`;
  await logAction(admin, body.is_locked ? 'channel_lock' : 'channel_unlock', { targetType: 'channel', targetId: body.slug, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  await sql`DELETE FROM channels WHERE slug = ${slug}`;
  await logAction(admin, 'channel_delete', { targetType: 'channel', targetId: slug, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
