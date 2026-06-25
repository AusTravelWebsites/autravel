'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /** Visible placeholder text — varies by tenant scope. */
  placeholder?: string
  /** Initial value (used on the /search/ page to round-trip the q query). */
  initialValue?: string
  /** Render style. "hero" = light, oversized, for homepages/heroes. "page" = page-search style for /search/. */
  variant?: 'hero' | 'page'
  /** Optional: render suggestion chips below the input. */
  suggestions?: Array<{ label: string; href: string }>
  /** Auto-focus on mount. Set true on /search/ page so users land in the input. */
  autoFocus?: boolean
}

/**
 * Big, centred search affordance. Used in the homepage hero and on /search/.
 * Submits to /search/?q=… and centralises the styling so all the entry points feel the same.
 */
export function HeroSearch({ placeholder = 'Search destinations, parks, tours…', initialValue = '', variant = 'hero', suggestions, autoFocus = false }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(initialValue)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search/?q=${encodeURIComponent(trimmed)}`)
  }

  const isHero = variant === 'hero'

  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <form onSubmit={onSubmit}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          background: '#fff',
          borderRadius: 14,
          padding: 6,
          boxShadow: isHero ? '0 10px 30px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.06)',
          border: isHero ? 'none' : '1px solid #e5e7eb',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 14, color: '#6b7280' }} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
        </div>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          autoFocus={autoFocus}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '12px 14px',
            fontSize: 16,
            background: 'transparent',
            color: '#111827',
            fontFamily: 'inherit',
            minWidth: 0,
          }}
        />
        <button type="submit"
          style={{
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}>
          Search
        </button>
      </form>
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 12, color: isHero ? 'rgba(255,255,255,0.85)' : '#6b7280', alignSelf: 'center' as const, marginRight: 4, fontWeight: 600 }}>Popular:</span>
          {suggestions.map(s => (
            <a key={s.href} href={s.href}
              style={{
                padding: '5px 12px',
                background: isHero ? 'rgba(255,255,255,0.15)' : '#fff',
                color: isHero ? '#fff' : 'var(--brand)',
                border: isHero ? '1px solid rgba(255,255,255,0.4)' : '1px solid #e5e7eb',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: 'none',
                backdropFilter: isHero ? 'blur(4px)' as any : undefined,
              }}>
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
