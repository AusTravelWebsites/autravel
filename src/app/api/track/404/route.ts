import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { db } from '@/lib/db'
import { getIP, rateLimit } from '@/lib/admin'
import { tenantForHost } from '@/lib/tenants'

// Logs a 404 hit. Called from app/not-found.tsx (client-side fire-and-forget)
// or middleware fallback. UPSERT by (state_code, path) so we count distinct
// paths per tenant.
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    if (ip && !(await rateLimit(`404log:${ip}`, 60, 60))) return NextResponse.json({ ok: true, throttled: true })

    const body = await req.json().catch(() => ({} as any))
    const path = String(body.path || '').trim().slice(0, 1000)
    if (!path || !path.startsWith('/')) return NextResponse.json({ error: 'bad path' }, { status: 400 })
    // Ignore noise.
    if (path.startsWith('/_next') || /\.(png|jpe?g|gif|webp|ico|css|js|map|woff2?|ttf|svg)$/i.test(path)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || ''
    const tenant = tenantForHost(host)
    const state = tenant.state_code

    const referrer = body.referrer ? String(body.referrer).slice(0, 1000) : (req.headers.get('referer') || null)
    const ua = req.headers.get('user-agent') || null

    await db`
      INSERT INTO redirect_404s (state_code, path, referrer, user_agent, ip, hit_count, first_seen_at, last_seen_at)
      VALUES (${state}, ${path}, ${referrer}, ${ua}, ${ip}, 1, NOW(), NOW())
      ON CONFLICT (state_code, path) DO UPDATE SET
        hit_count = redirect_404s.hit_count + 1,
        last_seen_at = NOW(),
        referrer = COALESCE(EXCLUDED.referrer, redirect_404s.referrer),
        ip = COALESCE(EXCLUDED.ip, redirect_404s.ip)`
    return NextResponse.json({ ok: true, state_code: state })
  } catch (e: any) { return serverError(e, 'track/404', req) }
}
