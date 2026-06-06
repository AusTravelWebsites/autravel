import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit, getIP } from '@/lib/admin';
import { stripExternalLinks } from '@/lib/sanitize';
import { canViewMeetup, getViewerWithVerify } from '@/lib/meetup-access';
import { getMutedIds } from '@/lib/blocks';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u as { id: string };
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [m] = await sql`SELECT id, host_id, scope, women_only, min_age, host_approval_required, status, max_attendees FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewer = await getViewer(req);
  const viewerFull = viewer ? await getViewerWithVerify(viewer.id) : null;
  const viewable = await canViewMeetup(m as any, viewerFull);
  if (!viewable) return NextResponse.json({ error: 'Not visible' }, { status: 403 });

  const muted = viewer ? await getMutedIds(viewer.id) : [];
  const comments = await sql`
    SELECT c.id, c.body, c.created_at, u.id::text AS user_id, u.username, u.display_name, u.avatar_url, u.verification_status
    FROM meetup_comments c
    JOIN users u ON u.id::text = c.user_id
    WHERE c.meetup_id = ${id}
      AND (${muted.length === 0 ? true : false}::boolean = true OR u.id::text <> ALL(${muted as any}::text[]))
    ORDER BY c.created_at ASC`;
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Please log in' }, { status: 401 });
  const ip = getIP(req) || 'unknown';
  if (!(await rateLimit(`meetup-cmt:${viewer.id}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many comments' }, { status: 429 });
  }

  const { id } = await ctx.params;
  const [m] = await sql`SELECT id, host_id, scope, women_only, min_age, host_approval_required, status, max_attendees FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewerFull = await getViewerWithVerify(viewer.id);
  const viewable = await canViewMeetup(m as any, viewerFull);
  if (!viewable) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const raw = typeof body?.body === 'string' ? body.body : '';
  const text = stripExternalLinks(raw) ?? '';
  if (!text.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 });

  const [c] = await sql`
    INSERT INTO meetup_comments (meetup_id, user_id, body)
    VALUES (${id}, ${viewer.id}, ${text.trim()})
    RETURNING id, body, created_at`;

  // Notify host (if not self)
  if (m.host_id !== viewer.id) {
    try {
      const { notify } = await import('@/lib/notify');
      notify({ recipientId: String(m.host_id), actorId: String(viewer.id), type: 'meetup_comment', link: `/meetups/${id}`, preview: text.slice(0, 140) }).catch(() => {});
    } catch {}
  }

  const [u] = await sql`SELECT username, display_name, avatar_url, verification_status FROM users WHERE id::text = ${viewer.id} LIMIT 1`;
  return NextResponse.json({
    comment: { id: c.id, body: c.body, created_at: c.created_at,
      username: u?.username, display_name: u?.display_name, avatar_url: u?.avatar_url, verification_status: u?.verification_status,
    },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const url = new URL(req.url);
  const commentId = url.searchParams.get('comment_id');
  if (!commentId) return NextResponse.json({ error: 'comment_id required' }, { status: 400 });
  const { id } = await ctx.params;
  const [m] = await sql`SELECT host_id FROM meetups WHERE id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Author or host can delete
  const [c] = await sql`SELECT user_id FROM meetup_comments WHERE id = ${commentId} AND meetup_id = ${id} LIMIT 1`;
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.user_id !== viewer.id && m.host_id !== viewer.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await sql`DELETE FROM meetup_comments WHERE id = ${commentId}`;
  return NextResponse.json({ ok: true });
}
