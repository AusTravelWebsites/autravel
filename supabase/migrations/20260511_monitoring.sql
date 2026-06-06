-- Monitoring: tenant-level HTTP uptime probes + server-side error counters.
-- Runs after 20260424_admin_backend.sql.

SET search_path = autravel, public;

-- ───────────────────────────────────────────────────────────────────────────
-- uptime_probes — one row per tenant probe (every ~1min)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.uptime_probes (
  id           BIGSERIAL PRIMARY KEY,
  state_code   TEXT NOT NULL,
  host         TEXT NOT NULL,
  url          TEXT NOT NULL,
  status_code  INT,                 -- null on network failure
  ok           BOOLEAN NOT NULL,
  latency_ms   INT,
  error        TEXT,                -- network/timeout error string
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_uptime_probes_state_time ON autravel.uptime_probes (state_code, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_probes_recent ON autravel.uptime_probes (checked_at DESC);
-- Prune anything older than 14 days nightly via /api/cron (cheap; saves space).

-- ───────────────────────────────────────────────────────────────────────────
-- server_errors — rolled-up server-side errors (sampled from try/catch points)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.server_errors (
  id            BIGSERIAL PRIMARY KEY,
  state_code    TEXT,
  source        TEXT NOT NULL,     -- 'api:/places' | 'page:/country' etc.
  message       TEXT NOT NULL,
  fingerprint   TEXT NOT NULL,     -- hash(source+message-first-line)
  stack         TEXT,
  url           TEXT,
  user_agent    TEXT,
  hit_count     INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_server_errors_last_seen ON autravel.server_errors (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_errors_state_last ON autravel.server_errors (state_code, last_seen_at DESC);
