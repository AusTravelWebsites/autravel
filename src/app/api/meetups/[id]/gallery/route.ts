import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/admin';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

// POST — add a photo URL to the meetup gallery. Host or any confirmed attendee may upload.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`meetup-gallery:${viewer.id}`, 20, 3600))) {
    return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({} as any));
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!/^https:\/\/media\.bugbitten\.com\/(meetup-gallery|meetup|journal|general)\/[a-f0-9-]+\.(webp|jpg|jpeg|png)$/i.test(url)) {
    return NextResponse.json({ error: 'URL must be a BugBitten-hosted image (upload first via /api/upload)' }, { status: 400 });
  }

  const [m] = await sql`SELECT host_id, gallery FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (m.host_id !== viewer.id) {
    const [att] = await sql`SELECT status FROM meetup_attendees WHERE meetup_id = ${id} AND user_id = ${viewer.id} LIMIT 1`;
    if (!att || att.status !== 'going') return NextResponse.json({ error: 'Only attendees can upload' }, { status: 403 });
  }

  const existing: string[] = Array.isArray(m.gallery) ? m.gallery : [];
  if (existing.length >= 30) return NextResponse.json({ error: 'Gallery full (30 max)' }, { status: 400 });
  if (existing.includes(url)) return NextResponse.json({ ok: true, gallery: existing });

  const next = [...existing, url];
  await sql`UPDATE meetups SET gallery = ${next as any} WHERE id = ${id}`;
  return NextResponse.json({ ok: true, gallery: next });
}

// DELETE — host or uploader can remove a photo. We don't track uploader per-photo, so restrict to host only.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const photoUrl = url.searchParams.get('url') || '';
  if (!photoUrl) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const [m] = await sql`SELECT host_id, gallery FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (m.host_id !== viewer.id) return NextResponse.json({ error: 'Only the host can remove photos' }, { status: 403 });

  const existing: string[] = Array.isArray(m.gallery) ? m.gallery : [];
  const next = existing.filter(u => u !== photoUrl);
  await sql`UPDATE meetups SET gallery = ${next as any} WHERE id = ${id}`;
  return NextResponse.json({ ok: true, gallery: next });
}
