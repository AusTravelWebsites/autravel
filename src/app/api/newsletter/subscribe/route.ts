import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTenant } from '@/lib/get-tenant'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }
  const email = String(body?.email || '').trim().toLowerCase()
  const source = String(body?.source || '').slice(0, 40) || null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  const tenant = await getTenant()
  const token = randomBytes(16).toString('hex')
  try {
    // Idempotent insert per (email, state_code). If they already exist, just bump source.
    await db`
      INSERT INTO newsletter_subscribers (email, state_code, source, confirm_token)
      VALUES (${email}, ${tenant.state_code}, ${source}, ${token})
      ON CONFLICT (email, state_code) DO UPDATE
        SET unsubscribed_at = NULL,
            source = COALESCE(newsletter_subscribers.source, EXCLUDED.source)
    `
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('newsletter subscribe error', e?.message)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
