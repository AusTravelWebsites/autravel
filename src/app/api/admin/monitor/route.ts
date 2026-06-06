import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin } from '@/lib/admin'
import { TENANTS, ALL_STATE_CODES } from '@/lib/tenants'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, stat } from 'fs/promises'

const execP = promisify(exec)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function pm2Status() {
  try {
    const { stdout } = await execP('pm2 jlist', { timeout: 4000 })
    const list = JSON.parse(stdout) as any[]
    return list.map(p => ({
      name: p.name,
      pid: p.pid,
      status: p?.pm2_env?.status,
      restarts: p?.pm2_env?.restart_time ?? 0,
      unstable_restarts: p?.pm2_env?.unstable_restarts ?? 0,
      uptime_ms: p?.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
      cpu: p?.monit?.cpu ?? 0,
      mem_mb: p?.monit?.memory ? Math.round(p.monit.memory / 1024 / 1024) : 0,
    }))
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

async function dbPing() {
  const start = Date.now()
  try {
    await db`SELECT 1`
    return { ok: true, latency_ms: Date.now() - start }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) }
  }
}

async function recentErrorTail() {
  try {
    const path = '/var/www/autravel/logs/pm2-error.log'
    const st = await stat(path).catch(() => null)
    if (!st) return []
    // Read last ~64KB only to keep this cheap.
    const fd = await readFile(path)
    const tail = fd.slice(Math.max(0, fd.length - 65536)).toString('utf8')
    const lines = tail.split('\n')
    // Group by first 200 chars of an error-looking line, count, last-seen.
    const buckets = new Map<string, { count: number; last: string; sample: string }>()
    for (const line of lines) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:]+):\s*(.*)$/)
      if (!m) continue
      const ts = m[1]
      const msg = m[2]
      if (!/error|Error|ERROR|ambiguous|undefined|cannot read|timeout/i.test(msg)) continue
      // Strip changing parts (numbers/ids) for crude fingerprinting
      const fp = msg.replace(/\d+/g, '#').replace(/['"][^'"]{4,}['"]/g, '"…"').slice(0, 160)
      const b = buckets.get(fp) || { count: 0, last: ts, sample: msg.slice(0, 240) }
      b.count++
      if (ts > b.last) b.last = ts
      buckets.set(fp, b)
    }
    return Array.from(buckets.entries())
      .map(([fp, v]) => ({ fingerprint: fp, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  } catch (e) {
    return [{ error: e instanceof Error ? e.message : String(e) }]
  }
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [pm2, ping, errors, tenantProbes, serverErrors, loadavg] = await Promise.all([
    pm2Status(),
    dbPing(),
    recentErrorTail(),
    // Latest probe per tenant (24h)
    db`
      SELECT DISTINCT ON (state_code) state_code, host, status_code, ok, latency_ms, error, checked_at
      FROM autravel.uptime_probes
      WHERE checked_at > NOW() - INTERVAL '24 hours'
      ORDER BY state_code, checked_at DESC`,
    // Recent server errors grouped (last 24h)
    db`
      SELECT route, COUNT(*)::int AS count, MAX(created_at) AS last_seen, MAX(message) AS sample
      FROM client_errors
      WHERE source = 'server' AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY route
      ORDER BY count DESC
      LIMIT 20`.catch(() => []),
    // System loadavg
    readFile('/proc/loadavg', 'utf8').then(s => s.trim().split(/\s+/).slice(0, 3).map(Number)).catch(() => null),
  ])

  // Probe stats per tenant (last 1h success rate)
  const probeStats = await db`
    SELECT state_code,
           COUNT(*)::int AS total,
           SUM(CASE WHEN ok THEN 1 ELSE 0 END)::int AS ok_count,
           AVG(latency_ms)::int AS avg_latency_ms
    FROM autravel.uptime_probes
    WHERE checked_at > NOW() - INTERVAL '1 hour'
    GROUP BY state_code`.catch(() => [])

  const probeStatsByCode: Record<string, any> = {}
  for (const r of probeStats as any[]) probeStatsByCode[r.state_code] = r

  // Recent incidents (open + last 7 days closed)
  const incidents = await db`
    SELECT id, state_code, host, started_at, ended_at, last_status, last_error, fail_count, notified
    FROM autravel.uptime_incidents
    WHERE ended_at IS NULL OR started_at > NOW() - INTERVAL '7 days'
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 30`.catch(() => [])

  const probesByCode: Record<string, any> = {}
  for (const r of tenantProbes as any[]) probesByCode[r.state_code] = r

  const tenants = ALL_STATE_CODES.map(code => ({
    state_code: code,
    name: TENANTS[code].name,
    host: TENANTS[code].host,
    latest: probesByCode[code] || null,
    last_hour: probeStatsByCode[code] || null,
  }))

  return NextResponse.json({
    pm2,
    db: ping,
    loadavg,
    tenants,
    incidents,
    log_errors: errors,
    server_errors: serverErrors,
    server_time: new Date().toISOString(),
  })
}
