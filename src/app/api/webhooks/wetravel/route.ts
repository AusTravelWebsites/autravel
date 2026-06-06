import { NextRequest, NextResponse } from 'next/server'
import { Webhook, WebhookVerificationError } from 'svix'
import sql from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SECRET = process.env.WETRAVEL_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!SECRET) {
    console.error('[wetravel] WETRAVEL_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 })
  }

  const body = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let evt: { type?: string; data?: unknown; [k: string]: unknown }
  try {
    evt = new Webhook(SECRET).verify(body, headers) as typeof evt
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
    throw err
  }

  const msgId = headers['svix-id']
  const eventType = (evt.type as string) || 'unknown'
  const payload = evt.data ?? evt

  try {
    const inserted = await sql`
      INSERT INTO wetravel_events (id, event_type, payload)
      VALUES (${msgId}, ${eventType}, ${sql.json(payload as any)})
      ON CONFLICT (id) DO NOTHING
      RETURNING id`
    if (inserted.length === 0) return NextResponse.json({ ok: true, duplicate: true })
  } catch (err) {
    console.error('[wetravel] log insert failed', err)
    return NextResponse.json({ error: 'log failed' }, { status: 500 })
  }

  try {
    await handleEvent(eventType, payload)
    await sql`UPDATE wetravel_events SET processed_at = NOW() WHERE id = ${msgId}`
  } catch (err: any) {
    console.error('[wetravel] handler failed', eventType, err)
    await sql`UPDATE wetravel_events SET error = ${String(err?.message ?? err)} WHERE id = ${msgId}`
  }

  return NextResponse.json({ ok: true })
}

async function handleEvent(type: string, data: any) {
  const t = type.toLowerCase()
  if (t.includes('booking') && (t.includes('created') || t.includes('new'))) {
    await onBookingCreated(data)
  } else if (t.includes('booking') && (t.includes('cancel') || t.includes('refund'))) {
    await onBookingCancelled(data)
  } else if (t.includes('payment') && t.includes('refund')) {
    await onPaymentRefunded(data)
  } else if (t.includes('payment')) {
    await onPaymentReceived(data)
  }
}

async function onBookingCreated(_d: any) { /* TODO: wire to bookings table once we see payload shape */ }
async function onBookingCancelled(_d: any) { /* TODO */ }
async function onPaymentReceived(_d: any) { /* TODO */ }
async function onPaymentRefunded(_d: any) { /* TODO */ }
