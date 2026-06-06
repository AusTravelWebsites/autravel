-- Admin backend: 404 tracking, redirect groups, user management.
-- Runs after 20260423_autravel_init_v2.sql.

SET search_path = autravel, public;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. redirect_404s — track every 404 hit per tenant
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.redirect_404s (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code    TEXT NOT NULL,
  path          TEXT NOT NULL,
  referrer      TEXT,
  user_agent    TEXT,
  ip            TEXT,
  hit_count     INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, path)
);
CREATE INDEX IF NOT EXISTS idx_autravel_404s_state_last ON autravel.redirect_404s (state_code, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_autravel_404s_state_hits ON autravel.redirect_404s (state_code, hit_count DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. redirect_groups — group redirects like the WP Redirection plugin
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.redirect_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (state_code, name)
);
CREATE INDEX IF NOT EXISTS idx_autravel_redirect_groups_state ON autravel.redirect_groups (state_code) WHERE is_active;

-- Seed a "Default" group per tenant so every new redirect has a home.
INSERT INTO autravel.redirect_groups (state_code, name, description)
SELECT c, 'Default', 'Auto-created default group — assign new redirects here'
FROM (VALUES ('qld'),('nsw'),('vic'),('wa'),('sa'),('tas'),('nt'),('aunz')) AS s(c)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. users — local profile mirrored from Firebase auth
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  TEXT UNIQUE,
  email         TEXT UNIQUE,
  username      TEXT UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  location      TEXT,
  -- Role + tenant scope. is_admin=true means site-wide admin across tenants;
  -- admin_state_codes is reserved for future per-tenant admins (not used yet).
  is_admin            BOOLEAN DEFAULT false,
  admin_state_codes   TEXT[],
  is_banned           BOOLEAN DEFAULT false,
  ban_reason          TEXT,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autravel_users_email ON autravel.users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_autravel_users_admin ON autravel.users (is_admin) WHERE is_admin;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. site_settings — per-tenant key/value store (GA4 IDs, feature flags, etc)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autravel.site_settings (
  state_code  TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (state_code, key)
);
