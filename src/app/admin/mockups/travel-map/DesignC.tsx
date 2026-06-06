'use client'
import { useState, useEffect, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from 'react-simple-maps'
import { MOCK_VISITED, visitedSet, lookupCountry, TOTAL_COUNTRIES, GEO_URL, MockCountry } from './mockData'

const TEAL = '#0d9488'
const TEAL_LIGHT = '#5eead4'

// Drag-to-rotate orthographic globe with a modal on country click.
export default function DesignC() {
  const [selected, setSelected] = useState<MockCountry | null>(null)
  const [query, setQuery] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [rotate, setRotate] = useState<[number, number, number]>([110, -10, 0])
  const dragRef = useRef<{ x: number; y: number; rotate: [number, number, number] } | null>(null)

  // Auto-spin when idle
  useEffect(() => {
    if (selected) return
    const id = setInterval(() => setRotate(r => [(r[0] + 0.2) % 360, r[1], r[2]]), 50)
    return () => clearInterval(id)
  }, [selected])

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, rotate: [...rotate] }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { x, y, rotate: r0 } = dragRef.current
    const dx = (e.clientX - x) * 0.4
    const dy = (e.clientY - y) * 0.4
    setRotate([r0[0] + dx, Math.max(-80, Math.min(80, r0[1] - dy)), r0[2]])
  }
  const onMouseUp = () => { dragRef.current = null }

  const onCountryClick = (name: string) => {
    const c = lookupCountry(name)
    if (c) setSelected(c)
  }

  // Search — recentre globe on matched country (rough centroid lookup would need extra data; we just teleport to first match)
  const onSearch = (q: string) => {
    setQuery(q)
    const match = MOCK_VISITED.find(c => c.name.toLowerCase().includes(q.toLowerCase()))
    if (match) setSelected(match)
  }

  return (
    <div style={{ background: 'radial-gradient(circle at 30% 20%, #1e293b 0%, #020617 70%)', borderRadius: 14, overflow: 'hidden', padding: '32px 20px', position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Your travel globe</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
            {MOCK_VISITED.length} countries explored · {Math.round(MOCK_VISITED.length / TOTAL_COUNTRIES * 100)}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query} onChange={e => onSearch(e.target.value)}
            placeholder="Search a country…"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 14, outline: 'none', width: 260 }}
          />
          <button onClick={() => setIsPublic(p => !p)} style={{ background: isPublic ? TEAL : 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {isPublic ? '🌐 Public' : '🔒 Private'}
          </button>
        </div>
      </div>

      {/* Globe */}
      <div
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        style={{ height: 520, maxWidth: 700, margin: '0 auto', cursor: dragRef.current ? 'grabbing' : 'grab' }}>
        <ComposableMap projection="geoOrthographic" projectionConfig={{ scale: 250, rotate }} style={{ width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="ocean-g">
              <stop offset="70%" stopColor="#0b2a4a"/>
              <stop offset="100%" stopColor="#050e1f"/>
            </radialGradient>
          </defs>
          <Sphere id="ocean" stroke="none" fill="url(#ocean-g)"/>
          <Graticule stroke="rgba(255,255,255,0.05)" strokeWidth={0.5}/>
          <Geographies geography={GEO_URL}>
            {({ geographies }) => geographies.map(geo => {
              const name = geo.properties.name
              const isVisited = visitedSet.has(name)
              return (
                <Geography key={geo.rsmKey} geography={geo}
                  fill={isVisited ? TEAL : '#1e293b'}
                  stroke="#0f172a" strokeWidth={0.4}
                  onClick={() => isVisited && onCountryClick(name)}
                  style={{
                    default: { outline: 'none', transition: 'fill 0.18s' },
                    hover: { fill: isVisited ? TEAL_LIGHT : '#334155', outline: 'none', cursor: isVisited ? 'pointer' : 'default' },
                    pressed: { outline: 'none' },
                  }}
                />
              )
            })}
          </Geographies>
        </ComposableMap>
      </div>

      {/* Hint */}
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 14 }}>
        Drag to rotate · Click a teal country to see your photos & entries
      </div>

      {/* Tags strip at bottom */}
      <div style={{ marginTop: 24, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' as const }}>
        <div style={{ display: 'inline-flex', flexWrap: 'wrap' as const, gap: 6, justifyContent: 'center' as const }}>
          {MOCK_VISITED.map(c => (
            <button key={c.iso2} onClick={() => onCountryClick(c.name)}
              style={{ background: 'rgba(13,148,136,0.12)', color: '#5eead4', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {c.flag} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Full-screen modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 820, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, fontFamily: 'Georgia, serif', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 30 }}>{selected.flag}</span> {selected.name}
              </h2>
              <button onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#475569' }}>×</button>
            </div>
            <div style={{ padding: '14px 22px', display: 'flex', gap: 20, fontSize: 13, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
              <span><b style={{ color: '#0f172a' }}>{selected.visits}</b> visits</span>
              <span><b style={{ color: '#0f172a' }}>{selected.entries}</b> entries</span>
              <span><b style={{ color: '#0f172a' }}>{selected.photos}</b> photos</span>
              <span>last {selected.lastVisit}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 20 }}>
                {selected.samplePhotos.concat(selected.samplePhotos, selected.samplePhotos).slice(0, 6).map((p, i) => (
                  <div key={i} style={{ aspectRatio: '4/3', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Journal entries</div>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Day {i} in {selected.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Sample entry — in production, pulls from journal_entries joined by place.country.</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Add photos</button>
              <button style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Edit notes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
