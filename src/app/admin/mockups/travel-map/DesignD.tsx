'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Sphere, Graticule, Marker } from 'react-simple-maps'
import { geoCentroid } from 'd3-geo'
import { MOCK_VISITED, visitedSet, lookupCountry, TOTAL_COUNTRIES, MockCountry } from './mockData'

const TEAL = '#0d9488'
const TEAL_LIGHT = '#5eead4'

// Higher-resolution (50m) topojson — more detail on coastlines, small islands, country borders.
const GEO_URL_HD = 'https://unpkg.com/world-atlas@2/countries-50m.json'

export default function DesignD() {
  const [selected, setSelected] = useState<MockCountry | null>(null)
  const [query, setQuery] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [rotate, setRotate] = useState<[number, number, number]>([110, -10, 0])
  const [scale, setScale] = useState(280)
  // Per-country visibility (default: public if the whole map is public, else each individually)
  const [countryPublic, setCountryPublic] = useState<Record<string, boolean>>({})
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [copiedMsg, setCopiedMsg] = useState('')
  const dragRef = useRef<{ x: number; y: number; rotate: [number, number, number]; moved: boolean } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ name: string; visited: boolean; x: number; y: number } | null>(null)

  // Visibility test for orthographic projection — hide labels on the far side of the globe.
  const isFrontFacing = (lng: number, lat: number) => {
    const λc = -rotate[0] * Math.PI / 180
    const φc = -rotate[1] * Math.PI / 180
    const λ = lng * Math.PI / 180
    const φ = lat * Math.PI / 180
    return Math.sin(φc) * Math.sin(φ) + Math.cos(φc) * Math.cos(φ) * Math.cos(λ - λc) > 0.15
  }

  // Starfield background — deterministic so it doesn't shift every render
  const stars = useMemo(() => {
    const rand = (() => { let s = 1337; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } })()
    return Array.from({ length: 80 }, () => ({
      x: rand() * 100, y: rand() * 100, r: rand() * 1.2 + 0.3, o: rand() * 0.6 + 0.2,
    }))
  }, [])

  const isCountryPublic = (iso2: string) => countryPublic[iso2] ?? isPublic
  const toggleCountryPublic = (iso2: string) =>
    setCountryPublic(p => ({ ...p, [iso2]: !(p[iso2] ?? isPublic) }))

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopiedMsg(msg)
    setTimeout(() => setCopiedMsg(''), 1800)
  }

  // Auto-spin when idle (and no country selected)
  useEffect(() => {
    if (selected || dragRef.current) return
    const id = setInterval(() => {
      if (!dragRef.current) setRotate(r => [(r[0] + 0.18) % 360, r[1], r[2]])
    }, 50)
    return () => clearInterval(id)
  }, [selected])

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, rotate: [...rotate], moved: false }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { x, y, rotate: r0 } = dragRef.current
    const dx = e.clientX - x
    const dy = e.clientY - y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true
    // Slower rotation at higher zoom — feels natural
    const speed = 260 / scale
    setRotate([r0[0] + dx * 0.4 * speed, Math.max(-80, Math.min(80, r0[1] - dy * 0.4 * speed)), r0[2]])
  }
  const onMouseUp = () => {
    dragRef.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.max(180, Math.min(900, s * (e.deltaY < 0 ? 1.12 : 0.9))))
  }

  // Touch: single-finger drag to rotate, two-finger pinch to zoom
  const touchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    return Math.hypot(dx, dy)
  }
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), scale }
      dragRef.current = null
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      dragRef.current = { x: t.clientX, y: t.clientY, rotate: [...rotate], moved: false }
      pinchRef.current = null
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const ratio = touchDist(e.touches) / pinchRef.current.dist
      setScale(Math.max(180, Math.min(900, pinchRef.current.scale * ratio)))
    } else if (e.touches.length === 1 && dragRef.current) {
      const t = e.touches[0]
      const { x, y, rotate: r0 } = dragRef.current
      const dx = t.clientX - x
      const dy = t.clientY - y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true
      const speed = 260 / scale
      setRotate([r0[0] + dx * 0.4 * speed, Math.max(-80, Math.min(80, r0[1] - dy * 0.4 * speed)), r0[2]])
    }
  }
  const onTouchEnd = () => { dragRef.current = null; pinchRef.current = null }

  const selectCountry = (name: string) => {
    const c = lookupCountry(name)
    if (!c) return
    setSelected(c)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const onCountryClick = (name: string) => {
    // Don't treat drag-releases as clicks
    if (dragRef.current?.moved) return
    if (visitedSet.has(name)) selectCountry(name)
  }

  const visibleCountries = query.trim()
    ? MOCK_VISITED.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : MOCK_VISITED

  return (
    <div>
      {/* Globe hero */}
      <div style={{ background: 'radial-gradient(ellipse at 30% 20%, #0f2740 0%, #050914 60%, #02050c 100%)', padding: '28px 20px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Starfield */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <svg width="100%" height="100%" style={{ display: 'block' }}>
            {stars.map((s, i) => (
              <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o}/>
            ))}
          </svg>
        </div>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Your travel globe</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
              {MOCK_VISITED.length} countries · {Math.round(MOCK_VISITED.length / TOTAL_COUNTRIES * 100)}% of the world
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsPublic(p => !p)} style={{ background: isPublic ? TEAL : 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {isPublic ? '🌐 Public' : '🔒 Private'}
            </button>
            <button style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Share</button>
          </div>
        </div>

        {/* Globe container */}
        <div
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
          style={{ height: 560, maxWidth: 780, margin: '0 auto', cursor: dragRef.current ? 'grabbing' : 'grab', position: 'relative', touchAction: 'none' }}>
          {/* Atmosphere glow behind the globe */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 50%, rgba(94,234,212,0.22) 0%, rgba(94,234,212,0.10) 38%, rgba(94,234,212,0) 52%)',
            filter: 'blur(6px)',
          }}/>
          <ComposableMap projection="geoOrthographic" projectionConfig={{ scale, rotate }} style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 25px 40px rgba(0,0,0,0.55))' }}>
            <defs>
              {/* Deep ocean with specular highlight top-left to hint a light source */}
              <radialGradient id="ocean-dd" cx="35%" cy="28%" r="75%">
                <stop offset="0%" stopColor="#1a5a8a"/>
                <stop offset="35%" stopColor="#0d3a6b"/>
                <stop offset="75%" stopColor="#081e3d"/>
                <stop offset="100%" stopColor="#020915"/>
              </radialGradient>
              <filter id="glow-dd" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="label-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
                <feOffset dx="0" dy="0.5" result="o"/>
                <feFlood floodColor="#000" floodOpacity="0.9"/>
                <feComposite in2="o" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <Sphere id="ocean-sphere" stroke="rgba(94,234,212,0.22)" strokeWidth={0.9} fill="url(#ocean-dd)"/>
            <Graticule stroke="rgba(148,197,255,0.06)" strokeWidth={0.5}/>
            <Geographies geography={GEO_URL_HD}>
              {({ geographies }) => <>
                {geographies.map(geo => {
                  const name = geo.properties.name
                  const isVisited = visitedSet.has(name)
                  const isActive = selected?.name === name
                  return (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill={isActive ? '#fbbf24' : isVisited ? TEAL : '#162338'}
                      stroke={isVisited ? '#0f766e' : '#0a1322'} strokeWidth={isVisited ? 0.5 : 0.3}
                      onClick={() => onCountryClick(name)}
                      onMouseEnter={(e: React.MouseEvent) => setHover({ name, visited: isVisited, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e: React.MouseEvent) => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : h)}
                      onMouseLeave={() => setHover(null)}
                      filter={isVisited ? 'url(#glow-dd)' : undefined}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.18s' },
                        hover: { fill: isActive ? '#fbbf24' : isVisited ? TEAL_LIGHT : '#2a3a54', outline: 'none', cursor: isVisited ? 'pointer' : 'default' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })}
                {/* Country name labels — visited only, front-facing only, scale with zoom */}
                {geographies.filter(g => visitedSet.has(g.properties.name)).map(geo => {
                  const name = geo.properties.name
                  const [lng, lat] = geoCentroid(geo as any)
                  if (!isFinite(lng) || !isFinite(lat)) return null
                  if (!isFrontFacing(lng, lat)) return null
                  const fontSize = Math.max(8, Math.min(16, scale / 30))
                  const isActive = selected?.name === name
                  return (
                    <Marker key={`lbl-${geo.rsmKey}`} coordinates={[lng, lat]}>
                      <text
                        textAnchor="middle" y={-fontSize * 0.2}
                        style={{ pointerEvents: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: 700, letterSpacing: 0.3 }}
                        fontSize={fontSize}
                        fill={isActive ? '#fbbf24' : '#f0fdfa'}
                        stroke="#000" strokeWidth={3} strokeOpacity={0.55} paintOrder="stroke"
                        filter="url(#label-shadow)"
                      >{name}</text>
                    </Marker>
                  )
                })}
              </>}
            </Geographies>
          </ComposableMap>

          {/* Hover tooltip */}
          {hover && (
            <div style={{
              position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 40, pointerEvents: 'none',
              background: 'rgba(15,23,42,0.95)', color: '#fff', padding: '6px 10px', borderRadius: 6,
              fontSize: 12, fontWeight: 600, border: '1px solid rgba(94,234,212,0.35)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            }}>
              {hover.visited ? '✦ ' : ''}{hover.name}
              {hover.visited && <span style={{ color: TEAL_LIGHT, marginLeft: 6, fontWeight: 500 }}>— click to open</span>}
            </div>
          )}

          {/* Zoom controls */}
          <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
            <button onClick={() => setScale(s => Math.min(900, s * 1.25))} aria-label="Zoom in"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>+</button>
            <button onClick={() => setScale(s => Math.max(180, s * 0.8))} aria-label="Zoom out"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>−</button>
            <button onClick={() => { setScale(280); setRotate([110, -10, 0]) }} aria-label="Reset"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>⌂</button>
          </div>
        </div>

        <div style={{ textAlign: 'center' as const, color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12 }}>
          Drag to rotate · Scroll / pinch / +− to zoom · Click a teal country to jump to it below
        </div>
      </div>

      {/* Gallery */}
      <div style={{ padding: '28px 24px', background: '#f8fafc' }}>
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
            <button key={c.iso2} onClick={() => selectCountry(c.name)}
              style={{ background: '#fff', border: `2px solid ${selected?.iso2 === c.iso2 ? TEAL : '#e5e7eb'}`, borderRadius: 12, padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.12s' }}>
              <div style={{ height: 110, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
                {c.samplePhotos[0]
                  ? <img src={c.samplePhotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>{c.flag}</div>}
                <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 18 }}>{c.flag}</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.name}</div>
                  <span title={isCountryPublic(c.iso2) ? 'Shared publicly' : 'Private'}
                    style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, fontWeight: 700,
                      background: isCountryPublic(c.iso2) ? '#d1fae5' : '#f1f5f9',
                      color: isCountryPublic(c.iso2) ? '#065f46' : '#64748b' }}>
                    {isCountryPublic(c.iso2) ? '🌐' : '🔒'}
                  </span>
                </div>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, position: 'relative' }}>
              <button onClick={() => toggleCountryPublic(selected.iso2)}
                style={{
                  background: isCountryPublic(selected.iso2) ? '#ecfdf5' : '#f8fafc',
                  color: isCountryPublic(selected.iso2) ? '#065f46' : '#475569',
                  border: `1px solid ${isCountryPublic(selected.iso2) ? '#a7f3d0' : '#e5e7eb'}`,
                  borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                {isCountryPublic(selected.iso2) ? '🌐 Public' : '🔒 Private'}
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShareFor(shareFor === selected.iso2 ? null : selected.iso2)}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Share ▾
                </button>
                {shareFor === selected.iso2 && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 6, minWidth: 220, zIndex: 50 }}>
                    {(() => {
                      const url = `https://bugbitten.com/u/me/travels/${selected.iso2.toLowerCase()}`
                      const text = `My ${selected.name} travel album on BugBitten`
                      const items: [string, string, () => void][] = [
                        ['🔗', 'Copy link', () => copy(url, 'Link copied')],
                        ['𝕏', 'Share to X', () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank')],
                        ['📘', 'Share to Facebook', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')],
                        ['💬', 'Share to WhatsApp', () => window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')],
                        ['✉️', 'Share via email', () => window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, '_self')],
                        ['📋', 'Copy embed code', () => copy(`<iframe src="${url}?embed=1" width="600" height="420"></iframe>`, 'Embed copied')],
                      ]
                      return items.map(([icon, label, fn]) => (
                        <button key={label} onClick={() => { fn(); setShareFor(null) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', textAlign: 'left' as const, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#0f172a' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ width: 20, textAlign: 'center' as const }}>{icon}</span>{label}
                        </button>
                      ))
                    })()}
                    {!isCountryPublic(selected.iso2) && (
                      <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px', margin: 4 }}>
                        This country is private — set it public for share links to work for others.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add photos</button>
              <button style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Edit notes</button>
              <button onClick={() => setSelected(null)} style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          {copiedMsg && (
            <div style={{ display: 'inline-block', background: '#0f172a', color: '#fff', fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 12 }}>
              ✓ {copiedMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#64748b', marginBottom: 18, flexWrap: 'wrap' as const }}>
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
