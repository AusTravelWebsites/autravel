'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

type Destination = {
  slug: string
  name: string
  region: string | null
  intro: string | null
  hero_image: string | null
  is_featured: boolean
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)' }

/**
 * Client component that renders the destinations grid with an instant-search filter input.
 * The full destinations list is passed from the server component; filtering is in-memory.
 */
export function DestinationsFilter({ destinations }: { destinations: Destination[] }) {
  const [q, setQ] = useState('')

  const { featured, rest, total } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (d: Destination) => {
      if (!needle) return true
      return (
        d.name.toLowerCase().includes(needle) ||
        (d.region || '').toLowerCase().includes(needle) ||
        (d.intro || '').toLowerCase().includes(needle)
      )
    }
    const filtered = destinations.filter(match)
    return {
      featured: filtered.filter(d => d.is_featured),
      rest: filtered.filter(d => !d.is_featured),
      total: filtered.length,
    }
  }, [destinations, q])

  return (
    <>
      {destinations.length > 6 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter by name or region…"
            aria-label="Filter destinations"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: C.text, background: 'transparent', fontFamily: 'inherit', padding: '6px 0' }}
          />
          {q && (
            <button type="button" onClick={() => setQ('')}
              style={{ background: 'transparent', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 13, padding: '4px 8px', fontFamily: 'inherit' }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: C.sub, fontWeight: 600, whiteSpace: 'nowrap' as const, marginLeft: 4 }}>
            {total} {total === 1 ? 'match' : 'matches'}
          </span>
        </div>
      )}

      {featured.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '4px 0 14px', color: C.text }}>Featured</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 18, marginBottom: 32 }}>
            {featured.map(d => <DestCard key={d.slug} d={d} big />)}
          </div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '4px 0 14px', color: C.text }}>All destinations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 16 }}>
            {rest.map(d => <DestCard key={d.slug} d={d} />)}
          </div>
        </>
      )}
      {total === 0 && q && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '36px 24px', textAlign: 'center' as const, color: C.sub }}>
          <p style={{ margin: '0 0 12px', fontSize: 15 }}>No destinations matching <b style={{ color: C.text }}>"{q}"</b>.</p>
          <button type="button" onClick={() => setQ('')}
            style={{ background: C.teal, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
            Clear filter
          </button>
        </div>
      )}
    </>
  )
}

function DestCard({ d, big }: { d: Destination; big?: boolean }) {
  return (
    <Link href={`/${d.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, display: 'flex', flexDirection: 'column' as const, height: '100%', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px -8px rgba(15,23,42,0.18)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
        <div style={{ position: 'relative' as const, aspectRatio: big ? '16/9' : '4/3', background: '#f1f5f9', overflow: 'hidden' as const }}>
          {d.hero_image
            ? <img src={d.hero_image} alt={d.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50 }}>📍</div>}
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 700 }}>{d.region || 'Destination guide'}</div>
          <h3 style={{ fontSize: big ? 18 : 16, fontWeight: 700, margin: '4px 0 6px', color: C.text }}>{d.name}</h3>
          {d.intro && <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{d.intro}</p>}
        </div>
      </article>
    </Link>
  )
}
