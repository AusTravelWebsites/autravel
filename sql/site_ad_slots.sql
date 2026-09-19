-- Hand-placed AdSense slots, one row per tenant + position.
-- Mirrors the stkp_ad_slots wp_option on stkildapenguins: an empty slot_id means
-- the placement renders nothing, so the code can ship before any slot exists and
-- a placement can be pulled without a deploy.
CREATE TABLE IF NOT EXISTS autravel.site_ad_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code  text NOT NULL,
  placement   text NOT NULL CHECK (placement IN ('in_article_1','in_article_2','content_end','home_mid')),
  slot_id     text NOT NULL DEFAULT '',
  ad_client   text NOT NULL DEFAULT 'ca-pub-4240720052276636',
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, placement)
);
CREATE INDEX IF NOT EXISTS idx_autravel_ad_slots_active
  ON autravel.site_ad_slots (state_code) WHERE is_active AND slot_id <> '';
