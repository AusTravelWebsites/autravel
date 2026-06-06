import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const search = (sp.get('search') || '').trim();
  const category = (sp.get('category') || '').trim();
  const state = (sp.get('state') || '').trim() || null;
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const limit = Math.min(100, Math.max(5, parseInt(sp.get('limit') || '20')));
  const offset = (page - 1) * limit;
  const pat = '%' + search + '%';
  const rows = await db`
    SELECT id::text AS id, slug, name, city, country, state_code, category, emoji, cover_image, is_verified, created_at,
           (SELECT COUNT(*)::int FROM reviews r WHERE r.place_id = places.id) AS review_count
    FROM places
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR name ILIKE ${pat} OR city ILIKE ${pat} OR country ILIKE ${pat})
      AND (${category ? true : false}::boolean = false OR category = ${category || ''})
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count FROM places
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR name ILIKE ${pat} OR city ILIKE ${pat} OR country ILIKE ${pat})
      AND (${category ? true : false}::boolean = false OR category = ${category || ''})`;
  return NextResponse.json({ places: rows, total: count, page, limit });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  const ids = (sp.get('ids') || '').split(',').filter(Boolean);
  const targetIds = ids.length ? ids : (id ? [id] : []);
  if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
  await db`DELETE FROM places WHERE id = ANY(${targetIds as any})`;
  return NextResponse.json({ ok: true, count: targetIds.length });
}
