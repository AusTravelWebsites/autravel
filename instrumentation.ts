// Next.js 15 instrumentation hook — called once when the server boots.
// Loads the appropriate Sentry config based on runtime (node vs edge).
// No-op when SENTRY_DSN isn't set.
export async function register() {
  if (!process.env.SENTRY_DSN) return
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
