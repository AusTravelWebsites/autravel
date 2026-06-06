import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'

function validateState(s: any) {
  const ok = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']
  return ok.includes(s) ? s : null
}

// GET /api/admin/settings?state=<code> — return the flat key/value map for a tenant.
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = validateState(new URL(req.url).searchParams.get('state'))
  if (!state) return NextResponse.json({ error: 'state required' }, { status: 400 })
  const rows = await db`SELECT key, value, updated_at FROM site_settings WHERE state_code = ${state} ORDER BY key`
  const settings: Record<string, string> = {}
  for (const r of rows as any[]) settings[r.key] = r.value
  return NextResponse.json({ state_code: state, settings, rows })
}

// PUT { state_code, settings: { key: value, ... } } — upsert multiple keys.
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json()
  const state = validateState(b.state_code)
  if (!state) return NextResponse.json({ error: 'state_code required' }, { status: 400 })
  const settings = b.settings || {}
  for (const [k, v] of Object.entries(settings)) {
    await db`
      INSERT INTO site_settings (state_code, key, value, updated_at)
      VALUES (${state}, ${k}, ${v as string}, NOW())
      ON CONFLICT (state_code, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  }
  await logAction(admin, 'settings_update', { state, keys: Object.keys(settings), ip: getIP(req) })
  return NextResponse.json({ ok: true, count: Object.keys(settings).length })
}

// DELETE ?state=<code>&key=<k>
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const state = validateState(sp.get('state'))
  const key = sp.get('key')
  if (!state || !key) return NextResponse.json({ error: 'state + key required' }, { status: 400 })
  await db`DELETE FROM site_settings WHERE state_code = ${state} AND key = ${key}`
  return NextResponse.json({ ok: true })
}
