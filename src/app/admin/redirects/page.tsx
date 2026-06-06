'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Redirect = {
  id: string
  state_code: string
  from_path: string
  to_path: string
  redirect_type: number
  match_type: string
  group_id: string | null
  group_name?: string | null
  notes: string | null
  hit_count: number
  last_hit_at: string | null
  is_active: boolean
  created_at: string
}
type Group = { id: string; state_code: string; name: string; redirect_count: number; total_hits: number }
type StateRow = { state_code: string; c: number; active_c: number; total_hits: number }

const STATES = ['qld', 'nsw', 'vic', 'wa', 'sa', 'tas', 'nt', 'aunz']

const blank = { state_code: 'qld', from_path: '', to_path: '', redirect_type: 301, match_type: 'exact', is_active: true, notes: '', group_id: '' }

const S = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 14 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4, display: 'block', textTransform: 'uppercase' as const, letterSpacing: 0.5 } as React.CSSProperties,
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f9fafb' },
  td: { padding: '8px 10px', fontSize: 13, color: '#111', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const },
  chip: (active: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: active ? '#0d9488' : '#fff', color: active ? '#fff' : '#374151', border: active ? '1px solid #0d9488' : '1px solid #e5e7eb', cursor: 'pointer' }),
}

export default function RedirectsPage() {
  const sp = useSearchParams()
  const [items, setItems] = useState<Redirect[]>([])
  const [total, setTotal] = useState(0)
  const [byState, setByState] = useState<StateRow[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [groupId, setGroupId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState(() => sp?.get('search') || '')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<any>(blank)
  const [editing, setEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newGroup, setNewGroup] = useState('')

  async function load() {
    setLoading(true)
    const q = new URLSearchParams()
    if (state) q.set('state', state)
    if (groupId) q.set('group_id', groupId)
    if (status) q.set('status', status)
    if (search) q.set('search', search)
    q.set('page', String(page))
    const r = await fetch('/api/admin/redirects?' + q)
    const j = await r.json()
    setItems(j.items || []); setTotal(j.total || 0); setByState(j.byState || [])
    setLoading(false)
  }
  async function loadGroups() {
    const r = await fetch('/api/admin/redirect-groups' + (state ? '?state=' + state : ''))
    const j = await r.json()
    setGroups(j.groups || [])
  }
  useEffect(() => { load(); loadGroups() }, [state, groupId, status, page])

  async function save() {
    const method = editing ? 'PUT' : 'POST'
    const r = await fetch('/api/admin/redirects', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, group_id: form.group_id || null }) })
    if (!r.ok) { alert('Save failed: ' + (await r.text())); return }
    setShowForm(false); setForm(blank); setEditing(false); load()
  }
  async function del(id: string) {
    if (!confirm('Delete this redirect?')) return
    await fetch('/api/admin/redirects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }
  async function bulk(action: 'enable' | 'disable' | 'delete' | 'reset-hits') {
    const ids = [...selected]
    if (!ids.length) return
    if (action === 'delete' && !confirm('Delete ' + ids.length + ' redirects?')) return
    await fetch('/api/admin/redirects?bulk=' + action + '&ids=' + ids.join(','), { method: 'PATCH' })
    setSelected(new Set()); load()
  }
  async function addGroup() {
    if (!newGroup.trim() || !state) return alert('Pick a state and enter a group name')
    await fetch('/api/admin/redirect-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state_code: state, name: newGroup.trim() }) })
    setNewGroup(''); loadGroups()
  }
  function startEdit(r: Redirect) {
    setForm({ ...r, group_id: r.group_id || '' })
    setEditing(true); setShowForm(true)
  }
  function startCreate() {
    setForm({ ...blank, state_code: state || 'qld' })
    setEditing(false); setShowForm(true)
  }
  function toggleSel(id: string) {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n)
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(r => r.id)))
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, marginBottom: 8 }}>
        <div>
          <h1 style={S.h1}>Redirects</h1>
          <p style={S.sub}>WordPress-Redirection-style manager. Exact, prefix, and regex match types. Tenant-scoped hit counters. {total.toLocaleString()} redirects total.</p>
        </div>
        <button style={{ ...S.btn, background: '#0d9488', color: '#fff' }} onClick={startCreate}>+ New redirect</button>
      </div>

      <div style={S.card}>
        <div style={S.label}>Tenant</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
          <button onClick={() => { setState(''); setPage(1) }} style={S.chip(!state)}>All</button>
          {byState.map(s => (
            <button key={s.state_code} onClick={() => { setState(s.state_code); setPage(1) }} style={S.chip(state === s.state_code)}>
              {s.state_code.toUpperCase()} ({s.c.toLocaleString()}){s.total_hits > 0 ? ' · ' + s.total_hits + ' hits' : ''}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <div style={S.label}>Group</div>
            <select value={groupId} onChange={e => { setGroupId(e.target.value); setPage(1) }} style={S.input}>
              <option value="">All groups</option>
              {groups.filter(g => !state || g.state_code === state).map(g => <option key={g.id} value={g.id}>{g.state_code.toUpperCase()} / {g.name} ({g.redirect_count})</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>Status</div>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={S.input}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={S.label}>Search</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }} placeholder="Search from_path, to_path, notes…" style={S.input}/>
              <button onClick={() => { setPage(1); load() }} style={{ ...S.btn, background: '#f3f4f6', color: '#111' }}>Search</button>
            </div>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ ...S.card, background: '#fef3c7', borderColor: '#fcd34d' }}>
          <b>{selected.size} selected</b>
          <div style={{ display: 'inline-flex', gap: 8, marginLeft: 16 }}>
            <button style={{ ...S.btn, background: '#10b981', color: '#fff' }} onClick={() => bulk('enable')}>Enable</button>
            <button style={{ ...S.btn, background: '#6b7280', color: '#fff' }} onClick={() => bulk('disable')}>Disable</button>
            <button style={{ ...S.btn, background: '#6366f1', color: '#fff' }} onClick={() => bulk('reset-hits')}>Reset hits</button>
            <button style={{ ...S.btn, background: '#ef4444', color: '#fff' }} onClick={() => bulk('delete')}>Delete</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ ...S.card, background: '#f0fdfa', borderColor: '#a7f3d0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>{editing ? 'Edit redirect' : 'New redirect'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div>
              <label style={S.label}>State</label>
              <select value={form.state_code} onChange={e => setForm({ ...form, state_code: e.target.value })} style={S.input} disabled={editing}>
                {STATES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Match type</label>
              <select value={form.match_type} onChange={e => setForm({ ...form, match_type: e.target.value })} style={S.input}>
                <option value="exact">Exact</option>
                <option value="prefix">Prefix</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <label style={S.label}>HTTP status</label>
              <select value={form.redirect_type} onChange={e => setForm({ ...form, redirect_type: Number(e.target.value) })} style={S.input}>
                <option value={301}>301 Permanent</option>
                <option value={302}>302 Found</option>
                <option value={307}>307 Temp</option>
                <option value={308}>308 Permanent (preserves method)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Group</label>
              <select value={form.group_id || ''} onChange={e => setForm({ ...form, group_id: e.target.value })} style={S.input}>
                <option value="">— none —</option>
                {groups.filter(g => g.state_code === form.state_code).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={S.label}>From path</label>
              <input value={form.from_path} onChange={e => setForm({ ...form, from_path: e.target.value })} placeholder="/old-url/" style={S.input}/>
            </div>
            <div>
              <label style={S.label}>To path (or full URL)</label>
              <input value={form.to_path} onChange={e => setForm({ ...form, to_path: e.target.value })} placeholder="/new-url/" style={S.input}/>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={S.label}>Notes (admin only)</label>
            <input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={S.input}/>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12 }}><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}/> Active</label>
            <button style={{ ...S.btn, background: '#0d9488', color: '#fff' }} onClick={save}>{editing ? 'Save changes' : 'Create redirect'}</button>
            <button style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }} onClick={() => { setShowForm(false); setForm(blank); setEditing(false) }}>Cancel</button>
          </div>
        </div>
      )}

      <details style={S.card}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Groups ({groups.length})</summary>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input placeholder="New group name" value={newGroup} onChange={e => setNewGroup(e.target.value)} style={S.input}/>
            <button onClick={addGroup} style={{ ...S.btn, background: '#0d9488', color: '#fff', whiteSpace: 'nowrap' as const }}>+ Group (uses selected tenant)</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {groups.map(g => (
              <span key={g.id} style={{ background: '#f3f4f6', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => setGroupId(g.id)}>
                {g.state_code.toUpperCase()} / {g.name} <b>({g.redirect_count})</b>
              </span>
            ))}
          </div>
        </div>
      </details>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: 32 }}><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll}/></th>
              <th style={S.th}>From</th>
              <th style={S.th}>→ To</th>
              <th style={S.th}>State</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Group</th>
              <th style={S.th}>Hits</th>
              <th style={S.th}>Last hit</th>
              <th style={S.th}>Status</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>No redirects.</td></tr>}
            {items.map(r => (
              <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                <td style={S.td}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)}/></td>
                <td style={S.td}><code style={{ fontSize: 12, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{r.from_path}</code></td>
                <td style={S.td}><code style={{ fontSize: 12, background: '#f0fdfa', padding: '1px 6px', borderRadius: 4 }}>{r.to_path}</code></td>
                <td style={S.td}>{r.state_code.toUpperCase()}</td>
                <td style={S.td}>{r.redirect_type} · {r.match_type}</td>
                <td style={S.td}>{r.group_name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                <td style={S.td}><b>{r.hit_count.toLocaleString()}</b></td>
                <td style={S.td}>{r.last_hit_at ? new Date(r.last_hit_at).toLocaleDateString() : '—'}</td>
                <td style={S.td}>{r.is_active
                  ? <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Active</span>
                  : <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Disabled</span>}</td>
                <td style={S.td}>
                  <button style={{ ...S.btn, background: '#f3f4f6', color: '#111', marginRight: 4 }} onClick={() => startEdit(r)}>Edit</button>
                  <button style={{ ...S.btn, background: '#fee2e2', color: '#991b1b' }} onClick={() => del(r.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {page > 1 && <button onClick={() => setPage(page - 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>← Prev</button>}
        <span style={{ padding: '7px 12px', fontSize: 12, color: '#6b7280' }}>Page {page}</span>
        {items.length === 100 && <button onClick={() => setPage(page + 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>Next →</button>}
      </div>
    </div>
  )
}
