import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

// Admin CRUD for authors. Authors live in `autravel.authors` and are shared
// across all 8 tenants — `state_codes` empty array means visible everywhere,
// otherwise restrict to the listed tenants.

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim()
  // If state is set, return only authors visible to that tenant. Otherwise
  // return everything (used by /admin/authors).
  const rows = state
    ? await db`
        SELECT id::text AS id, slug, name, role, bio, avatar_url, state_codes,
               email, twitter, instagram, website, is_active, display_order
        FROM autravel.authors
        WHERE is_active AND (cardinality(state_codes) = 0 OR ${state} = ANY(state_codes))
        ORDER BY display_order, name`
    : await db`
        SELECT id::text AS id, slug, name, role, bio, avatar_url, state_codes,
               email, twitter, instagram, website, is_active, display_order
        FROM autravel.authors
        ORDER BY is_active DESC, display_order, name`
  return NextResponse.json({ authors: rows })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const name = String(body.name || '').trim()
  if (!slug || !name) return NextResponse.json({ error: 'slug and name required' }, { status: 400 })
  try {
    const [row] = await db`
      INSERT INTO autravel.authors (slug, name, role, bio, avatar_url, state_codes, email, twitter, instagram, website, display_order)
      VALUES (
        ${slug}, ${name}, ${body.role || null}, ${body.bio || null}, ${body.avatar_url || null},
        ${body.state_codes ?? []}::text[], ${body.email || null}, ${body.twitter || null},
        ${body.instagram || null}, ${body.website || null}, ${body.display_order ?? 100}
      )
      RETURNING id::text AS id, slug`
    return NextResponse.json({ ok: true, author: row })
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    return NextResponse.json({ error: e?.message || 'Insert failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const allowed = ['name', 'role', 'bio', 'avatar_url', 'state_codes', 'email', 'twitter', 'instagram', 'website', 'is_active', 'display_order', 'slug']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })
  updates.updated_at = new Date()
  await db`UPDATE autravel.authors SET ${db(updates)} WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}
