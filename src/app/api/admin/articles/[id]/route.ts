import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'
import { ALL_STATE_CODES } from '@/lib/tenants'

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
    'seo_description', 'slug', 'legacy_path', 'published_at', 'affiliate_links', 'state_code']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })

  // Moving a post to another site (tenant) changes state_code. Validate it and
  // guard the unique(state_code, slug) constraint so a collision returns a clear
  // message instead of a raw DB error.
  if ('state_code' in updates) {
    if (!ALL_STATE_CODES.includes(updates.state_code)) {
      return NextResponse.json({ error: 'Invalid site' }, { status: 400 })
    }
    const targetSlug = 'slug' in updates ? updates.slug : undefined
    const [clash] = await db<Array<{ id: string }>>`
      SELECT id::text AS id FROM articles
       WHERE state_code = ${updates.state_code}
         AND slug = COALESCE(${targetSlug ?? null}, (SELECT slug FROM articles WHERE id = ${id}::uuid))
         AND id <> ${id}::uuid
       LIMIT 1`
    if (clash) {
      return NextResponse.json({ error: 'That site already has a post with this slug. Change the slug first, then move it.' }, { status: 409 })
    }
  }

  // When a freshly-created post's placeholder URL (/new-post-xxxx/) is renamed
  // to its real title-based URL, auto-create a 301 from the old placeholder so
  // any link/index of the old URL keeps working. Scoped to placeholder paths so
  // it never fires on imported-post legacy_path corrections.
  if ('legacy_path' in updates && updates.legacy_path) {
    try {
      const [cur] = await db<Array<{ state_code: string; legacy_path: string | null }>>`
        SELECT state_code, legacy_path FROM articles WHERE id = ${id}::uuid LIMIT 1`
      const oldPath = cur?.legacy_path || ''
      const newPath = updates.legacy_path as string
      if (cur && oldPath && oldPath !== newPath && /^\/new-post-[a-z0-9]+\/?$/i.test(oldPath)) {
        const from = oldPath.endsWith('/') ? oldPath : oldPath + '/'
        // redirects has no unique(state_code, from_path) — upsert via delete+insert
        await db`DELETE FROM redirects WHERE state_code = ${cur.state_code} AND from_path = ${from}`
        await db`INSERT INTO redirects (state_code, from_path, to_path, redirect_type, match_type, is_active, notes)
                 VALUES (${cur.state_code}, ${from}, ${newPath}, 301, 'exact', true, 'auto: placeholder slug renamed to title')`
      }
    } catch (e) { console.error('[articles PATCH auto-redirect]', e) }
  }

  updates.updated_at = new Date()
  await db`UPDATE articles SET ${db(updates)} WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}
