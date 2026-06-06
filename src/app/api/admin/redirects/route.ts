import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'

function validateType(t: any) { return [301, 302, 307, 308].includes(Number(t)) ? Number(t) : 301 }
function validateMatch(m: any) { return ['exact', 'prefix', 'regex'].includes(m) ? m : 'exact' }
function validateState(s: any) {
  const ok = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']
  return ok.includes(s) ? s : null
}

// GET /api/admin/redirects?state=&search=&group_id=&page= — tenant-scoped list
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = (sp.get('state') || '').trim() || null
  const search = (sp.get('search') || '').trim()
  const group = sp.get('group_id')
  const status = (sp.get('status') || '').trim()  // 'active' | 'disabled' | ''
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(500, Math.max(10, parseInt(sp.get('limit') || '100')))
  const offset = (page - 1) * limit
  const pat = '%' + search + '%'

  const rows = await db`
    SELECT r.*, g.name AS group_name
    FROM redirects r
    LEFT JOIN redirect_groups g ON g.id = r.group_id
    WHERE (${state}::text IS NULL OR r.state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR r.from_path ILIKE ${pat} OR r.to_path ILIKE ${pat} OR r.notes ILIKE ${pat})
      AND (${group}::text IS NULL OR r.group_id = ${group}::uuid)
      AND (
        ${status || ''} = ''
        OR (${status || ''} = 'active'   AND r.is_active = true)
        OR (${status || ''} = 'disabled' AND r.is_active = false)
      )
    ORDER BY r.hit_count DESC, r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [{ total }] = await db<[{ total: number }]>`
    SELECT COUNT(*)::int AS total FROM redirects r
    WHERE (${state}::text IS NULL OR r.state_code = ${state}::text)
      AND (${search ? true : false}::boolean = false OR r.from_path ILIKE ${pat} OR r.to_path ILIKE ${pat} OR r.notes ILIKE ${pat})
      AND (${group}::text IS NULL OR r.group_id = ${group}::uuid)
      AND (
        ${status || ''} = ''
        OR (${status || ''} = 'active'   AND r.is_active = true)
        OR (${status || ''} = 'disabled' AND r.is_active = false)
      )`

  const byState = await db`
    SELECT state_code, COUNT(*)::int AS c,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active_c,
      SUM(hit_count)::int AS total_hits
    FROM redirects GROUP BY state_code ORDER BY state_code`

  return NextResponse.json({ items: rows, total, byState })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  const state = validateState(b.state_code)
  if (!state) return NextResponse.json({ error: 'state_code required' }, { status: 400 })
  const from = b.from_path?.startsWith('/') ? b.from_path : '/' + (b.from_path || '')
  const match_type = validateMatch(b.match_type)
  const type = validateType(b.redirect_type)
  if (match_type === 'regex') {
    try { new RegExp(from) } catch (e: any) { return NextResponse.json({ error: 'Invalid regex: ' + e.message }, { status: 400 }) }
  }
  const [row] = await db`
    INSERT INTO redirects (state_code, from_path, to_path, redirect_type, match_type, group_id, is_active, notes)
    VALUES (${state}, ${from}, ${b.to_path}, ${type}, ${match_type}, ${b.group_id ?? null}, ${b.is_active ?? true}, ${b.notes ?? null})
    ON CONFLICT DO NOTHING
    RETURNING *`
  if (!row) return NextResponse.json({ error: 'duplicate (state + from_path)' }, { status: 409 })
  await logAction(admin, 'redirect_create', { targetType: 'redirect', targetId: row.id, metadata: { state, from, to: b.to_path, type, match_type }, ip: getIP(req) })
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const match_type = validateMatch(b.match_type)
  const type = validateType(b.redirect_type)
  if (match_type === 'regex') {
    try { new RegExp(b.from_path) } catch (e: any) { return NextResponse.json({ error: 'Invalid regex: ' + e.message }, { status: 400 }) }
  }
  const [row] = await db`
    UPDATE redirects SET
      from_path = ${b.from_path},
      to_path = ${b.to_path},
      redirect_type = ${type},
      match_type = ${match_type},
      group_id = ${b.group_id ?? null},
      is_active = ${b.is_active},
      notes = ${b.notes ?? null},
      updated_at = NOW()
    WHERE id = ${b.id}::uuid
    RETURNING *`
  await logAction(admin, 'redirect_update', { targetType: 'redirect', targetId: b.id, ip: getIP(req) })
  return NextResponse.json(row)
}

// PATCH ?bulk=enable|disable|delete|reset-hits&ids=a,b,c
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const bulk = sp.get('bulk')
  const ids = (sp.get('ids') || '').split(',').filter(Boolean)
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 })
  const uuids = ids as any
  if (bulk === 'enable')       await db`UPDATE redirects SET is_active = true  WHERE id = ANY(${uuids}::uuid[])`
  else if (bulk === 'disable') await db`UPDATE redirects SET is_active = false WHERE id = ANY(${uuids}::uuid[])`
  else if (bulk === 'delete')  await db`DELETE FROM redirects WHERE id = ANY(${uuids}::uuid[])`
  else if (bulk === 'reset-hits') await db`UPDATE redirects SET hit_count = 0, last_hit_at = NULL WHERE id = ANY(${uuids}::uuid[])`
  else return NextResponse.json({ error: 'unknown bulk' }, { status: 400 })
  await logAction(admin, `redirect_bulk_${bulk}`, { metadata: { count: ids.length }, ip: getIP(req) })
  return NextResponse.json({ ok: true, count: ids.length })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await db`DELETE FROM redirects WHERE id = ${id}::uuid`
  await logAction(admin, 'redirect_delete', { targetType: 'redirect', targetId: id, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}
