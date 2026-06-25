'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type LogRow = { id: string; user_id: string; username?: string; display_name?: string; cluster_lat: string; cluster_lng: string; member_count: number; created_at: string }

export default function AdminAutoMeetups() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ candidates: number; notified: number } | null>(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/auto-meetups')
    const d = await r.json().catch(() => ({ logs: [] }))
    setLogs(d.logs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const runScan = async () => {
    setRunning(true); setErr(''); setResult(null)
    try {
      const r = await fetch('/api/auto-meetups/scan', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setErr(d?.error || 'Scan failed'); return }
      setResult({ candidates: d.candidates || 0, notified: d.notified || 0 })
      load()
    } finally { setRunning(false) }
  }

  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }
  const th: React.CSSProperties = { ...td, fontWeight: 600, color: '#6b7280', background: '#f9fafb' }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Auto-meetups</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
        When 5+ opted-in travellers check in within 10 miles of each other, the scan sends each of them a notification (throttled to once per 24h per user).
      </p>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <button onClick={runScan} disabled={running}
          style={{ background: running ? '#9ca3af' : 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: running ? 'wait' : 'pointer' }}>
          {running ? 'Scanning…' : 'Run scan now'}
        </button>
        {result && (
          <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--brand-dark)', fontWeight: 600 }}>
            ✓ Scanned {result.candidates} travellers, notified {result.notified}
          </span>
        )}
        {err && <span style={{ marginLeft: 12, color: '#ef4444', fontSize: 13 }}>{err}</span>}
        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          For production: schedule a cron hitting <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>POST /api/auto-meetups/scan?token=$AUTO_MEETUP_TOKEN</code> every 10 minutes.
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' as const }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 14 }}>Recent notifications ({logs.length})</div>
        {loading ? (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>No auto-meetups triggered yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead><tr><th style={th}>When</th><th style={th}>User</th><th style={th}>Members</th><th style={th}>Cluster</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={td}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={td}>{l.username ? <a href={`/${l.username}`} style={{ color: 'var(--brand)' }}>@{l.username}</a> : l.user_id}</td>
                  <td style={td}>{l.member_count}</td>
                  <td style={td}>{Number(l.cluster_lat).toFixed(3)}, {Number(l.cluster_lng).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
