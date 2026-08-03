/** @type {import("next").NextConfig} */

// Content-Security-Policy in REPORT-ONLY mode. Browsers will send violation
// reports to /api/csp-report but won't block anything yet. We collect a week
// or two of reports, tighten allowlist, then flip the header name to
// Content-Security-Policy (enforcing).
const cspReportOnly = [
  "default-src 'self'",
  // Scripts: self, inline (gtag consent bootstrap + JSON-LD dangerouslySet),
  // gtag, firebase, leaflet CDN
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com https://www.gstatic.com https://apis.google.com https://unpkg.com https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Images: all the hosts we actually pull from + OSM tile CDNs (a-c).tile.openstreetmap.org
  "img-src 'self' data: blob: https://media.bugbitten.com https://images.unsplash.com https://*.googleusercontent.com https://*.tile.openstreetmap.org https://*.google-analytics.com https://*.googletagmanager.com https://*.analytics.google.com https://*.g.doubleclick.net https://api.qrserver.com https://media-cdn.tripadvisor.com https://cache.graphicslib.viator.com https://*.viator.com",
  // XHR / fetch — our own API + Google Places, Firebase, analytics (incl. regional GA4 endpoints)
  "connect-src 'self' https://media.bugbitten.com https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.firebaseapp.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://api.qrserver.com https://unpkg.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io",
  // Iframes: Firebase Auth handler + YouTube embeds
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://www.youtube.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-report",
].join('; ');

const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains, eligible for HSTS preload
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Browsers should obey the Content-Type header — no MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Block our pages from being framed (clickjacking) except by ourselves
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Don't leak full URLs as referrers to other sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Lock down browser-API features we don't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(self), geolocation=(self), interest-cohort=()' },
  // Cross-origin window/popup isolation
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // CSP ENFORCING — only 1 violation logged historically (already in allowlist).
  // Still logs violations to /api/csp-report for monitoring.
  { key: 'Content-Security-Policy', value: cspReportOnly },
]

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  staticPageGenerationTimeout: 180,
  // WP legacy URLs use trailing slashes (/cairns/accommodation/). Preserving
  // them avoids a redirect hop + keeps the existing SEO-ranked URL intact.
  trailingSlash: true,
  images: {
    // Single R2 bucket used for all 8 tenants, keyed by `${state_code}/…` prefix.
    // BugBitten's bucket (media.bugbitten.com) stays whitelisted too so the
    // brand-shared logo/assets and the Unsplash-seeded covers keep resolving
    // while we migrate images over. Also allow each tenant's own domain so we
    // can serve site-owned assets (e.g. /public/ logos) via next/image.
    remotePatterns: [
      { protocol: 'https', hostname: 'media.autravel.com.au' },
      { protocol: 'https', hostname: 'media.bugbitten.com' },
      { protocol: 'https', hostname: 'qldtravel.com.au' },
      { protocol: 'https', hostname: 'nswtravel.com.au' },
      { protocol: 'https', hostname: 'nttravel.com.au' },
      { protocol: 'https', hostname: 'watravel.com.au' },
      { protocol: 'https', hostname: 'satravel.net.au' },
      { protocol: 'https', hostname: 'tastravel.net.au' },
      { protocol: 'https', hostname: 'victravel.com.au' },
      { protocol: 'https', hostname: 'aunztravel.com.au' },
      { protocol: 'https', hostname: '*.qldtravel.com.au' },
      { protocol: 'https', hostname: '*.nswtravel.com.au' },
      { protocol: 'https', hostname: '*.nttravel.com.au' },
      { protocol: 'https', hostname: '*.watravel.com.au' },
      { protocol: 'https', hostname: '*.satravel.net.au' },
      { protocol: 'https', hostname: '*.tastravel.net.au' },
      { protocol: 'https', hostname: '*.victravel.com.au' },
      { protocol: 'https', hostname: '*.aunztravel.com.au' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'media-cdn.tripadvisor.com' },
      { protocol: 'https', hostname: 'cache.graphicslib.viator.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      // Google Places Photo endpoint used by scripts/import-parks.mjs cover images.
      { protocol: 'https', hostname: 'maps.googleapis.com' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async redirects() {
    // NOTE: per-tenant WP legacy URLs are NOT handled here. They live in the
    // `redirects` table and are served by src/middleware.ts, which scopes the
    // lookup by state_code so qldtravel's old slugs don't collide with nswtravel's.
    //
    // Only keep rules here that are truly global (bot probes, favicon).
    return [
      // NOTE: /wp-content/* is NOT redirected here — article body_html
      // references original image URLs under /wp-content/uploads/, and the
      // Apache vhost serves those from disk while proxying everything else
      // to this Next.js app. Do not add a /wp-content redirect here.
      { source: '/favicon.ico',        destination: '/icon.svg', permanent: true },
      { source: '/wp-admin',           destination: '/',         permanent: true },
      { source: '/wp-admin/:path*',    destination: '/',         permanent: true },
      { source: '/wp-login.php',       destination: '/login',    permanent: true },
      { source: '/wp-json/:path*',     destination: '/',         permanent: true },
      { source: '/wp-:file.php',       destination: '/',         permanent: true },
      // New Forest legacy /image-files/ static image dir — wasn't preserved at
      // the WP→autravel rebuild, but the originals were bulk-restored from the
      // Wayback Machine into R2 (autravel/newforest/image-files/). 301 the old
      // image URLs (still in Google Images + external backlinks) to the CDN.
      // Host-scoped so it can't affect the AU tenants. permanent → 301.
      { source: '/image-files/:path*', has: [{ type: 'host', value: '(www\\.)?new-forest-national-park\\.com' }], destination: 'https://media.bugbitten.com/autravel/newforest/image-files/:path*', permanent: true },
      // New Forest apple-touch-icon — iOS/browsers probe these bare paths
      // directly. Host-scoped because the icon lives in NF's own uploads dir.
      { source: '/apple-touch-icon.png',             has: [{ type: 'host', value: '(www\\.)?new-forest-national-park\\.com' }], destination: '/wp-content/uploads/nfnp-apple-touch-icon.png', permanent: false },
      { source: '/apple-touch-icon-precomposed.png', has: [{ type: 'host', value: '(www\\.)?new-forest-national-park\\.com' }], destination: '/wp-content/uploads/nfnp-apple-touch-icon.png', permanent: false },
    ]
  },
}
module.exports = nextConfig
