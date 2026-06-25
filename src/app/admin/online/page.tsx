'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Online = { id:string; username:string; display_name:string; avatar_url?:string; ip?:string; last_seen_at:string }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'var(--brand)' }

function ago(iso: string) { const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return 'just now'; return Math.floor(s/60) + 'm ago' }

export default function OnlinePage() {
  const [users, setUsers] = useState<Online[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => fetch('/api/admin/stats').then(r => r.ok ? r.json() : null).then(d => { setUsers(d?.online || []); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>Online now</h1>
        <Link href="/admin" style={{ fontSize: 13, color: C.sub, textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>{users.length} user{users.length === 1 ? '' : 's'} active in the last 15 minutes. Auto-refreshes every 30 seconds.</p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        {loading ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>Loading…</div>
          : users.length === 0 ? <div style={{ padding: 32, color: C.sub, textAlign: 'center' as const }}>👋 Nobody online right now.</div>
          : users.map(u => (
            <Link key={u.id} href={`/${u.username}`} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textDecoration: 'none', borderTop: `1px solid ${C.border}`, color: C.text }}>
              <div style={{ position: 'relative' as const, flexShrink: 0 }}>
                {u.avatar_url
                  ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const }} />
                  : <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.teal, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{(u.display_name || u.username || '?')[0].toUpperCase()}</span>}
                <span style={{ position: 'absolute' as const, bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.display_name || u.username}</div>
                <div style={{ fontSize: 12, color: C.sub }}>@{u.username} · {ago(u.last_seen_at)}{u.ip ? ` · ${u.ip}` : ''}</div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}
