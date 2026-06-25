import Link from 'next/link'

export type Crumb = { href?: string; label: string }

/**
 * Visible breadcrumbs above detail page heroes. Helps users understand where
 * they are in the hierarchy and gives one-click jumps back up.
 * For SEO, pages render JSON-LD BreadcrumbList separately — this is the
 * visible UI version.
 *
 * Two visual variants:
 *  - "light" (default): white text on dark/photo backgrounds (use inside hero overlays)
 *  - "dark":            slate text on white/grey backgrounds (use above hero on light pages)
 */
export function Breadcrumbs({ crumbs, variant = 'light' }: { crumbs: Crumb[]; variant?: 'light' | 'dark' }) {
  if (crumbs.length === 0) return null
  const linkColor = variant === 'light' ? 'rgba(255,255,255,0.85)' : 'var(--brand)'
  const currentColor = variant === 'light' ? 'rgba(255,255,255,0.6)' : '#6b7280'
  const sepColor = variant === 'light' ? 'rgba(255,255,255,0.45)' : '#9ca3af'
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 600, letterSpacing: 0.4 }}>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {c.href && !isLast
              ? <Link href={c.href} style={{ color: linkColor, textDecoration: 'none' }}>{c.label}</Link>
              : <span style={{ color: isLast ? currentColor : linkColor }} aria-current={isLast ? 'page' : undefined}>{c.label}</span>}
            {!isLast && <span aria-hidden style={{ color: sepColor }}>›</span>}
          </span>
        )
      })}
    </nav>
  )
}
