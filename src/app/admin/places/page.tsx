'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Place = { id:string; slug:string; name:string; city?:string; country?:string; category:string; emoji?:string; cover_image?:string; is_verified:boolean; review_count:number; created_at:string }
const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa', red:'#ef4444' }
const CATS = ['','cities','attractions','activities','nature','temples','beaches','food','hotels','hostels']

export default function AdminPlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const limit = 20
  const load = (p = 1, append = false) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p), limit: String(limit) })
    if (search) qs.set('search', search)
    if (category) qs.set('category', category)
    fetch('/api/admin/places?' + qs.toString())
      .then(r => r.ok ? r.json() : { places: [], total: 0 })
      .then(d => {
        setPlaces(append ? [...places, ...(d.places || [])] : (d.places || []))
        setTotal(d.total || 0)
        setPage(p)
        setLoading(false)
      }).catch(() => setLoading(false))
  }

  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t) }, [search, category])
  useEffect(() => { load(1) }, [])

  const del = async (id: string) => {
    if (!confirm('Delete this place? This cannot be undone.')) return
    const r = await fetch(`/api/admin/places?id=${id}`, { method: 'DELETE' })
    if (r.ok) load(1)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>Places</h1>
        <Link href="/admin" style={{ fontSize: 13, color: C.sub, textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>{total.toLocaleString()} places. Click any row to view it on the public site.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, city or country…"
          style={{ flex: '1 1 280px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
          {CATS.map(c => <option key={c} value={c}>{c || 'All categories'}</option>)}
        </select>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        {loading && places.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>Loading…</div>
          : places.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>No places match.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>Place</th>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>Location</th>
                  <th style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>Category</th>
                  <th style={{ textAlign: 'right' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const }}>Reviews</th>
                  <th style={{ padding: '10px 14px' }}></th>
                </tr>
              </thead>
              <tbody>
                {places.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                      <Link href={`/places/${p.slug}`} target="_blank" style={{ color: C.text, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.cover_image
                          ? <img loading="lazy" decoding="async" src={p.cover_image} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' as const, flexShrink: 0 }} />
                          : <span style={{ width: 40, height: 40, borderRadius: 6, background: C.tealLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.emoji || '📍'}</span>}
                        <span>{p.name}{p.is_verified && <span title="Verified" style={{ marginLeft: 6, color: C.teal }}>✓</span>}</span>
                      </Link>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, color: C.sub }}>{[p.city, p.country].filter(Boolean).join(', ')}</td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{p.category}</span></td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, textAlign: 'right' as const, color: p.review_count > 0 ? C.text : C.sub, fontWeight: p.review_count > 0 ? 700 : 400 }}>{p.review_count}</td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>
                      <Link href={`/places/${p.slug}`} target="_blank" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginRight: 4 }}>View</Link>
                      <button onClick={() => del(p.id)} style={{ background: '#fff', color: C.red, border: `1px solid #fecaca`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {places.length < total && !loading && (
        <div style={{ textAlign: 'center' as const, marginTop: 16 }}>
          <button onClick={() => load(page + 1, true)} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Show more ({total - places.length} remaining)</button>
        </div>
      )}
    </div>
  )
}
