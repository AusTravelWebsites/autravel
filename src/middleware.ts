import { NextRequest, NextResponse } from 'next/server'
import { tenantForHost } from '@/lib/tenants'

const PROTECTED = ['/admin']

// Community / auth surface inherited from the bugbitten fork that autravel
// does not use. Pages → 404. APIs → 404 JSON. Centralised here so re-enabling
// a route is a one-line change.
const COMMUNITY_PAGES = [
  '/login', '/signup', '/onboarding', '/verify',
  '/settings', '/notifications', '/user-data', '/unsubscribe',
  '/meetups', '/auto-meetups',
  '/friends', '/messages',
  '/trips',
  '/channels',
  '/favourites',
  '/feed',
  '/check-in', '/journal-entries',
  '/my-reviews',
  '/billing',
  '/u',
]
// /api/auth/admin-login + /api/auth/admin-logout are exempt — autravel-only
// admin auth path that bypasses Firebase entirely.
const COMMUNITY_APIS = [
  '/api/auth/magic-link', '/api/auth/session', '/api/auth/upsert',
  '/api/meetups', '/api/meetup-ratings', '/api/auto-meetups',
  '/api/users', '/api/me', '/api/travels',
  '/api/messages', '/api/conversations',
  '/api/friends', '/api/follows', '/api/blocks',
  '/api/notifications', '/api/presence',
  '/api/trips', '/api/journal-entries', '/api/checkins',
  '/api/channels',
  '/api/favourites', '/api/feed',
  '/api/comments',
  '/api/invites', '/api/reports',
  '/api/unsubscribe', '/api/delete-request', '/api/newsletter',
]

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Legacy WordPress RSS: old sites served their feed at /feed/. On autravel the
  // social "/feed" page is part of the gated community surface (404'd below), so
  // map the legacy RSS URL straight onto the generated feed at /feed.xml. A
  // rewrite keeps the original /feed/ URL intact (preserves old URL structure).
  if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/feed' || pathname === '/feed/')) {
    return NextResponse.rewrite(new URL('/feed.xml', req.url))
  }

  // Hard-404 the community surface on every method (GET/POST/PATCH/DELETE).
  if (matchesPrefix(pathname, COMMUNITY_APIS)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (matchesPrefix(pathname, COMMUNITY_PAGES)) {
    return NextResponse.rewrite(new URL('/404', req.url))
  }

  const method = req.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return NextResponse.next()
  }

  // Edge-runtime presence check only; the route handler runs proper HMAC
  // verification on the signed value.
  const adminCookie = req.cookies.get('__autravel_admin')?.value

  // Resolve tenant from host and stamp it on the request + response so every
  // server component / API route can read it via `headers()`.
  const host = req.headers.get('host') || ''
  const tenant = tenantForHost(host)

  // www → apex 301 redirect. Every tenant's canonical host is the apex (see
  // tenants.ts `host` vs `aliases`). Internal absolute refs (article cover
  // URLs, OG images, etc.) are all written for apex, so when a user lands
  // on www.<tenant> the page-origin (www) and image-origin (apex) differ and
  // CSP `img-src 'self'` blocks the images. Forcing apex collapses both
  // origins together, fixes the cross-origin block, and consolidates link
  // equity onto one canonical host. Only redirect GET/HEAD (POST/etc handled
  // above), and only the host part — preserve path + query.
  if (host.toLowerCase().startsWith('www.') && host.toLowerCase().slice(4) === tenant.host.toLowerCase()) {
    // Build the redirect target by hand — using `new URL(req.nextUrl.toString())`
    // and mutating `.host` carries through the internal port (Next.js listens
    // on :3001 behind haproxy + LiteSpeed) into the Location header, which
    // breaks the browser-side redirect. We only want scheme + apex host + path
    // + search.
    const target = `https://${tenant.host}${req.nextUrl.pathname}${req.nextUrl.search}`
    return NextResponse.redirect(target, 308)
  }

  // Trails feature routing. A trails-enabled tenant exposes the walks/trails
  // explorer at its own public path (tenant.trailsRoute); the implementation
  // lives at the single physical /park-maps route. Map the tenant's public path
  // onto it, and hide the physical /park-maps path on tenants that publish under
  // a different path so there's no duplicate-URL exposure. Tenants with no
  // trailsRoute fall through and the page itself 404s.
  const tr = tenant.trailsRoute
  if (tr && tr !== '/park-maps') {
    if (pathname === tr || pathname.startsWith(tr + '/')) {
      const dest = req.nextUrl.clone()
      dest.pathname = '/park-maps' + pathname.slice(tr.length)
      const rwHeaders = new Headers(req.headers)
      rwHeaders.set('x-tenant', tenant.state_code)
      const r = NextResponse.rewrite(dest, { request: { headers: rwHeaders } })
      r.headers.set('x-tenant', tenant.state_code)
      return r
    }
    if (pathname === '/park-maps' || pathname.startsWith('/park-maps/')) {
      return NextResponse.rewrite(new URL('/404', req.url))
    }
  }

  // Redirect lookup. Tenant-scoped. We include `.html` / `.php` style legacy
  // URLs (very common for older WordPress + static-template sites) — only
  // true static assets (images/CSS/JS/fonts) are skipped.
  const isStaticAsset = /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|otf|xml|txt|json)$/i.test(pathname)
  // NOTE: general DB-backed redirect lookups used to happen here via a
  // fetch-to-self, but Next.js middleware's edge runtime can't reliably
  // reach the same origin (it hits Cloudflare and fails). The .html → /slug/
  // case is now handled inside the [...legacy] catch-all via redirect(),
  // which runs in the normal Node runtime and can redirect with a proper 301.
  //
  // For arbitrary DB-driven redirects (admin-configured), the catch-all also
  // does a redirects-table lookup before rendering the article.

  // /admin/login + /admin/forgot-password + /admin/reset-password must stay
  // reachable without a cookie (the recovery surface).
  const isAdminPublic = (
    pathname === '/admin/login' || pathname.startsWith('/admin/login/') ||
    pathname === '/admin/forgot-password' || pathname.startsWith('/admin/forgot-password/') ||
    pathname === '/admin/reset-password' || pathname.startsWith('/admin/reset-password/')
  )
  const isProtected = !isAdminPublic && PROTECTED.some(p => pathname.startsWith(p))
  if (isProtected && !adminCookie) {
    return NextResponse.redirect(new URL('/admin/login/', req.url))
  }

  // Forward tenant to the server pipeline via a request header.
  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-tenant', tenant.state_code)

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  res.headers.set('x-tenant', tenant.state_code)
  return res
}

// Match every request EXCEPT clearly-static asset paths. .html and .php
// style URLs MUST pass through so the redirect middleware can 301 them.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf)$).*)',
  ],
}
