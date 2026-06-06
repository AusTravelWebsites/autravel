SET search_path = autravel, public;

CREATE TABLE IF NOT EXISTS autravel.uptime_incidents (
  id              BIGSERIAL PRIMARY KEY,
  state_code      TEXT NOT NULL,
  host            TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  last_status     INT,
  last_error      TEXT,
  fail_count      INT NOT NULL DEFAULT 1,
  notified        BOOLEAN NOT NULL DEFAULT FALSE,
  recovery_notified BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_uptime_incidents_open  ON autravel.uptime_incidents (state_code) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uptime_incidents_recent ON autravel.uptime_incidents (started_at DESC);
