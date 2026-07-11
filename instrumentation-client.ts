// Next.js 15 client instrumentation — the SINGLE source of truth for the Sentry
// browser SDK. Runs once per page load in the browser.
//
// NOTE: this file (not the legacy `sentry.client.config.ts`) is the config that
// actually takes effect. In a production build @sentry/nextjs injects both files
// if present, and whichever `Sentry.init()` runs LAST wins — which is this one.
// Keep all browser filtering here; do not reintroduce `sentry.client.config.ts`.
//
// No-op if NEXT_PUBLIC_SENTRY_DSN isn't set, so builds without a DSN ship safely.
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
    // Don't add default integrations we don't want; we report our own errors via
    // ClientErrorReporter and only lean on Sentry for aggregation/alerting.
    integrations: [],
    // Noise we never want paged about. These are matched against the event message.
    ignoreErrors: [
      /ResizeObserver loop/,
      /^Script error\.?$/,
      /^Non-Error promise rejection/,
      /Loading chunk/,
      /Loading CSS chunk/,
      /ChunkLoadError/,
      // Private-browsing / cookie-blocked browsers: third-party scripts (ads, GA)
      // hit Window.localStorage and throw. App code is guarded; this is noise.
      /Failed to read the 'localStorage' property/i,
      /Failed to read the 'sessionStorage' property/i,
      /Access is denied for this document/i,
      // Chunk fetches aborted when the user navigates away mid-load.
      /^Connection closed/i,
      // Sentry's own "we captured a non-Error as a rejection" meta-noise.
      /captured as promise rejection/i,
      // Third-party iframe (AdSense, GTM, etc) racing the load event. The ad
      // script touches iframe.contentWindow.document before/after it's mounted.
      // Different browsers phrase this differently.
      /contentWindow is null/i,
      /Cannot read propert(y|ies) of null \(reading ['"]document['"]\)/i,
      /null is not an object \(evaluating .*\.contentWindow/i,
      // Transient network failures — a fetch (route prefetch, map tile,
      // browser-extension sidecar, ad pixel) dies when a mobile user navigates
      // away, loses signal, or the request is blocked. Sentry sometimes appends
      // the URL to the message (e.g. "Failed to fetch (tausearch.com)"), so
      // these patterns are unanchored. "Load failed" = Safari, "Failed to fetch"
      // = Chrome, "NetworkError" = Firefox.
      /Load failed/i,
      /Failed to fetch/i,
      /NetworkError when attempting to fetch/i,
      // AbortController fires when the user navigates away mid-fetch (Next.js
      // route prefetch, in-flight data fetches). Page itself is fine.
      /signal is aborted without reason/i,
      /The (operation|user) (was )?aborted/i,
      /^AbortError/i,
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
    beforeSend(event) {
      const exc = event.exception?.values?.[0]
      const frames = exc?.stacktrace?.frames || []

      // Drop events whose stack frames live in injected in-app-browser code.
      // The message text varies across iOS versions but the function names don't.
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

      // Browser extensions (shopping/coupon/session-recorder/a11y tools) commonly
      // monkey-patch Node.appendChild/insertBefore and JSON.stringify each inserted
      // node to ship it to their background script. When React appends an element
      // that carries a `__reactFiber$…` property, the fiber's circular `stateNode`
      // reference throws "Converting circular structure to JSON" — surfaced via our
      // window.onerror as if it were ours. Our own code never serializes a live DOM
      // node, so a circular-structure error that names an HTML*Element or a React
      // fiber is unambiguously injected third-party code. Scope the drop tightly so
      // a genuine first-party circular-JSON regression (which wouldn't reference the
      // DOM) still reaches us.
      const val = exc?.value || ''
      if (
        exc?.type === 'TypeError' &&
        /circular structure/i.test(val) &&
        /(HTML\w*Element|__reactFiber|__reactProps|stateNode)/.test(val)
      ) {
        return null
      }

      return event
    },
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'production',
  })
}

// Required export for client-side navigation transaction capture in App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
