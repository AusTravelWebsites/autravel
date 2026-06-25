type AffiliateLinks = {
  booking?: string         // Booking.com Partner deep link (accommodation)
  cruise_com?: string      // Cruise.com / CruiseDirect (ocean cruise lines)
  captain_cook?: string    // Captain Cook Cruises direct (via Awin / SeaLink)
  direct?: string          // Property/operator direct booking
  [k: string]: string | undefined
}

const BRAND_LABELS: Record<string, { cta: string; brand: string }> = {
  booking:      { cta: 'Check rates & book',     brand: 'Booking.com' },
  cruise_com:   { cta: 'Compare cruise prices',  brand: 'Cruise.com' },
  captain_cook: { cta: 'Book direct',            brand: 'Captain Cook Cruises' },
  direct:       { cta: 'Book direct',            brand: 'the operator' },
}

const ORDER: Array<keyof typeof BRAND_LABELS> = ['direct', 'captain_cook', 'cruise_com', 'booking']

export function DirectAffiliateCTA({ links, label }: { links: AffiliateLinks | null | undefined; label?: string }) {
  if (!links) return null
  const entries = ORDER
    .filter(k => typeof links[k] === 'string' && (links[k] as string).startsWith('http'))
    .map(k => ({ key: k, url: links[k] as string, ...BRAND_LABELS[k] }))
  if (!entries.length) return null

  return (
    <section style={{ marginTop: 24, padding: '20px 22px', background: 'linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%)', borderRadius: 12, color: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 12 }}>
        {label || 'Book this experience'}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {entries.map(e => (
          <a key={e.key} href={e.url} rel="sponsored nofollow noopener" target="_blank"
             style={{ display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '12px 16px', background: '#fff', color: 'var(--brand-dark)', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
            <span>{e.cta} <span style={{ fontWeight: 500, color: '#6b7280', fontSize: 13 }}>on {e.brand}</span></span>
            <span aria-hidden>→</span>
          </a>
        ))}
      </div>
    </section>
  )
}
