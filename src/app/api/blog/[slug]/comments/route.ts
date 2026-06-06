import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/admin';
import { stripExternalLinks } from '@/lib/sanitize';
import { getMutedIds } from '@/lib/blocks';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [post] = await sql`SELECT id FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const viewer = await getUser(req);
  const muted = viewer ? await getMutedIds(viewer.id) : [];
  const comments = await sql`
    SELECT c.id, c.body, c.created_at, u.username, u.display_name, u.avatar_url, u.verification_status
    FROM blog_comments c
    JOIN users u ON u.id::text = c.user_id
    WHERE c.blog_post_id = ${post.id}
      AND (${muted.length === 0 ? true : false}::boolean = true OR u.id::text <> ALL(${muted as any}::text[]))
    ORDER BY c.created_at ASC`;
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Please log in' }, { status: 401 });
  if (!(await rateLimit(`blog-cmt:${viewer.id}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many comments' }, { status: 429 });
  }
  const { slug } = await ctx.params;
  const [post] = await sql`SELECT id, user_id FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const raw = typeof body?.body === 'string' ? body.body : '';
  const text = stripExternalLinks(raw) ?? '';
  if (!text.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: 'Too long (max 1000 chars)' }, { status: 400 });

  const [c] = await sql`
    INSERT INTO blog_comments (blog_post_id, user_id, body)
    VALUES (${post.id}, ${viewer.id}, ${text.trim()})
    RETURNING id, body, created_at`;

  if (post.user_id !== viewer.id) {
    try {
      const { notify } = await import('@/lib/notify');
      notify({ recipientId: String(post.user_id), actorId: String(viewer.id), type: 'blog_comment', link: `/blog/${slug}`, preview: text.slice(0, 140) }).catch(() => {});
    } catch {}
  }

  const [u] = await sql`SELECT username, display_name, avatar_url, verification_status FROM users WHERE id::text = ${viewer.id} LIMIT 1`;
  return NextResponse.json({
    comment: { id: c.id, body: c.body, created_at: c.created_at,
      username: u?.username, display_name: u?.display_name, avatar_url: u?.avatar_url, verification_status: u?.verification_status,
    },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const viewer = await getUser(req);
  if (!viewer) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const url = new URL(req.url);
  const commentId = url.searchParams.get('comment_id');
  if (!commentId) return NextResponse.json({ error: 'comment_id required' }, { status: 400 });
  const { slug } = await ctx.params;
  const [post] = await sql`SELECT id, user_id FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [c] = await sql`SELECT user_id FROM blog_comments WHERE id = ${commentId} AND blog_post_id = ${post.id} LIMIT 1`;
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.user_id !== viewer.id && post.user_id !== viewer.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await sql`DELETE FROM blog_comments WHERE id = ${commentId}`;
  return NextResponse.json({ ok: true });
}
