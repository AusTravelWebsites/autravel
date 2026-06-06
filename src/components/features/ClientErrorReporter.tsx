'use client'
import { useEffect } from 'react'

// Reports uncaught browser errors + unhandled promise rejections to /api/client-errors.
// Renders nothing. Drop it once in layout.tsx. Deduplicates within a session so a
// broken tight loop can't spam the endpoint.
export default function ClientErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const reported = new Set<string>()

    const send = (payload: Record<string, unknown>) => {
      try {
        // navigator.sendBeacon is fire-and-forget — survives page unload too
        const body = JSON.stringify(payload)
        const key = `${payload.message}|${payload.url}|${payload.lineNo}`
        if (reported.has(key)) return
        reported.add(key)
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' })
          navigator.sendBeacon('/api/client-errors', blob)
        } else {
          fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
        }
      } catch {}
    }

    const onError = (e: ErrorEvent) => {
      send({
        message: e.message || 'unknown error',
        stack: e.error?.stack || null,
        url: window.location.href,
        lineNo: e.lineno ?? null,
        colNo: e.colno ?? null,
      })
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      send({
        message: (reason?.message || String(reason || 'Unhandled promise rejection')).slice(0, 800),
        stack: reason?.stack || null,
        url: window.location.href,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
