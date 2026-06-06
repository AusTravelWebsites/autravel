'use client'
import { useState, useRef } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { MOCK_VISITED, visitedSet, lookupCountry, TOTAL_COUNTRIES, GEO_URL, MockCountry } from './mockData'

const TEAL = '#0d9488'
const TEAL_LIGHT = '#5eead4'

export default function DesignB() {
  const [selected, setSelected] = useState<MockCountry | null>(null)
  const [query, setQuery] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const onSelect = (name: string) => {
    const c = lookupCountry(name)
    if (!c) return
    setSelected(c)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const visibleCountries = query.trim()
    ? MOCK_VISITED.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : MOCK_VISITED

  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, overflow: 'hidden' }}>
      {/* Top band: hero with stats + toolbar */}
      <div style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '32px 24px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Your travel map</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, fontFamily: 'Georgia, serif' }}>
              {MOCK_VISITED.length} countries · {Math.round(MOCK_VISITED.length / TOTAL_COUNTRIES * 100)}% of the world
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsPublic(p => !p)} style={{ background: isPublic ? 'rgba(255,255,255,0.2)' : '#fff', color: isPublic ? '#fff' : '#0f172a', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {isPublic ? '🌐 Public' : '🔒 Private'}
            </button>
            <button style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Map (shorter) */}
      <div style={{ height: 320, background: '#0b1420', position: 'relative' }}>
        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 155 }} style={{ width: '100%', height: '100%' }}>
          <ZoomableGroup center={[0, 20]} minZoom={0.8} maxZoom={3}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) => geographies.map(geo => {
                const name = geo.properties.name
                const isVisited = visitedSet.has(name)
                const isActive = selected?.name === name
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    fill={isActive ? '#fbbf24' : isVisited ? TEAL : '#1e293b'}
                    stroke="#0f172a" strokeWidth={0.3}
                    onClick={() => isVisited && onSelect(name)}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.18s' },
                      hover: { fill: isActive ? '#fbbf24' : isVisited ? TEAL_LIGHT : '#334155', cursor: isVisited ? 'pointer' : 'default', outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Search + gallery */}
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search countries…"
            style={{ flex: '1 1 280px', padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }}
          />
          <div style={{ fontSize: 13, color: '#64748b' }}>{visibleCountries.length} of {MOCK_VISITED.length} countries</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {visibleCountries.map(c => (
            <button key={c.iso2} onClick={() => onSelect(c.name)}
              style={{ background: '#fff', border: `2px solid ${selected?.iso2 === c.iso2 ? TEAL : '#e5e7eb'}`, borderRadius: 12, padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.12s, border-color 0.12s' }}>
              <div style={{ height: 100, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
                {c.samplePhotos[0]
                  ? <img src={c.samplePhotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>{c.flag}</div>}
                <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 18 }}>{c.flag}</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  📓 {c.entries} · 📷 {c.photos} · last {c.lastVisit.slice(0, 7)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Inline detail */}
      {selected && (
        <div ref={detailRef} style={{ padding: '28px 24px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, fontFamily: 'Georgia, serif', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 32 }}>{selected.flag}</span> {selected.name}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add photos</button>
              <button style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Edit notes</button>
              <button onClick={() => setSelected(null)} style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#64748b', marginBottom: 18 }}>
            <span><b style={{ color: '#0f172a' }}>{selected.visits}</b> visits</span>
            <span><b style={{ color: '#0f172a' }}>{selected.entries}</b> entries</span>
            <span><b style={{ color: '#0f172a' }}>{selected.photos}</b> photos</span>
            <span>last visited {selected.lastVisit}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 22 }}>
            {selected.samplePhotos.concat(selected.samplePhotos, selected.samplePhotos).slice(0, 8).map((p, i) => (
              <div key={i} style={{ aspectRatio: '4/3', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Journal entries</div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Day {i} in {selected.name}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Sample entry — in production, pulls from journal_entries joined by place.country.</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
