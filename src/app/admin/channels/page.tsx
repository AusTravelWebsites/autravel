'use client'
import { useEffect, useState, Suspense } from 'react'

type Channel = { id: string; slug: string; city_name: string; country: string|null; member_count: number; message_count: number; last_activity_at: string|null; is_locked: boolean; hidden_count?: number }
type Ban = { id: string; user_id?: string|null; ip?: string|null; reason?: string|null; expires_at?: string|null; created_at: string; username?: string; display_name?: string }

export const dynamic = 'force-dynamic'

export default function AdminChannelsWrapper() {
  return <Suspense fallback={<div style={{ padding: 32 }}>Loading…</div>}><AdminChannelsInner/></Suspense>
}

function AdminChannelsInner() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [bans, setBans] = useState<Ban[]>([])
  const [hidden, setHidden] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [cr, br] = await Promise.all([
      fetch('/api/admin/channels'),
      fetch('/api/admin/channels/bans'),
    ])
    setChannels((cr.ok ? (await cr.json()).channels : []) || [])
    setBans((br.ok ? (await br.json()).bans : []) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const loadHidden = async (slug: string) => {
    setSelectedSlug(slug)
    const r = await fetch(`/api/admin/channels/hidden?slug=${encodeURIComponent(slug)}`)
    setHidden((r.ok ? (await r.json()).messages : []) || [])
  }

  const toggleLock = async (slug: string, lock: boolean) => {
    await fetch('/api/admin/channels', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ slug, is_locked: lock }) })
    load()
  }

  const deleteChannel = async (slug: string) => {
    if (!confirm(`Delete #${slug}? Messages and bans will be removed.`)) return
    await fetch(`/api/admin/channels?slug=${encodeURIComponent(slug)}`, { method:'DELETE' })
    load()
  }

  const liftBan = async (banId: string) => {
    await fetch(`/api/admin/channels/bans?id=${banId}`, { method:'DELETE' })
    load()
  }

  const restore = async (messageId: string) => {
    await fetch(`/api/admin/channels/hidden?id=${messageId}`, { method:'POST' })
    if (selectedSlug) loadHidden(selectedSlug)
  }

  const td: React.CSSProperties = { padding:'10px 12px', fontSize:13, borderBottom:'1px solid #f3f4f6', verticalAlign:'middle' }
  const th: React.CSSProperties = { ...td, fontWeight:600, color:'#6b7280', background:'#f9fafb' }
  const btn: React.CSSProperties = { padding:'5px 10px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', border:'none' }

  if (loading) return <div style={{ padding:32, color:'#6b7280' }}>Loading…</div>

  return (
    <div style={{ padding:32 }}>
      <h1 style={{ fontSize:22, fontWeight:700, margin:'0 0 4px' }}>Channels</h1>
      <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 24px' }}>City channels moderation — lock, delete, review hidden messages, lift bans.</p>

      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' as const, marginBottom:24 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' as const }}>
          <thead>
            <tr><th style={th}>Channel</th><th style={th}>Country</th><th style={th}>Members</th><th style={th}>Messages</th><th style={th}>Hidden</th><th style={th}>Active</th><th style={th}>Status</th><th style={th}>Actions</th></tr>
          </thead>
          <tbody>
            {channels.map(c => (
              <tr key={c.id}>
                <td style={td}><a href={`/channels/${c.slug}`} style={{ color:'#0d9488', fontWeight:600, textDecoration:'none' }}>#{c.city_name}</a></td>
                <td style={td}>{c.country || '-'}</td>
                <td style={td}>{c.member_count}</td>
                <td style={td}>{c.message_count}</td>
                <td style={td}>{c.hidden_count ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{c.hidden_count}</span> : '0'}</td>
                <td style={td}>{c.last_activity_at ? new Date(c.last_activity_at).toLocaleString() : '-'}</td>
                <td style={td}>{c.is_locked ? <span style={{ color:'#ef4444', fontWeight:700 }}>🔒 Locked</span> : <span style={{ color:'#10b981' }}>Open</span>}</td>
                <td style={{ ...td, display:'flex', gap:4 }}>
                  <a href={`/channels/${c.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, background:'#f0fdfa', color:'#0d9488', textDecoration:'none', display:'inline-block' }}>Open</a>
                  <button onClick={() => loadHidden(c.slug)} style={{ ...btn, background:'#f3f4f6', color:'#374151' }}>Hidden</button>
                  <button onClick={() => toggleLock(c.slug, !c.is_locked)} style={{ ...btn, background:c.is_locked?'#d1fae5':'#fef3c7', color:c.is_locked?'#065f46':'#92400e' }}>{c.is_locked?'Unlock':'Lock'}</button>
                  <button onClick={() => deleteChannel(c.slug)} style={{ ...btn, background:'#fee2e2', color:'#991b1b' }}>Delete</button>
                </td>
              </tr>
            ))}
            {!channels.length && <tr><td colSpan={8} style={{ ...td, textAlign:'center' as const, color:'#6b7280' }}>No channels yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedSlug && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' as const, marginBottom:24 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e5e7eb', fontWeight:700, fontSize:14 }}>Hidden messages in #{selectedSlug} ({hidden.length})</div>
          {hidden.length === 0
            ? <div style={{ padding:20, color:'#6b7280', fontSize:13 }}>No hidden messages.</div>
            : <table style={{ width:'100%', borderCollapse:'collapse' as const }}>
                <thead><tr><th style={th}>When</th><th style={th}>User</th><th style={th}>Body</th><th style={th}>Reason</th><th style={th}>Actions</th></tr></thead>
                <tbody>
                  {hidden.map((h: any) => (
                    <tr key={h.id}>
                      <td style={td}>{new Date(h.created_at).toLocaleString()}</td>
                      <td style={td}>@{h.username || h.user_id}</td>
                      <td style={{ ...td, maxWidth: 400, wordBreak: 'break-word' as const }}>{h.body}</td>
                      <td style={td}>{h.hidden_reason || '-'}</td>
                      <td style={td}><button onClick={() => restore(h.id)} style={{ ...btn, background:'#d1fae5', color:'#065f46' }}>Restore</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      )}

      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' as const }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #e5e7eb', fontWeight:700, fontSize:14 }}>Channel bans ({bans.length})</div>
        <table style={{ width:'100%', borderCollapse:'collapse' as const }}>
          <thead><tr><th style={th}>Target</th><th style={th}>Reason</th><th style={th}>Since</th><th style={th}>Expires</th><th style={th}>Actions</th></tr></thead>
          <tbody>
            {bans.map(b => (
              <tr key={b.id}>
                <td style={td}>{b.user_id ? `@${b.username || b.user_id}` : b.ip ? `IP ${b.ip}` : '-'}</td>
                <td style={td}>{b.reason || '-'}</td>
                <td style={td}>{new Date(b.created_at).toLocaleString()}</td>
                <td style={td}>{b.expires_at ? new Date(b.expires_at).toLocaleString() : 'Permanent'}</td>
                <td style={td}><button onClick={() => liftBan(b.id)} style={{ ...btn, background:'#d1fae5', color:'#065f46' }}>Lift</button></td>
              </tr>
            ))}
            {!bans.length && <tr><td colSpan={5} style={{ ...td, textAlign:'center' as const, color:'#6b7280' }}>No bans.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
