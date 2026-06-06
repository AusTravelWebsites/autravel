'use client'
import { useEffect, useState } from 'react'

type User = {
  id: string
  firebase_uid: string | null
  username: string | null
  display_name: string | null
  email: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  is_admin: boolean
  admin_state_codes: string[] | null
  is_banned: boolean
  ban_reason: string | null
  last_seen_at: string | null
  created_at: string
}

const S = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb', marginBottom: 14 } as React.CSSProperties,
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f9fafb' },
  td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const },
  chip: (active: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: active ? '#0d9488' : '#fff', color: active ? '#fff' : '#374151', border: active ? '1px solid #0d9488' : '1px solid #e5e7eb', cursor: 'pointer' }),
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, admins: 0, banned: 0 })
  const [filter, setFilter] = useState<'' | 'admin' | 'banned'>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [banModal, setBanModal] = useState<{ user: User; reason: string } | null>(null)

  async function load() {
    setLoading(true)
    const q = new URLSearchParams()
    if (filter === 'admin') q.set('admin', '1')
    if (filter === 'banned') q.set('banned', '1')
    if (search) q.set('search', search)
    q.set('page', String(page))
    const r = await fetch('/api/admin/users?' + q)
    const j = await r.json()
    setUsers(j.users || []); setTotal(j.total || 0); setStats(j.stats || { total: 0, admins: 0, banned: 0 })
    setLoading(false)
  }
  useEffect(() => { load() }, [filter, page])

  async function toggleAdmin(u: User) {
    if (!confirm(u.is_admin ? `Revoke admin from ${u.display_name || u.email}?` : `Grant admin to ${u.display_name || u.email}?`)) return
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, is_admin: !u.is_admin }) })
    load()
  }
  async function ban(u: User) {
    setBanModal({ user: u, reason: '' })
  }
  async function confirmBan() {
    if (!banModal) return
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banModal.user.id, is_banned: true, ban_reason: banModal.reason }) })
    setBanModal(null); load()
  }
  async function unban(u: User) {
    if (!confirm(`Unban ${u.display_name || u.email}?`)) return
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, is_banned: false, ban_reason: null }) })
    load()
  }
  async function del(u: User) {
    if (!confirm(`PERMANENTLY DELETE ${u.display_name || u.email}? (Bans are usually better than deletes.)`)) return
    await fetch('/api/admin/users?id=' + u.id, { method: 'DELETE' })
    load()
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Users</h1>
      <p style={S.sub}>{stats.total.toLocaleString()} users · {stats.admins} admins · {stats.banned} banned</p>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
          <button onClick={() => { setFilter(''); setPage(1) }} style={S.chip(!filter)}>All ({stats.total})</button>
          <button onClick={() => { setFilter('admin'); setPage(1) }} style={S.chip(filter === 'admin')}>Admins ({stats.admins})</button>
          <button onClick={() => { setFilter('banned'); setPage(1) }} style={S.chip(filter === 'banned')}>Banned ({stats.banned})</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }} placeholder="Search username, display name, email" style={{ ...S.input, flex: 1 }}/>
          <button onClick={() => { setPage(1); load() }} style={{ ...S.btn, background: '#0d9488', color: '#fff' }}>Search</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              <th style={S.th}>User</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Role</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Last seen</th>
              <th style={S.th}>Joined</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center' as const, color: '#6b7280' }}>No users.</td></tr>}
            {users.map(u => (
              <tr key={u.id} style={{ opacity: u.is_banned ? 0.5 : 1 }}>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', overflow: 'hidden' as const }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/> : (u.display_name || u.email || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.display_name || u.username || '(no name)'}</div>
                      {u.username && <div style={{ fontSize: 11, color: '#6b7280' }}>@{u.username}</div>}
                    </div>
                  </div>
                </td>
                <td style={S.td}>{u.email || '—'}</td>
                <td style={S.td}>
                  {u.is_admin
                    ? <span style={{ background: '#0d9488', color: '#fff', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Admin</span>
                    : <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>User</span>}
                </td>
                <td style={S.td}>
                  {u.is_banned
                    ? <span title={u.ban_reason || ''} style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Banned</span>
                    : <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Active</span>}
                </td>
                <td style={S.td}><span style={{ fontSize: 11, color: '#6b7280' }}>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : '—'}</span></td>
                <td style={S.td}><span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(u.created_at).toLocaleDateString()}</span></td>
                <td style={S.td}>
                  <button onClick={() => toggleAdmin(u)} style={{ ...S.btn, background: u.is_admin ? '#fef3c7' : '#dcfce7', color: u.is_admin ? '#92400e' : '#166534', marginRight: 4 }}>{u.is_admin ? 'Revoke admin' : 'Make admin'}</button>
                  {u.is_banned
                    ? <button onClick={() => unban(u)} style={{ ...S.btn, background: '#dcfce7', color: '#166534', marginRight: 4 }}>Unban</button>
                    : <button onClick={() => ban(u)} style={{ ...S.btn, background: '#fee2e2', color: '#991b1b', marginRight: 4 }}>Ban</button>}
                  <button onClick={() => del(u)} style={{ ...S.btn, background: '#ef4444', color: '#fff' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {page > 1 && <button onClick={() => setPage(page - 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>← Prev</button>}
        <span style={{ padding: '7px 12px', fontSize: 12, color: '#6b7280' }}>Page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
        {page * 50 < total && <button onClick={() => setPage(page + 1)} style={{ ...S.btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>Next →</button>}
      </div>

      {banModal && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }} onClick={() => setBanModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Ban {banModal.user.display_name || banModal.user.email}?</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>User will be unable to sign in. Their content stays in place.</p>
            <textarea value={banModal.reason} onChange={e => setBanModal({ ...banModal, reason: e.target.value })} placeholder="Reason (admin only, required)" style={{ ...S.input, width: '100%', minHeight: 60, marginBottom: 10 }}/>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setBanModal(null)} style={{ ...S.btn, background: '#f3f4f6', color: '#111' }}>Cancel</button>
              <button onClick={confirmBan} disabled={!banModal.reason.trim()} style={{ ...S.btn, background: '#ef4444', color: '#fff', opacity: banModal.reason.trim() ? 1 : 0.5 }}>Confirm ban</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
