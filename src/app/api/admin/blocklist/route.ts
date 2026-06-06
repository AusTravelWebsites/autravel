import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

const VALID_KINDS = new Set(['ip','email','email_domain','phone','phone_prefix']);

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await db`SELECT * FROM blocklist ORDER BY created_at DESC LIMIT 500`;
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const kind = String(body.kind || '').toLowerCase();
  const value = String(body.value || '').trim();
  const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;
  if (!VALID_KINDS.has(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  if (!value) return NextResponse.json({ error: 'Value required' }, { status: 400 });
  try {
    const [row] = await db`
      INSERT INTO blocklist (kind, value, reason, created_by)
      VALUES (${kind}, ${value}, ${reason}, ${admin.id}::text)
      ON CONFLICT (kind, LOWER(value)) DO UPDATE SET reason = EXCLUDED.reason
      RETURNING *`;
    await logAction(admin, 'block', { targetType: kind, targetId: value, metadata: { reason }, ip: getIP(req) });
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const [row] = await db`DELETE FROM blocklist WHERE id = ${id} RETURNING kind, value`;
  if (row) await logAction(admin, 'unblock', { targetType: row.kind, targetId: row.value, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
