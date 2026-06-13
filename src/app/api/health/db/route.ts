// DB-aware liveness probe.
//
// /api/health/ answers "is the Node event loop responsive?" — used by haproxy
// every 2s. /api/health/db/ answers the harder question: "is this instance
// AND its DB connection actually serving data?" The watchdog uses this to
// decide whether to recycle an instance whose process is alive but whose DB
// pool is wedged (the failure mode that caused autravel's pre-migration daily
// outages — pool starvation made queries hang even though /api/health/ said OK).
//
// Cheap query (SELECT 1, < 50ms typical). 1.2s timeout — anything past that
// counts as wedged. If the DB itself is the problem (not this instance), the
// watchdog refuses to restart because restarting won't help — and the alert
// channel makes the operator aware.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 1200)
    const result = await Promise.race([
      db`SELECT 1 AS ok`,
      new Promise((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error('db ping timeout')))),
    ])
    clearTimeout(timeout)
    return NextResponse.json(
      { ok: true, db_ms: Date.now() - t0, rows: Array.isArray(result) ? result.length : 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db_ms: Date.now() - t0, error: (e?.code || e?.message || 'unknown').toString().slice(0, 120) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
