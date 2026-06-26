// Sub-menu nav for a destination — chip-bar style.
// Appears on the destination overview and every article within that destination.
// Auto-derives items from articles whose legacy_path starts with the dest slug.
//
// Two render modes:
//   - Chip bar (≤15 items): single horizontal scroll bar, sticky-friendly
//   - Grouped (>15 items): grouped vertical layout with category headers
//
// Per Craig: location pages should not look like a blog. This is the "everything
// at this destination" nav that always tells the user what else is here.
import Link from 'next/link'
import type { SubMenuGroup } from '@/lib/destination-submenu'

// Accent follows the per-tenant brand tokens (set on <body> in app/layout.tsx),
// so this nav matches each site — e.g. ochre on Perth/Australian Explorer —
// rather than hardcoding the default teal.
const C = {
  bg: '#f8fafc',
  border: '#e5e7eb',
  text: '#111827',
  sub: '#64748b',
  accent: 'var(--brand)',
  accentDark: 'var(--brand-dark)',
  accentLight: 'var(--brand-light)',
}

export function DestinationSubMenu({
  destinationName,
  groups,
  currentPath,
}: {
  destinationName: string
  groups: SubMenuGroup[]
  currentPath?: string | null
}) {
  if (!groups || groups.length === 0) return null
  const flat = groups.flatMap(g => g.items)
  const total = flat.length
  if (total <= 1) return null

  // Pick render mode — chip bar for small destinations (everything inline,
  // single-line scroll), grouped columns for larger ones (always visible,
  // never behind a click-to-expand).
  const useGrouped = total > 24

  return (
    <nav aria-label={`Sub-menu for ${destinationName}`} style={{
      background: '#fff', borderBottom: `1px solid ${C.border}`,
      boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
    }}>
      <style>{`
        .dest-submenu-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .dest-submenu-scroll::-webkit-scrollbar { height: 4px; }
        .dest-submenu-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        .dest-submenu-chip { transition: color .15s, background .15s, border-color .15s; }
        .dest-submenu-chip:hover { color: ${C.accentDark}; background: ${C.accentLight}; border-color: ${C.accent}; }
        .dest-submenu-chip[aria-current="page"] { background: ${C.accent}; color: #fff; border-color: ${C.accent}; }
        .dest-submenu-grouped a:hover { color: ${C.accentDark}; }
        .dest-submenu-grouped a[aria-current="page"] { color: ${C.accent}; font-weight: 700; border-left-color: ${C.accent} !important; background: ${C.accentLight}; }
      `}</style>

      {useGrouped ? (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 20px 14px' }} className="dest-submenu-grouped">
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 12 }}>
            Everything in {destinationName} <span style={{ color: C.sub, opacity: 0.6, fontWeight: 500 }}>({total})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px 24px' }}>
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.group ? (
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${C.border}` }}>{g.group}</div>
                ) : null}
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {g.items.map(it => (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={currentPath === it.href ? 'page' : undefined}
                        style={{ display: 'block', padding: '4px 8px 4px 10px', fontSize: 13.5, color: C.text, textDecoration: 'none', lineHeight: 1.35, borderLeft: '2px solid transparent', borderRadius: 3 }}
                      >
                        {it.isOverview ? <strong>{it.label}</strong> : it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '10px 12px' }}>
          <div className="dest-submenu-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' as const, padding: '4px 6px', alignItems: 'center' }}>
            {flat.map(it => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={currentPath === it.href ? 'page' : undefined}
                className="dest-submenu-chip"
                style={{
                  display: 'inline-block', padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', background: '#fff',
                  whiteSpace: 'nowrap' as const, flexShrink: 0,
                }}
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

/** A richer "hub" block for the destination overview — shows the full menu
 *  as a grouped grid below the hero, so the overview page acts as a pillar. */
export function DestinationHubGrid({
  destinationName,
  groups,
}: {
  destinationName: string
  groups: SubMenuGroup[]
}) {
  if (!groups || groups.length < 2) return null
  const linkGroups = groups.slice(1) // skip the "Overview" group
  if (linkGroups.length === 0) return null

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 18 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 4px', color: C.text }}>
        Everything in {destinationName}
      </h2>
      <p style={{ fontSize: 13, color: C.sub, margin: '0 0 18px' }}>
        Browse every guide, listing and how-to for {destinationName}.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
        {linkGroups.map((g, gi) => (
          <div key={gi}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.accentDark, textTransform: 'uppercase' as const, letterSpacing: 1.1, margin: '0 0 10px' }}>
              {g.group}
              <span style={{ color: C.sub, fontWeight: 500, marginLeft: 6 }}>({g.items.length})</span>
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
              {g.items.slice(0, 8).map(it => (
                <li key={it.href}>
                  <Link href={it.href} style={{ display: 'inline-block', color: C.text, textDecoration: 'none', fontSize: 14, padding: '3px 0', borderBottom: '1px solid transparent' }}>
                    {it.label}
                  </Link>
                </li>
              ))}
              {g.items.length > 8 && (
                <li><span style={{ fontSize: 12, color: C.sub }}>+ {g.items.length - 8} more</span></li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
