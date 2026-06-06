import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const search = (sp.get('search') || '').trim();
  const country = (sp.get('country') || '').trim();
  const source = (sp.get('source') || '').trim();
  const state = (sp.get('state') || '').trim() || null;
  const status = (sp.get('status') || '').trim(); // 'active' | 'inactive' | 'featured' | 'ai-missing' | 'ai-done' | ''
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const limit = Math.min(100, Math.max(5, parseInt(sp.get('limit') || '25')));
  const offset = (page - 1) * limit;
  const pat = '%' + search + '%';

  const rows = await db`
    SELECT id::text AS id, slug, title, country, city, state_code, source, source_product_code,
           duration_label, price_from, currency, rating, review_count, cover_image,
           active, featured, ai_rewritten_at, created_at
    FROM tours
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR title ILIKE ${pat} OR country ILIKE ${pat} OR city ILIKE ${pat} OR source_product_code ILIKE ${pat})
      AND (${country ? true : false}::boolean = false OR country = ${country || ''})
      AND (${source ? true : false}::boolean = false OR source = ${source || ''})
      AND (
        ${status || ''} = ''
        OR (${status || ''} = 'active'     AND active = true)
        OR (${status || ''} = 'inactive'   AND active = false)
        OR (${status || ''} = 'featured'   AND featured = true)
        OR (${status || ''} = 'ai-missing' AND ai_rewritten_at IS NULL)
        OR (${status || ''} = 'ai-done'    AND ai_rewritten_at IS NOT NULL)
      )
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;

  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count FROM tours
    WHERE (${state}::text IS NULL OR state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR title ILIKE ${pat} OR country ILIKE ${pat} OR city ILIKE ${pat} OR source_product_code ILIKE ${pat})
      AND (${country ? true : false}::boolean = false OR country = ${country || ''})
      AND (${source ? true : false}::boolean = false OR source = ${source || ''})
      AND (
        ${status || ''} = ''
        OR (${status || ''} = 'active'     AND active = true)
        OR (${status || ''} = 'inactive'   AND active = false)
        OR (${status || ''} = 'featured'   AND featured = true)
        OR (${status || ''} = 'ai-missing' AND ai_rewritten_at IS NULL)
        OR (${status || ''} = 'ai-done'    AND ai_rewritten_at IS NOT NULL)
      )`;

  // Country breakdown for filter dropdown and at-a-glance summary
  const countries = await db`
    SELECT country, COUNT(*)::int AS c,
           SUM(CASE WHEN active THEN 1 ELSE 0 END)::int AS active_c,
           SUM(CASE WHEN featured THEN 1 ELSE 0 END)::int AS featured_c
    FROM tours
    WHERE country IS NOT NULL AND country <> ''
    GROUP BY country ORDER BY c DESC`;

  const sources = await db`SELECT source, COUNT(*)::int AS c FROM tours GROUP BY source ORDER BY c DESC`;

  const [aiSummary] = await db`
    SELECT
      COUNT(*) FILTER (WHERE ai_rewritten_at IS NULL)::int      AS ai_missing,
      COUNT(*) FILTER (WHERE ai_rewritten_at IS NOT NULL)::int  AS ai_done,
      COUNT(*)::int                                             AS ai_total
    FROM tours`;

  // Recent sync-log entries (table may not exist on older dbs — be defensive)
  let syncLog: any[] = [];
  try {
    syncLog = await db`
      SELECT id::text AS id, source, action, ok, count_ok, count_fail, details,
             started_at, finished_at
      FROM tour_sync_log
      ORDER BY started_at DESC
      LIMIT 10` as any;
  } catch { /* table missing — ignore */ }

  return NextResponse.json({ tours: rows, total: count, page, limit, countries, sources, aiSummary, syncLog });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.active   === 'boolean') updates.active   = body.active;
  if (typeof body.featured === 'boolean') updates.featured = body.featured;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no updates' }, { status: 400 });

  if ('active' in updates && 'featured' in updates) {
    await db`UPDATE tours SET active = ${updates.active as boolean}, featured = ${updates.featured as boolean}, updated_at = NOW() WHERE id = ${id}::uuid`;
  } else if ('active' in updates) {
    await db`UPDATE tours SET active = ${updates.active as boolean}, updated_at = NOW() WHERE id = ${id}::uuid`;
  } else {
    await db`UPDATE tours SET featured = ${updates.featured as boolean}, updated_at = NOW() WHERE id = ${id}::uuid`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  const ids = (sp.get('ids') || '').split(',').filter(Boolean);
  const targetIds = ids.length ? ids : (id ? [id] : []);
  if (!targetIds.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 });
  await db`DELETE FROM tours WHERE id = ANY(${targetIds as any}::uuid[])`;
  return NextResponse.json({ ok: true, count: targetIds.length });
}
