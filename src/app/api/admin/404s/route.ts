import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'

// GET /api/admin/404s?state=&search=&page= — list 404 hits, tenant-scoped.
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null
  const search = (sp.get('search') || '').trim()
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(500, Math.max(10, parseInt(sp.get('limit') || '200')))
  const offset = (page - 1) * limit
  const pat = '%' + search + '%'

  const rows = await db`
    SELECT r.id::text, r.state_code, r.path, r.referrer, r.user_agent, r.ip,
           r.hit_count, r.first_seen_at, r.last_seen_at,
           EXISTS (
             SELECT 1 FROM redirects rd
             WHERE rd.state_code = r.state_code
               AND rd.from_path = r.path
               AND rd.is_active = true
           ) AS has_redirect
    FROM redirect_404s r
    WHERE (${state}::text IS NULL OR r.state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR r.path ILIKE ${pat} OR r.referrer ILIKE ${pat})
    ORDER BY r.hit_count DESC, r.last_seen_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [{ total }] = await db<[{ total: number }]>`
    SELECT COUNT(*)::int AS total FROM redirect_404s r
    WHERE (${state}::text IS NULL OR r.state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR r.path ILIKE ${pat} OR r.referrer ILIKE ${pat})`

  const byState = await db`
    SELECT state_code, COUNT(*)::int AS unique_paths, SUM(hit_count)::int AS total_hits
    FROM redirect_404s GROUP BY state_code ORDER BY total_hits DESC`

  return NextResponse.json({ items: rows, total, byState })
}

// DELETE ?id=<uuid> | ?all=1
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null
  if (sp.get('all') === '1') {
    const r = state
      ? await db`DELETE FROM redirect_404s WHERE state_code = ${state}`
      : await db`DELETE FROM redirect_404s`
    await logAction(admin, 'clear_404s', { state, count: r.count, ip: getIP(req) })
    return NextResponse.json({ ok: true, count: r.count })
  }
  const id = sp.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db`DELETE FROM redirect_404s WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}

// POST { id, to_path, redirect_type?, match_type? }
// Convert a 404 row into an active redirect and clear the 404 log entry.
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  const id = body.id
  const to = String(body.to_path || '').trim()
  const type = parseInt(body.redirect_type || '301', 10)
  const match_type = ['exact', 'prefix', 'regex'].includes(body.match_type) ? body.match_type : 'exact'
  if (!id || !to.startsWith('/')) return NextResponse.json({ error: 'id + to_path(/...) required' }, { status: 400 })

  const [row] = await db`SELECT state_code, path FROM redirect_404s WHERE id = ${id}::uuid`
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await db`INSERT INTO redirects (state_code, from_path, to_path, redirect_type, match_type, is_active)
    VALUES (${row.state_code}, ${row.path}, ${to}, ${type}, ${match_type}, true)
    ON CONFLICT DO NOTHING`
  await db`DELETE FROM redirect_404s WHERE id = ${id}::uuid`
  await logAction(admin, 'redirect_from_404', { state: row.state_code, from: row.path, to, type, match_type, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}
