'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

const navGroups: Array<{ heading: string; items: Array<{ href: string; label: string; exact?: boolean }> }> = [
  { heading: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', exact: true },
    { href: '/admin/monitor', label: 'Monitor' },
  ]},
  { heading: 'Content', items: [
    { href: '/admin/destinations', label: 'Destinations' },
    { href: '/admin/parks',        label: 'Caravan parks' },
    { href: '/admin/tours',        label: 'Tours' },
    { href: '/admin/articles',     label: 'Articles' },
    { href: '/admin/places',       label: 'Places' },
    { href: '/admin/authors',      label: 'Authors' },
    { href: '/admin/snippets',     label: 'Head/body snippets' },
  ]},
  { heading: 'SEO & URLs', items: [
    { href: '/admin/redirects', label: 'Redirects' },
    { href: '/admin/404s',      label: '404 log' },
  ]},
  { heading: 'Users', items: [
    { href: '/admin/users',      label: 'All users' },
    { href: '/admin/moderation', label: 'Moderation' },
    { href: '/admin/reports',    label: 'Reports' },
    { href: '/admin/blocklist',  label: 'Blocklist' },
    { href: '/admin/signins',    label: 'Sign-ins' },
    { href: '/admin/online',     label: 'Online now' },
  ]},
  { heading: 'Site', items: [
    { href: '/admin/settings',        label: 'Site settings' },
    { href: '/admin/actions',         label: 'Audit log' },
    { href: '/admin/client-errors',   label: 'Client errors' },
    { href: '/admin/csp-violations',  label: 'CSP violations' },
  ]},
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  const isPublicAuthPath = (
    pathname === '/admin/login' || pathname === '/admin/login/' ||
    pathname === '/admin/forgot-password' || pathname === '/admin/forgot-password/' ||
    pathname === '/admin/reset-password' || pathname === '/admin/reset-password/'
  )
  useEffect(() => {
    if (isPublicAuthPath) { setChecking(false); return }
    fetch('/api/admin/check')
      .then(r => { if (!r.ok) router.replace('/admin/login/'); else setChecking(false) })
      .catch(() => router.replace('/admin/login/'))
  }, [router, isPublicAuthPath])

  // Login + forgot/reset pages render standalone (no admin chrome), bypass auth check
  if (isPublicAuthPath) return <>{children}</>

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
      <div style={{ color: '#6b7280', fontSize: 14 }}>Checking admin access…</div>
    </div>
  )

  return (
    <div className="bb-admin-shell" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f3f4f6' }}>
      <style>{`
        @media (max-width: 768px) {
          .bb-admin-shell { flex-direction: column !important; }
          .bb-admin-side { width: 100% !important; position: static !important; height: auto !important; }
          .bb-admin-side nav { display: flex !important; overflow-x: auto !important; gap: 2px; padding: 6px 8px !important; }
          .bb-admin-side nav a { white-space: nowrap !important; padding: 8px 12px !important; border-left: none !important; border-bottom: 3px solid transparent !important; flex-shrink: 0; }
          .bb-admin-side nav a[data-active="1"] { border-bottom-color: var(--brand) !important; border-left-color: transparent !important; }
          .bb-admin-side .bb-admin-foot { display: none !important; }
          .bb-admin-side .bb-admin-heading { display: none !important; }
        }
      `}</style>
      <aside className="bb-admin-side" style={{ width: 240, background: '#1a2332', color: '#fff', display: 'flex', flexDirection: 'column' as const, flexShrink: 0, position: 'sticky' as const, top: 0, height: '100vh', overflow: 'auto' as const }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>autravel</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Admin</div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navGroups.map(g => (
            <div key={g.heading}>
              <div className="bb-admin-heading" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, padding: '10px 16px 4px' }}>{g.heading}</div>
              {g.items.map(item => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} data-active={active ? '1' : '0'} style={{
                    display: 'block', padding: '7px 16px', fontSize: 13,
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                    background: active ? 'rgba(13, 148, 136, 0.25)' : 'transparent',
                    textDecoration: 'none', borderLeft: active ? '3px solid #14b8a6' : '3px solid transparent',
                  }}>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="bb-admin-foot" style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>← Back to site</Link>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' as const }}>
        {children}
      </main>
    </div>
  )
}
