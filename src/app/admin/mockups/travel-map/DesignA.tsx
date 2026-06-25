'use client'
import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup, Sphere, Graticule } from 'react-simple-maps'
import { MOCK_VISITED, visitedSet, lookupCountry, TOTAL_COUNTRIES, GEO_URL, MockCountry } from './mockData'

const TEAL = 'var(--brand)'
const TEAL_LIGHT = '#5eead4'
const GRAY = '#e5e7eb'
const GRAY_HOVER = '#cbd5e1'

export default function DesignA() {
  const [selected, setSelected] = useState<MockCountry | null>(null)
  const [query, setQuery] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const filteredSet = query.trim()
    ? new Set(MOCK_VISITED.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase())).map(c => c.name))
    : visitedSet

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', height: 'calc(100vh - 220px)', minHeight: 520, background: '#0b1420', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        {/* Top toolbar */}
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px', maxWidth: 420, boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search a country to filter…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
            />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0f172a', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
            🌏 {MOCK_VISITED.length}/{TOTAL_COUNTRIES} · {Math.round(MOCK_VISITED.length / TOTAL_COUNTRIES * 100)}%
          </div>
          <button onClick={() => setIsPublic(p => !p)} style={{ background: isPublic ? TEAL : 'rgba(255,255,255,0.95)', color: isPublic ? '#fff' : '#0f172a', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
            {isPublic ? '🌐 Public' : '🔒 Private'}
          </button>
        </div>

        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 170 }} style={{ width: '100%', height: '100%' }}>
          <ZoomableGroup center={[0, 20]} minZoom={0.8} maxZoom={4}>
            <Sphere id="bg-sphere" stroke="#1e293b" strokeWidth={0.5} fill="#0b1420"/>
            <Graticule stroke="#1e293b" strokeWidth={0.5}/>
            <Geographies geography={GEO_URL}>
              {({ geographies }) => geographies.map(geo => {
                const name = geo.properties.name
                const isVisited = filteredSet.has(name)
                const isDim = query.trim() && !isVisited
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    fill={isVisited ? TEAL : isDim ? '#1e293b' : GRAY}
                    stroke="#0f172a" strokeWidth={0.3}
                    onClick={() => isVisited && setSelected(lookupCountry(name) || null)}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.18s' },
                      hover: { fill: isVisited ? TEAL_LIGHT : GRAY_HOVER, outline: 'none', cursor: isVisited ? 'pointer' : 'default' },
                      pressed: { fill: isVisited ? TEAL_LIGHT : GRAY_HOVER, outline: 'none' },
                    }}
                  />
                )
              })}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: 14, left: 14, color: 'rgba(255,255,255,0.6)', fontSize: 11, background: 'rgba(0,0,0,0.35)', padding: '6px 10px', borderRadius: 6 }}>
          Click a teal country to see your photos & entries · Drag to pan · Scroll to zoom
        </div>
      </div>

      {/* Right drawer */}
      {selected && (
        <div style={{ background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Country</div>
              <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 26 }}>{selected.flag}</span> {selected.name}
              </h2>
            </div>
            <button onClick={() => setSelected(null)} aria-label="Close" style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#475569' }}>×</button>
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <Stat label="Visits" value={selected.visits}/>
            <Stat label="Entries" value={selected.entries}/>
            <Stat label="Photos" value={selected.photos}/>
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Recent photos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {selected.samplePhotos.slice(0, 9).map((p, i) => (
                <div key={i} style={{ aspectRatio: '1 / 1', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                  <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 20px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Your journal entries</div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Day {i} in {selected.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Sample entry — in production, pulls from journal_entries/checkins/reviews joined by place.country</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add photos</button>
            <button style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Edit notes</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{label}</div>
    </div>
  )
}
