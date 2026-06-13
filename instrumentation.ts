// Next.js 15 instrumentation hook — called once when the server boots.
// Starts the cross-region DB keep-alive (node only) and loads the appropriate
// Sentry config based on runtime (node vs edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Keep a few cross-region DB connections warm so visitor cache-miss renders
    // don't pay the ~1.3s cold-connect to the Singapore pooler. See db-keepalive.ts.
    try {
      const { startDbKeepAlive } = await import('./src/lib/db-keepalive')
      startDbKeepAlive()
    } catch (e) {
      console.error('[instrumentation] db keep-alive failed to start', e)
    }
    if (process.env.SENTRY_DSN) await import('./sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.SENTRY_DSN) await import('./sentry.edge.config')
  }
}
