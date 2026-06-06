-- Seed QLD destination hubs (pilot tenant).
-- Run after 20260423_autravel_init_v2.sql.
-- UPSERTs so re-runs are safe.

SET search_path = autravel, public;

INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active)
VALUES
  ('qld', 'brisbane',           'Brisbane',           'South East Queensland', 'Queensland''s sub-tropical capital — riverside city life, South Bank parklands, Fortitude Valley nightlife and the gateway to Moreton Bay.', -27.4705, 153.0260, 30, true,  10, true),
  ('qld', 'gold-coast',          'Gold Coast',         'South East Queensland', 'Surfers Paradise beaches, theme parks, the Hinterland rainforest and Byron-adjacent south coast breaks.', -28.0167, 153.4000, 35, true,  20, true),
  ('qld', 'sunshine-coast',      'Sunshine Coast',     'South East Queensland', 'Noosa, Mooloolaba, the Glass House Mountains and a laid-back beach-and-hinterland combo.', -26.6500, 153.0667, 45, true,  30, true),
  ('qld', 'noosa',               'Noosa',              'Sunshine Coast',        'National park headland, Hastings St boutiques and the Everglades — the polished face of the Sunshine Coast.', -26.3985, 153.1094, 15, true,  40, true),
  ('qld', 'cairns',              'Cairns',             'Far North Queensland',  'Tropical base camp for the Great Barrier Reef, Daintree Rainforest and the Atherton Tablelands.', -16.9186, 145.7781, 40, true,  50, true),
  ('qld', 'port-douglas',        'Port Douglas',       'Far North Queensland',  'Boutique reef-and-rainforest town, Four Mile Beach and the most accessible corner of the Daintree.', -16.4834, 145.4630, 25, true,  60, true),
  ('qld', 'whitsundays',         'Whitsundays',        'Central Queensland',    '74 islands, Whitehaven Beach, Hamilton and Hayman — the sailing capital of the Great Barrier Reef.', -20.2830, 148.7181, 60, true,  70, true),
  ('qld', 'airlie-beach',        'Airlie Beach',       'Whitsundays',           'Mainland launchpad for the Whitsundays — marina, lagoon and the jump-off for every reef and island trip.', -20.2683, 148.7183, 20, false, 80, true),
  ('qld', 'fraser-island',       'K''gari (Fraser Island)', 'Wide Bay-Burnett', 'World''s largest sand island — 4WD beaches, Lake McKenzie, the Maheno wreck and dingo-country bushland.', -25.2499, 153.1349, 50, true,  90, true),
  ('qld', 'hervey-bay',          'Hervey Bay',         'Wide Bay-Burnett',      'Whale-watching capital and the gateway to K''gari (Fraser Island).', -25.2882, 152.8186, 30, false, 100, true),
  ('qld', 'great-barrier-reef',  'Great Barrier Reef', 'Queensland coast',      'The world''s largest coral reef system — dive, snorkel and sail across 2300 km of UNESCO-listed coastline.', -18.2871, 147.6992, 150, true, 110, true),
  ('qld', 'atherton-tablelands', 'Atherton Tablelands', 'Far North Queensland', 'High-country rainforest, waterfalls, crater lakes and boutique farm-gate food behind Cairns.', -17.2680, 145.4760, 45, false, 120, true),
  ('qld', 'townsville',          'Townsville',         'North Queensland',      'Reef-and-garrison city, Magnetic Island wallabies, Castle Hill and the Museum of Tropical Queensland.', -19.2589, 146.8169, 30, false, 130, true),
  ('qld', 'magnetic-island',     'Magnetic Island',    'North Queensland',      'A 20-minute ferry from Townsville: koala-bushwalks, Horseshoe Bay and quiet national-park beaches.', -19.1589, 146.8500, 12, false, 140, true),
  ('qld', 'mackay',              'Mackay',             'Central Queensland',    'Eungella rainforest platypus, Cape Hillsborough sunrise roos and the sugarcane-and-coal heart of CQ.', -21.1411, 149.1861, 40, false, 150, true),
  ('qld', 'rockhampton',         'Rockhampton',        'Central Queensland',    'Beef capital, Capricorn Caves and the launchpad for Great Keppel Island.', -23.3800, 150.5000, 40, false, 160, true),
  ('qld', 'bundaberg',           'Bundaberg',          'Wide Bay-Burnett',      'Rum, turtles at Mon Repos and the southern reef island gateway (Lady Elliot, Lady Musgrave).', -24.8660, 152.3489, 30, false, 170, true),
  ('qld', 'gold-coast-hinterland', 'Gold Coast Hinterland', 'South East Queensland', 'Rainforest walks, glow worms, Tamborine Mountain wineries and Lamington National Park.', -28.2167, 153.1833, 30, false, 180, true),
  ('qld', 'outback-qld',         'Outback Queensland', 'Outback',               'Winton dinosaur trail, Longreach Qantas founders museum, Birdsville, Mount Isa and the Stockman''s Hall of Fame.', -23.4425, 144.2497, 250, false, 190, true),
  ('qld', 'gladstone',           'Gladstone',          'Central Queensland',    'Harbour city and stepping-stone to Heron Island and the southern Great Barrier Reef cays.', -23.8433, 151.2689, 25, false, 200, true),
  ('qld', 'rainbow-beach',       'Rainbow Beach',      'Wide Bay-Burnett',      'Coloured sand cliffs, Double Island Point 4WD beach and the southern route to K''gari.', -25.9050, 153.0911, 20, false, 210, true),
  ('qld', 'stradbroke-island',   'North Stradbroke Island', 'Moreton Bay',      '"Straddie" — Moreton Bay''s big sand-island cousin: gorges, surf beaches and 20+ beach camping areas.', -27.5500, 153.4500, 20, false, 220, true)
ON CONFLICT (state_code, slug) DO UPDATE SET
  -- keep destinations in-place; idempotent re-seeding is fine.
  name = EXCLUDED.name, region = EXCLUDED.region, intro = EXCLUDED.intro,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, radius_km = EXCLUDED.radius_km,
  is_featured = EXCLUDED.is_featured, display_order = EXCLUDED.display_order, active = EXCLUDED.active,
  updated_at = NOW();
