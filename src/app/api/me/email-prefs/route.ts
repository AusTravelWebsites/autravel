import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id::text FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

const TYPES = ['like','comment','follow','tag_trip','tag_review','new_message',
  'meetup_invite','meetup_join_request','meetup_approved','meetup_comment','meetup_rated',
  'blog_comment','auto_meetup'] as const;

export async function GET(req: NextRequest) {
  const u = await getUser(req);
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [row] = await db`SELECT email_notifications FROM users WHERE id::text = ${u.id} LIMIT 1`;
  return NextResponse.json({ prefs: row?.email_notifications || {} });
}

export async function PATCH(req: NextRequest) {
  const u = await getUser(req);
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const incoming: Record<string, boolean> = {};
  for (const t of TYPES) if (typeof body[t] === 'boolean') incoming[t] = body[t];
  const [row] = await db`SELECT email_notifications FROM users WHERE id::text = ${u.id} LIMIT 1`;
  const merged = { ...(row?.email_notifications || {}), ...incoming };
  await db`UPDATE users SET email_notifications = ${merged as any} WHERE id::text = ${u.id}`;
  return NextResponse.json({ ok: true, prefs: merged });
}
