-- 2026-05-13 — autravel.tours is a VIEW over public.tours (filtered to AU+NZ).
-- public.tours has 12 indexes but NONE on `country`, so the homepage
-- GROUP BY country / category aggregations seq-scanned 46k rows. Under load
-- multiple concurrent aggregations hit the 10s statement_timeout and piled up
-- — qld/nsw went down repeatedly today (2026-05-13).
--
-- Indexes added to public.tours (the only place they can live, since views
-- can't be indexed). Both partial-on-active so they stay small and only
-- benefit the live-tour read path that autravel cares about. BugBitten queries
-- get the same or faster with negligible write-side cost.
--
-- CONCURRENTLY so this can run on a live table without blocking writes.
-- (Cannot wrap in a transaction; postgres rejects CONCURRENTLY in BEGIN.)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tours_state_country
  ON public.tours (state_code, country)
  WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tours_state_category
  ON public.tours (state_code, category)
  WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tours_country_active
  ON public.tours (country)
  WHERE active = true;
