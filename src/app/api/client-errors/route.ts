import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getIP, rateLimit } from '@/lib/admin'

// POST /api/client-errors — browser reports an uncaught error.
// No auth required (errors happen pre-auth too); rate-limited per IP so a misbehaving
// tab can't hammer us + drop completely silent on any failure so we never surface
// reporting problems back to the user.
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req) || 'unknown'
    // 120 errors per IP per hour — generous, but prevents flood
    if (!(await rateLimit(`client-err:${ip}`, 120, 3600))) {
      return NextResponse.json({ ok: true, dropped: 'rate' })
    }
    const body = await req.json().catch(() => ({} as any))
    const message = String(body.message || '').slice(0, 800)
    if (!message) return NextResponse.json({ ok: true })
    const stack = body.stack ? String(body.stack).slice(0, 4000) : null
    const url = body.url ? String(body.url).slice(0, 500) : null
    const lineNo = Number.isInteger(body.lineNo) ? body.lineNo : null
    const colNo = Number.isInteger(body.colNo) ? body.colNo : null
    const ua = (req.headers.get('user-agent') || '').slice(0, 400)
    const userId = body.userId ? String(body.userId).slice(0, 64) : null

    // Skip noisy / non-actionable errors
    const ignore = [
      'ResizeObserver loop',           // browser quirk, no useful signal
      'Script error.',                  // cross-origin, no details → useless
      'Non-Error promise rejection',    // React internal, hard to action
      'Loading chunk',                  // transient deploy artifact
      'Loading CSS chunk',
    ]
    if (ignore.some(i => message.includes(i))) return NextResponse.json({ ok: true, dropped: 'ignored' })

    await db`
      INSERT INTO client_errors (message, stack, url, line_no, col_no, user_agent, user_id, ip)
      VALUES (${message}, ${stack}, ${url}, ${lineNo}, ${colNo}, ${ua}, ${userId}, ${ip})`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // never signal failure back
  }
}
