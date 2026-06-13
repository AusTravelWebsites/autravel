import postgres from 'postgres'
import { setDefaultResultOrder } from 'dns'

// Force IPv4 DNS resolution - server has no IPv6 connectivity
setDefaultResultOrder('ipv4first')

// 2026-05-20 — moved off the SESSION pooler (:5432) onto the TRANSACTION
// pooler (:6543). The session pooler pins one real Postgres backend per
// client connection for the whole session; autravel (max:5) + bugbitten
// (max:12) together held ~17 real backends on a 60-connection instance, and
// during the overnight US-traffic peak the session pooler ran out of
// backends to hand out → CONNECT_TIMEOUT on every new connection + statement
// cancellations (57014). The transaction pooler returns the backend after
// each transaction, so our footprint drops to near-zero steady-state.
// Verified search_path + unqualified autravel-schema resolution still work
// through :6543. REQUIRES prepare:false (see below).
const connectionString =
     process.env.DATABASE_URL_TX_POOL
  || process.env.DATABASE_URL_POOL
  || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL_TX_POOL or DATABASE_URL_POOL or DATABASE_URL environment variable is required')
}

// 2026-05-18 — ported bugbitten's full DB hardening after autravel kept
// hanging while bugbitten stayed stable on the SAME shared Supavisor session
// pool. The differences (and why each matters):
//
//   max:5            — was 8. New apps (mortgagecalc max:20 on session pool)
//                       deployed today consumed the pool, so we tighten our
//                       footprint. autravel caches aggressively (revalidate up
//                       to 86400s) so 5 in-flight is plenty.
//   max_lifetime:120 — reaps each connection every 2 min. Without this,
//                       silently-dropped Supavisor backend connections sit in
//                       the pool as "idle" zombies until something queries
//                       them and discovers they're dead → cascading failures.
//   application_name — surfaces in pg_stat_activity so the self-healer below
//                       (and human debug) can identify OUR backends without
//                       a table allowlist.
//   prepare:false    — MANDATORY on the transaction pooler. Prepared
//                       statements are per-backend; in transaction mode each
//                       statement can land on a different backend, so a
//                       prepared statement from an earlier txn won't exist.
//   statement_timeout + idle_in_transaction_session_timeout — per-connection
//                       timeouts. Belt-and-suspenders to the role-level
//                       ALTER ROLE postgres SET statement_timeout that
//                       bugbitten installed on the shared project.
const SCHEMA = process.env.DB_SCHEMA || 'autravel'

// 2026-05-25 — tuned for the real /tours load shape.
//   max:10 — /tours runs 4 parallel queries per render; max:5 ate the whole
//             pool on a single render when 2+ users coincided, producing
//             ECHECKOUTTIMEOUT cascades + EDBHANDLEREXITED + process crashes.
//             3 instances × 10 = 30 worst-case; Supavisor handles it.
//   idle_timeout:8 — was 20. Free idle conns back to the pool sooner so a
//             page-load burst can claim them.
//   statement_timeout:12000 — was 8000. Default sort has ~400ms PG-planning
//             time; under load planning spikes. 12s gives headroom without
//             letting genuine runaways camp.
// ssl: false for localhost (PG 17 over unix-domain / loopback, no TLS), 'require'
// for everything remote. 2026-06-13 — autravel moved off Supabase to local PG on
// this server. Keeps the SSL discipline anywhere the connection leaves the box.
const isLocalhost = /@(127\.0\.0\.1|localhost)\b/.test(connectionString)
const db = postgres(connectionString, {
  ssl: isLocalhost ? false : 'require',
  max: 10,
  idle_timeout: 8,
  max_lifetime: 60 * 2,
  connect_timeout: 8,
  prepare: false,
  connection: {
    application_name: 'autravel',
    search_path: `${SCHEMA}, public`,
    statement_timeout: '12000',
    idle_in_transaction_session_timeout: '15000',
  },
})

// Process-level unhandled-rejection handler. Each unhandled rejection from a
// fire-and-forget db query was leaving a postgres-js Connection in a degraded
// state; over hours these accumulated and exhausted the pool. Log and swallow
// at process level so a single statement_timeout never corrupts the pool.
// Anything genuinely worth crashing on is handled closer to its source.
if (typeof process !== 'undefined' && !(process as any).__autravelUnhandledHandlerInstalled) {
  (process as any).__autravelUnhandledHandlerInstalled = true
  process.on('unhandledRejection', (reason: any) => {
    const msg = (reason && (reason.message || reason)) || 'unknown'
    console.warn('[autravel unhandledRejection caught]', String(msg).slice(0, 300))
  })
}

// Self-healer. statement_timeout (8s) kills queries that are still EXECUTING.
// It does nothing about queries sitting in `state=active wait_event=ClientRead`
// because the Next.js client never read the rowset off the wire — the exact
// failure mode that wedges autravel when SSR is cancelled mid-render.
//
// Every 20s, open a side connection and pg_terminate_backend any pooled
// backend stuck >20s in active+ClientRead THAT touches an autravel-exclusive
// table. We can't filter by application_name because Supavisor overrides it
// to 'Supavisor' for every backend (verified 2026-05-18). The table allowlist
// is autravel-only tables (no overlap with bugbitten/charityguide) so we
// don't fight bugbitten's own cleaner over shared-table queries.
const AUTRAVEL_TABLES = [
  'articles', 'localities', 'destinations',
  'park_nearby', 'park_nearby_meta',
  'destination_nearby', 'destination_nearby_meta', 'destination_climate', 'destination_marine',
  'distance_pairs', 'alerts', 'tour_sync_log', 'wp_import_log',
  'newsletter_subscribers', 'uptime_probes', 'uptime_incidents',
  'site_settings', 'redirect_404s', 'redirect_groups',
]
let cleanerStarted = false
function startSelfHealer() {
  if (cleanerStarted) return
  if (process.env.NODE_ENV === 'test') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  cleanerStarted = true
  const tableMatch = AUTRAVEL_TABLES.map(t => `q.query ILIKE '%${t}%'`).join(' OR ')
  // 2026-05-25 — slowed from 20s to 60s. The healer was opening a new
  // connection each tick (overhead while system was stressed) AND its
  // pg_stat_activity scan held a connection through the timeout window
  // when the pool was already starved. With the larger pool + per-tick cap
  // on stuck-query age (60s), 60s cadence is enough.
  setInterval(async () => {
    // Skip while backed off — when Supavisor's circuit breaker is tripped,
    // a new connection attempt each tick contributes to keeping it tripped.
    if (Date.now() < selfHealerSkipUntil) return
    let cleaner: ReturnType<typeof postgres> | null = null
    try {
      cleaner = postgres(connectionString!, { ssl: isLocalhost ? false : 'require', prepare: false, max: 1, connect_timeout: 4, idle_timeout: 3 })
      const killed = await cleaner.unsafe(`
        SELECT pid, EXTRACT(EPOCH FROM (NOW() - query_start))::int AS secs,
               LEFT(query, 80) AS q
        FROM pg_stat_activity AS q
        WHERE datname = current_database()
          AND state = 'active' AND wait_event = 'ClientRead'
          AND application_name = 'Supavisor'
          AND query_start < NOW() - INTERVAL '20 seconds'
          AND query NOT ILIKE '%pg_stat_activity%'
          AND (${tableMatch})
      `)
      for (const row of killed as any[]) {
        try {
          await cleaner.unsafe(`SELECT pg_terminate_backend(${Number(row.pid)})`)
          console.warn(`[autravel self-heal] terminated leaked backend pid=${row.pid} stuck=${row.secs}s q="${row.q.replace(/\s+/g, ' ').slice(0, 120)}"`)
        } catch (e: any) {
          console.warn(`[autravel self-heal] terminate pid=${row.pid} failed: ${e?.message}`)
        }
      }
    } catch (e: any) {
      console.warn('[autravel self-heal] tick failed:', e?.message)
      // Back off for 2 minutes on any failure.
      selfHealerSkipUntil = Date.now() + 120_000
    } finally {
      try { await cleaner?.end({ timeout: 2 }) } catch {}
    }
  }, 60_000).unref()
}
let selfHealerSkipUntil = 0
startSelfHealer()

export { db }
export { db as sql }
export default db
