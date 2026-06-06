import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'

function validateState(s: any) {
  const ok = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']
  return ok.includes(s) ? s : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = new URL(req.url).searchParams.get('state') || null
  const rows = await db`
    SELECT g.id::text, g.state_code, g.name, g.description, g.is_active, g.created_at,
           (SELECT COUNT(*)::int FROM redirects r WHERE r.group_id = g.id) AS redirect_count,
           (SELECT COALESCE(SUM(hit_count), 0)::int FROM redirects r WHERE r.group_id = g.id) AS total_hits
    FROM redirect_groups g
    WHERE (${state}::text IS NULL OR g.state_code = ${state}::text)
    ORDER BY g.state_code, g.name ASC`
  return NextResponse.json({ groups: rows })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  const state = validateState(b.state_code)
  const name = (b.name || '').trim()
  if (!state || !name) return NextResponse.json({ error: 'state_code + name required' }, { status: 400 })
  try {
    const [row] = await db`
      INSERT INTO redirect_groups (state_code, name, description)
      VALUES (${state}, ${name}, ${b.description || null})
      ON CONFLICT (state_code, name) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
      RETURNING *`
    await logAction(admin, 'redirect_group_create', { targetType: 'group', targetId: row.id, metadata: { state, name }, ip: getIP(req) })
    return NextResponse.json({ group: row }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, description, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const [row] = await db`
    UPDATE redirect_groups SET
      name = COALESCE(${name}, name),
      description = COALESCE(${description}, description),
      is_active = COALESCE(${is_active}, is_active),
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *`
  return NextResponse.json({ group: row })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Un-group all its redirects first (keep them alive under no group).
  await db`UPDATE redirects SET group_id = NULL WHERE group_id = ${id}::uuid`
  await db`DELETE FROM redirect_groups WHERE id = ${id}::uuid`
  return NextResponse.json({ ok: true })
}
