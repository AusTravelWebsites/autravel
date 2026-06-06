import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

// GET ?kind=posts|reviews|images|trips — recent items for moderation
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const kind = new URL(req.url).searchParams.get('kind') || 'posts';
  try {
    if (kind === 'posts') {
      const rows = await db`
        SELECT je.id::text AS id, je.body, je.created_at, je.is_public, je.location_name, je.media_urls, je.like_count, je.comment_count,
               u.username, u.display_name, u.avatar_url, u.id::text AS user_id
        FROM journal_entries je JOIN users u ON u.id::text = je.user_id
        ORDER BY je.created_at DESC LIMIT 100`;
      return NextResponse.json({ items: rows });
    }
    if (kind === 'reviews') {
      const rows = await db`
        SELECT r.id::text AS id, r.body, r.title, r.created_at, r.rating, r.overall_rating,
               u.username, u.display_name, u.id::text AS user_id,
               p.name AS place_name, p.slug AS place_slug
        FROM reviews r JOIN users u ON u.id::text = r.user_id
        LEFT JOIN places p ON p.id = r.place_id
        ORDER BY r.created_at DESC LIMIT 100`;
      return NextResponse.json({ items: rows });
    }
    if (kind === 'comments') {
      const rows = await db`
        SELECT c.id::text AS id, c.body, c.created_at,
               u.username, u.display_name,
               c.entry_id::text AS entry_id
        FROM comments c JOIN users u ON u.id::text = c.user_id
        ORDER BY c.created_at DESC LIMIT 100`;
      return NextResponse.json({ items: rows });
    }
    if (kind === 'images') {
      // Aggregate from journal_entries.media_urls
      const rows = await db`
        SELECT je.id::text AS entry_id, je.created_at, UNNEST(je.media_urls) AS url,
               u.username, u.display_name
        FROM journal_entries je JOIN users u ON u.id::text = je.user_id
        WHERE je.media_urls IS NOT NULL AND array_length(je.media_urls, 1) > 0
        ORDER BY je.created_at DESC LIMIT 100`;
      return NextResponse.json({ items: rows });
    }
    if (kind === 'trips') {
      const rows = await db`
        SELECT t.id::text AS id, t.title, t.slug, t.description, t.created_at, t.is_public, t.location_name, t.cover_image,
               u.username, u.display_name
        FROM trips t JOIN users u ON u.id::text = t.user_id
        ORDER BY t.created_at DESC LIMIT 100`;
      return NextResponse.json({ items: rows });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE ?kind=post|review|trip|image&id=... (or ids=a,b,c for bulk; url required for image)
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const kind = sp.get('kind');
  const id = sp.get('id');
  const ids = (sp.get('ids') || '').split(',').filter(Boolean);
  const targetIds = ids.length ? ids : (id ? [id] : []);
  try {
    if (kind === 'post') {
      if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
      await db`DELETE FROM journal_entries WHERE id = ANY(${targetIds as any})`;
      await logAction(admin, ids.length ? 'bulk_delete_posts' : 'delete_post', { targetType: 'journal_entry', targetId: targetIds.join(','), metadata: { count: targetIds.length }, ip: getIP(req) });
      return NextResponse.json({ ok: true, count: targetIds.length });
    }
    if (kind === 'review') {
      if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
      await db`DELETE FROM reviews WHERE id = ANY(${targetIds as any})`;
      await logAction(admin, ids.length ? 'bulk_delete_reviews' : 'delete_review', { targetType: 'review', targetId: targetIds.join(','), metadata: { count: targetIds.length }, ip: getIP(req) });
      return NextResponse.json({ ok: true, count: targetIds.length });
    }
    if (kind === 'trip') {
      if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
      await db`DELETE FROM trips WHERE id = ANY(${targetIds as any})`;
      await logAction(admin, ids.length ? 'bulk_delete_trips' : 'delete_trip', { targetType: 'trip', targetId: targetIds.join(','), metadata: { count: targetIds.length }, ip: getIP(req) });
      return NextResponse.json({ ok: true, count: targetIds.length });
    }
    if (kind === 'comment') {
      if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
      await db`DELETE FROM comments WHERE id = ANY(${targetIds as any})`;
      await logAction(admin, ids.length ? 'bulk_delete_comments' : 'delete_comment', { targetType: 'comment', targetId: targetIds.join(','), metadata: { count: targetIds.length }, ip: getIP(req) });
      return NextResponse.json({ ok: true, count: targetIds.length });
    }
    if (kind === 'image') {
      const entryId = sp.get('entry_id');
      const url = sp.get('url');
      if (!entryId || !url) return NextResponse.json({ error: 'entry_id + url required' }, { status: 400 });
      await db`UPDATE journal_entries SET media_urls = array_remove(media_urls, ${url}) WHERE id = ${entryId}`;
      await logAction(admin, 'delete_image', { targetType: 'journal_entry', targetId: entryId, metadata: { url }, ip: getIP(req) });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
