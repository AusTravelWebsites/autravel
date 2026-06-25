'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Row = { id: string; state_code: string; path: string; referrer?: string | null; user_agent?: string | null; ip?: string | null; hit_count: number; first_seen_at: string; last_seen_at: string; has_redirect: boolean }
type StateRow = { state_code: string; unique_paths: number; total_hits: number }

const STATES = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']

const S = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb', marginBottom: 14 } as React.CSSProperties,
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f9fafb' },
  td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const },
  chip: (active: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: active ? 'var(--brand)' : '#fff', color: active ? '#fff' : '#374151', border: active ? '1px solid var(--brand)' : '1px solid #e5e7eb', cursor: 'pointer' }),
}

export default function Admin404s() {
  const sp = useSearchParams()
  const [items, setItems] = useState<Row[]>([])
  const [byState, setByState] = useState<StateRow[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [search, setSearch] = useState(() => sp?.get('search') || '')
  const [page, setPage] = useState(1)
  const [redirectTo, setRedirectTo] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const q = new URLSearchParams()
    if (state) q.set('state', state)
    if (search) q.set('search', search)
    q.set('page', String(page))
    const r = await fetch('/api/admin/404s?' + q)
    const j = await r.json()
    setItems(j.items || []); setByState(j.byState || []); setTotal(j.total || 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [state, page])

  async function createRedirect(r: Row) {
    const to = redirectTo[r.id]?.trim()
    if (!to || !to.startsWith('/')) return alert('Target must start with /')
    const res = await fetch('/api/admin/404s', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, to_path: to, redirect_type: 301, match_type: 'exact' }) })
    if (!res.ok) return alert('Failed: ' + (await res.text()))
    load()
  }
  async function del(id: string) {
    if (!confirm('Delete this 404 log entry?')) return
    await fetch('/api/admin/404s?id=' + id, { method: 'DELETE' })
    load()
  }
  async function clearAll() {
    if (!confirm('Clear ALL 404 log entries' + (state ? ` for ${state.toUpperCase()}?` : '?'))) return
    await fetch('/api/admin/404s?all=1' + (state ? '&state=' + state : ''), { method: 'DELETE' })
    load()
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h1 style={S.h1}>404 errors</h1>
          <p style={S.sub}>Every 404 hit the site receives is logged here with its hit count. Convert a row into an active redirect in one click.</p>
        </div>
        <button style={{ ...S.btn, background: '#ef4444', color: '#fff' }} onClick={clearAll}>Clear {state ? state.toUpperCase() : 'all'} 404 log</button>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 6 }}>Tenant</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          <button onClick={() => { setState(''); setPage(1) }} style={S.chip(!state)}>All ({total.toLocaleString()})</button>
          {byState.map(s => (
            <button key={s.state_code} onClick={() => { setState(s.state_code); setPage(1) }} style={S.chip(state === s.state_code)}>
              {s.state_code.toUpperCase()} — {s.unique_paths} paths / {s.total_hits.toLocaleString()} hits
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }} placeholder="Search by path or referrer…" style={S.input}/>
          <button onClick={() => { setPage(1); load() }} style={{ ...S.btn, background: 'var(--brand)', color: '#fff' }}>Search</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              <th style={S.th}>Path</th>
              <th style={S.th}>Hits</th>
              <th style={S.th}>First seen</th>
              <th style={S.th}>Last seen</th>
              <th style={S.th}>Referrer</th>
              <th style={S.th}>State</th>
              <th style={S.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>No 404s logged.</td></tr>}
            {items.map(r => (
              <tr key={r.id}>
                <td style={S.td}><code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>{r.path}</code></td>
                <td style={S.td}><b>{r.hit_count.toLocaleString()}</b></td>
                <td style={S.td}>{new Date(r.first_seen_at).toLocaleDateString()}</td>
                <td style={S.td}>{new Date(r.last_seen_at).toLocaleDateString()}</td>
                <td style={S.td}><span style={{ fontSize: 11, color: '#6b7280' }}>{(r.referrer || '—').slice(0, 60)}</span></td>
                <td style={S.td}>{r.state_code.toUpperCase()}</td>
                <td style={{ ...S.td, minWidth: 280 }}>
                  {r.has_redirect
                    ? <span style={{ fontSize: 11, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>✓ already redirected</span>
                    : <div style={{ display: 'flex', gap: 4 }}>
                        <input placeholder="/new-path/" value={redirectTo[r.id] || ''} onChange={e => setRedirectTo({ ...redirectTo, [r.id]: e.target.value })} style={{ ...S.input, padding: '4px 8px', fontSize: 12 }}/>
                        <button onClick={() => createRedirect(r)} style={{ ...S.btn, background: 'var(--brand)', color: '#fff', whiteSpace: 'nowrap' as const }}>Redirect</button>
                        <button onClick={() => del(r.id)} style={{ ...S.btn, background: '#fee2e2', color: '#991b1b' }}>×</button>
                      </div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {page > 1 && <button onClick={() => setPage(page - 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>← Prev</button>}
        <span style={{ padding: '7px 12px', fontSize: 12, color: '#6b7280' }}>Page {page}</span>
        {items.length === 200 && <button onClick={() => setPage(page + 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>Next →</button>}
      </div>
    </div>
  )
}
