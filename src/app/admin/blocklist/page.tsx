'use client'
import { useEffect, useState } from 'react'

type Item = { id: string; kind: string; value: string; reason?: string; created_by?: string; created_at: string }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'var(--brand)', red:'#ef4444' }

export default function BlocklistPage() {
  const [items, setItems] = useState<Item[]>([])
  const [kind, setKind] = useState<'ip'|'email'|'email_domain'|'phone'|'phone_prefix'>('ip')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = () => fetch('/api/admin/blocklist').then(r => r.ok ? r.json() : {}).then(d => setItems(d.items || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true); setErr('')
    const r = await fetch('/api/admin/blocklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, value: value.trim(), reason: reason.trim() || undefined }) })
    setBusy(false)
    if (r.ok) { setValue(''); setReason(''); load() }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed') }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove from blocklist?')) return
    const r = await fetch(`/api/admin/blocklist?id=${id}`, { method: 'DELETE' })
    if (r.ok) load()
  }

  const inp = { padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const filtered = items.filter(i => !filter || i.value.toLowerCase().includes(filter.toLowerCase()) || (i.reason || '').toLowerCase().includes(filter.toLowerCase()))

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Blocklist</h1>
      <p style={{ color: C.sub, fontSize: 14, margin: '0 0 20px' }}>Block IPs, emails, email domains, phone numbers or phone prefixes from signing up or signing in.</p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Add a block</div>
        <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'stretch' }}>
          <select value={kind} onChange={e => setKind(e.target.value as any)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="ip">IP</option>
            <option value="email">Email</option>
            <option value="email_domain">Email domain</option>
            <option value="phone">Phone (full)</option>
            <option value="phone_prefix">Phone prefix</option>
          </select>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder={kind === 'ip' ? '1.2.3.4' : kind === 'email_domain' ? 'spammer.com' : kind === 'phone_prefix' ? '+234' : 'value'} style={{ ...inp, flex: '1 1 220px' }} />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" style={{ ...inp, flex: '1 1 180px' }} />
          <button type="submit" disabled={busy} style={{ background: busy?C.sub:C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: busy?'wait':'pointer', fontFamily: 'inherit' }}>{busy?'Adding…':'Add block'}</button>
        </form>
        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search blocks…" style={{ ...inp, width: '100%', marginBottom: 12, boxSizing: 'border-box' as const }} />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        {filtered.length === 0 ? <div style={{ padding: 18, color: C.sub, fontSize: 14 }}>No blocks{filter ? ' match your filter' : ''}.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Kind</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Value</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Reason</th>
                <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Added</th>
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id}>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}><code style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{i.kind}</code></td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, fontFamily: 'monospace', color: C.text }}>{i.value}</td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub }}>{i.reason || '—'}</td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub }}>{new Date(i.created_at).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}</td>
                  <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, textAlign: 'right' as const }}>
                    <button onClick={() => remove(i.id)} style={{ background: '#fff', color: C.red, border: `1px solid #fecaca`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
