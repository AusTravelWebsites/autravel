'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

type Country = {
  iso2: string
  name: string
  flag: string
  photos: number
  entries: number
  places: number
  lastActivity: string | null
  isPublic: boolean
  coverPhoto: string | null
}

// Country card gallery that sits below the globe on /trips.
// Matches the Design D mockup: covers + flag + per-country stats + public/private
// badge + search. Clicking a card scrolls up to the globe and selects that country
// via a CustomEvent that TravelMapClient listens for.
export default function TravelCountryGallery({ username }: { username?: string }) {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const url = username ? `/api/travels?username=${encodeURIComponent(username)}` : '/api/travels'
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCountries(d?.countries || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [username])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return countries
    return countries.filter(c => c.name.toLowerCase().includes(needle))
  }, [countries, query])

  const select = (iso2: string) => {
    // Let TravelMapClient pick up the selection and scroll itself into view.
    window.dispatchEvent(new CustomEvent('bb-travel-map:select', { detail: { iso2 } }))
  }

  if (loading) {
    return (
      <section style={{ background: '#f3f4f6', padding: '28px 16px 10px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', color: '#6b7280', fontSize: 14 }}>Loading your countries…</div>
      </section>
    )
  }

  if (countries.length === 0) {
    return (
      <section style={{ background: '#f3f4f6', padding: '28px 16px 10px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌏</div>
          <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>No countries on your globe yet</div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Check in somewhere or write a journal entry — every country you visit will light up.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section style={{ background: '#f3f4f6', padding: '28px 16px 10px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 800, margin: 0, color: '#111827' }}>
            Countries on your globe <span style={{ color: '#6b7280', fontSize: 14, fontWeight: 400 }}>({countries.length})</span>
          </h2>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your countries…"
            style={{
              flex: '1 1 200px', maxWidth: 280,
              padding: '9px 14px', borderRadius: 999,
              border: '1px solid #d1d5db', background: '#fff',
              fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </div>
        <div className="bb-row-grid">
          {filtered.map(c => (
            <button key={c.iso2} onClick={() => select(c.iso2)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 12, padding: 0, overflow: 'hidden' as const,
                textAlign: 'left' as const, cursor: 'pointer',
                fontFamily: 'inherit', position: 'relative' as const,
              }}>
              <div style={{ height: 120, background: '#f1f5f9', overflow: 'hidden' as const, position: 'relative' as const }}>
                {c.coverPhoto
                  ? <img src={c.coverPhoto} alt="" loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }}/>
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 44 }}>{c.flag || '🌍'}</div>}
                {/* Flag chip */}
                <div style={{ position: 'absolute' as const, top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 8, padding: '3px 8px', fontSize: 18, lineHeight: 1 }}>
                  {c.flag || '🌍'}
                </div>
                {/* Privacy chip */}
                <div style={{
                  position: 'absolute' as const, top: 8, right: 8,
                  background: c.isPublic ? 'rgba(13,148,136,0.92)' : 'rgba(0,0,0,0.55)',
                  color: '#fff', borderRadius: 999, padding: '3px 10px',
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                }}>
                  {c.isPublic ? '🌐 Public' : '🔒 Private'}
                </div>
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: 14, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                  <span>📓 {c.entries}</span>
                  <span>📷 {c.photos}</span>
                  {c.places > 0 && <span>📍 {c.places}</span>}
                </div>
                {c.lastActivity && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    Last {new Date(c.lastActivity).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && query && (
          <div style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' as const, padding: '20px 0' }}>
            No countries match "{query}".
          </div>
        )}
      </div>
    </section>
  )
}

// Sibling hook for TravelMapClient — import and wire into its existing select effect.
