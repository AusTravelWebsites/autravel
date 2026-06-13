import { db } from './db'

// Cross-region DB warm-keeper (added 2026-06-13).
//
// The autravel Supabase pooler lives in Singapore; this server is far from it,
// so a *fresh* client connection costs ~1.3s (TCP + TLS + auth) and each warm
// query ~217ms. db.ts deliberately reaps connections (idle_timeout: 8s,
// max_lifetime: 120s) to avoid Supavisor zombie backends — which is correct,
// but on a low-traffic instance it means real visitor requests keep paying the
// cold-connect cost on a cache-miss render. That's what made New Forest
// homepages spike to 2–4s and trip the uptime monitor.
//
// This keeps a SMALL set of client connections warm by firing cheap `SELECT 1`
// pings just under the 8s idle_timeout. The hot render paths reuse the warm
// connections instead of cold-dialing Singapore: the homepage fans out 5
// parallel queries and /tours 4, so we warm a few connections, not just one.
//
// IMPORTANT: this changes NO pool parameter. max_lifetime still reaps every
// connection at 120s (zombie protection intact) — the keep-alive merely re-warms
// the replacement promptly, moving the TLS cost off the visitor's request and
// onto a background ping. Fully additive and self-healing: ping errors are
// swallowed so a transient DB blip never crashes the process or spams logs.
//
// On the transaction pooler a warm *client* connection to Supavisor does not pin
// a Postgres backend (backends are returned after each statement), so holding a
// few warm client connections per instance is cheap and safe.

let started = false

export function startDbKeepAlive(): void {
  if (started) return
  started = true

  // Warm enough connections to cover the hottest parallel render path
  // (homepage = 5 parallel queries). Stays well under db.ts max:10.
  const CONNS = Math.min(Math.max(1, Number(process.env.DB_KEEPALIVE_CONNS) || 5), 8)
  // Ping interval must be < db.ts idle_timeout (8s) or connections get reaped
  // between pings and go cold again. 5s leaves margin.
  const INTERVAL_MS = Math.max(2000, Number(process.env.DB_KEEPALIVE_MS) || 5000)

  const ping = () => {
    // Fire CONNS trivial queries concurrently so that many pooled connections
    // stay warm (a single query would only keep one warm).
    for (let i = 0; i < CONNS; i++) {
      db`SELECT 1`.catch(() => {})
    }
  }

  ping() // warm immediately on boot so the first visitor isn't cold
  const timer = setInterval(ping, INTERVAL_MS)
  // Don't let the keep-alive timer hold the event loop open on shutdown.
  if (typeof (timer as any).unref === 'function') (timer as any).unref()
}
