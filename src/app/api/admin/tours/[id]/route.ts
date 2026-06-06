import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const [row] = await db`
    SELECT id::text AS id, source, source_product_code, slug, title, country, country_code, city,
           duration_min, duration_label, price_from, currency, rating, review_count,
           cover_image, images, booking_url, tags, summary_ai, highlights_ai, what_to_expect_ai,
           good_to_know_ai, category, state_code, active, featured,
           created_at, updated_at, ai_rewritten_at
      FROM tours
     WHERE id = ${id}::uuid
     LIMIT 1`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tour: row })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const patch = await req.json()
  const allowed = ['title', 'slug', 'country', 'country_code', 'city', 'duration_min',
    'duration_label', 'price_from', 'currency', 'rating', 'review_count', 'cover_image',
    'booking_url', 'tags', 'summary_ai', 'highlights_ai', 'what_to_expect_ai', 'good_to_know_ai',
    'category', 'state_code', 'active', 'featured']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in patch) updates[k] = patch[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 })
  updates.updated_at = new Date()
  await db`UPDATE tours SET ${db(updates)} WHERE id = ${id}::uuid`
  // Bust the relevant caches so the public site picks up the edit immediately.
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag('tours')
    if (updates.state_code) revalidateTag(`tours:${updates.state_code}`)
  } catch {}
  return NextResponse.json({ ok: true })
}
