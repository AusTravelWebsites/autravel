import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null
  const status = (sp.get('status') || '').trim()
  const search = (sp.get('search') || '').trim()
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') || '50')))
  const offset = (page - 1) * limit
  const pat = '%' + search + '%'

  const rows = await db`
    SELECT id::text AS id, state_code, slug, legacy_path, title, excerpt, cover_image,
           destination_slug, post_type, author, status, source, published_at,
           noindex, created_at, updated_at
    FROM articles
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${status || ''} = '' OR status = ${status})
      AND (${search ? true : false}::boolean = false OR title ILIKE ${pat} OR slug ILIKE ${pat} OR legacy_path ILIKE ${pat})
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [{ count }] = await db<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM articles
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${status || ''} = '' OR status = ${status})
      AND (${search ? true : false}::boolean = false OR title ILIKE ${pat} OR slug ILIKE ${pat} OR legacy_path ILIKE ${pat})`

  const byState = await db`
    SELECT state_code, COUNT(*)::int AS c,
      SUM(CASE WHEN status='published' THEN 1 ELSE 0 END)::int AS published_c,
      SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END)::int AS draft_c
    FROM articles GROUP BY state_code ORDER BY state_code`

  return NextResponse.json({ articles: rows, count, byState })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

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

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Soft-archive instead of hard-delete to honour "never trash posts" rule.
  await db`UPDATE articles SET status = 'archived', updated_at = NOW() WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true, archived: true })
}
