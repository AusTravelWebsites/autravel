'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type TenantStats = {
  state_code: string
  d: number; p: number; t: number; a: number; r: number
  n404: number; redirect_hits: number; recent_404s: number
}
type Activity = { admin_user: string; action: string; target_type: string; target_id: string; details: any; created_at: string }
type Top404 = { state_code: string; path: string; hit_count: number; last_seen_at: string }

const STATE_LABELS: Record<string, string> = {
  qld: 'QLD', nsw: 'NSW', vic: 'VIC', wa: 'WA', sa: 'SA', tas: 'TAS', nt: 'NT', aunz: 'AU/NZ'
}

const S = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 24px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' } as React.CSSProperties,
  cardTitle: { fontSize: 15, fontWeight: 700, margin: '0 0 10px' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f9fafb' },
  td: { padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const },
}

export default function Dashboard() {
  const [data, setData] = useState<{ perTenant: TenantStats[]; activity: Activity[]; top404s: Top404[]; users: { n: number; admins: number; banned: number } } | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div style={S.page}>Loading dashboard…</div>

  const totals = data.perTenant.reduce((a, r) => ({
    d: a.d + r.d, p: a.p + r.p, t: a.t + r.t, a: a.a + r.a, r: a.r + r.r, n404: a.n404 + r.n404, redirect_hits: a.redirect_hits + r.redirect_hits
  }), { d: 0, p: 0, t: 0, a: 0, r: 0, n404: 0, redirect_hits: 0 })

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Dashboard</h1>
      <p style={S.sub}>Content + SEO at a glance across all 8 Australian travel sites.</p>

      {/* Total cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Destinations', n: totals.d, href: '/admin/destinations', color: '#0d9488' },
          { label: 'Caravan parks', n: totals.p, href: '/admin/parks', color: '#059669' },
          { label: 'Tours', n: totals.t, href: '/admin/tours', color: '#0891b2' },
          { label: 'Articles', n: totals.a, href: '/admin/articles', color: '#7c3aed' },
          { label: 'Users', n: data.users.n, href: '/admin/users', color: '#ec4899', sub: `${data.users.admins} admins · ${data.users.banned} banned` },
          { label: 'Redirects', n: totals.r, href: '/admin/redirects', color: '#f59e0b', sub: `${totals.redirect_hits.toLocaleString()} total hits` },
          { label: '404 errors', n: totals.n404, href: '/admin/404s', color: '#ef4444' },
        ].map(c => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...S.card, borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#111', marginTop: 4 }}>{c.n.toLocaleString()}</div>
              {c.sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{c.sub}</div>}
            </div>
          </Link>
        ))}
      </div>

      {/* Per-tenant table */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.cardTitle}>Per-tenant content</div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
          Click any cell to jump into that section filtered to the tenant — search from there to find the page you want to edit.
        </p>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={S.th}>Tenant</th>
                <th style={S.th}>Destinations</th>
                <th style={S.th}>Parks</th>
                <th style={S.th}>Tours</th>
                <th style={S.th}>Articles</th>
                <th style={S.th}>Redirects</th>
                <th style={S.th}>Redirect hits</th>
                <th style={S.th}>404s (7d)</th>
              </tr>
            </thead>
            <tbody>
              {data.perTenant.map(r => {
                const tdLink = (href: string, content: React.ReactNode, bold = false): React.ReactNode => (
                  <td style={{ ...S.td, padding: 0 }}>
                    <Link href={href} style={{ display: 'block', padding: '6px 10px', color: '#0d9488', textDecoration: 'none', fontWeight: bold ? 700 : undefined }}>
                      {content}
                    </Link>
                  </td>
                )
                const tenantLabel = STATE_LABELS[r.state_code] || r.state_code.toUpperCase()
                return (
                  <tr key={r.state_code} style={{ transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    {tdLink(`/admin/articles?state=${r.state_code}`, tenantLabel, true)}
                    {tdLink(`/admin/destinations?state=${r.state_code}`, r.d.toLocaleString())}
                    {tdLink(`/admin/parks?state=${r.state_code}`, r.p.toLocaleString())}
                    {tdLink(`/admin/tours?state=${r.state_code}`, r.t.toLocaleString())}
                    {tdLink(`/admin/articles?state=${r.state_code}`, r.a.toLocaleString())}
                    {tdLink(`/admin/redirects?state=${r.state_code}`, r.r.toLocaleString())}
                    {tdLink(`/admin/redirects?state=${r.state_code}`, r.redirect_hits.toLocaleString())}
                    {tdLink(`/admin/404s?state=${r.state_code}`, r.recent_404s.toLocaleString())}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        {/* Top 404s */}
        <div style={S.card}>
          <div style={S.cardTitle}>Top 404s this week</div>
          {data.top404s.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 13 }}>No 404s logged in the last 7 days. Clean.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead><tr><th style={S.th}>Path</th><th style={S.th}>Tenant</th><th style={S.th}>Hits</th></tr></thead>
                <tbody>
                  {data.top404s.map((r, i) => (
                    <tr key={i}>
                      <td style={S.td}><Link href={`/admin/404s?state=${r.state_code}`} style={{ color: '#0d9488', textDecoration: 'none' }}><code style={{ fontSize: 12 }}>{r.path}</code></Link></td>
                      <td style={S.td}>{STATE_LABELS[r.state_code] || r.state_code}</td>
                      <td style={S.td}><b>{r.hit_count.toLocaleString()}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>

        {/* Recent admin activity */}
        <div style={S.card}>
          <div style={S.cardTitle}>Recent admin activity</div>
          {data.activity.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 13 }}>No admin activity logged yet.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead><tr><th style={S.th}>When</th><th style={S.th}>Who</th><th style={S.th}>What</th></tr></thead>
                <tbody>
                  {data.activity.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={S.td}>{r.admin_user}</td>
                      <td style={S.td}><code style={{ fontSize: 12 }}>{r.action}</code> {r.target_type && <span style={{ color: '#6b7280', fontSize: 11 }}>on {r.target_type}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      </div>
    </div>
  )
}
