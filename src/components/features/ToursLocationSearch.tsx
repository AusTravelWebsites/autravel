'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Locality = { name: string; slug: string; place_type: string }

// Location autocomplete for state-scoped tenants. Queries
// /api/localities/search for the tenant's state — returns suburbs/towns/cities
// from the OSM-imported gazetteer. Falls back to the destinations chip list
// (passed as `popular`) for one-tap shortcuts.
export function ToursLocationSearch({
  state,
  stateName,
  currentLocation,
  preserveParams = {},
}: {
  state: string
  stateName: string
  currentLocation?: string
  preserveParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [q, setQ] = useState(currentLocation || '')
  const [results, setResults] = useState<Locality[]>([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const skip = useRef(false)

  useEffect(() => { setQ(currentLocation || '') }, [currentLocation])

  useEffect(() => {
    if (skip.current) { skip.current = false; return }
    const s = q.trim()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/localities/search?state=${encodeURIComponent(state)}&q=${encodeURIComponent(s)}&limit=10`)
        const d = r.ok ? await r.json() : { results: [] }
        setResults(d.results || [])
        setHi(0)
      } catch {}
    }, 180)
    return () => clearTimeout(t)
  }, [q, state])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const navigateTo = (loc: string | null) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(preserveParams)) if (v) p.set(k, v)
    if (loc) p.set('loc', loc)
    router.push(`/tours${p.toString() ? '?' + p.toString() : ''}`)
  }

  const pickName = (name: string) => {
    skip.current = true
    setQ(name); setOpen(false)
    navigateTo(name)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && results.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); pickName(results[hi].name); return }
      if (e.key === 'Escape')    { setOpen(false); return }
    }
    if (e.key === 'Enter' && q.trim()) {
      e.preventDefault()
      navigateTo(q.trim())
    }
  }

  const clear = () => { setQ(''); setResults([]); setOpen(false); navigateTo(null) }

  return (
    <div ref={wrap} style={{ position: 'relative' as const, width: '100%' }}>
      <div style={{ position: 'relative' as const }}>
        <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' as const }}>📍</span>
        <input
          type="search"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={`Search by location — e.g. Sydney, Bondi, Hunter Valley`}
          aria-label={`Search ${stateName} locations`}
          autoComplete="off"
          style={{ width: '100%', padding: '11px 40px 11px 40px', borderRadius: 999, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }}
        />
        {q && (
          <button onClick={clear} aria-label="Clear location filter"
            style={{ position: 'absolute' as const, right: 10, top: '50%', transform: 'translateY(-50%)', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#6b7280', fontSize: 13, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 6, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 30, maxHeight: 320, overflowY: 'auto' as const, textAlign: 'left' as const, border: '1px solid #e5e7eb' }}>
          {results.map((d, i) => (
            <button key={`${d.slug}-${d.place_type}`}
              onMouseDown={e => { e.preventDefault(); pickName(d.name) }}
              onMouseEnter={() => setHi(i)}
              style={{ display: 'block', width: '100%', padding: '10px 16px', background: hi === i ? 'var(--brand-light)' : 'transparent', border: 'none', textAlign: 'left' as const, cursor: 'pointer', fontSize: 14, color: '#111827', fontFamily: 'inherit' }}>
              <div style={{ fontWeight: 600 }}>📍 {d.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' as const }}>{d.place_type} · {stateName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
