import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null
  const search = (sp.get('search') || '').trim()
  const status = (sp.get('status') || '').trim()
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(200, Math.max(5, parseInt(sp.get('limit') || '50')))
  const offset = (page - 1) * limit
  const pat = '%' + search + '%'

  const rows = await db`
    SELECT id::text AS id, slug, state_code, name, park_type, region, suburb, postcode,
           phone, email, website, price_from, currency, star_rating, avg_rating, review_count,
           cover_image, pets_allowed, dump_point, big_rig_friendly,
           active, featured, google_place_id, source, created_at, updated_at
    FROM parks
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR name ILIKE ${pat} OR region ILIKE ${pat} OR suburb ILIKE ${pat} OR slug ILIKE ${pat})
      AND (
        ${status || ''} = ''
        OR (${status || ''} = 'active'   AND active = true)
        OR (${status || ''} = 'inactive' AND active = false)
        OR (${status || ''} = 'featured' AND featured = true)
        OR (${status || ''} = 'no-image' AND (cover_image IS NULL OR cover_image = ''))
      )
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [{ count }] = await db<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM parks
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR name ILIKE ${pat} OR region ILIKE ${pat} OR suburb ILIKE ${pat} OR slug ILIKE ${pat})`

  const byState = await db`
    SELECT state_code, COUNT(*)::int AS c,
           SUM(CASE WHEN active THEN 1 ELSE 0 END)::int AS active_c,
           SUM(CASE WHEN featured THEN 1 ELSE 0 END)::int AS featured_c
    FROM parks GROUP BY state_code ORDER BY state_code`

  return NextResponse.json({ parks: rows, count, byState })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...patch } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = [
    'name', 'park_type', 'region', 'destination_slug', 'address', 'suburb', 'postcode',
    'lat', 'lng', 'phone', 'email', 'website', 'description', 'description_ai',
    'amenities', 'site_types', 'pets_allowed', 'dump_point', 'big_rig_friendly',
    'price_from', 'currency', 'star_rating', 'cover_image', 'images',
    'active', 'featured', 'seo_title', 'seo_description', 'state_code', 'slug',
  ]
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })

  updates.updated_at = new Date()
  await db`UPDATE parks SET ${db(updates)} WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db`DELETE FROM parks WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { state_code, slug, name } = body
  if (!state_code || !slug || !name) return NextResponse.json({ error: 'state_code, slug, name required' }, { status: 400 })

  const [row] = await db`
    INSERT INTO parks (state_code, slug, name, park_type, region, suburb, description, source, active)
    VALUES (${state_code}, ${slug}, ${name}, ${body.park_type || null}, ${body.region || null},
            ${body.suburb || null}, ${body.description || null}, 'manual', true)
    ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id::text AS id`
  return NextResponse.json({ ok: true, id: row.id })
}
