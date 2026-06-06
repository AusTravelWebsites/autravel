import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null

  const rows = await db`
    SELECT id::text AS id, state_code, slug, name, region, intro, lat, lng, radius_km,
           hero_image, tags, viator_dest_id, is_featured, display_order, active,
           seo_title, seo_description, created_at, updated_at
    FROM destinations
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
    ORDER BY state_code, display_order, name`
  return NextResponse.json({ destinations: rows })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { state_code, slug, name } = body
  if (!state_code || !slug || !name) return NextResponse.json({ error: 'state_code, slug, name required' }, { status: 400 })

  const [row] = await db`
    INSERT INTO destinations (state_code, slug, name, region, intro, body, lat, lng,
                              radius_km, hero_image, tags, viator_dest_id, is_featured,
                              display_order, active, seo_title, seo_description)
    VALUES (${state_code}, ${slug}, ${name}, ${body.region || null}, ${body.intro || null},
            ${body.body || null}, ${body.lat || null}, ${body.lng || null},
            ${body.radius_km || 25}, ${body.hero_image || null}, ${body.tags || null},
            ${body.viator_dest_id || null}, ${body.is_featured || false},
            ${body.display_order || 100}, ${body.active !== false},
            ${body.seo_title || null}, ${body.seo_description || null})
    ON CONFLICT (state_code, slug) DO UPDATE SET
      name = EXCLUDED.name, region = EXCLUDED.region, intro = EXCLUDED.intro,
      body = EXCLUDED.body, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
      radius_km = EXCLUDED.radius_km, hero_image = EXCLUDED.hero_image,
      tags = EXCLUDED.tags, viator_dest_id = EXCLUDED.viator_dest_id,
      is_featured = EXCLUDED.is_featured, display_order = EXCLUDED.display_order,
      active = EXCLUDED.active, seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description, updated_at = NOW()
    RETURNING id::text AS id`
  return NextResponse.json({ ok: true, id: row.id })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['name', 'region', 'intro', 'body', 'lat', 'lng', 'radius_km', 'hero_image', 'gallery',
    'tags', 'viator_dest_id', 'is_featured', 'display_order', 'active', 'seo_title', 'seo_description']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })
  updates.updated_at = new Date()
  await db`UPDATE destinations SET ${db(updates)} WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db`DELETE FROM destinations WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}
