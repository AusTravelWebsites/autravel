import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { NavbarWrapper } from '@/components/layout/NavbarWrapper'
import { CookieConsent } from '@/components/legal/CookieConsent'
import { SiteFooter } from '@/components/layout/SiteFooter'
import ClientErrorReporter from '@/components/features/ClientErrorReporter'
import db from '@/lib/db'
import { getTenant } from '@/lib/get-tenant'
import { TENANTS, ALL_STATE_CODES } from '@/lib/tenants'
import { loadMegaMenu } from '@/lib/mega-menu'

const sora = Inter({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['400','500','600','700','800'] })
const dmSans = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap', weight: ['300','400','500','600'] })

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const SITE_URL = `https://${tenant.host}`
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const title = `${tenant.name} — Tours, caravan parks & destination guides`
  const description = `Plan your trip across ${scope}: hand-picked tours, caravan parks, destination guides and travel articles from ${tenant.name}.`
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${tenant.name}` },
    description,
    applicationName: tenant.name,
    keywords: [tenant.stateName, 'travel', 'tours', 'caravan parks', 'holiday parks', 'destinations', 'attractions', 'things to do'],
    authors: [{ name: tenant.name }],
    creator: tenant.name,
    publisher: tenant.name,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    alternates: { canonical: SITE_URL },
    manifest: '/manifest.webmanifest',
    openGraph: {
      type: 'website',
      siteName: tenant.name,
      title,
      description: tenant.tagline,
      url: SITE_URL,
      images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: tenant.name }],
      locale: (tenant.locale ?? 'en-AU').replace('-', '_'),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: tenant.tagline,
      images: [tenant.ogImage],
    },
    icons: { icon: tenant.ogImage, apple: tenant.ogImage },
  }
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d9488' }

import { unstable_cache } from 'next/cache'

// Snippets are tenant-scoped (different GA4 ID etc. per site). Rows with
// NULL state_code apply globally across every tenant.
//
// Two-layer caching:
//   1. unstable_cache → 5-min server cache so repeat renders don't query DB
//   2. In-memory fallback cache → if the DB is down, serve the last-known
//      value (or empty string) for 60s instead of slamming Supavisor with
//      one failed connection per layout render. Without this, every page on
//      every tenant fires 3 failed queries (head/body_start/body_end) while
//      the DB is degraded, which is enough to keep Supavisor's circuit
//      breaker permanently tripped.
const snippetFallback = new Map<string, { code: string; until: number }>()
async function fetchSnippetsRaw(location: string, state: string | null): Promise<string> {
  const key = `${location}|${state || ''}`
  try {
    const rows = await db`
      SELECT code FROM site_snippets
      WHERE location = ${location}
        AND is_active = true
        AND (state_code = ${state} OR state_code IS NULL)
      ORDER BY state_code NULLS LAST, created_at`
    const out = rows.map((r: { code: string }) => r.code).join('\n')
    snippetFallback.set(key, { code: out, until: Date.now() + 5 * 60_000 })
    return out
  } catch (e) {
    const cached = snippetFallback.get(key)
    if (cached && cached.until > Date.now()) return cached.code
    // Suppress per-request log spam: remember last-failed time per key.
    const failKey = `__fail_${key}`
    const lastFail = snippetFallback.get(failKey)?.until || 0
    if (Date.now() - lastFail > 60_000) {
      console.warn('[getSnippets] DB unavailable, serving empty', location, state)
      snippetFallback.set(failKey, { code: '', until: Date.now() })
    }
    return ''
  }
}
async function getSnippets(location: string, state: string | null): Promise<string> {
  return fetchSnippetsRaw(location, state)
}

// Parse arbitrary head HTML into individual <script> React elements so we
// don't wrap them in a <div> (which is invalid inside <head> and forces the
// browser to end head parsing early).
function HeadSnippets({ html }: { html: string }) {
  if (!html) return null
  const scripts: Array<{ src?: string; async: boolean; defer: boolean; type?: string; content?: string }> = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1]
    const content = m[2]
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)
    scripts.push({
      src: srcMatch?.[1],
      async: /\basync\b/i.test(attrs),
      defer: /\bdefer\b/i.test(attrs),
      type: typeMatch?.[1],
      content: content.trim() || undefined,
    })
  }
  return (
    <>
      {scripts.map((s, i) =>
        s.src ? (
          <script key={i} src={s.src} async={s.async} defer={s.defer} type={s.type} />
        ) : s.content ? (
          <script key={i} type={s.type} dangerouslySetInnerHTML={{ __html: s.content }} />
        ) : null
      )}
    </>
  )
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant()
  const [headCode, bodyStartCode, bodyEndCode] = await Promise.all([
    getSnippets('head', tenant.state_code),
    getSnippets('body_start', tenant.state_code),
    getSnippets('body_end', tenant.state_code),
  ])
  const SITE_URL = `https://${tenant.host}`

  // Mega-menu data — destinations / recent articles / authors for the current
  // tenant; the state-picker only populates on the aggregator tenant.
  const stateList = ALL_STATE_CODES
    .filter(c => c !== 'aunz')
    .map(c => ({ host: TENANTS[c].host, name: TENANTS[c].name, stateName: TENANTS[c].stateName, state_code: c }))
  const mega = await loadMegaMenu(tenant, stateList)

  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const brand = { name: tenant.name, homeHref: '/' }

  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* Per-tenant OG images aren't uploaded to R2 yet; skip the preload so
            we don't ship a broken 404 to every browser. When R2 is set up and
            the brand images land at tenant.ogImage, re-add this preload. */}
        <meta name="format-detection" content="telephone=no" />
        {/* Google Consent Mode v2 — default everything DENIED until user consents. MUST run before gtag.js. */}
        <script dangerouslySetInnerHTML={{ __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500,
});
try {
  var m = document.cookie.match(/(?:^|; )bb-consent=([^;]+)/);
  if (m) {
    var p = JSON.parse(decodeURIComponent(m[1]));
    gtag('consent', 'update', {
      ad_storage: p.marketing ? 'granted' : 'denied',
      ad_user_data: p.marketing ? 'granted' : 'denied',
      ad_personalization: p.marketing ? 'granted' : 'denied',
      analytics_storage: p.analytics ? 'granted' : 'denied',
    });
  }
} catch(e) {}
        ` }} />
        {/* Analytics / tracking tags (GA4, Meta Pixel, etc.) are managed via
            /admin/snippets (location=head). Consent bootstrap above runs first,
            so admin-added tags pick up the correct consent state. */}
        <HeadSnippets html={headCode} />
      {/* Per-tenant Organization + WebSite + SearchAction JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${SITE_URL}/#org`,
            name: tenant.name,
            url: SITE_URL,
            logo: tenant.ogImage,
            sameAs: [],
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: SITE_URL,
            name: tenant.name,
            description: tenant.tagline,
            publisher: { '@id': `${SITE_URL}/#org` },
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
              'query-input': 'required name=search_term_string',
            },
          },
        ],
      }) }} />
      </head>
      <body className="font-body antialiased min-h-screen" suppressHydrationWarning style={{background:"#f3f4f6"}}>
        {/* Head snippets rendered at body start  scripts/styles work from here too */}
        {bodyStartCode && (
          <div id="bb-body-start" dangerouslySetInnerHTML={{ __html: bodyStartCode }} />
        )}
        <NavbarWrapper brand={brand} scope={scope} isAggregator={tenant.aggregator} mega={mega} tenantCode={tenant.state_code} />
        {children}
        <SiteFooter
          brand={{ name: tenant.name, scope, tagline: tenant.tagline }}
          authors={mega.authors.slice(0, 4).map(a => ({ slug: a.slug, name: a.name }))}
          topDestinations={mega.destinations.slice(0, 8).map(d => ({ slug: d.slug, name: d.name }))}
        />
        <CookieConsent />
        <ClientErrorReporter />
        {bodyEndCode && (
          <div id="bb-body-end" dangerouslySetInnerHTML={{ __html: bodyEndCode }} />
        )}
      </body>
    </html>
  )
}
