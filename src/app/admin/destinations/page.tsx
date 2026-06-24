'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Dest = {
  id: string; state_code: string; slug: string; name: string
  region: string | null; intro: string | null
  lat: string | null; lng: string | null; radius_km: string | null
  hero_image: string | null; is_featured: boolean; display_order: number; active: boolean
}

const C = { card: '#fff', border: '#e5e7eb', text: '#111', sub: '#6b7280', teal: '#0d9488', red: '#ef4444' }

export default function AdminDestinationsPage() {
  const sp = useSearchParams()
  const [rows, setRows] = useState<Dest[]>([])
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [draft, setDraft] = useState<Partial<Dest> & { state_code?: string }>({ state_code: 'qld' })
  const [editing, setEditing] = useState<Dest | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams(); if (state) p.set('state', state)
    const r = await fetch(`/api/admin/destinations?${p}`); const j = await r.json()
    setRows(j.destinations || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [state])

  async function save() {
    const body = editing ? { ...editing } : draft
    const method = editing ? 'PATCH' : 'POST'
    const r = await fetch('/api/admin/destinations', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { alert('Save failed'); return }
    setEditing(null)
    setDraft({ state_code: 'qld' })
    load()
  }
  async function del(id: string) {
    if (!confirm('Delete this destination?')) return
    await fetch('/api/admin/destinations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }
  async function toggle(d: Dest, field: 'is_featured' | 'active') {
    await fetch('/api/admin/destinations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, [field]: !d[field] }) })
    load()
  }

  const form = editing || draft
  const setField = (k: string, v: any) => editing ? setEditing({ ...editing, [k]: v } as any) : setDraft({ ...draft, [k]: v })

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>Destinations</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>State:</label>
        <select value={state} onChange={e => setState(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13 }}>
          <option value="">All</option>
          {['qld','nsw','nt','wa','sa','tas','vic','aunz'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{editing ? `Edit: ${editing.name}` : 'Add destination'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          <select value={(form as any).state_code || 'qld'} onChange={e => setField('state_code', e.target.value)} disabled={!!editing} style={input}>
            {['qld','nsw','nt','wa','sa','tas','vic','aunz'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <input placeholder="slug (e.g. cairns)" value={(form as any).slug || ''} onChange={e => setField('slug', e.target.value)} disabled={!!editing} style={input}/>
          <input placeholder="Name (e.g. Cairns)" value={(form as any).name || ''} onChange={e => setField('name', e.target.value)} style={input}/>
          <input placeholder="Region (e.g. Far North QLD)" value={(form as any).region || ''} onChange={e => setField('region', e.target.value)} style={input}/>
          <input placeholder="Latitude" value={(form as any).lat || ''} onChange={e => setField('lat', e.target.value)} style={input}/>
          <input placeholder="Longitude" value={(form as any).lng || ''} onChange={e => setField('lng', e.target.value)} style={input}/>
          <input placeholder="Radius (km)" value={(form as any).radius_km || ''} onChange={e => setField('radius_km', e.target.value)} style={input}/>
          <input placeholder="Hero image URL" value={(form as any).hero_image || ''} onChange={e => setField('hero_image', e.target.value)} style={input}/>
        </div>
        <textarea placeholder="Intro (150 chars)" value={(form as any).intro || ''} onChange={e => setField('intro', e.target.value)} style={{ ...input, marginTop: 8, width: '100%', minHeight: 60 }}/>
        <textarea placeholder="Body (HTML)" value={(form as any).body || ''} onChange={e => setField('body', e.target.value)} style={{ ...input, marginTop: 8, width: '100%', minHeight: 120, fontFamily: 'monospace' as const, fontSize: 12 }}/>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!(form as any).is_featured} onChange={e => setField('is_featured', e.target.checked)}/> Featured</label>
          <button onClick={save} style={{ padding: '8px 18px', background: C.teal, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
            {editing ? 'Save changes' : 'Add destination'}
          </button>
          {editing && <button onClick={() => setEditing(null)} style={{ padding: '8px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead><tr style={{ background: '#f9fafb', textAlign: 'left' as const }}>
            <th style={th}>Name</th><th style={th}>State</th><th style={th}>Region</th>
            <th style={th}>Featured</th><th style={th}>Active</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' }}>Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: C.sub }}>None yet.</td></tr>
              : rows.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={td}>
                    <Link href={`/${d.slug}`} target="_blank" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{d.name}</Link>
                    <div style={{ fontSize: 11, color: C.sub }}>{d.slug}</div>
                  </td>
                  <td style={td}>{d.state_code.toUpperCase()}</td>
                  <td style={td}>{d.region || '—'}</td>
                  <td style={td}><button onClick={() => toggle(d, 'is_featured')} style={btn}>{d.is_featured ? '★ Yes' : 'No'}</button></td>
                  <td style={td}><button onClick={() => toggle(d, 'active')} style={btn}>{d.active ? 'Yes' : 'No'}</button></td>
                  <td style={td}>
                    <button onClick={() => setEditing(d)} style={btn}>Edit</button>
                    <button onClick={() => del(d.id)} style={{ ...btn, color: C.red }}>Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }
const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#374151' }
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' as const }
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', marginRight: 4 }
