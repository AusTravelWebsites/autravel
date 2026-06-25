'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

type SignIn = { id:string; user_id:string; ip?:string; user_agent?:string; created_at:string; username?:string; display_name?:string; avatar_url?:string; is_banned?:boolean }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'var(--brand)' }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  return Math.floor(s/86400) + 'd ago'
}

export default function Wrapper() {
  return <Suspense fallback={<div style={{ padding: 32, color: '#6b7280' }}>Loading…</div>}><Inner/></Suspense>
}

function Inner() {
  const sp = useSearchParams()
  const initialWindow = (sp?.get('window') as '15m'|'24h'|'7d') || '24h'
  const [signins, setSignins] = useState<SignIn[]>([])
  const [search, setSearch] = useState('')
  const [windowSel, setWindowSel] = useState<'15m'|'24h'|'7d'>(initialWindow)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const load = (p = 1, append = false) => {
    setLoading(true)
    const qs = new URLSearchParams({ window: windowSel, page: String(p), limit: String(limit) })
    if (search) qs.set('search', search)
    fetch('/api/admin/signins?' + qs).then(r => r.ok ? r.json() : { signins: [], total: 0 }).then(d => {
      setSignins(append ? [...signins, ...(d.signins || [])] : (d.signins || []))
      setTotal(d.total || 0); setPage(p); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { const t = setTimeout(() => load(1), 200); return () => clearTimeout(t) }, [search, windowSel])

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>Sign-ins</h1>
        <Link href="/admin" style={{ fontSize: 13, color: C.sub, textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 14px' }}>{total.toLocaleString()} sign-ins in the last {windowSel}.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {(['15m','24h','7d'] as const).map(w => (
          <button key={w} onClick={() => setWindowSel(w)} style={{ padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: windowSel===w?C.teal:'#fff', color: windowSel===w?'#fff':C.sub, boxShadow: windowSel===w?'none':`0 0 0 1px ${C.border}`, fontFamily: 'inherit' }}>{w === '15m' ? 'Last 15 min' : w === '24h' ? 'Last 24h' : 'Last 7 days'}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by user or IP…" style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        {loading && signins.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>Loading…</div>
          : signins.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>No sign-ins.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>User</th>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>When</th>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>IP</th>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {signins.map(s => (
                  <tr key={s.id} style={{ opacity: s.is_banned ? 0.4 : 1 }}>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                      {s.username
                        ? <Link href={`/${s.username}`} target="_blank" style={{ color: C.teal, fontWeight: 600, textDecoration: 'none' }}>{s.display_name || s.username}{s.is_banned && <span style={{ marginLeft: 6, color: '#ef4444', fontSize: 10, fontWeight: 700 }}>BANNED</span>}</Link>
                        : <span style={{ color: C.sub }}>(unknown)</span>}
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub, whiteSpace: 'nowrap' as const }}>{timeAgo(s.created_at)}</td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 12 }}>{s.ip || '—'}</td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub, fontSize: 11, maxWidth: 320, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }} title={s.user_agent}>{s.user_agent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {signins.length < total && !loading && (
        <div style={{ textAlign: 'center' as const, marginTop: 16 }}>
          <button onClick={() => load(page + 1, true)} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Show more ({total - signins.length} remaining)</button>
        </div>
      )}
    </div>
  )
}
