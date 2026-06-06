'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type Row = { id: string; directive: string; blocked_uri: string; document_uri: string; source_file: string; first_seen: string; last_seen: string; hit_count: number }

export default function AdminCspViolations() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/csp-violations')
    const d = await r.json().catch(() => ({}))
    setRows(d.violations || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const clearAll = async () => {
    if (!confirm('Clear all CSP violation rows?')) return
    await fetch('/api/admin/csp-violations', { method: 'DELETE' })
    load()
  }
  const del = async (id: string) => {
    await fetch(`/api/admin/csp-violations?id=${id}`, { method: 'DELETE' })
    setRows(r => r.filter(x => x.id !== id))
  }

  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6', verticalAlign: 'top', wordBreak: 'break-all' as const }
  const th: React.CSSProperties = { ...td, fontWeight: 700, color: '#6b7280', background: '#f9fafb', whiteSpace: 'nowrap' as const }
  const pill = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color: fg, fontFamily: 'monospace' })

  const filtered = rows.filter(r => !filter || JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()))
  const grouped: Record<string, number> = {}
  for (const r of rows) grouped[r.directive || 'other'] = (grouped[r.directive || 'other'] || 0) + r.hit_count

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>CSP violations</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Policy is still report-only. Each row = a unique (directive, blocked source). Tighten next.config.js CSP allowlist to cover legitimate rows, then flip to enforcing.</p>
        </div>
        <button onClick={clearAll} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear all</button>
      </div>

      {Object.keys(grouped).length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([dir, hits]) => (
            <span key={dir} style={pill('#fef3c7', '#92400e')}>{dir}: {hits}</span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
          style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: 300 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' as const }}>
        {loading ? <div style={{ padding: 20, color: '#6b7280' }}>Loading…</div>
          : filtered.length === 0 ? <div style={{ padding: 20, color: '#6b7280' }}>No violations recorded yet — either nothing was blocked or the CSP allowlist is covering everything.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead><tr><th style={th}>Directive</th><th style={th}>Blocked</th><th style={th}>Document</th><th style={th}>Source</th><th style={th}>Hits</th><th style={th}>Last</th><th style={th}></th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={td}><span style={pill('#fef3c7', '#92400e')}>{r.directive || '-'}</span></td>
                    <td style={td}>{r.blocked_uri || '-'}</td>
                    <td style={td}>{r.document_uri || '-'}</td>
                    <td style={td}>{r.source_file || '-'}</td>
                    <td style={td}>{r.hit_count}</td>
                    <td style={td}>{new Date(r.last_seen).toLocaleString()}</td>
                    <td style={td}><button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>
    </div>
  )
}
