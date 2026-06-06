// Next.js 15 client instrumentation. Runs once per page load in the browser.
// No-op if NEXT_PUBLIC_SENTRY_DSN isn't set, so builds without a DSN ship safely.
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.25,
    integrations: [],
    ignoreErrors: [
      /ResizeObserver loop/,
      /^Script error\.?$/,
      /^Non-Error promise rejection/,
      /Loading chunk/,
      /Loading CSS chunk/,
    ],
    environment: process.env.NODE_ENV || 'production',
  })
}

// Required export for client-side navigation transaction capture in App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
