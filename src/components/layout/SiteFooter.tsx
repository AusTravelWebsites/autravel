'use client'
import Link from 'next/link'
import { useState } from 'react'

interface FooterBrand {
  name: string
  scope: string         // "Queensland", "New South Wales", etc.
  tagline: string
}
interface FooterAuthor { slug: string; name: string }
interface FooterDest   { slug: string; name: string }

export function SiteFooter({
  brand = { name: 'Autravel', scope: 'Australia', tagline: '' },
  authors = [],
  topDestinations = [],
}: {
  brand?: FooterBrand
  authors?: FooterAuthor[]
  topDestinations?: FooterDest[]
} = {}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const year = new Date().getFullYear()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !/.+@.+\..+/.test(email)) { setState('error'); return }
    setState('submitting')
    try {
      const r = await fetch('/api/newsletter/subscribe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      setState(r.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  const openCookies = (e: React.MouseEvent) => {
    e.preventDefault()
    if (typeof window !== 'undefined' && typeof (window as any).openCookieSettings === 'function') {
      (window as any).openCookieSettings()
    }
  }

  return (
    <footer style={{ background: '#111827', color: '#e5e7eb', marginTop: 56 }}>
      <style>{`
        .bb-foot-grid { max-width: 1200px; margin: 0 auto; padding: 56px 24px 28px; display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 36px; }
        .bb-foot-col h4 { font-size: 11px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: 800; color: #fff; margin: 0 0 18px; }
        .bb-foot-col a { display: block; color: #cbd5e1; text-decoration: none; padding: 4px 0; font-size: 14px; line-height: 1.5; transition: color 0.15s; }
        .bb-foot-col a:hover { color: #5eead4; }
        .bb-foot-brand { color: #fff; font-family: Georgia, serif; font-weight: 800; font-size: 24px; letter-spacing: -0.5px; margin: 0 0 8px; display: inline-block; }
        .bb-foot-tag { color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0 0 14px; max-width: 320px; }
        .bb-newsletter-row { background: var(--brand); }
        .bb-newsletter-inner { max-width: 1200px; margin: 0 auto; padding: 26px 24px; display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: center; }
        .bb-newsletter-inner h3 { color: #fff; margin: 0 0 4px; font-family: Georgia, serif; font-weight: 800; font-size: 22px; }
        .bb-newsletter-inner p { color: #ccfbf1; font-size: 14px; margin: 0; line-height: 1.5; }
        .bb-newsletter-form { display: flex; gap: 8px; min-width: 360px; }
        .bb-newsletter-form input { flex: 1; background: #fff; border: none; padding: 12px 16px; border-radius: 10px; font-size: 14px; outline: none; min-width: 0; font-family: inherit; }
        .bb-newsletter-form button { background: #042f2e; color: #fff; border: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
        .bb-newsletter-form button:hover { background: #064e3b; }
        .bb-bottom-bar { border-top: 1px solid #1f2937; }
        .bb-bottom-inner { max-width: 1200px; margin: 0 auto; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; font-size: 12px; color: #94a3b8; }
        .bb-bottom-inner a { color: #94a3b8; text-decoration: none; }
        .bb-bottom-inner a:hover { color: #5eead4; }
        .bb-bottom-links { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 900px) {
          .bb-foot-grid { grid-template-columns: 1fr 1fr; gap: 28px; padding: 44px 20px 24px; }
          .bb-newsletter-inner { grid-template-columns: 1fr; }
          .bb-newsletter-form { min-width: 0; width: 100%; }
        }
        @media (max-width: 560px) {
          .bb-foot-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Newsletter row */}
      <div className="bb-newsletter-row">
        <div className="bb-newsletter-inner">
          <div>
            <h3>Get the {brand.name} monthly</h3>
            <p>One email a month — what's on, where to go, what we've added. No spam, unsubscribe anytime.</p>
          </div>
          {state === 'done' ? (
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>✓ Thanks — you're subscribed.</div>
          ) : (
            <form onSubmit={submit} className="bb-newsletter-form">
              <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setState('idle') }} placeholder="Your email address" />
              <button type="submit" disabled={state === 'submitting'}>
                {state === 'submitting' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          {state === 'error' && <div style={{ color: '#fff', fontSize: 12, gridColumn: '1 / -1' }}>Couldn't subscribe — please check your email and try again.</div>}
        </div>
      </div>

      {/* Main 4-column grid */}
      <div className="bb-foot-grid">
        {/* Brand + intro */}
        <div className="bb-foot-col">
          <Link href="/" className="bb-foot-brand">{brand.name}</Link>
          <p className="bb-foot-tag">{brand.tagline}</p>
          <p className="bb-foot-tag" style={{ marginTop: -4 }}>Independent travel guides, caravan parks, tours and writers across {brand.scope}.</p>
        </div>

        {/* Explore */}
        <div className="bb-foot-col">
          <h4>Explore</h4>
          <Link href="/destinations/">Destinations</Link>
          <Link href="/tours/">Tours</Link>
          <Link href="/parks/">Caravan parks</Link>
          <Link href="/places/">Places</Link>
          <Link href="/articles/">All articles</Link>
          <Link href="/explore/">Map view</Link>
          <Link href="/saved/">My saved</Link>
        </div>

        {/* Top destinations */}
        <div className="bb-foot-col">
          <h4>Top destinations</h4>
          {topDestinations.slice(0, 8).map(d => (
            <Link key={d.slug} href={`/${d.slug}/`}>{d.name}</Link>
          ))}
          {topDestinations.length === 0 && <Link href="/destinations/">Browse all →</Link>}
        </div>

        {/* About */}
        <div className="bb-foot-col">
          <h4>About</h4>
          <Link href="/about/">About {brand.name}</Link>
          <Link href="/authors/">Meet the team</Link>
          <Link href="/contact/">Contact</Link>
          {authors.slice(0, 3).map(a => (
            <Link key={a.slug} href={`/authors/${a.slug}/`}>{a.name}</Link>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bb-bottom-bar">
        <div className="bb-bottom-inner">
          <div>© {year} {brand.name}. All rights reserved.</div>
          <nav className="bb-bottom-links">
            <Link href="/privacy/">Privacy</Link>
            <Link href="/terms/">Terms</Link>
            <Link href="/cookies/">Cookies</Link>
            <a href="#" onClick={openCookies}>Cookie settings</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
