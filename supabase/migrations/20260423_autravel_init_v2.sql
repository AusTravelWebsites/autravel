-- autravel initial migration (v2 — isolated schema).
--
-- This supersedes 20260423_autravel_init.sql. Instead of adding state_code to
-- bugbitten's existing public.tours / public.places / public.redirects /
-- public.site_snippets, we put EVERY autravel table under a dedicated
-- `autravel` schema so bugbitten is completely untouched and autravel can
-- share the Supabase Postgres instance safely.
--
-- The autravel Next.js app sets search_path to 'autravel, public' (see
-- src/lib/db.ts) so `FROM tours` naturally resolves to `autravel.tours`, but
-- code can still reach public.users / public.reviews if ever needed (shared
-- Firebase auth → shared users table).

CREATE SCHEMA IF NOT EXISTS autravel;
SET search_path = autravel, public;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. tours — same shape as bugbitten's public.tours plus state_code.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.tours (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source               TEXT NOT NULL,
  source_product_code  TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,
  state_code           TEXT,
  title                TEXT NOT NULL,
  country              TEXT,
  country_code         TEXT,
  city                 TEXT,
  category             TEXT,
  duration_min         INT,
  duration_label       TEXT,
  price_from           NUMERIC(10,2),
  currency             TEXT,
  rating               NUMERIC(3,2),
  review_count         INT,
  cover_image          TEXT,
  images               JSONB,
  booking_url          TEXT NOT NULL,
  tags                 JSONB,
  summary_ai           TEXT,
  highlights_ai        JSONB,
  what_to_expect_ai    TEXT,
  good_to_know_ai      TEXT,
  ai_rewritten_at      TIMESTAMPTZ,
  ai_model             TEXT,
  source_raw           JSONB,
  source_fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  active               BOOLEAN DEFAULT true,
  featured             BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_product_code)
);
CREATE INDEX IF NOT EXISTS idx_autravel_tours_state_active ON autravel.tours (state_code, active, rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_autravel_tours_city        ON autravel.tours (state_code, city) WHERE active;
CREATE INDEX IF NOT EXISTS idx_autravel_tours_category    ON autravel.tours (state_code, category) WHERE active;

CREATE TABLE IF NOT EXISTS autravel.tour_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL,
  action      TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  count_ok    INT DEFAULT 0,
  count_fail  INT DEFAULT 0,
  details     JSONB,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. places — autravel's own copy, state-scoped.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.places (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  state_code        TEXT NOT NULL,
  name              TEXT NOT NULL,
  city              TEXT,
  country           TEXT DEFAULT 'Australia',
  address           TEXT,
  category          TEXT,
  emoji             TEXT,
  cover_image       TEXT,
  description       TEXT,
  lat               NUMERIC(9,6),
  lng               NUMERIC(9,6),
  google_place_id   TEXT,
  is_verified       BOOLEAN DEFAULT false,
  review_count      INT DEFAULT 0,
  avg_rating        NUMERIC(3,2),
  checkin_count     INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autravel_places_state_city ON autravel.places (state_code, city);
CREATE INDEX IF NOT EXISTS idx_autravel_places_state_cat  ON autravel.places (state_code, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_autravel_places_google ON autravel.places (google_place_id) WHERE google_place_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. parks
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.parks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code        TEXT NOT NULL,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  park_type         TEXT,
  region            TEXT,
  destination_slug  TEXT,
  address           TEXT,
  suburb            TEXT,
  postcode          TEXT,
  lat               NUMERIC(9,6),
  lng               NUMERIC(9,6),
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  description       TEXT,
  description_ai    TEXT,
  amenities         JSONB,
  site_types        JSONB,
  pets_allowed      BOOLEAN,
  dump_point        BOOLEAN,
  big_rig_friendly  BOOLEAN,
  price_from        NUMERIC(10,2),
  currency          TEXT DEFAULT 'AUD',
  star_rating       NUMERIC(3,2),
  avg_rating        NUMERIC(3,2),
  review_count      INT DEFAULT 0,
  cover_image       TEXT,
  images            JSONB,
  google_place_id   TEXT,
  source            TEXT,
  source_raw        JSONB,
  source_fetched_at TIMESTAMPTZ,
  active            BOOLEAN DEFAULT true,
  featured          BOOLEAN DEFAULT false,
  seo_title         TEXT,
  seo_description   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_autravel_parks_state_active ON autravel.parks (state_code, active, featured DESC, avg_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_autravel_parks_geo          ON autravel.parks (state_code, lat, lng) WHERE active;
CREATE INDEX IF NOT EXISTS idx_autravel_parks_destination  ON autravel.parks (state_code, destination_slug) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_autravel_parks_google ON autravel.parks (google_place_id) WHERE google_place_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. destinations
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.destinations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      TEXT NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  region          TEXT,
  intro           TEXT,
  body            TEXT,
  lat             NUMERIC(9,6),
  lng             NUMERIC(9,6),
  radius_km       NUMERIC(6,2) DEFAULT 25,
  hero_image      TEXT,
  gallery         JSONB,
  tags            JSONB,
  viator_dest_id  INT,
  is_featured     BOOLEAN DEFAULT false,
  display_order   INT DEFAULT 100,
  active          BOOLEAN DEFAULT true,
  seo_title       TEXT,
  seo_description TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_autravel_destinations_state_active ON autravel.destinations (state_code, active, display_order, is_featured DESC);
CREATE INDEX IF NOT EXISTS idx_autravel_destinations_geo          ON autravel.destinations (state_code, lat, lng) WHERE active;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. articles (WP migration target)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.articles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code        TEXT NOT NULL,
  slug              TEXT NOT NULL,
  legacy_path       TEXT,
  title             TEXT NOT NULL,
  excerpt           TEXT,
  body_html         TEXT,
  body_md           TEXT,
  cover_image       TEXT,
  images            JSONB,
  categories        JSONB,
  tags              JSONB,
  destination_slug  TEXT,
  post_type         TEXT DEFAULT 'post',
  author            TEXT,
  status            TEXT DEFAULT 'published',
  source            TEXT,
  source_raw        JSONB,
  published_at      TIMESTAMPTZ,
  updated_at_source TIMESTAMPTZ,
  noindex           BOOLEAN DEFAULT false,
  seo_title         TEXT,
  seo_description   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_autravel_articles_state_status  ON autravel.articles (state_code, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_autravel_articles_state_dest    ON autravel.articles (state_code, destination_slug) WHERE status = 'published';
-- Non-unique index: two WP posts occasionally resolve to the same final URL
-- (e.g. after hierarchical slug clean-up). Both rows are kept in the DB so no
-- content is lost; the catch-all route picks LIMIT 1 for serving.
CREATE INDEX IF NOT EXISTS idx_autravel_articles_legacy ON autravel.articles (state_code, legacy_path) WHERE legacy_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autravel_articles_fts ON autravel.articles USING GIN (
  to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(excerpt,'') || ' ' || COALESCE(body_html,''))
);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. redirects — tenant-scoped by state_code.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.redirects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code     TEXT,
  from_path      TEXT NOT NULL,
  to_path        TEXT NOT NULL,
  redirect_type  INT DEFAULT 301,
  match_type     TEXT DEFAULT 'exact',
  hit_count      INT DEFAULT 0,
  last_hit_at    TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT true,
  group_id       UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_autravel_redirects_tenant_path
  ON autravel.redirects (COALESCE(state_code,''), from_path);
CREATE INDEX IF NOT EXISTS idx_autravel_redirects_active
  ON autravel.redirects (state_code, from_path) WHERE is_active;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. site_snippets — per-tenant head/body injections (GA4 etc).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.site_snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  state_code  TEXT,
  location    TEXT NOT NULL CHECK (location IN ('head','body_start','body_end')),
  code        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autravel_snippets_state_loc
  ON autravel.site_snippets (state_code, location) WHERE is_active;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. wp_import_log — audit trail for WP migrations.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.wp_import_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code  TEXT NOT NULL,
  action      TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  count_ok    INT DEFAULT 0,
  count_fail  INT DEFAULT 0,
  details     JSONB,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_autravel_wp_import_log_state_start
  ON autravel.wp_import_log (state_code, started_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 9. admin_settings + admin_actions (minimal audit + settings)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autravel.admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autravel_admin_actions_created ON autravel.admin_actions (created_at DESC);
