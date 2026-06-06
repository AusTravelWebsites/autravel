import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getIP, rateLimit } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    // Prevent counter inflation via rapid hits from one IP
    if (ip && !(await rateLimit(`redir-hit:${ip}`, 60, 60))) {
      return NextResponse.json({ ok: false, reason: 'rate' }, { status: 429 })
    }
    const { id } = await req.json()
    if (!id) return NextResponse.json({ ok: false }, { status: 400 })
    await db`UPDATE redirects SET hit_count = hit_count + 1, last_hit_at = now() WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
