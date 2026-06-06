import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { stripExternalLinks } from '@/lib/sanitize';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id::text, is_admin FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db`
    SELECT b.*, u.username, u.display_name, u.avatar_url, u.bio
    FROM blog_posts b JOIN users u ON u.id::text = b.user_id
    WHERE b.slug = ${slug} LIMIT 1`;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post: row });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [post] = await db`SELECT user_id FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.user_id !== user.id && !user.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const title = stripExternalLinks(b.title)?.trim();
  const body = stripExternalLinks(b.body)?.trim();
  const subtitle = stripExternalLinks(b.subtitle)?.trim() ?? null;
  const excerpt = stripExternalLinks(b.excerpt)?.trim() ?? null;
  const location_name = stripExternalLinks(b.location_name)?.trim();
  const featured_image = typeof b.featured_image === 'string' && /^https?:\/\//.test(b.featured_image) ? b.featured_image : null;
  const featured_image_alt = typeof b.featured_image_alt === 'string' ? b.featured_image_alt.trim() : null;
  const tags: string[] | null = Array.isArray(b.tags) ? (b.tags as any[]).map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10) : null;
  const category = ['blog','review','story'].includes(b.category) ? b.category : null;
  const status = ['published','draft','archived'].includes(b.status) ? b.status : null;
  const readingMinutes = body ? Math.max(1, Math.round((body.trim().split(/\s+/).length || 1) / 200)) : null;
  const metaTitle = stripExternalLinks(b.meta_title)?.trim() ?? null;
  const metaDescription = stripExternalLinks(b.meta_description)?.trim() ?? null;

  const [row] = await db`
    UPDATE blog_posts SET
      title = COALESCE(${title ?? null}, title),
      subtitle = COALESCE(${subtitle}, subtitle),
      body = COALESCE(${body ?? null}, body),
      excerpt = COALESCE(${excerpt}, excerpt),
      location_name = COALESCE(${location_name ?? null}, location_name),
      featured_image = COALESCE(${featured_image}, featured_image),
      featured_image_alt = COALESCE(${featured_image_alt}, featured_image_alt),
      tags = COALESCE(${tags as any}, tags),
      category = COALESCE(${category}, category),
      status = COALESCE(${status}, status),
      reading_minutes = COALESCE(${readingMinutes}, reading_minutes),
      meta_title = COALESCE(${metaTitle}, meta_title),
      meta_description = COALESCE(${metaDescription}, meta_description),
      published_at = CASE WHEN status = 'draft' AND ${status} = 'published' THEN NOW() ELSE published_at END,
      updated_at = NOW()
    WHERE slug = ${slug} RETURNING slug`;
  return NextResponse.json({ post: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [post] = await db`SELECT user_id FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.user_id !== user.id && !user.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await db`DELETE FROM blog_posts WHERE slug = ${slug}`;
  return NextResponse.json({ ok: true });
}
