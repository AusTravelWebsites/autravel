'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Park = {
  id: string; slug: string; state_code: string; name: string
  park_type: string | null; region: string | null; suburb: string | null; postcode: string | null
  phone: string | null; website: string | null
  price_from: string | null; currency: string | null
  star_rating: string | null; avg_rating: string | null; review_count: number | null
  cover_image: string | null
  pets_allowed: boolean | null; big_rig_friendly: boolean | null
  active: boolean; featured: boolean
  google_place_id: string | null; source: string | null
  created_at: string
}
type StateRow = { state_code: string; c: number; active_c: number; featured_c: number }

const C = { card: '#fff', border: '#e5e7eb', text: '#111', sub: '#6b7280', teal: 'var(--brand)', red: '#ef4444', amber: '#f59e0b' }

export default function AdminParksPage() {
  const sp = useSearchParams()
  const [parks, setParks] = useState<Park[]>([])
  const [count, setCount] = useState(0)
  const [byState, setByState] = useState<StateRow[]>([])
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [search, setSearch] = useState(() => sp?.get('search') || '')
  const [status, setStatus] = useState(() => sp?.get('status') || '')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (state) p.set('state', state)
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    p.set('page', String(page))
    const r = await fetch(`/api/admin/parks?${p}`)
    const j = await r.json()
    setParks(j.parks || [])
    setCount(j.count || 0)
    setByState(j.byState || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [state, status, page]) // search via button

  async function patch(id: string, body: any) {
    await fetch('/api/admin/parks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    load()
  }
  async function del(id: string) {
    if (!confirm('Delete this park? This cannot be undone.')) return
    await fetch('/api/admin/parks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Parks</h1>
        <div style={{ fontSize: 12, color: C.sub }}>{count.toLocaleString()} parks total</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14, fontSize: 12 }}>
        {byState.map(r => (
          <button key={r.state_code} onClick={() => { setState(r.state_code === state ? '' : r.state_code); setPage(1) }}
            style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${r.state_code === state ? C.teal : C.border}`, background: r.state_code === state ? C.teal : C.card, color: r.state_code === state ? '#fff' : C.text, fontWeight: 600, cursor: 'pointer' }}>
            {r.state_code.toUpperCase()} ({r.c.toLocaleString()})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
          placeholder="Search name / region / suburb / slug" style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}/>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="featured">Featured</option>
          <option value="no-image">No cover image</option>
        </select>
        <button onClick={() => { setPage(1); load() }} style={{ padding: '8px 16px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Search</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: `1px solid ${C.border}`, textAlign: 'left' as const }}>
              <th style={th}>Name</th><th style={th}>State</th><th style={th}>Region</th>
              <th style={th}>Type</th><th style={th}>Price</th><th style={th}>Rating</th>
              <th style={th}>Source</th><th style={th}>Status</th><th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>Loading…</td></tr>
              : parks.length === 0 ? <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>No parks.</td></tr>
              : parks.map(p => {
                const rating = p.avg_rating ? Number(p.avg_rating) : (p.star_rating ? Number(p.star_rating) : null)
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={td}>
                      <Link href={`/parks/${p.slug}`} target="_blank" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{p.name}</Link>
                      <div style={{ fontSize: 11, color: C.sub }}>{p.suburb ? `${p.suburb}` : ''} · {p.slug}</div>
                    </td>
                    <td style={td}>{p.state_code.toUpperCase()}</td>
                    <td style={td}>{p.region || '—'}</td>
                    <td style={td}>{p.park_type || '—'}</td>
                    <td style={td}>{p.price_from ? `${p.currency || 'AUD'} $${Number(p.price_from).toFixed(0)}` : '—'}</td>
                    <td style={td}>{rating != null ? `★ ${rating.toFixed(1)}${p.review_count ? ` (${p.review_count})` : ''}` : '—'}</td>
                    <td style={td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f3f4f6' }}>{p.source || '—'}</span></td>
                    <td style={td}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: p.active ? '#dcfce7' : '#fee2e2', color: p.active ? '#166534' : '#991b1b', fontWeight: 700 }}>{p.active ? 'Active' : 'Inactive'}</span>
                      {p.featured && <span style={{ marginLeft: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Featured</span>}
                    </td>
                    <td style={td}>
                      <button onClick={() => patch(p.id, { active: !p.active })} style={btn}>{p.active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => patch(p.id, { featured: !p.featured })} style={btn}>{p.featured ? 'Unfeature' : 'Feature'}</button>
                      <button onClick={() => del(p.id)} style={{ ...btn, color: C.red }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {page > 1 && <button onClick={() => setPage(page - 1)} style={btn}>← Prev</button>}
        <span style={{ padding: '6px 10px', fontSize: 12, color: C.sub }}>Page {page}</span>
        <button onClick={() => setPage(page + 1)} style={btn}>Next →</button>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#374151' }
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' as const }
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', marginRight: 4 }
