// Sentry browser SDK config. Runs on every page load.
// Disabled at build + runtime when SENTRY_DSN is empty — so we ship without a
// DSN and activate by dropping one into NEXT_PUBLIC_SENTRY_DSN in .env.local.
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Sample 10% of sessions for performance traces — adjust if you hit free-tier quota.
    tracesSampleRate: 0.1,
    // Replays are expensive; keep off unless you're actively debugging.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.25,
    // Don't swallow errors we also log via ClientErrorReporter — but avoid double
    // reports for errors Sentry itself already captures.
    integrations: [],
    // Filter out the same noise ClientErrorReporter ignores, so we don't pay
    // for them twice.
    ignoreErrors: [
      /ResizeObserver loop/,
      /^Script error\.?$/,
      /^Non-Error promise rejection/,
      /Loading chunk/,
      /Loading CSS chunk/,
      // Private-browsing / cookie-blocked browsers: third-party scripts (ads, GA)
      // hit Window.localStorage and throw. App code is guarded; this is noise.
      /Failed to read the 'localStorage' property/i,
      /Failed to read the 'sessionStorage' property/i,
      /Access is denied for this document/i,
      // Chunk fetches aborted when the user navigates away mid-load.
      /^Connection closed/i,
      /ChunkLoadError/,
      // Sentry's own "we captured a non-Error as a rejection" meta-noise.
      /captured as promise rejection/i,
      // Third-party iframe (AdSense, GTM, etc) racing the load event. The ad
      // script touches iframe.contentWindow.document before/after it's mounted.
      // Different browsers phrase this differently.
      /contentWindow is null/i,
      /Cannot read propert(y|ies) of null \(reading ['"]document['"]\)/i,
      /null is not an object \(evaluating .*\.contentWindow/i,
      // Transient network failures — a fetch (route prefetch, map tile, etc.)
      // dies when a mobile user navigates away or loses signal. Page itself is
      // fine; nothing actionable. "Load failed" = Safari, "Failed to fetch" = Chrome.
      /^Load failed$/i,
      /^Failed to fetch$/i,
      /NetworkError when attempting to fetch/i,
      // Facebook + Instagram in-app browsers inject their own performance probe
      // that calls window.webkit.messageHandlers.* to relay LCP back to the
      // native iOS app. On iOS versions where that bridge isn't present, their
      // injected script throws — but our window.onerror catches it as if it
      // were ours. Same applies to Pinterest, Snapchat, TikTok in-app browsers.
      /window\.webkit\.messageHandlers/i,
      /undefined is not an object \(evaluating ['"]window\.webkit/i,
      /processLargestContentfulPaintEvent/i,
      /sendDataToNative/i,
    ],
    // Drop events whose stack frames live in injected in-app-browser code.
    // The message text varies across iOS versions but the function names don't.
    beforeSend(event) {
      const frames = event.exception?.values?.[0]?.stacktrace?.frames || []
      for (const f of frames) {
        const fn = f.function || ''
        if (
          fn === 'sendDataToNative' ||
          fn === 'processLargestContentfulPaintEvent' ||
          fn.includes('window.webkit.messageHandlers')
        ) {
          return null
        }
      }
      return event
    },
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'production',
  })
}
