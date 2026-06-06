-- Travel-map feature: per-country visibility overrides.
-- Aggregation reads from journal_entries + user_locations; this table only
-- stores the user's explicit public/private choice per country.

CREATE TABLE IF NOT EXISTS country_visibility (
  user_id      TEXT NOT NULL,
  country_code TEXT NOT NULL,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, country_code)
);
CREATE INDEX IF NOT EXISTS idx_country_visibility_user ON country_visibility(user_id);
