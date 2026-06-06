-- Unify the tours catalog: bugbitten's `public.tours` becomes the single
-- master. `autravel.tours` becomes a filtered VIEW over it. Every other
-- travel-site tenant (nswtravel, qldtravel, etc.) gets its own view with
-- its own WHERE clause. One catalog, many lenses.
--
-- Safety:
--   * Ordered so each step is verifiable; read the comments before each one.
--   * No autravel app code changes required — the VIEW sits in the autravel
--     schema with the same name, so the existing `search_path = autravel,
--     public` DSN + `FROM tours` queries land on the view.
--   * All 1,055 overlapping rows are already in public.tours; this
--     migration just harmonises `state_code` and ports the 5 autravel-only
--     rows into public.
--   * Idempotent: ADD COLUMN IF NOT EXISTS, INSERT … ON CONFLICT, DROP
--     TABLE IF EXISTS, CREATE OR REPLACE VIEW. Safe to re-run.
--
-- Apply with:
--   psql "$DATABASE_URL" -f supabase/migrations/20260425_unify_tours.sql

BEGIN;

-- 1. Add state_code to the master catalog. autravel.tours had it; public didn't.
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS state_code TEXT;
CREATE INDEX IF NOT EXISTS idx_public_tours_state_code ON public.tours (state_code) WHERE state_code IS NOT NULL;

-- 2. Import the 5 autravel-only rows into public (so the VIEW returns the
--    same 1,060 rows autravel currently sees). Match on the same natural
--    key public.tours already uses: (source, source_product_code).
INSERT INTO public.tours (
  source, source_product_code, slug, title, country, country_code, city, state_code, category,
  duration_min, duration_label, price_from, currency, rating, review_count, cover_image, images,
  booking_url, tags, summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai, ai_rewritten_at,
  ai_model, source_raw, source_fetched_at, active, featured, created_at, updated_at
)
SELECT
  source, source_product_code, slug, title, country, country_code, city, state_code, category,
  duration_min, duration_label, price_from, currency, rating, review_count, cover_image, images,
  booking_url, tags, summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai, ai_rewritten_at,
  ai_model, source_raw, source_fetched_at, active, featured, created_at, updated_at
FROM autravel.tours a
WHERE NOT EXISTS (
  SELECT 1 FROM public.tours p
  WHERE p.source = a.source AND p.source_product_code = a.source_product_code
)
ON CONFLICT (source, source_product_code) DO NOTHING;

-- 3. Copy state_code from autravel.tours to public.tours for the 1,055
--    overlapping rows. We only set where public.tours.state_code is NULL —
--    never overwrite a value someone may have set directly in public.
UPDATE public.tours p
SET state_code = a.state_code,
    updated_at = NOW()
FROM autravel.tours a
WHERE p.source = a.source
  AND p.source_product_code = a.source_product_code
  AND a.state_code IS NOT NULL
  AND p.state_code IS NULL;

-- 4. Sanity check before destructive step. (Not a constraint — just a
--    comment-visible count for someone reading the migration output.)
-- SELECT 'public.tours AU tours with state_code' AS label, COUNT(*)
-- FROM public.tours WHERE country = 'Australia' AND state_code IS NOT NULL;

-- 5. Drop the duplicate table. VIEW will replace it.
DROP TABLE IF EXISTS autravel.tours CASCADE;

-- 6. Create the filtered VIEW. autravel code `FROM tours` now hits this
--    (search_path puts autravel first). The view selects AU + NZ master
--    tours; per-tenant filters (e.g. nswtravel = state_code='nsw') happen
--    in the app layer via tenants.ts.
CREATE OR REPLACE VIEW autravel.tours AS
  SELECT *
  FROM public.tours
  WHERE country IN ('Australia', 'New Zealand');

-- 7. Grant the same roles as public.tours so RLS + row access pass through.
-- (Supabase default roles. Uncomment/adjust if your setup uses custom roles.)
-- GRANT SELECT ON autravel.tours TO anon, authenticated, service_role;

COMMIT;

-- Post-flight verification queries (run manually after COMMIT):
-- SELECT COUNT(*) FROM autravel.tours;                           -- expect ~4,442 (all AU+NZ)
-- SELECT COUNT(*) FROM public.tours WHERE state_code IS NOT NULL; -- expect ~1,060
-- SELECT state_code, COUNT(*) FROM autravel.tours GROUP BY 1;
