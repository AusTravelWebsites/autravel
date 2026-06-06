import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID = new Set(['like','comment','follow','tag_trip','tag_review','new_message','all']);

// GET /api/unsubscribe?token=...&type=like  (one-click from email)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const token = sp.get('token');
  const type = sp.get('type') || 'all';
  if (!token || !VALID.has(type)) return NextResponse.redirect(new URL('/?unsub=invalid', req.url));

  try {
    const [u] = await db`SELECT id::text, email_notifications FROM users WHERE unsubscribe_token = ${token} LIMIT 1`;
    if (!u) return NextResponse.redirect(new URL('/?unsub=invalid', req.url));

    let prefs = u.email_notifications || {};
    if (type === 'all') {
      prefs = { like: false, comment: false, follow: false, tag_trip: false, tag_review: false, new_message: false };
    } else {
      prefs = { ...prefs, [type]: false };
    }
    await db`UPDATE users SET email_notifications = ${prefs as any} WHERE id::text = ${u.id}`;
    return NextResponse.redirect(new URL(`/unsubscribe?ok=1&type=${type}`, req.url));
  } catch (e) {
    console.error('[unsubscribe]', e);
    return NextResponse.redirect(new URL('/?unsub=error', req.url));
  }
}
