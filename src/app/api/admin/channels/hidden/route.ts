import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  const [ch] = await sql`SELECT id FROM channels WHERE slug = ${slug} LIMIT 1`;
  if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const messages = await sql`
    SELECT m.id, m.body, m.created_at, m.hidden_reason, m.user_id, u.username
    FROM channel_messages m
    LEFT JOIN users u ON u.id::text = m.user_id
    WHERE m.channel_id = ${ch.id} AND m.is_hidden = true
    ORDER BY m.created_at DESC LIMIT 200`;
  return NextResponse.json({ messages });
}

// Restore a hidden message (clears is_hidden)
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await sql`UPDATE channel_messages SET is_hidden = false, hidden_reason = NULL WHERE id = ${id}`;
  await logAction(admin, 'channel_message_restore', { targetType: 'channel_message', targetId: id, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}

// Hard-delete a message
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await sql`DELETE FROM channel_messages WHERE id = ${id}`;
  await logAction(admin, 'channel_message_delete', { targetType: 'channel_message', targetId: id, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
