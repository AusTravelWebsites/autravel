import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

// Single-article fetch + update. The list endpoint at /api/admin/articles
// returns row summaries (no body_html, no body_md) — this one returns the
// full record so the editor can populate. PATCH mirrors the list-level
// PATCH so callers can use either.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const [row] = await db`
    SELECT id::text AS id, state_code, slug, legacy_path, title, excerpt, body_html, body_md,
           cover_image, images, categories, tags, destination_slug, post_type, author, status,
           source, source_raw, published_at, updated_at_source, noindex, seo_title, seo_description,
           created_at, updated_at, affiliate_links
      FROM articles
     WHERE id = ${id}::uuid
     LIMIT 1`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ article: row })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const patch = await req.json()
  const allowed = ['title', 'excerpt', 'body_html', 'body_md', 'cover_image', 'categories',
    'tags', 'destination_slug', 'author', 'author_slug', 'status', 'noindex', 'seo_title',
    'seo_description', 'slug', 'legacy_path', 'published_at', 'affiliate_links']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })
  updates.updated_at = new Date()
  await db`UPDATE articles SET ${db(updates)} WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}
