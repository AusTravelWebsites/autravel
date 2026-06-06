import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api-errors'
import { db } from '@/lib/db';
import { getIP } from '@/lib/admin';
import { getAdminAuth } from '@/lib/firebase-admin';

// POST — record a view; increments view_count once per IP+user-per-day
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const [post] = await db`SELECT id::text, user_id FROM blog_posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ip = getIP(req);

    // Resolve viewer (if signed-in)
    let viewerId: string | null = null;
    try {
      const s = req.cookies.get('__session')?.value;
      if (s) {
        const d = await getAdminAuth().verifySessionCookie(s, true);
        const [u] = await db`SELECT id::text FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
        viewerId = (u?.id as string) || null;
      }
    } catch {}

    // Don't count the author viewing their own post
    if (viewerId && viewerId === post.user_id) return NextResponse.json({ ok: true, skipped: 'author' });

    try {
      await db`
        INSERT INTO blog_views (blog_post_id, ip, user_id)
        VALUES (${post.id}, ${ip}, ${viewerId})`;
      await db`UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ${post.id}`;
      return NextResponse.json({ ok: true });
    } catch {
      // Unique violation on the dedup index = already counted today
      return NextResponse.json({ ok: true, deduped: true });
    }
  } catch (e: any) {
    return serverError(e, 'blog/[slug]/view', req);
  }
}
