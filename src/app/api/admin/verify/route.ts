import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, status, reason } = await req.json().catch(() => ({} as any));
  if (!id || !['verified', 'unverified', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'id + valid status required' }, { status: 400 });
  }
  await sql`UPDATE users SET verification_status = ${status},
            verification_method = ${status === 'verified' ? 'admin' : null},
            verified_at = ${status === 'verified' ? sql`NOW()` : null}
            WHERE id::text = ${id}`;
  await logAction(admin, 'verify_user', { targetType: 'user', targetId: id, metadata: { status, reason }, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
