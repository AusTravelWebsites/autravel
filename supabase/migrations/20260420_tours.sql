-- Unified tours catalogue — one row per imported tour from Viator or WeTravel.
-- Our own AI-rewritten content lives alongside the raw source payload.

CREATE TABLE IF NOT EXISTS tours (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source               TEXT NOT NULL,             -- 'viator' | 'wetravel'
  source_product_code  TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,
  title                TEXT NOT NULL,
  country              TEXT,
  country_code         TEXT,                      -- ISO2 where inferable
  city                 TEXT,
  duration_min         INT,                       -- duration in minutes where known
  duration_label       TEXT,                      -- "2 hours", "3 days 2 nights"
  price_from           NUMERIC(10,2),
  currency             TEXT,
  rating               NUMERIC(3,2),
  review_count         INT,
  cover_image          TEXT,
  images               JSONB,                     -- array of image URLs (string[])
  booking_url          TEXT NOT NULL,             -- the affiliate-tracked productUrl — never hand-build
  tags                 JSONB,                     -- array of tag names
  -- AI-rewritten, original content (never copied verbatim)
  summary_ai           TEXT,
  highlights_ai        JSONB,                     -- array of bullet strings
  what_to_expect_ai    TEXT,
  good_to_know_ai      TEXT,
  ai_rewritten_at      TIMESTAMPTZ,
  ai_model             TEXT,
  -- raw source payload for re-processing
  source_raw           JSONB,
  source_fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  -- display status
  active               BOOLEAN DEFAULT true,
  featured             BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_product_code)
);
CREATE INDEX IF NOT EXISTS idx_tours_country ON tours (country_code) WHERE active;
CREATE INDEX IF NOT EXISTS idx_tours_city    ON tours (city)         WHERE active;
CREATE INDEX IF NOT EXISTS idx_tours_source  ON tours (source);
CREATE INDEX IF NOT EXISTS idx_tours_active  ON tours (active, rating DESC NULLS LAST);

-- A very light sync-run log (separate from the rich source_raw on each row).
CREATE TABLE IF NOT EXISTS tour_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL,
  action      TEXT NOT NULL,            -- 'search' | 'fetch' | 'rewrite' | 'import'
  ok          BOOLEAN NOT NULL,
  count_ok    INT DEFAULT 0,
  count_fail  INT DEFAULT 0,
  details     JSONB,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tour_sync_log_started ON tour_sync_log (started_at DESC);
