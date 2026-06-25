'use client'
import { useEffect, useState } from 'react'

type Pm2 = {
  name: string; pid: number; status: string; restarts: number; unstable_restarts: number;
  uptime_ms: number | null; cpu: number; mem_mb: number;
}
type TenantRow = {
  state_code: string; name: string; host: string;
  latest: { status_code: number | null; ok: boolean; latency_ms: number; error: string | null; checked_at: string } | null;
  last_hour: { total: number; ok_count: number; avg_latency_ms: number } | null;
}
type LogErr = { fingerprint: string; count: number; last: string; sample: string }
type ServerErr = { route: string; count: number; last_seen: string; sample: string }
type Incident = {
  id: number; state_code: string; host: string; started_at: string; ended_at: string | null;
  last_status: number | null; last_error: string | null; fail_count: number; notified: boolean
}

type Data = {
  pm2: Pm2[] | { error: string };
  db: { ok: boolean; latency_ms: number; error?: string };
  loadavg: number[] | null;
  tenants: TenantRow[];
  incidents: Incident[];
  log_errors: LogErr[];
  server_errors: ServerErr[];
  server_time: string;
}

const C = {
  bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', sub: '#6b7280', text: '#111827',
  ok: '#10b981', warn: '#f59e0b', err: '#ef4444', teal: 'var(--brand)',
}

const S = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: C.text } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: C.sub, margin: '0 0 20px' } as React.CSSProperties,
  card: { background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: C.text } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 } as React.CSSProperties,
  pill: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: color + '20', color }) as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f9fafb' },
  td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' as const },
  code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: '#374151' } as React.CSSProperties,
}

function fmtUptime(ms: number | null) {
  if (!ms || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  if (h > 24) return `${Math.floor(h/24)}d ${h%24}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

function fmtTimeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}

export default function MonitorPage() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/admin/monitor', { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (!cancelled) { setData(j); setErr(null) }
      } catch (e: any) {
        if (!cancelled) setErr(e.message || String(e))
      }
    }
    load()
    if (!auto) return
    const id = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [auto])

  const triggerProbe = async () => {
    const r = await fetch('/api/admin/uptime-probe', { method: 'POST', headers: { 'x-cron-token': prompt('Cron token (one-off):') || '' } })
    alert(r.ok ? 'Probes ran' : `Failed: ${r.status}`)
  }

  if (err) return <div style={S.page}><div style={S.card}><strong>Monitor error:</strong> {err}</div></div>
  if (!data) return <div style={S.page}>Loading monitor…</div>

  const pm2 = Array.isArray(data.pm2) ? data.pm2 : []
  const pm2Err = !Array.isArray(data.pm2) ? data.pm2.error : null
  const autravel = pm2.find(p => p.name === 'autravel')

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Monitor</h1>
      <p style={S.sub}>
        Per-tenant uptime, process health, and recent errors. Auto-refreshes every 15s.
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> auto
        </label>
        <button onClick={triggerProbe} style={{ marginLeft: 12, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer' }}>Run probes now</button>
      </p>

      {/* Top summary */}
      <div style={S.grid}>
        <Stat label="autravel uptime" value={fmtUptime(autravel?.uptime_ms ?? null)} sub={`pid ${autravel?.pid ?? '—'}`} color={autravel?.status === 'online' ? C.ok : C.err} />
        <Stat label="restarts" value={String(autravel?.restarts ?? '—')} sub={autravel && autravel.unstable_restarts > 0 ? `${autravel.unstable_restarts} unstable` : 'stable'} color={(autravel?.unstable_restarts ?? 0) > 0 ? C.err : C.ok} />
        <Stat label="memory" value={`${autravel?.mem_mb ?? '—'} MB`} sub={`limit 800 MB`} color={(autravel?.mem_mb ?? 0) > 700 ? C.warn : C.ok} />
        <Stat label="cpu" value={`${autravel?.cpu ?? '—'}%`} sub={`load ${data.loadavg ? data.loadavg.join(' / ') : '—'}`} color={(autravel?.cpu ?? 0) > 90 ? C.warn : C.ok} />
        <Stat label="db ping" value={data.db.ok ? `${data.db.latency_ms} ms` : 'fail'} sub={data.db.ok ? 'pool ok' : (data.db.error || 'no detail')} color={data.db.ok ? C.ok : C.err} />
      </div>

      {/* Tenant probes */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <h2 style={S.cardTitle}>Tenant uptime (last hour)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Tenant</th>
              <th style={S.th}>Host</th>
              <th style={S.th}>Last probe</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Latency</th>
              <th style={S.th}>1h success</th>
              <th style={S.th}>Avg latency</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map(t => {
              const l = t.latest
              const lh = t.last_hour
              const successPct = lh && lh.total > 0 ? Math.round((lh.ok_count / lh.total) * 100) : null
              const color = !l ? C.sub : (l.ok ? C.ok : C.err)
              return (
                <tr key={t.state_code}>
                  <td style={S.td}><strong>{t.name}</strong></td>
                  <td style={{ ...S.td, ...S.code }}>{t.host}</td>
                  <td style={S.td}>{l ? fmtTimeAgo(l.checked_at) : 'never'}</td>
                  <td style={S.td}><span style={S.pill(color)}>{l ? (l.ok ? `${l.status_code} ok` : (l.status_code ? `HTTP ${l.status_code}` : (l.error || 'down'))) : 'no data'}</span></td>
                  <td style={S.td}>{l ? `${l.latency_ms} ms` : '—'}</td>
                  <td style={S.td}>{successPct === null ? '—' : (
                    <span style={S.pill(successPct === 100 ? C.ok : (successPct >= 95 ? C.warn : C.err))}>
                      {successPct}% ({lh!.ok_count}/{lh!.total})
                    </span>
                  )}</td>
                  <td style={S.td}>{lh?.avg_latency_ms ? `${lh.avg_latency_ms} ms` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Incidents */}
      <div style={S.card}>
        <h2 style={S.cardTitle}>Incidents — open + last 7 days</h2>
        {(!data.incidents || data.incidents.length === 0) ? <div style={{ fontSize: 13, color: C.sub }}>No incidents recorded.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Tenant</th>
                <th style={S.th}>Started</th>
                <th style={S.th}>Ended</th>
                <th style={S.th}>Duration</th>
                <th style={S.th}>Fails</th>
                <th style={S.th}>Last error</th>
                <th style={S.th}>Notified</th>
              </tr>
            </thead>
            <tbody>
              {data.incidents.map(inc => {
                const open = !inc.ended_at
                const start = new Date(inc.started_at).getTime()
                const end = inc.ended_at ? new Date(inc.ended_at).getTime() : Date.now()
                const dur = Math.max(0, Math.round((end - start) / 1000))
                const durStr = dur < 60 ? `${dur}s` : dur < 3600 ? `${Math.floor(dur/60)}m ${dur%60}s` : `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m`
                return (
                  <tr key={inc.id}>
                    <td style={S.td}><strong>{inc.state_code.toUpperCase()}</strong> <span style={{ color: C.sub }}>{inc.host}</span></td>
                    <td style={S.td}>{new Date(inc.started_at).toLocaleString()}</td>
                    <td style={S.td}>{open ? <span style={S.pill(C.err)}>OPEN</span> : new Date(inc.ended_at!).toLocaleString()}</td>
                    <td style={S.td}>{durStr}</td>
                    <td style={S.td}>{inc.fail_count}</td>
                    <td style={{ ...S.td, ...S.code, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inc.last_status ? `HTTP ${inc.last_status}` : (inc.last_error || '—')}</td>
                    <td style={S.td}>{inc.notified ? <span style={S.pill(C.teal)}>email sent</span> : <span style={{ color: C.sub, fontSize: 11 }}>—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PM2 processes */}
      <div style={S.card}>
        <h2 style={S.cardTitle}>PM2 processes</h2>
        {pm2Err ? <div style={{ color: C.err, fontSize: 13 }}>pm2 jlist failed: {pm2Err}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>App</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Uptime</th>
                <th style={S.th}>Restarts</th>
                <th style={S.th}>CPU</th>
                <th style={S.th}>Memory</th>
              </tr>
            </thead>
            <tbody>
              {pm2.map(p => (
                <tr key={p.name}>
                  <td style={S.td}><strong>{p.name}</strong></td>
                  <td style={S.td}><span style={S.pill(p.status === 'online' ? C.ok : C.err)}>{p.status}</span></td>
                  <td style={S.td}>{fmtUptime(p.uptime_ms)}</td>
                  <td style={S.td}>{p.restarts}{p.unstable_restarts > 0 ? <span style={{ color: C.err, marginLeft: 6, fontSize: 11 }}>({p.unstable_restarts} unstable)</span> : null}</td>
                  <td style={S.td}>{p.cpu}%</td>
                  <td style={S.td}>{p.mem_mb} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Server errors (last 24h, from client_errors source=server) */}
      <div style={S.card}>
        <h2 style={S.cardTitle}>Server errors — last 24h ({data.server_errors.length} routes)</h2>
        {data.server_errors.length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>No server errors logged in the last 24h.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Route</th>
                <th style={S.th}>Count</th>
                <th style={S.th}>Last seen</th>
                <th style={S.th}>Sample</th>
              </tr>
            </thead>
            <tbody>
              {data.server_errors.map(e => (
                <tr key={e.route + e.sample}>
                  <td style={{ ...S.td, ...S.code }}>{e.route || '—'}</td>
                  <td style={S.td}><span style={S.pill(e.count > 100 ? C.err : C.warn)}>{e.count}</span></td>
                  <td style={S.td}>{fmtTimeAgo(e.last_seen)}</td>
                  <td style={{ ...S.td, ...S.code, maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log tail clusters */}
      <div style={S.card}>
        <h2 style={S.cardTitle}>Recent pm2-error.log clusters (tail 64KB)</h2>
        {data.log_errors.length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>No error lines in recent log tail.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Count</th>
                <th style={S.th}>Last</th>
                <th style={S.th}>Sample</th>
              </tr>
            </thead>
            <tbody>
              {data.log_errors.map((e, i) => (
                <tr key={i}>
                  <td style={S.td}><span style={S.pill(e.count > 50 ? C.err : (e.count > 5 ? C.warn : C.sub))}>{e.count}</span></td>
                  <td style={S.td}>{e.last.replace('T', ' ')}</td>
                  <td style={{ ...S.td, ...S.code, maxWidth: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>Server time: {data.server_time}</p>
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ ...S.card, marginBottom: 0, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>
    </div>
  )
}
