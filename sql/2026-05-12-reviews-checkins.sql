-- 2026-05-12 — give autravel its own reviews/checkins tables and stop
-- silently joining places against bugbitten's public.reviews data.
-- Also drops the unmaintained denormalized counts on places (always 0,
-- never updated by app code or trigger). Routes already compute counts
-- via SELECT subqueries.

BEGIN;

CREATE TABLE IF NOT EXISTS autravel.reviews (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         text NOT NULL,
  place_id        uuid NOT NULL,
  overall_rating  numeric NOT NULL,
  rating          integer,
  title           text,
  body            text,
  gps_verified    boolean DEFAULT false,
  gps_lat         numeric,
  gps_lng         numeric,
  media_urls      text[],
  photo_urls      text[],
  images          text[],
  visit_date      date,
  trip_id         uuid,
  tagged_user_ids text[] DEFAULT '{}'::text[],
  like_count      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_autravel_reviews_place ON autravel.reviews (place_id);
CREATE INDEX IF NOT EXISTS idx_autravel_reviews_user  ON autravel.reviews (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_autravel_reviews_user_place ON autravel.reviews (user_id, place_id);

CREATE TABLE IF NOT EXISTS autravel.checkins (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       text NOT NULL,
  place_id      uuid NOT NULL,
  trip_id       uuid,
  gps_lat       numeric NOT NULL,
  gps_lng       numeric NOT NULL,
  lat           numeric,
  lng           numeric,
  gps_verified  boolean DEFAULT false,
  verified_at   timestamptz DEFAULT now(),
  note          text,
  photo_url     text,
  images        text[],
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_autravel_checkins_user  ON autravel.checkins (user_id);
CREATE INDEX IF NOT EXISTS idx_autravel_checkins_place ON autravel.checkins (place_id);

ALTER TABLE autravel.places DROP COLUMN IF EXISTS review_count;
ALTER TABLE autravel.places DROP COLUMN IF EXISTS checkin_count;
ALTER TABLE autravel.places DROP COLUMN IF EXISTS avg_rating;

COMMIT;

-- Both code-side ORDER BY references updated in the same commit:
--   src/app/api/places/route.ts:81 — `p.review_count` → unqualified `review_count` (uses the subquery alias)
--   src/app/country/[country]/page.tsx:36 — same change
