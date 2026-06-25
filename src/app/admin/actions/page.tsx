'use client'
import { useEffect, useState } from 'react'

type Action = { id:string; action:string; target_type?:string; target_id?:string; metadata?:any; ip?:string; created_at:string; username?:string; display_name?:string }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'var(--brand)' }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  return Math.floor(s/86400) + 'd ago'
}

const ACTION_COLORS: Record<string, string> = {
  delete_post: '#ef4444', delete_review: '#ef4444', delete_trip: '#ef4444', delete_image: '#ef4444', delete_user: '#ef4444',
  ban_user: '#f97316', block: '#f97316',
  unblock: '#10b981', update_user: '#3b82f6',
}

export default function ActionsPage() {
  const [items, setItems] = useState<Action[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/actions').then(r => r.ok ? r.json() : {}).then(d => { setItems(d.items || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filtered = items.filter(i => !filter ||
    i.action.includes(filter.toLowerCase()) ||
    (i.target_id || '').includes(filter) ||
    (i.ip || '').includes(filter) ||
    (i.username || '').toLowerCase().includes(filter.toLowerCase()))

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Audit log</h1>
      <p style={{ color: C.sub, fontSize: 14, margin: '0 0 16px' }}>Every admin action is logged here — deletes, bans, blocks, unblocks, and user edits.</p>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by action, admin, target id, IP…" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit', marginBottom: 14 }} />

      {loading ? <div style={{ color: C.sub, padding: 20 }}>Loading…</div> : filtered.length === 0 ? <div style={{ color: C.sub, padding: 20 }}>No actions{filter ? ' match filter' : ' logged yet'}.</div> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>When</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>Admin</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>Action</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>Target</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>Detail</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub, whiteSpace: 'nowrap' as const }}>{timeAgo(a.created_at)}</td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.teal, fontWeight: 600 }}>{a.display_name || a.username || '—'}</td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                    <span style={{ background: '#f3f4f6', color: ACTION_COLORS[a.action] || '#374151', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{a.action}</span>
                  </td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub, fontSize: 12, fontFamily: 'monospace' }}>
                    {a.target_type ? <span>{a.target_type}:{(a.target_id || '').slice(0, 12)}{(a.target_id || '').length > 12 ? '…' : ''}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.sub }}>
                    {a.metadata ? <code>{JSON.stringify(a.metadata).slice(0, 80)}</code> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, fontSize: 11, fontFamily: 'monospace', color: C.sub }}>{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
