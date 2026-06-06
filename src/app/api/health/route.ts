/**
 * /api/health — liveness probe for the haproxy load balancer.
 *
 * Deliberately does NO database work. It answers one question only:
 * "is this Node process's event loop still servicing requests?" — which is
 * exactly the failure mode that wedges autravel (process alive but
 * unresponsive). A DB-dependent check would false-positive on DB blips and
 * eject healthy instances; this one ejects an instance only when the process
 * itself can no longer respond.
 *
 * haproxy hits this every few seconds; a wedged instance stops answering and
 * is taken out of rotation within ~6s, before users reach it.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
