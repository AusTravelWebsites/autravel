// Compact destination sub-nav — chip bar of category headings, each opening
// a CSS-only dropdown of items in that category. Designed to sit just under
// the destination hero strip without dominating the page (unlike the old
// DestinationSubMenu's grouped mega-grid which pushed all the content panels
// below the fold on busy destinations like Cairns with 70+ subpages).
//
// Behaviour:
//   - Always renders if `groups` has 2+ categories.
//   - Each category is a <details> dropdown opened on click (keyboard + screen
//     reader accessible; no JS).
//   - When a category has only 1 item, render it as a flat chip-link (no dropdown).
//   - The chip row scrolls horizontally on mobile.
import Link from 'next/link'
import type { SubMenuGroup } from '@/lib/destination-submenu'

const C = {
  bg: '#fff',
  border: '#e5e7eb',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  sub: '#64748b',
  accent: 'var(--brand)',
  accentDark: 'var(--brand-dark)',
  accentLight: 'var(--brand-light)',
}

export function DestinationMiniMenu({
  destinationName,
  groups,
  currentPath,
}: {
  destinationName: string
  groups: SubMenuGroup[]
  currentPath?: string | null
}) {
  // Split out the "Overview" link (always first if present) — render flat,
  // and skip any group with no items.
  const overview = groups.find(g => g.group === null)?.items.find(i => i.isOverview)
  const cats = groups.filter(g => g.group && g.items.length > 0)
  if (cats.length < 2) return null

  return (
    <nav
      aria-label={`Explore ${destinationName}`}
      style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        position: 'relative' as const,
        zIndex: 50,
      }}
    >
      <style>{`
        .mini-nav-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 16px;
          align-items: center;
          max-width: 1240px;
          margin: 0 auto;
        }
        .mini-nav-label {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          color: ${C.sub};
          text-transform: uppercase;
          letter-spacing: 1.2px;
          padding: 4px 6px 4px 0;
          white-space: nowrap;
        }
        .mini-nav-chip,
        .mini-nav-cat > summary {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: ${C.text};
          background: ${C.bg};
          border: 1px solid ${C.border};
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          list-style: none;
          transition: color .15s, background .15s, border-color .15s;
        }
        .mini-nav-cat > summary::-webkit-details-marker { display: none; }
        .mini-nav-cat > summary::after {
          content: '▾';
          font-size: 9px;
          opacity: 0.55;
          margin-left: 2px;
        }
        .mini-nav-chip:hover,
        .mini-nav-cat > summary:hover {
          color: ${C.accentDark};
          background: ${C.accentLight};
          border-color: ${C.accent};
        }
        .mini-nav-chip[aria-current="page"],
        .mini-nav-cat[open] > summary {
          background: ${C.accent};
          color: #fff;
          border-color: ${C.accent};
        }
        .mini-nav-cat { position: relative; }
        .mini-nav-cat[open] > summary::after { content: '▴'; opacity: 0.9; }
        .mini-nav-cat-count {
          opacity: 0.75;
          font-weight: 500;
          font-size: 11.5px;
        }
        .mini-nav-cat[open] .mini-nav-cat-count { opacity: 0.95; color: rgba(255,255,255,0.9); }
        .mini-nav-cat-panel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 100;
          min-width: 240px;
          max-width: 340px;
          max-height: 70vh;
          overflow-y: auto;
          background: ${C.bg};
          border: 1px solid ${C.borderStrong};
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 28px -10px rgba(15,23,42,0.18);
        }
        .mini-nav-cat-panel a {
          display: block;
          padding: 6px 10px;
          font-size: 13.5px;
          color: ${C.text};
          text-decoration: none;
          border-radius: 6px;
          line-height: 1.35;
        }
        .mini-nav-cat-panel a:hover { background: ${C.accentLight}; color: ${C.accentDark}; }
        .mini-nav-cat-panel a[aria-current="page"] {
          background: ${C.accentLight};
          color: ${C.accentDark};
          font-weight: 700;
        }
        @media (max-width: 700px) {
          .mini-nav-cat-panel {
            min-width: 200px;
            max-width: calc(100vw - 32px);
            right: auto;
          }
          /* Anchor right-edge dropdowns to the right so they don't overflow the viewport */
          .mini-nav-cat:nth-last-child(-n+2) .mini-nav-cat-panel { left: auto; right: 0; }
        }
      `}</style>
      <div className="mini-nav-row">
        <span className="mini-nav-label">Explore {destinationName}</span>
        {overview && (
          <Link
            href={overview.href}
            className="mini-nav-chip"
            aria-current={currentPath === overview.href ? 'page' : undefined}
          >
            Overview
          </Link>
        )}
        {cats.map(g => {
          // Single-item category — render flat chip instead of dropdown
          if (g.items.length === 1) {
            const it = g.items[0]
            return (
              <Link
                key={g.group}
                href={it.href}
                className="mini-nav-chip"
                aria-current={currentPath === it.href ? 'page' : undefined}
              >
                {g.group}
              </Link>
            )
          }
          return (
            <details key={g.group} className="mini-nav-cat">
              <summary>
                {g.group} <span className="mini-nav-cat-count">{g.items.length}</span>
              </summary>
              <div className="mini-nav-cat-panel">
                {g.items.map(it => (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={currentPath === it.href ? 'page' : undefined}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    </nav>
  )
}
