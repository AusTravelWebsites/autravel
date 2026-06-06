-- autravel initial migration
-- Adds multi-tenant (state_code) dimension to the inherited BugBitten schema,
-- and creates new tables unique to autravel: parks, destinations, articles.
--
-- state_code values: 'qld' | 'nsw' | 'nt' | 'wa' | 'sa' | 'tas' | 'vic'
-- (aunz is the aggregator tenant and never writes state_code rows of its own —
--  it reads across all states.)
--
-- NULL state_code on an existing row means "not yet tagged"; aggregator queries
-- see those rows, but per-state queries do not. Use the backfill tooling in
-- scripts/import-* to populate state_code for imported content.

-------------------------------------------------------------------------------
-- 1. Tenant dimension on existing BugBitten tables
-------------------------------------------------------------------------------

ALTER TABLE tours           ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE places          ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE site_snippets   ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE redirects       ADD COLUMN IF NOT EXISTS state_code TEXT;

-- Drop the global-unique constraint on redirects.from_path so the same legacy
-- path (e.g. "/about/") can exist independently on qldtravel vs victravel.
ALTER TABLE redirects DROP CONSTRAINT IF EXISTS redirects_from_path_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_redirects_tenant_path
  ON redirects (COALESCE(state_code,''), from_path);

CREATE INDEX IF NOT EXISTS idx_tours_state_active
  ON tours (state_code, active, rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_places_state_city
  ON places (state_code, city);
CREATE INDEX IF NOT EXISTS idx_site_snippets_state_loc
  ON site_snippets (state_code, location) WHERE is_active = true;

-------------------------------------------------------------------------------
-- 2. Destinations — curated tourist hubs per state
-------------------------------------------------------------------------------
--
-- A destination is an editorial page that aggregates tours, places (attractions,
-- landmarks, activities), parks and articles in one geographic area. e.g. a
-- `qld / cairns` destination shows every tour near Cairns, every caravan park
-- within radius_km, every attraction, every related article.

CREATE TABLE IF NOT EXISTS destinations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      TEXT NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,                 -- "Cairns"
  region          TEXT,                           -- "Far North Queensland"
  intro           TEXT,                           -- short editorial intro
  body            TEXT,                           -- long-form guide (markdown/html)
  lat             NUMERIC(9,6),
  lng             NUMERIC(9,6),
  radius_km       NUMERIC(6,2) DEFAULT 25,        -- aggregation radius
  hero_image      TEXT,
  gallery         JSONB,                           -- array of image URLs
  tags            JSONB,                           -- array of tag strings (matched to articles)
  viator_dest_id  INT,                             -- optional: Viator city ID for targeted tour matching
  is_featured     BOOLEAN DEFAULT false,
  display_order   INT DEFAULT 100,
  active          BOOLEAN DEFAULT true,
  seo_title       TEXT,
  seo_description TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_destinations_state_active
  ON destinations (state_code, active, display_order, is_featured DESC);
CREATE INDEX IF NOT EXISTS idx_destinations_geo
  ON destinations (state_code, lat, lng) WHERE active;

-------------------------------------------------------------------------------
-- 3. Parks — caravan / holiday / tourist parks
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS parks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code        TEXT NOT NULL,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  park_type         TEXT,                         -- 'caravan' | 'holiday' | 'tourist' | 'bushcamp' | 'national_park'
  region            TEXT,
  destination_slug  TEXT,                         -- optional link to a destination hub
  address           TEXT,
  suburb            TEXT,
  postcode          TEXT,
  lat               NUMERIC(9,6),
  lng               NUMERIC(9,6),
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  description       TEXT,
  description_ai    TEXT,                         -- AI-rewritten long description
  amenities         JSONB,                         -- { wifi, pool, laundry, camp_kitchen, ... }
  site_types        JSONB,                         -- { powered_sites, unpowered_sites, cabins, ensuite_sites, glamping }
  pets_allowed      BOOLEAN,
  dump_point        BOOLEAN,
  big_rig_friendly  BOOLEAN,
  price_from        NUMERIC(10,2),
  currency          TEXT DEFAULT 'AUD',
  star_rating       NUMERIC(3,2),                 -- official star if any
  avg_rating        NUMERIC(3,2),
  review_count      INT DEFAULT 0,
  cover_image       TEXT,
  images            JSONB,
  google_place_id   TEXT,
  source            TEXT,                         -- 'google' | 'manual' | 'import'
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
CREATE INDEX IF NOT EXISTS idx_parks_state_active
  ON parks (state_code, active, featured DESC, avg_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_parks_geo
  ON parks (state_code, lat, lng) WHERE active;
CREATE INDEX IF NOT EXISTS idx_parks_destination
  ON parks (state_code, destination_slug) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_parks_google_place
  ON parks (google_place_id) WHERE google_place_id IS NOT NULL;

-------------------------------------------------------------------------------
-- 4. Articles — migrated WP content + new editorial
-------------------------------------------------------------------------------
--
-- Every WP post/page from the 7 existing travel sites lands here. Original
-- permalink path is stored in `legacy_path` (e.g. "/best-beaches-qld/") and
-- served at that path via a catch-all route to preserve SEO.

CREATE TABLE IF NOT EXISTS articles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code        TEXT NOT NULL,
  slug              TEXT NOT NULL,
  legacy_path       TEXT,                         -- full original path incl. slashes, e.g. "/cairns-guide/"
  title             TEXT NOT NULL,
  excerpt           TEXT,
  body_html         TEXT,                         -- original WP HTML
  body_md           TEXT,                         -- optional cleaned markdown
  cover_image       TEXT,
  images            JSONB,
  categories        JSONB,                         -- array of category names
  tags              JSONB,                         -- array of tag names
  destination_slug  TEXT,                         -- optional link to a destination hub (boosted in hub "related")
  post_type         TEXT DEFAULT 'post',          -- 'post' | 'page'
  author            TEXT,
  status            TEXT DEFAULT 'published',     -- 'draft' | 'published' | 'archived'
  source            TEXT,                         -- 'wp_import' | 'manual'
  source_raw        JSONB,                         -- raw WP row for rollback / reprocessing
  published_at      TIMESTAMPTZ,
  updated_at_source TIMESTAMPTZ,
  noindex           BOOLEAN DEFAULT false,
  seo_title         TEXT,
  seo_description   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, slug)
);
CREATE INDEX IF NOT EXISTS idx_articles_state_status
  ON articles (state_code, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_state_destination
  ON articles (state_code, destination_slug) WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_legacy_path
  ON articles (state_code, legacy_path) WHERE legacy_path IS NOT NULL;
-- Full-text search on title+excerpt+body for related-article matching on hubs.
CREATE INDEX IF NOT EXISTS idx_articles_fts
  ON articles USING GIN (
    to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(excerpt,'') || ' ' || COALESCE(body_html,''))
  );

-------------------------------------------------------------------------------
-- 5. Audit tables
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wp_import_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code  TEXT NOT NULL,
  action      TEXT NOT NULL,                     -- 'posts' | 'pages' | 'media' | 'summary'
  ok          BOOLEAN NOT NULL,
  count_ok    INT DEFAULT 0,
  count_fail  INT DEFAULT 0,
  details     JSONB,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wp_import_log_state_start
  ON wp_import_log (state_code, started_at DESC);
