import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'
import { serverError } from '@/lib/api-errors'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const tables = await db`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    const counts: Record<string,any> = {}
    for (const t of ['journal_entries','checkins','reviews','users','places','trips']) {
      try {
        const r = await db`SELECT COUNT(*) as n FROM ${db.unsafe(t)}`
        counts[t] = Number(r[0].n)
      } catch(e:any) { counts[t] = 'ERR:' + e.message.slice(0,100) }
    }
    return NextResponse.json({ tables: tables.map((t:any) => t.table_name), counts })
  } catch(e) { return serverError(e, 'diag') }
}
