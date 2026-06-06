'use client'
import { useEffect, useState } from 'react'

type Report = { id:string; target_type:string; target_id:string; reason:string; notes?:string; status:string; created_at:string; reporter_username?:string; reporter_name?:string }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'#0d9488', red:'#ef4444' }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  return Math.floor(s/86400) + 'd ago'
}

const TARGET_URL: Record<string, (id: string) => string> = {
  post: id => `/journal-entries/${id}`,
  review: _ => '#',
  trip: _ => '#',
  user: id => `/${id}`,
  image: _ => '#',
}

export default function ReportsPage() {
  const [items, setItems] = useState<Report[]>([])
  const [status, setStatus] = useState<'pending'|'resolved'|'dismissed'>('pending')
  const [loading, setLoading] = useState(true)

  const load = () => { setLoading(true); fetch(`/api/admin/reports?status=${status}`).then(r => r.ok ? r.json() : {}).then(d => { setItems(d.items || []); setLoading(false) }).catch(() => setLoading(false)) }
  useEffect(() => { load() }, [status])

  const act = async (id: string, action: 'dismiss' | 'delete_content') => {
    if (action === 'delete_content' && !confirm('Delete the reported content?')) return
    const r = await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    if (r.ok) load()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Content reports</h1>
      <p style={{ color: C.sub, fontSize: 14, margin: '0 0 16px' }}>Flagged content from the community awaiting review.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending','resolved','dismissed'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)} style={{ padding: '7px 15px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: status===s?C.teal:C.card, color: status===s?'#fff':C.sub, boxShadow: status===s?'none':`0 0 0 1px ${C.border}`, textTransform: 'capitalize' as const }}>{s}</button>
        ))}
      </div>

      {loading ? <div style={{ color: C.sub, padding: 20 }}>Loading…</div> : items.length === 0 ? <div style={{ color: C.sub, padding: 20 }}>No {status} reports.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {items.map(r => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' as const }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>
                  <span style={{ background: '#f3f4f6', color: C.text, padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{r.target_type}</span>
                  {' · '}reported by <strong>@{r.reporter_username || '?'}</strong> · {timeAgo(r.created_at)}
                </div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{r.reason}</div>
                {r.notes && <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{r.notes}</div>}
                <div style={{ fontSize: 11, color: C.sub, marginTop: 6, fontFamily: 'monospace' }}>Target: {r.target_type}:{r.target_id}</div>
              </div>
              {status === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                  <a href={TARGET_URL[r.target_type]?.(r.target_id) || '#'} target="_blank" rel="noopener noreferrer" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>View</a>
                  <button onClick={() => act(r.id, 'dismiss')} style={{ background: '#fff', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
                  <button onClick={() => act(r.id, 'delete_content')} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
