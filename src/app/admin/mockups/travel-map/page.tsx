'use client'
import { useState } from 'react'
import Link from 'next/link'
import DesignA from './DesignA'
import DesignB from './DesignB'
import DesignC from './DesignC'
import DesignD from './DesignD'

const DESIGNS = [
  {
    id: 'd' as const, label: 'D · Globe + Gallery (recommended)',
    headline: 'Hi-res rotating globe + journal gallery, per-country sharing',
    blurb: 'Drag-to-rotate 50m hi-res globe on top (auto-spin when idle, mouse-wheel + pinch-to-zoom on mobile, +/− controls). Gallery of visited countries underneath, each card shows a 🌐/🔒 badge. Click a country → inline detail with photos + journal entries, per-country public/private toggle, and a share menu (copy link, X, Facebook, WhatsApp, email, embed). Global Public/Private button acts as the default for countries you haven\'t overridden.',
  },
  {
    id: 'a' as const, label: 'A · Classic Choropleth',
    headline: 'Full-width flat map, side drawer',
    blurb: 'Map dominates the screen. Search + stats + public-toggle pinned to the top. Click a teal country → right-hand drawer slides in with photos, entries, notes. Feels efficient and familiar. Best for power-users who want the map to do most of the work.',
  },
  {
    id: 'b' as const, label: 'B · Map + Gallery',
    headline: 'Smaller map + browsable country grid',
    blurb: 'Small map at the top for overview, scrollable gallery of country cards below (each with a cover photo + stats). Click either the map OR a card → inline detail section expands underneath. Best for showing off your travels — the gallery is the main attraction, like a scrapbook.',
  },
  {
    id: 'c' as const, label: 'C · Rotating Globe',
    headline: '2D globe (orthographic), drag to rotate, modal drawer',
    blurb: 'Drag-to-rotate sphere view. Auto-spins when idle. Visited countries glow teal on the dark globe. Click → full-screen modal with photos & entries. More cinematic, great for social sharing screenshots. A bit more friction to find a specific country — search helps.',
  },
]

export default function TravelMapMockups() {
  const [which, setWhich] = useState<'a' | 'b' | 'c' | 'd'>('d')
  const active = DESIGNS.find(d => d.id === which)!

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '24px 20px 64px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Design review · Travel Map</div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Pick a direction</h1>
            <p style={{ color: '#475569', fontSize: 14, margin: '6px 0 0', maxWidth: 720 }}>
              Three interactive mockups with fake data (15 "visited" countries, Unsplash sample photos). Click on the teal countries to see the drawer behaviour. Once you pick one, I'll wire it to the real data + add the public-sharing toggle.
            </p>
          </div>
          <Link href="/admin" style={{ color: '#0d9488', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Back to admin</Link>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#fff', padding: 6, borderRadius: 10, marginBottom: 14, border: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {DESIGNS.map(d => (
            <button key={d.id} onClick={() => setWhich(d.id)}
              style={{
                flex: '1 1 auto', border: 'none', background: which === d.id ? '#0d9488' : 'transparent',
                color: which === d.id ? '#fff' : '#475569', fontWeight: 700, fontSize: 13,
                padding: '10px 16px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Current design blurb */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{active.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{active.headline}</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{active.blurb}</div>
        </div>

        {/* Mockup canvas */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          {which === 'd' && <DesignD/>}
          {which === 'a' && <DesignA/>}
          {which === 'b' && <DesignB/>}
          {which === 'c' && <DesignC/>}
        </div>

        <div style={{ marginTop: 18, textAlign: 'center' as const, color: '#64748b', fontSize: 13 }}>
          Pick a letter when you're ready — A, B, or C — and I'll build it out with real data.
        </div>
      </div>
    </div>
  )
}
