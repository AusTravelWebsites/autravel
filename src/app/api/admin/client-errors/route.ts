import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(100, Math.max(10, parseInt(sp.get('limit') || '50')))
  const offset = (page - 1) * limit
  const seenFilter = sp.get('seen')                    // 'unseen' | 'all'
  const source = sp.get('source')                      // 'client' | 'server' | null

  const sourceWhere = source === 'client' ? db`source = 'client'`
                     : source === 'server' ? db`source = 'server'`
                     : db`TRUE`
  const seenWhere = seenFilter === 'unseen' ? db`AND seen = false` : db``

  // Group by message + source to keep the list scannable.
  const rows = await db`
    SELECT
      message,
      source,
      COUNT(*)::int AS count,
      COUNT(DISTINCT ip)::int AS ip_count,
      MAX(created_at) AS last_seen,
      MIN(created_at) AS first_seen,
      (ARRAY_AGG(url ORDER BY created_at DESC))[1] AS last_url,
      (ARRAY_AGG(route ORDER BY created_at DESC))[1] AS last_route,
      (ARRAY_AGG(user_agent ORDER BY created_at DESC))[1] AS last_ua,
      (ARRAY_AGG(stack ORDER BY created_at DESC))[1] AS last_stack,
      (ARRAY_AGG(status_code ORDER BY created_at DESC))[1] AS last_status,
      BOOL_AND(seen) AS all_seen
    FROM client_errors
    WHERE ${sourceWhere} ${seenWhere}
    GROUP BY message, source
    ORDER BY MAX(created_at) DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [counts] = await db`
    SELECT
      COUNT(DISTINCT message) FILTER (WHERE source = 'client')::int AS client_total,
      COUNT(DISTINCT message) FILTER (WHERE source = 'client' AND seen = false)::int AS client_unseen,
      COUNT(DISTINCT message) FILTER (WHERE source = 'server')::int AS server_total,
      COUNT(DISTINCT message) FILTER (WHERE source = 'server' AND seen = false)::int AS server_unseen,
      COUNT(DISTINCT message)::int AS total,
      COUNT(DISTINCT message) FILTER (WHERE seen = false)::int AS unseen
    FROM client_errors`

  return NextResponse.json({ rows, ...counts, page, limit })
}

// PATCH — mark-as-seen by message+source, or all
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  if (body.all === true) {
    await db`UPDATE client_errors SET seen = true WHERE seen = false`
    return NextResponse.json({ ok: true })
  }
  if (body.message) {
    if (body.source) {
      await db`UPDATE client_errors SET seen = true WHERE message = ${String(body.message)} AND source = ${String(body.source)}`
    } else {
      await db`UPDATE client_errors SET seen = true WHERE message = ${String(body.message)}`
    }
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'message or all required' }, { status: 400 })
}
