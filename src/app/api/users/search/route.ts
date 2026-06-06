import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/api-errors'
import { db } from '@/lib/db'

// GET /api/users/search?q=str — returns users whose username/display_name match (max 8).
// Public-readable so the tag-companions autocomplete on /reviews/new can use it.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 1) return NextResponse.json({ users: [] })
  try {
    const rows = await db`
      SELECT id, username, display_name, avatar_url
      FROM users
      WHERE (username ILIKE ${q + '%'} OR display_name ILIKE ${'%' + q + '%'})
        AND COALESCE(is_banned, false) = false
      ORDER BY (username ILIKE ${q + '%'}) DESC, username ASC
      LIMIT 8`
    return NextResponse.json({ users: rows })
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[users/search]', msg, stack || '')
    logServerError({ message: msg.slice(0, 800), stack: stack?.slice(0, 4000), context: 'users/search', req }).catch(() => {})
    return NextResponse.json({ users: [], error: 'Internal error' }, { status: 500 })
  }
}
