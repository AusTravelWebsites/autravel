// Sentry Node runtime config. Runs in server components, API routes, middleware.
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.05, // Lower for server — higher volume than client
    environment: process.env.NODE_ENV || 'production',
    // Don't report expected 4xx's or canceled requests
    ignoreErrors: [
      /canceling statement due to statement timeout/, // Supabase pooler quirk we already handle
    ],
  })
}
