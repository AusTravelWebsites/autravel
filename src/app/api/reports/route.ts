import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit, getIP } from '@/lib/admin';

const VALID = new Set(['post','review','trip','user','image']);

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

// POST — logged-in user flags content for admin review.
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ip = getIP(req);
  if (ip && !(await rateLimit(`report:${ip}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many reports recently. Try later.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({} as any));
  const target_type = String(body.target_type || '').toLowerCase();
  const target_id = String(body.target_id || '').trim();
  const reason = String(body.reason || '').trim().slice(0, 100);
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
  if (!VALID.has(target_type)) return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 });
  if (!target_id) return NextResponse.json({ error: 'target_id required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });
  const [row] = await db`
    INSERT INTO content_reports (reporter_id, target_type, target_id, reason, notes)
    VALUES (${user.id}::text, ${target_type}, ${target_id}, ${reason}, ${notes})
    RETURNING id, created_at`;
  return NextResponse.json({ report: row }, { status: 201 });
}
