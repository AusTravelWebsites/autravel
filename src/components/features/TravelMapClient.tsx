'use client'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ComposableMap, Geographies, Geography, Sphere, Graticule, Marker } from 'react-simple-maps'
import { geoCentroid } from 'd3-geo'
import { COUNTRIES, NUMERIC_TO_ISO2, TOTAL_COUNTRIES, flagFor } from '@/lib/countries'

const TEAL = 'var(--brand)'
const TEAL_LIGHT = '#5eead4'
const GEO_URL_HD = 'https://unpkg.com/world-atlas@2/countries-50m.json'

type Country = {
  iso2: string
  name: string
  flag: string
  numericId: string | null
  photos: number
  entries: number
  places: number
  lastActivity: string | null
  isPublic: boolean
  coverPhoto: string | null
}

type Detail = {
  country: { iso2: string; name: string; flag: string; isPublic: boolean; isOwner: boolean }
  entries: Array<{ id: string; body: string; location_name: string | null; media_urls: string[] | null; posted_at: string; place_slug: string | null; place_name: string | null; place_city: string | null }>
  locations: Array<{ id: string; place_name: string | null; category: string; notes: string | null; photos: string[] | null; is_public: boolean; updated_at: string }>
  photos: Array<{ url: string; source: 'journal' | 'location'; id: string; postedAt: string | null }>
}

type Props = { username?: string; initialIso2?: string }

export default function TravelMapClient({ username, initialIso2 }: Props) {
  const [countries, setCountries] = useState<Country[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [ownerUsername, setOwnerUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Country | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [rotate, setRotate] = useState<[number, number, number]>([110, -10, 0])
  const [scale, setScale] = useState(280)
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [copiedMsg, setCopiedMsg] = useState('')
  const [hover, setHover] = useState<{ name: string; visited: boolean; x: number; y: number } | null>(null)

  const dragRef = useRef<{ x: number; y: number; rotate: [number, number, number]; moved: boolean } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Load country list
  useEffect(() => {
    let alive = true
    const url = username ? `/api/travels?username=${encodeURIComponent(username)}` : '/api/travels'
    fetch(url)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (!alive) return
        setCountries(d.countries || [])
        setIsOwner(!!d.isOwner)
        setOwnerUsername(d.user?.username || username || '')
        setLoading(false)
        if (initialIso2) {
          const match = (d.countries || []).find((c: Country) => c.iso2 === initialIso2.toUpperCase())
          if (match) {
            setSelected(match)
            setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
          }
        }
      })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [username])

  // Map ISO2 → Country for fast lookup
  const byIso2 = useMemo(() => {
    const m = new Map<string, Country>()
    for (const c of countries) m.set(c.iso2, c)
    return m
  }, [countries])

  // Let the country-gallery below trigger selection on the globe above.
  useEffect(() => {
    const handler = (e: Event) => {
      const iso2 = (e as CustomEvent<{ iso2: string }>).detail?.iso2
      if (!iso2) return
      const match = byIso2.get(iso2.toUpperCase())
      if (match) {
        setSelected(match)
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      }
    }
    window.addEventListener('bb-travel-map:select', handler as any)
    return () => window.removeEventListener('bb-travel-map:select', handler as any)
  }, [byIso2])

  const visitedNumericIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of countries) if (c.numericId) s.add(c.numericId)
    return s
  }, [countries])

  // Auto-spin when idle
  useEffect(() => {
    if (selected || dragRef.current) return
    const id = setInterval(() => {
      if (!dragRef.current) setRotate(r => [(r[0] + 0.18) % 360, r[1], r[2]])
    }, 50)
    return () => clearInterval(id)
  }, [selected])

  // Fetch detail when a country is selected
  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let alive = true
    setDetailLoading(true)
    const q = username ? `?username=${encodeURIComponent(username)}` : ''
    fetch(`/api/travels/${selected.iso2}${q}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(d => { if (alive) { setDetail(d); setDetailLoading(false) } })
      .catch(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [selected, username])

  const selectCountry = useCallback((iso2: string) => {
    const c = byIso2.get(iso2)
    if (!c) return
    setSelected(c)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [byIso2])

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, rotate: [...rotate], moved: false }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const { x, y, rotate: r0 } = dragRef.current
    const dx = e.clientX - x
    const dy = e.clientY - y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true
    const speed = 260 / scale
    setRotate([r0[0] + dx * 0.4 * speed, Math.max(-80, Math.min(80, r0[1] - dy * 0.4 * speed)), r0[2]])
  }
  const onMouseUp = () => { dragRef.current = null }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.max(180, Math.min(900, s * (e.deltaY < 0 ? 1.12 : 0.9))))
  }

  const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { pinchRef.current = { dist: touchDist(e.touches), scale }; dragRef.current = null }
    else if (e.touches.length === 1) {
      const t = e.touches[0]
      dragRef.current = { x: t.clientX, y: t.clientY, rotate: [...rotate], moved: false }; pinchRef.current = null
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      setScale(Math.max(180, Math.min(900, pinchRef.current.scale * (touchDist(e.touches) / pinchRef.current.dist))))
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

  const onGeoClick = (geo: any) => {
    if (dragRef.current?.moved) return
    const iso2 = NUMERIC_TO_ISO2[geo.id] || null
    if (iso2 && byIso2.has(iso2)) selectCountry(iso2)
  }

  const isFrontFacing = (lng: number, lat: number) => {
    const λc = -rotate[0] * Math.PI / 180
    const φc = -rotate[1] * Math.PI / 180
    const λ = lng * Math.PI / 180
    const φ = lat * Math.PI / 180
    return Math.sin(φc) * Math.sin(φ) + Math.cos(φc) * Math.cos(φ) * Math.cos(λ - λc) > 0.15
  }

  const stars = useMemo(() => {
    const rand = (() => { let s = 1337; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } })()
    return Array.from({ length: 80 }, () => ({ x: rand() * 100, y: rand() * 100, r: rand() * 1.2 + 0.3, o: rand() * 0.6 + 0.2 }))
  }, [])

  const visibleCountries = query.trim()
    ? countries.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : countries

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopiedMsg(msg)
    setTimeout(() => setCopiedMsg(''), 1800)
  }

  // Toggle visibility (owner only). Optimistically updates.
  const toggleVisibility = async (iso2: string) => {
    if (!isOwner) return
    const current = byIso2.get(iso2)
    if (!current) return
    const next = !current.isPublic
    setCountries(cs => cs.map(c => c.iso2 === iso2 ? { ...c, isPublic: next } : c))
    if (detail && detail.country.iso2 === iso2) setDetail({ ...detail, country: { ...detail.country, isPublic: next } })
    try {
      const r = await fetch(`/api/travels/${iso2}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_public: next }) })
      if (!r.ok) throw new Error()
    } catch {
      // revert on error
      setCountries(cs => cs.map(c => c.iso2 === iso2 ? { ...c, isPublic: !next } : c))
      setCopiedMsg('Failed to update')
    }
  }

  const shareUrl = (iso2: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : 'https://bugbitten.com'}/u/${ownerUsername}/travels/${iso2.toLowerCase()}`

  if (loading) {
    return <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>Loading travels…</div>
  }
  if (error) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
        <div style={{ color: '#0f172a', fontWeight: 700, marginBottom: 6 }}>Couldn't load travels</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>{error}</div>
      </div>
    )
  }

  if (countries.length === 0) {
    return (
      <div style={{ padding: '60px 20px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🌍</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 10px', color: '#0f172a' }}>
          {isOwner ? 'No travels yet' : `${ownerUsername} hasn't shared any travels yet`}
        </h2>
        {isOwner && (
          <>
            <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.55, marginBottom: 20 }}>
              Start a journal entry with a place or drop a location pin — countries you've written about will appear here automatically.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/journal/new" style={{ background: TEAL, color: '#fff', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>+ Write a journal entry</Link>
              <Link href={`/${ownerUsername}`} style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>My profile</Link>
            </div>
          </>
        )}
      </div>
    )
  }

  const totalPhotos = countries.reduce((s, c) => s + c.photos, 0)
  const totalEntries = countries.reduce((s, c) => s + c.entries, 0)

  return (
    <div>
      {/* Globe hero */}
      <div style={{ background: 'radial-gradient(ellipse at 30% 20%, #0f2740 0%, #050914 60%, #02050c 100%)', padding: '28px 20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <svg width="100%" height="100%" style={{ display: 'block' }}>
            {stars.map((s, i) => <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o}/>)}
          </svg>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10, position: 'relative' as const }}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
              {isOwner ? 'Your travel globe' : `${ownerUsername}'s travel globe`}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
              {countries.length} countries · {Math.round(countries.length / TOTAL_COUNTRIES * 100)}% of the world
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
              {totalEntries} journal entries · {totalPhotos} photos
            </div>
          </div>
        </div>

        <div
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
          style={{ height: 560, maxWidth: 780, margin: '0 auto', cursor: dragRef.current ? 'grabbing' : 'grab', position: 'relative', touchAction: 'none' }}>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 50%, rgba(94,234,212,0.22) 0%, rgba(94,234,212,0.10) 38%, rgba(94,234,212,0) 52%)',
            filter: 'blur(6px)',
          }}/>
          <ComposableMap projection="geoOrthographic" projectionConfig={{ scale, rotate }} style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 25px 40px rgba(0,0,0,0.55))' }}>
            <defs>
              <radialGradient id="ocean-tm" cx="35%" cy="28%" r="75%">
                <stop offset="0%" stopColor="#1a5a8a"/>
                <stop offset="35%" stopColor="#0d3a6b"/>
                <stop offset="75%" stopColor="#081e3d"/>
                <stop offset="100%" stopColor="#020915"/>
              </radialGradient>
              <filter id="glow-tm" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="label-shadow-tm" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
                <feOffset dx="0" dy="0.5" result="o"/>
                <feFlood floodColor="#000" floodOpacity="0.9"/>
                <feComposite in2="o" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <Sphere id="ocean-tm" stroke="rgba(94,234,212,0.22)" strokeWidth={0.9} fill="url(#ocean-tm)"/>
            <Graticule stroke="rgba(148,197,255,0.06)" strokeWidth={0.5}/>
            <Geographies geography={GEO_URL_HD}>
              {({ geographies }) => <>
                {geographies.map(geo => {
                  const iso2 = NUMERIC_TO_ISO2[geo.id] || null
                  const isVisited = !!(iso2 && byIso2.has(iso2))
                  const isActive = selected?.iso2 === iso2
                  return (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill={isActive ? '#fbbf24' : isVisited ? TEAL : '#162338'}
                      stroke={isVisited ? 'var(--brand-dark)' : '#0a1322'} strokeWidth={isVisited ? 0.5 : 0.3}
                      onClick={() => onGeoClick(geo)}
                      onMouseEnter={(e: React.MouseEvent) => setHover({ name: (iso2 && COUNTRIES[iso2]?.name) || geo.properties.name, visited: isVisited, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e: React.MouseEvent) => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : h)}
                      onMouseLeave={() => setHover(null)}
                      filter={isVisited ? 'url(#glow-tm)' : undefined}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.18s' },
                        hover: { fill: isActive ? '#fbbf24' : isVisited ? TEAL_LIGHT : '#2a3a54', outline: 'none', cursor: isVisited ? 'pointer' : 'default' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })}
                {geographies.filter(g => visitedNumericIds.has(g.id)).map(geo => {
                  const iso2 = NUMERIC_TO_ISO2[geo.id]
                  const [lng, lat] = geoCentroid(geo as any)
                  if (!isFinite(lng) || !isFinite(lat)) return null
                  if (!isFrontFacing(lng, lat)) return null
                  const fontSize = Math.max(8, Math.min(16, scale / 30))
                  const isActive = selected?.iso2 === iso2
                  return (
                    <Marker key={`lbl-${geo.rsmKey}`} coordinates={[lng, lat]}>
                      <text textAnchor="middle" y={-fontSize * 0.2}
                        style={{ pointerEvents: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: 700, letterSpacing: 0.3 }}
                        fontSize={fontSize}
                        fill={isActive ? '#fbbf24' : 'var(--brand-light)'}
                        stroke="#000" strokeWidth={3} strokeOpacity={0.55} paintOrder="stroke"
                        filter="url(#label-shadow-tm)"
                      >{COUNTRIES[iso2]?.name || ''}</text>
                    </Marker>
                  )
                })}
              </>}
            </Geographies>
          </ComposableMap>

          {hover && (
            <div style={{
              position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 40, pointerEvents: 'none',
              background: 'rgba(15,23,42,0.95)', color: '#fff', padding: '6px 10px', borderRadius: 6,
              fontSize: 12, fontWeight: 600, border: '1px solid rgba(94,234,212,0.35)', boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            }}>
              {hover.visited ? '✦ ' : ''}{hover.name}
              {hover.visited && <span style={{ color: TEAL_LIGHT, marginLeft: 6, fontWeight: 500 }}>— click to open</span>}
            </div>
          )}

          <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
            <button onClick={() => setScale(s => Math.min(900, s * 1.25))} aria-label="Zoom in"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>+</button>
            <button onClick={() => setScale(s => Math.max(180, s * 0.8))} aria-label="Zoom out"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>−</button>
            <button onClick={() => { setScale(280); setRotate([110, -10, 0]) }} aria-label="Reset"
              style={{ width: 34, height: 34, background: 'transparent', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>⌂</button>
          </div>
        </div>

        <div style={{ textAlign: 'center' as const, color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12, position: 'relative' as const }}>
          Drag to rotate · Scroll / pinch / +− to zoom · Click a teal country to jump to it below
        </div>
      </div>

      {/* Gallery */}
      <div style={{ padding: '28px 24px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search countries…"
            style={{ flex: '1 1 280px', padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }}/>
          <div style={{ fontSize: 13, color: '#64748b' }}>{visibleCountries.length} of {countries.length} countries</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {visibleCountries.map(c => (
            <button key={c.iso2} onClick={() => selectCountry(c.iso2)}
              style={{ background: '#fff', border: `2px solid ${selected?.iso2 === c.iso2 ? TEAL : '#e5e7eb'}`, borderRadius: 12, padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.12s' }}>
              <div style={{ height: 110, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
                {c.coverPhoto
                  ? <img src={c.coverPhoto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>{c.flag}</div>}
                <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 18 }}>{c.flag}</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.name}</div>
                  {isOwner && (
                    <span title={c.isPublic ? 'Shared publicly' : 'Private'}
                      style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, fontWeight: 700,
                        background: c.isPublic ? '#d1fae5' : '#f1f5f9',
                        color: c.isPublic ? 'var(--brand-dark)' : '#64748b' }}>
                      {c.isPublic ? '🌐' : '🔒'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  📓 {c.entries} · 📷 {c.photos}{c.lastActivity ? ` · ${new Date(c.lastActivity).toISOString().slice(0, 7)}` : ''}
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
              {isOwner && (
                <button onClick={() => toggleVisibility(selected.iso2)}
                  style={{
                    background: selected.isPublic ? '#ecfdf5' : '#f8fafc',
                    color: selected.isPublic ? 'var(--brand-dark)' : '#475569',
                    border: `1px solid ${selected.isPublic ? '#a7f3d0' : '#e5e7eb'}`,
                    borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  {selected.isPublic ? '🌐 Public' : '🔒 Private'}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShareFor(shareFor === selected.iso2 ? null : selected.iso2)}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Share ▾
                </button>
                {shareFor === selected.iso2 && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 6, minWidth: 220, zIndex: 50 }}>
                    {(() => {
                      const url = shareUrl(selected.iso2)
                      const text = `${isOwner ? 'My' : `${ownerUsername}'s`} ${selected.name} travels on BugBitten`
                      const items: [string, string, () => void][] = [
                        ['🔗', 'Copy link', () => copy(url, 'Link copied')],
                        ['𝕏', 'Share to X', () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank')],
                        ['📘', 'Share to Facebook', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')],
                        ['💬', 'Share to WhatsApp', () => window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')],
                        ['✉️', 'Share via email', () => window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, '_self')],
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
                    {isOwner && !selected.isPublic && (
                      <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px', margin: 4 }}>
                        This country is private — visitors will see "Not found". Toggle to Public for share links to work.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: '#fff', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          {copiedMsg && (
            <div style={{ display: 'inline-block', background: '#0f172a', color: '#fff', fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 12 }}>✓ {copiedMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#64748b', marginBottom: 18, flexWrap: 'wrap' as const }}>
            <span><b style={{ color: '#0f172a' }}>{selected.entries}</b> entries</span>
            <span><b style={{ color: '#0f172a' }}>{selected.photos}</b> photos</span>
            <span><b style={{ color: '#0f172a' }}>{selected.places}</b> location pins</span>
            {selected.lastActivity && <span>last activity {new Date(selected.lastActivity).toISOString().slice(0, 10)}</span>}
          </div>

          {detailLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>}

          {detail && (
            <>
              {detail.photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 22 }}>
                  {detail.photos.slice(0, 12).map((p, i) => (
                    <div key={p.source + p.id + i} style={{ aspectRatio: '4/3', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                      <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  ))}
                </div>
              )}
              {detail.entries.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Journal entries</div>
                  {detail.entries.map(e => (
                    <Link key={e.id} href={e.place_slug ? `/places/${e.place_slug}` : '#'}
                      style={{ display: 'block', padding: '12px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{e.place_name || e.location_name || 'Journal entry'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', margin: '2px 0 4px' }}>
                        {e.place_city ? `${e.place_city} · ` : ''}{new Date(e.posted_at).toISOString().slice(0, 10)}
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {(e.body || '').slice(0, 280)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {detail.entries.length === 0 && detail.photos.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13 }}>No public content for this country yet.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
