import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANTS, ALL_STATE_CODES, type StateCode } from '@/lib/tenants'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRON_TOKEN = process.env.CRON_SECRET || ''
// Probe via haproxy (3010) — that's the path real visitors take. Skips
// CF/DNS noise but still exercises the 3-instance failover, so a single
// wedged Next.js instance doesn't get reported as an outage when haproxy
// has already ejected it and the other two are serving fine.
// (Previously hit autravel-1 directly on 3001, which caused false-positive
// "down" alerts whenever just that one instance had a transient slow moment.)
const PROBE_PORT = process.env.UPTIME_PROBE_PORT || '3010'
const ALERT_EMAIL = process.env.ALERT_EMAIL || ''
const ALERT_FROM = process.env.ALERT_FROM || 'Autravel Monitor <noreply@bugbitten.com>'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// 2026-06-13 — timeout raised 8s → 20s after a false-positive "DOWN: timeout"
// page on new-forest. The app was never down (health probes + watchdog green
// throughout); a single cold homepage render — fresh cross-region DB connection
// (~1.3s to the Singapore pooler) + queries + a shared-box PHP load spike —
// briefly exceeded 8s and tripped the alert. A 2–8s slow render is "degraded",
// not "down"; only a sustained >20s hang is a real outage. Paired with the
// fail_count >= 3 threshold below (3 min sustained) so a one-minute blip never
// pages. A genuine outage (all 3 instances down) still alerts immediately —
// haproxy returns 503 with no delay, so ok=false fires on the first probe.
const PROBE_TIMEOUT_MS = Number(process.env.UPTIME_PROBE_TIMEOUT_MS) || 20000

async function probeOne(stateCode: string, host: string) {
  const url = `http://127.0.0.1:${PROBE_PORT}/`
  const start = Date.now()
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'Host': host, 'User-Agent': 'autravel-uptime-probe/1' },
      signal: ctrl.signal,
      // @ts-expect-error — next/undici allows this option
      redirect: 'manual',
    })
    clearTimeout(t)
    return {
      state_code: stateCode, host, url,
      status_code: r.status,
      ok: r.status >= 200 && r.status < 400,
      latency_ms: Date.now() - start,
      error: null as string | null,
    }
  } catch (e: any) {
    clearTimeout(t)
    return {
      state_code: stateCode, host, url,
      status_code: null,
      ok: false,
      latency_ms: Date.now() - start,
      error: (e?.name === 'AbortError' ? 'timeout' : (e?.message || String(e))).slice(0, 240),
    }
  }
}

async function sendAlert(subject: string, html: string) {
  if (!resend || !ALERT_EMAIL) return false
  try {
    const to = ALERT_EMAIL.split(',').map(s => s.trim()).filter(Boolean)
    await resend.emails.send({ from: ALERT_FROM, to, subject, html })
    return true
  } catch (e) {
    console.error('[uptime alert email]', e)
    return false
  }
}

// Open/extend/close incidents based on the latest probe. Sends DOWN email
// when fail_count reaches 2 (avoids paging on a single transient blip).
// Sends UP email when an incident with `notified=true` closes.
async function processIncidents(probes: Array<{ state_code: string; host: string; ok: boolean; status_code: number | null; error: string | null }>) {
  for (const p of probes) {
    const [open] = await db`
      SELECT id, fail_count, notified FROM autravel.uptime_incidents
      WHERE state_code = ${p.state_code} AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`
    if (!p.ok) {
      if (open) {
        const newCount = (open.fail_count as number) + 1
        await db`UPDATE autravel.uptime_incidents
                 SET fail_count = ${newCount}, last_status = ${p.status_code}, last_error = ${p.error}
                 WHERE id = ${open.id}`
        if (!open.notified && newCount >= 3) {
          const tenant = TENANTS[p.state_code as StateCode]
          const subj = `🔴 DOWN: ${tenant.name} (${p.host})`
          const sent = await sendAlert(subj, `
            <p><strong>${tenant.name}</strong> is down.</p>
            <p>Host: <code>${p.host}</code><br/>
            Last status: <code>${p.status_code ?? 'no response'}</code><br/>
            Error: <code>${p.error ?? '—'}</code><br/>
            Consecutive failures: <strong>${newCount}</strong></p>
            <p>Open the <a href="https://${tenant.host}/admin/monitor">monitor dashboard</a> to investigate.</p>
          `)
          if (sent) await db`UPDATE autravel.uptime_incidents SET notified = TRUE WHERE id = ${open.id}`
        }
      } else {
        await db`INSERT INTO autravel.uptime_incidents (state_code, host, last_status, last_error, fail_count)
                 VALUES (${p.state_code}, ${p.host}, ${p.status_code}, ${p.error}, 1)`
      }
    } else if (open) {
      await db`UPDATE autravel.uptime_incidents SET ended_at = NOW() WHERE id = ${open.id}`
      if (open.notified) {
        const tenant = TENANTS[p.state_code as StateCode]
        const subj = `🟢 UP: ${tenant.name} recovered`
        const sent = await sendAlert(subj, `
          <p><strong>${tenant.name}</strong> is back up.</p>
          <p>Host: <code>${p.host}</code><br/>
          Status: <code>${p.status_code} OK</code></p>
        `)
        if (sent) await db`UPDATE autravel.uptime_incidents SET recovery_notified = TRUE WHERE id = ${open.id}`
      }
    }
  }
}

async function runProbes() {
  const probes = await Promise.all(
    ALL_STATE_CODES.map(code => probeOne(code, TENANTS[code].host))
  )
  // Bulk insert
  for (const p of probes) {
    await db`
      INSERT INTO autravel.uptime_probes (state_code, host, url, status_code, ok, latency_ms, error)
      VALUES (${p.state_code}, ${p.host}, ${p.url}, ${p.status_code}, ${p.ok}, ${p.latency_ms}, ${p.error})
    `.catch(e => console.error('[uptime-probe insert]', e))
  }
  await processIncidents(probes).catch(e => console.error('[incidents]', e))
  // Prune anything older than 14 days
  await db`DELETE FROM autravel.uptime_probes WHERE checked_at < NOW() - INTERVAL '14 days'`.catch(() => {})
  return probes
}

function authorised(req: NextRequest) {
  if (!CRON_TOKEN) return false
  const t = req.headers.get('x-cron-token') || new URL(req.url).searchParams.get('t') || ''
  return t === CRON_TOKEN
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const probes = await runProbes()
  return NextResponse.json({ ok: true, probes })
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const probes = await runProbes()
  return NextResponse.json({ ok: true, probes })
}
