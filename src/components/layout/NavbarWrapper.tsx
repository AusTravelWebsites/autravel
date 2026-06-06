'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import type { MegaMenu } from '@/lib/mega-menu'

function SavedCountBadge() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const update = () => {
      try { setN((JSON.parse(localStorage.getItem('autravel:saved') || '[]') as unknown[]).length) }
      catch { setN(0) }
    }
    update()
    window.addEventListener('autravel:saved-change', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('autravel:saved-change', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  if (n === 0) return null
  return <span style={{ display: 'inline-block', minWidth: 18, padding: '2px 7px', background: '#0d9488', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{n}</span>
}

interface NavProps {
  brand: {
    name: string
    homeHref: string
  }
  scope: string         // "Queensland", "New South Wales", "Australia" etc — for menu labels
  isAggregator: boolean
  mega: MegaMenu
}

const PANELS = ['destinations', 'things', 'trains', 'guides', 'about'] as const
type PanelKey = typeof PANELS[number]

export function NavbarWrapper({ brand, scope, isAggregator, mega }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState<PanelKey | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<PanelKey | null>(null)
  const [search, setSearch] = useState('')
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMobileOpen(false); setOpen(null) }, [pathname])

  // Close panel on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setMobileOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) { router.push(`/search?q=${encodeURIComponent(search.trim())}`); setSearch('') }
  }

  // Hover-open with a small close delay so moving cursor between trigger and
  // panel doesn't snap the menu shut.
  function hoverOpen(panel: PanelKey) {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(panel)
  }
  function hoverClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(null), 180)
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="bb-nav" style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 60 }}>
      <style>{`
        .bb-nav-hamburger { display: none; }
        .bb-mega-trigger { background: transparent; border: none; padding: 18px 14px; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; letter-spacing: 0.01em; position: relative; font-family: inherit; }
        .bb-mega-trigger:hover, .bb-mega-trigger[data-open="true"] { color: #0d9488; }
        .bb-mega-trigger[data-open="true"]::after { content:''; position: absolute; bottom: 0; left: 14px; right: 14px; height: 2px; background: #0d9488; border-radius: 2px 2px 0 0; }
        .bb-mega-chev { font-size: 10px; margin-left: 5px; opacity: 0.6; }
        .bb-mega-panel { position: absolute; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; box-shadow: 0 18px 28px -16px rgba(15,23,42,0.18); animation: bb-mega-in 0.18s ease-out; }
        @keyframes bb-mega-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .bb-mega-grid { max-width: 1200px; margin: 0 auto; padding: 28px 24px 30px; }
        .bb-dest-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .bb-dest-card { display: block; text-decoration: none; color: #111827; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; background: #fff; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .bb-dest-card:hover { transform: translateY(-2px); box-shadow: 0 8px 18px -8px rgba(15,23,42,0.15); border-color: #0d9488; }
        .bb-dest-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: #f1f5f9; display: block; }
        .bb-dest-name { padding: 9px 12px; font-size: 13px; font-weight: 700; line-height: 1.2; }
        .bb-mega-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; }
        .bb-mega-col h3 { font-size: 11px; font-weight: 800; color: #6b7280; letter-spacing: 1.4px; text-transform: uppercase; margin: 0 0 12px; }
        .bb-mega-col a { display: block; padding: 8px 0; color: #111827; text-decoration: none; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f3f4f6; }
        .bb-mega-col a:last-child { border-bottom: none; }
        .bb-mega-col a:hover { color: #0d9488; }
        .bb-mega-col a small { display: block; color: #6b7280; font-size: 12px; font-weight: 400; margin-top: 2px; }
        .bb-mega-feature { display: block; text-decoration: none; color: #111827; }
        .bb-mega-feature img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 10px; background: #f1f5f9; }
        .bb-mega-feature .meta { display: block; font-size: 11px; color: #0d9488; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px; }
        .bb-mega-feature h4 { font-size: 15px; line-height: 1.35; margin: 0; font-weight: 700; }
        .bb-mega-feature:hover h4 { color: #0d9488; }
        .bb-author-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; color: #111827; text-decoration: none; border-bottom: 1px solid #f3f4f6; }
        .bb-author-row:hover { color: #0d9488; }
        .bb-author-row:last-child { border-bottom: none; }
        .bb-author-av { width: 32px; height: 32px; border-radius: 999px; background: #0d9488; color: #fff; font-weight: 800; font-family: Georgia, serif; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .bb-author-av img { width: 100%; height: 100%; object-fit: cover; }
        .bb-author-name { font-size: 13px; font-weight: 700; }
        .bb-author-role { font-size: 11px; color: #6b7280; }
        .bb-state-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .bb-state-card { display: block; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #111827; font-weight: 700; transition: all 0.15s; }
        .bb-state-card:hover { border-color: #0d9488; color: #0d9488; background: #f0fdfa; }
        .bb-state-card small { display: block; font-weight: 400; color: #6b7280; font-size: 11px; margin-top: 4px; }
        @media (max-width: 1100px) {
          .bb-nav-search input { width: 180px !important; }
        }
        @media (max-width: 1000px) {
          .bb-nav-top { min-height: 64px !important; grid-template-columns: auto 1fr auto !important; padding: 6px 12px !important; }
          .bb-nav-logo img { height: 48px !important; }
          .bb-nav-links { display: none !important; }
          .bb-nav-search { display: none !important; }
          .bb-nav-hamburger { display: inline-flex !important; }
          .bb-mega-panel { display: none !important; }
          .bb-dest-grid, .bb-state-grid { grid-template-columns: repeat(2, 1fr); }
          .bb-mega-3col { grid-template-columns: 1fr; gap: 20px; }
        }
      `}</style>

      {/* Top row — auto-fit logo + flexible centre links + auto-fit right rail */}
      <div className="bb-nav-top" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px', minHeight: 72, display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 18 }}>
        {/* Logo — left */}
        <div className="bb-nav-logo" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <Link href={brand.homeHref} style={{ display: 'inline-block', textDecoration: 'none', color: '#0d9488', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>
            {brand.name}
          </Link>
        </div>

        {/* Mega menu — middle */}
        <div className="bb-nav-links" style={{ display: 'flex', alignItems: 'stretch', gap: 0, justifyContent: 'center' }}>
          <MegaTrigger label="Destinations"  panel="destinations" open={open} onHover={hoverOpen} onLeave={hoverClose} />
          <MegaTrigger label="Things to do"  panel="things"       open={open} onHover={hoverOpen} onLeave={hoverClose} />
          <MegaTrigger label="Trains"        panel="trains"       open={open} onHover={hoverOpen} onLeave={hoverClose} />
          <MegaTrigger label="Travel guides" panel="guides"       open={open} onHover={hoverOpen} onLeave={hoverClose} />
          <MegaTrigger label="About"         panel="about"        open={open} onHover={hoverOpen} onLeave={hoverClose} />
        </div>

        {/* Right — search + saved + mobile hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <form onSubmit={handleSearch} className="bb-nav-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} aria-hidden>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${brand.name}…`}
              aria-label={`Search ${brand.name}`}
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999, padding: '8px 14px 8px 34px', fontSize: 13.5, outline: 'none', width: 260, fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f3f4f6' }}
            />
          </form>
          <Link href="/saved/" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 8, color: isActive('/saved') ? '#0d9488' : '#374151', textDecoration: 'none', fontSize: 13, fontWeight: 600, position: 'relative', background: isActive('/saved') ? '#f0fdfa' : 'transparent', transition: 'background 0.15s' }}>
            <span aria-hidden style={{ marginRight: 5, fontSize: 15, lineHeight: 1 }}>♡</span> Saved <SavedCountBadge/>
          </Link>
          <button
            className="bb-nav-hamburger"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {mobileOpen
                ? <><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></>
                : <><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop mega panel */}
      {open && (
        <div className="bb-mega-panel" onMouseEnter={() => hoverOpen(open)} onMouseLeave={hoverClose}>
          <div className="bb-mega-grid">
            {open === 'destinations' && (
              isAggregator
                ? <StateGrid mega={mega} />
                : <DestinationsGrid mega={mega} scope={scope} />
            )}
            {open === 'things' && <ThingsToDo scope={scope} />}
            {open === 'trains' && <TrainsPanel mega={mega} scope={scope} isAggregator={isAggregator} />}
            {open === 'guides' && <TravelGuides mega={mega} scope={scope} />}
            {open === 'about' && <AboutPanel mega={mega} brandName={brand.name} />}
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff', position: 'relative', zIndex: 50 }}>
          <MobileDrawer mega={mega} scope={scope} isAggregator={isAggregator} panel={mobilePanel} setPanel={setMobilePanel} onClose={() => setMobileOpen(false)} />
        </div>
      )}
    </nav>
  )
}

// --- Trigger button + panels ---

function MegaTrigger({ label, panel, open, onHover, onLeave }: { label: string; panel: PanelKey; open: PanelKey | null; onHover: (p: PanelKey) => void; onLeave: () => void }) {
  return (
    <div onMouseEnter={() => onHover(panel)} onMouseLeave={onLeave} style={{ display: 'flex' }}>
      <button
        className="bb-mega-trigger"
        data-open={open === panel}
        aria-haspopup="true"
        aria-expanded={open === panel}
        onClick={() => onHover(panel)}
        type="button"
      >
        {label}<span className="bb-mega-chev" aria-hidden>▾</span>
      </button>
    </div>
  )
}

function DestinationsGrid({ mega, scope }: { mega: MegaMenu; scope: string }) {
  return (
    <>
      <PanelHeading
        title={`Destinations in ${scope}`}
        cta={{ href: '/destinations/', label: 'All destinations →' }}
      />
      <div className="bb-dest-grid">
        {mega.destinations.map(d => (
          <Link key={d.slug} href={`/destinations/${d.slug}/`} className="bb-dest-card">
            {d.cover_image
              ? <img src={d.cover_image} alt={d.name} loading="lazy" className="bb-dest-img" />
              : <div className="bb-dest-img" />}
            <div className="bb-dest-name">{d.name}</div>
          </Link>
        ))}
      </div>
    </>
  )
}

function StateGrid({ mega }: { mega: MegaMenu }) {
  return (
    <>
      <PanelHeading title="Pick a state" cta={{ href: '/states/', label: 'See all states →' }} />
      <div className="bb-state-grid">
        {mega.stateList.map(s => (
          <a key={s.state_code} href={`https://${s.host}/`} className="bb-state-card">
            {s.name}
            <small>{s.stateName}</small>
          </a>
        ))}
      </div>
    </>
  )
}

function ThingsToDo({ scope }: { scope: string }) {
  return (
    <>
      <PanelHeading title={`What to do in ${scope}`} cta={null} />
      <div className="bb-mega-3col">
        <div className="bb-mega-col">
          <h3>Book a tour</h3>
          <Link href="/tours/">Browse all tours<small>Day trips, multi-day, small group</small></Link>
          <Link href="/tours/?cat=day">Day tours<small>Single-day experiences</small></Link>
          <Link href="/tours/?cat=multi">Multi-day & overnight<small>Longer journeys</small></Link>
          <Link href="/tours/?cat=adventure">Adventure & outdoor<small>Hiking, 4WD, water sports</small></Link>
        </div>
        <div className="bb-mega-col">
          <h3>Stay overnight</h3>
          <Link href="/parks/">Caravan & holiday parks<small>Powered, cabins, glamping</small></Link>
          <Link href="/parks/?type=big-rig">Big-rig friendly<small>Drive-thru sites for larger vans</small></Link>
          <Link href="/parks/?type=pets">Pet-friendly parks<small>Bring the four-legged crew</small></Link>
          <Link href="/parks/?type=national">National park camping<small>Inside protected areas</small></Link>
        </div>
        <div className="bb-mega-col">
          <h3>Places to visit</h3>
          <Link href="/places/">All places<small>Attractions, viewpoints, beaches</small></Link>
          <Link href="/places/random">Surprise me<small>Random place to explore</small></Link>
          <Link href="/explore/">Explore the map<small>Visual browse</small></Link>
        </div>
      </div>
    </>
  )
}

function TrainsPanel({ mega, scope, isAggregator }: { mega: MegaMenu; scope: string; isAggregator: boolean }) {
  const national = mega.trains.filter(t => t.is_national && !t.is_heritage)
  const regional = mega.trains.filter(t => !t.is_national && !t.is_heritage)
  const heritage = mega.trains.filter(t => t.is_heritage)
  const cols: Array<{ title: string; items: typeof mega.trains }> = [
    { title: isAggregator ? 'Great rail journeys' : 'Long-distance', items: national.length ? national : regional },
    { title: national.length ? 'Regional services' : 'Heritage & scenic', items: national.length ? regional : heritage },
    { title: 'Heritage & scenic', items: national.length ? heritage : [] },
  ].filter(c => c.items.length)

  return (
    <>
      <PanelHeading
        title={isAggregator ? 'Trains across Australia' : `Trains in ${scope}`}
        cta={{ href: '/trains/', label: 'All trains →' }}
      />
      {mega.trains.length === 0
        ? <p style={{ color: '#6b7280', fontSize: 14 }}>Train guides are on the way.</p>
        : <div className="bb-mega-3col">
            {cols.map(col => (
              <div className="bb-mega-col" key={col.title}>
                <h3>{col.title}</h3>
                {col.items.map(t => (
                  <Link key={t.slug} href={`/trains/${t.slug}/`}>
                    {t.name}
                    {t.route_summary && <small>{t.route_summary}</small>}
                  </Link>
                ))}
              </div>
            ))}
          </div>}
    </>
  )
}

function TravelGuides({ mega, scope }: { mega: MegaMenu; scope: string }) {
  return (
    <>
      <PanelHeading title={`Articles from ${scope}`} cta={{ href: '/articles/', label: 'All articles →' }} />
      <div className="bb-mega-3col">
        {mega.recentArticles.slice(0, 3).map(a => (
          <Link key={a.slug} href={a.legacy_path || `/articles/${a.slug}/`} className="bb-mega-feature">
            {a.cover_image
              ? <img src={a.cover_image} alt={a.title} loading="lazy" />
              : <div style={{ width: '100%', aspectRatio: '16/10', background: '#f1f5f9', borderRadius: 10 }} />}
            <span className="meta">Article</span>
            <h4>{a.title}</h4>
          </Link>
        ))}
      </div>
    </>
  )
}

function AboutPanel({ mega, brandName }: { mega: MegaMenu; brandName: string }) {
  return (
    <>
      <PanelHeading title={`About ${brandName}`} cta={{ href: '/authors/', label: 'Meet the team →' }} />
      <div className="bb-mega-3col">
        <div className="bb-mega-col">
          <h3>The site</h3>
          <Link href="/about/">About us<small>Who we are, what we do</small></Link>
          <Link href="/contact/">Contact<small>Get in touch</small></Link>
          <Link href="/articles/">Travel blog<small>Stories & guides</small></Link>
        </div>
        <div className="bb-mega-col" style={{ gridColumn: 'span 2' }}>
          <h3>Writers</h3>
          {mega.authors.slice(0, 6).map(a => {
            const initials = a.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
            return (
              <Link key={a.slug} href={`/authors/${a.slug}/`} className="bb-author-row">
                <span className="bb-author-av">
                  {a.avatar_url ? <img src={a.avatar_url} alt="" /> : initials}
                </span>
                <span>
                  <span className="bb-author-name">{a.name}</span>
                  {a.role && <span className="bb-author-role">{a.role}</span>}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

function PanelHeading({ title, cta }: { title: string; cta: { href: string; label: string } | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800, color: '#111827' }}>{title}</div>
      {cta && <Link href={cta.href} style={{ color: '#0d9488', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{cta.label}</Link>}
    </div>
  )
}

// --- Mobile drawer ---

function MobileDrawer({ mega, scope, isAggregator, panel, setPanel, onClose }: {
  mega: MegaMenu; scope: string; isAggregator: boolean;
  panel: PanelKey | null; setPanel: (p: PanelKey | null) => void;
  onClose: () => void
}) {
  const linkStyle: React.CSSProperties = { display: 'block', padding: '14px 20px', color: '#111827', fontSize: 15, fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid #f3f4f6' }
  const groupBtnStyle: React.CSSProperties = { ...linkStyle, background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

  if (panel) {
    return (
      <div>
        <button onClick={() => setPanel(null)} style={{ ...groupBtnStyle, color: '#0d9488', fontWeight: 700 }}>
          ← Back
        </button>
        {panel === 'destinations' && (isAggregator
          ? mega.stateList.map(s => (
              <a key={s.state_code} href={`https://${s.host}/`} style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>{s.name}</a>
            ))
          : mega.destinations.map(d => (
              <Link key={d.slug} href={`/destinations/${d.slug}/`} style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>{d.name}</Link>
            ))
        )}
        {panel === 'things' && <>
          <Link href="/tours/"  style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Tours</Link>
          <Link href="/parks/"  style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Caravan & holiday parks</Link>
          <Link href="/places/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Places to visit</Link>
          <Link href="/explore/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Explore the map</Link>
        </>}
        {panel === 'trains' && <>
          <Link href="/trains/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>All trains</Link>
          {mega.trains.map(t => (
            <Link key={t.slug} href={`/trains/${t.slug}/`} style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>{t.name}</Link>
          ))}
        </>}
        {panel === 'guides' && <>
          <Link href="/articles/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>All articles</Link>
          {mega.recentArticles.map(a => (
            <Link key={a.slug} href={a.legacy_path || `/articles/${a.slug}/`} style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>{a.title}</Link>
          ))}
        </>}
        {panel === 'about' && <>
          <Link href="/about/"   style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>About</Link>
          <Link href="/contact/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Contact</Link>
          <Link href="/authors/" style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>Meet the team</Link>
          {mega.authors.slice(0, 6).map(a => (
            <Link key={a.slug} href={`/authors/${a.slug}/`} style={{ ...linkStyle, paddingLeft: 32 }} onClick={onClose}>{a.name}</Link>
          ))}
        </>}
      </div>
    )
  }
  return (
    <div>
      <button onClick={() => setPanel('destinations')} style={groupBtnStyle}>Destinations <span aria-hidden>›</span></button>
      <button onClick={() => setPanel('things')}        style={groupBtnStyle}>Things to do <span aria-hidden>›</span></button>
      <button onClick={() => setPanel('trains')}        style={groupBtnStyle}>Trains <span aria-hidden>›</span></button>
      <button onClick={() => setPanel('guides')}        style={groupBtnStyle}>Travel guides <span aria-hidden>›</span></button>
      <button onClick={() => setPanel('about')}         style={groupBtnStyle}>About <span aria-hidden>›</span></button>
      <Link href="/saved/" style={linkStyle} onClick={onClose}>♡ Saved</Link>
    </div>
  )
}

export default NavbarWrapper
