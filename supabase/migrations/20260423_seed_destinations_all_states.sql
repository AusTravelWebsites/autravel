-- Seed destination hubs for NSW, VIC, WA, SA, TAS, NT (QLD already seeded).
-- Run after 20260423_autravel_init_v2.sql.
-- UPSERTs so re-runs are safe.
--
-- Each destination has: state_code, slug, name, region, intro, lat, lng,
-- radius_km, is_featured, display_order, active. Intros are short editorial
-- copy describing the area; body (long-form guide) is left null and can be
-- filled in via /admin/destinations.

SET search_path = autravel, public;

-- ───────────────────────────── NEW SOUTH WALES ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('nsw', 'sydney',            'Sydney',             'Greater Sydney',        'Harbour icon — Opera House, Bondi, the Blue Mountains day trip and the gateway to the NSW coast.', -33.8688, 151.2093, 40, true,  10, true),
  ('nsw', 'blue-mountains',    'Blue Mountains',     'Greater Sydney',        'Eucalyptus-blue bushland, Three Sisters, cliff-top walks and Leura / Katoomba cafes — 90 min west of Sydney.', -33.7000, 150.3000, 50, true,  20, true),
  ('nsw', 'byron-bay',          'Byron Bay',          'North Coast',           'Lighthouse headland, east-coast sunrise beaches, hinterland markets and the surf-and-yoga capital of Australia.', -28.6434, 153.6122, 25, true,  30, true),
  ('nsw', 'hunter-valley',      'Hunter Valley',      'Hunter Region',         '150+ wineries, Semillon heartland, boutique stays and hot-air-balloon mornings 2 hours north of Sydney.', -32.7500, 151.3167, 35, true,  40, true),
  ('nsw', 'port-stephens',      'Port Stephens',      'Hunter Region',         'Dolphin-watching capital — Stockton sand dunes, Shoal Bay and a family-friendly base north of Newcastle.', -32.7094, 152.0779, 25, false, 50, true),
  ('nsw', 'port-macquarie',     'Port Macquarie',     'Mid North Coast',       'Koala Hospital, nine beaches, coastal walk and mid-north-coast holiday hub.', -31.4333, 152.9000, 25, false, 60, true),
  ('nsw', 'coffs-harbour',      'Coffs Harbour',      'Mid North Coast',       'Big Banana, Solitary Islands marine park and whale-watching on the sub-tropical coast.', -30.2963, 153.1135, 25, false, 70, true),
  ('nsw', 'snowy-mountains',    'Snowy Mountains',    'Snowy Mountains',       'Thredbo and Perisher for winter snow; Kosciuszko summit walks and fly-fishing in summer.', -36.5000, 148.3500, 60, true,  80, true),
  ('nsw', 'south-coast',        'South Coast',        'Illawarra & South Coast','Jervis Bay''s whitest-sand beaches, Kiama blowhole, Eurobodalla and the wild Sapphire Coast.', -35.0000, 150.5000, 80, false, 90, true),
  ('nsw', 'jervis-bay',         'Jervis Bay',         'Illawarra & South Coast','Hyams Beach (whitest sand in the world), Booderee National Park and crystal-clear marine reserve.', -35.1167, 150.7667, 20, false, 100, true),
  ('nsw', 'central-coast',      'Central Coast',      'Central Coast',         'Between Sydney and Newcastle — Terrigal, The Entrance pelicans and family caravan-park country.', -33.4167, 151.3500, 35, false, 110, true),
  ('nsw', 'newcastle',          'Newcastle',          'Hunter Region',         'Harbour-side city with surf beaches, Fort Scratchley and a craft-brewery scene.', -32.9283, 151.7817, 20, false, 120, true),
  ('nsw', 'wollongong',         'Wollongong',         'Illawarra & South Coast','Escarpment-to-sea drive, Sea Cliff Bridge and 17 patrolled beaches an hour south of Sydney.', -34.4278, 150.8931, 25, false, 130, true),
  ('nsw', 'mudgee',             'Mudgee',             'Central West',          'Wine, honey, olive groves and historic gold-mining towns 4 hours NW of Sydney.', -32.5947, 149.5881, 30, false, 140, true),
  ('nsw', 'orange',             'Orange',             'Central West',          'Cool-climate wine, autumn colour, heritage main street at the foot of Mt Canobolas.', -33.2833, 149.1000, 25, false, 150, true),
  ('nsw', 'lord-howe-island',   'Lord Howe Island',   'Lord Howe Island',      'UNESCO world-heritage island 600 km off the coast — snorkelling, walks and just 400 visitors allowed at a time.', -31.5553, 159.0820, 15, false, 160, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ───────────────────────────── VICTORIA ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('vic', 'melbourne',              'Melbourne',              'Greater Melbourne',    'Laneway coffee, world-class dining, sport obsessions and the gateway to every great Victorian road trip.', -37.8136, 144.9631, 40, true,  10, true),
  ('vic', 'great-ocean-road',       'Great Ocean Road',       'Great Ocean Road',     '243 km of coastal drama — Twelve Apostles, Loch Ard Gorge, rainforest hinterland and surf breaks.', -38.6807, 143.5910, 80, true,  20, true),
  ('vic', 'phillip-island',         'Phillip Island',         'Phillip Island',       'Penguin Parade, Grand Prix, Koala Conservation Centre and Cowes beach — 90 min from Melbourne.', -38.4833, 145.2333, 20, true,  30, true),
  ('vic', 'mornington-peninsula',   'Mornington Peninsula',   'Mornington Peninsula', 'Hot springs, vineyards, bayside beaches and wild ocean surf at Point Nepean.', -38.3000, 144.8500, 25, true,  40, true),
  ('vic', 'yarra-valley',           'Yarra Valley',           'Yarra Valley',         '80+ cellar doors, Healesville Sanctuary and sparkling-wine country 60 min from the CBD.', -37.6500, 145.5000, 25, false, 50, true),
  ('vic', 'dandenong-ranges',       'Dandenong Ranges',       'Yarra Valley',         'Cool-climate fern gullies, Puffing Billy steam train and SkyHigh sunset over Melbourne.', -37.8667, 145.3500, 20, false, 60, true),
  ('vic', 'grampians',              'Grampians',              'Grampians',            'Rock art, waterfalls, sandstone ridges and one of Australia''s great bushwalking regions.', -37.2500, 142.3500, 40, true,  70, true),
  ('vic', 'wilsons-promontory',     'Wilsons Promontory',     'Gippsland',            'Southernmost tip of mainland Australia — granite mountains dropping into turquoise bays.', -39.0333, 146.4167, 30, false, 80, true),
  ('vic', 'gippsland',              'Gippsland',              'Gippsland',            'Ninety-Mile Beach, Lakes Entrance, dairy country and alpine high plains out east.', -37.9000, 147.5000, 100, false, 90, true),
  ('vic', 'daylesford',             'Daylesford',             'Goldfields',           'Mineral springs, spa retreats and a foodie weekend destination 90 min NW of Melbourne.', -37.3333, 144.1500, 15, false, 100, true),
  ('vic', 'murray-river',           'Murray River',           'Murray River',         'Echuca paddlesteamers, Mildura citrus and the river-country border with NSW.', -36.1000, 144.7000, 80, false, 110, true),
  ('vic', 'bright',                 'Bright',                 'High Country',         'Autumn colour capital, Mount Buffalo and gateway to the Alpine National Park.', -36.7333, 146.9667, 25, false, 120, true),
  ('vic', 'mount-buller',           'Mount Buller',           'High Country',         'Premier snow-sports village 3 hours from Melbourne; summer mountain-biking and hiking too.', -37.1333, 146.4500, 20, false, 130, true),
  ('vic', 'geelong-bellarine',      'Geelong & Bellarine',    'Great Ocean Road',     'Waterfront Geelong, Queenscliff heritage and a quieter Bellarine wine scene.', -38.1499, 144.3617, 30, false, 140, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ───────────────────────────── WESTERN AUSTRALIA ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('wa', 'perth',           'Perth',           'Greater Perth',      'Kings Park, Cottesloe sunset, Rottnest ferry and Australia''s sunniest capital.', -31.9505, 115.8605, 30, true,  10, true),
  ('wa', 'margaret-river',  'Margaret River',  'South West',         'Premium wine, surf breaks, limestone caves and old-growth karri forest 3 hours south of Perth.', -33.9551, 115.0753, 35, true,  20, true),
  ('wa', 'rottnest-island', 'Rottnest Island', 'Greater Perth',      'Car-free island 19 km off Fremantle — quokkas, bike loops and 63 beaches.', -32.0094, 115.5197, 10, true,  30, true),
  ('wa', 'broome',          'Broome',          'Kimberley',          'Cable Beach camel sunsets, Staircase to the Moon and gateway to the Kimberley.', -17.9614, 122.2359, 30, true,  40, true),
  ('wa', 'exmouth-ningaloo','Exmouth & Ningaloo','Coral Coast',      'Whale-shark swims, Ningaloo Reef snorkel straight off the beach and Cape Range gorges.', -21.9323, 114.1311, 50, true,  50, true),
  ('wa', 'kalgoorlie',      'Kalgoorlie',      'Goldfields-Esperance','Super Pit gold mine, Edwardian main street and stepping stone to the Nullarbor.', -30.7489, 121.4664, 25, false, 60, true),
  ('wa', 'esperance',       'Esperance',       'Goldfields-Esperance','Lucky Bay kangaroos, white-sand beaches and Cape Le Grand National Park.', -33.8613, 121.8915, 30, false, 70, true),
  ('wa', 'karijini',        'Karijini',        'Pilbara',            'Hamersley Range gorges — Circular Pool, Kermits Pool and iron-ore-country canyons.', -22.4833, 118.2833, 40, false, 80, true),
  ('wa', 'albany',          'Albany',          'South Coast',        'The Gap, Middleton Beach and the windswept south coast''s original colonial port.', -35.0229, 117.8811, 25, false, 90, true),
  ('wa', 'coral-coast',     'Coral Coast',     'Coral Coast',        'Shark Bay, Monkey Mia dolphins, Kalbarri, Pinnacles and the full western-coast drive north of Perth.', -25.5000, 114.0000, 200, false, 100, true),
  ('wa', 'fremantle',       'Fremantle',       'Greater Perth',      'Heritage port, weekend markets, craft brewers and WA''s maritime museum district.', -32.0569, 115.7439, 8, false, 110, true),
  ('wa', 'pinnacles-desert','Pinnacles Desert','Coral Coast',        'Limestone pillar-country in Nambung National Park — a 2-hour day trip up the Indian Ocean Drive.', -30.6167, 115.1500, 15, false, 120, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ───────────────────────────── SOUTH AUSTRALIA ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('sa', 'adelaide',            'Adelaide',            'Adelaide',            'Festival-city laneways, central market and the start of every great SA wine drive.', -34.9285, 138.6007, 30, true,  10, true),
  ('sa', 'barossa-valley',      'Barossa Valley',      'Barossa',             'Australia''s most famous wine region — Shiraz country, heritage bakeries and Seppeltsfield 1-hour from Adelaide.', -34.5167, 138.9500, 25, true,  20, true),
  ('sa', 'kangaroo-island',     'Kangaroo Island',     'Kangaroo Island',     'Wild coastline, sea-lions at Seal Bay, Remarkable Rocks and Flinders Chase bushwalks.', -35.7783, 137.2144, 60, true,  30, true),
  ('sa', 'flinders-ranges',     'Flinders Ranges',     'Flinders & Outback',  'Wilpena Pound amphitheatre, outback road trips and some of SA''s wildest bushwalking.', -31.4500, 138.5333, 80, true,  40, true),
  ('sa', 'fleurieu-peninsula',  'Fleurieu Peninsula',  'Fleurieu',            'Victor Harbor whales, Granite Island, surf and Seppeltsfield-adjacent wine.', -35.5500, 138.6167, 30, false, 50, true),
  ('sa', 'mclaren-vale',        'McLaren Vale',        'Fleurieu',            'Shiraz, Grenache and 80 cellar doors 40 min south of Adelaide.', -35.2167, 138.5500, 15, false, 60, true),
  ('sa', 'clare-valley',        'Clare Valley',        'Clare',               'Riesling country with the Riesling Trail cycleway winding between historic townships.', -33.8333, 138.6167, 25, false, 70, true),
  ('sa', 'eyre-peninsula',      'Eyre Peninsula',      'Eyre Peninsula',      'Great Australian Bight cliffs, cage-diving with great whites and Coffin Bay oysters.', -34.0000, 135.5000, 200, false, 80, true),
  ('sa', 'coober-pedy',         'Coober Pedy',         'Outback',             'Underground opal-mining town and the landscape that stood in for Mad Max 3.', -29.0167, 134.7500, 20, false, 90, true),
  ('sa', 'riverland',           'Riverland',           'Riverland',           'Murray-River houseboating, citrus orchards and Berri / Renmark stepping-stone towns.', -34.2833, 140.6000, 60, false, 100, true),
  ('sa', 'limestone-coast',     'Limestone Coast',     'Limestone Coast',     'Mount Gambier''s Blue Lake, Naracoorte caves and the Coonawarra Cabernet strip.', -37.0000, 140.5000, 100, false, 110, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ───────────────────────────── TASMANIA ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('tas', 'hobart',             'Hobart',              'Hobart Region',      'MONA, Salamanca Market, Mt Wellington summit and the southernmost Australian capital.', -42.8821, 147.3272, 25, true,  10, true),
  ('tas', 'launceston',         'Launceston',          'Launceston Region',  'Cataract Gorge in-town, Tamar Valley wine and the north''s heritage-city base.', -41.4391, 147.1358, 25, true,  20, true),
  ('tas', 'cradle-mountain',    'Cradle Mountain',     'Cradle Country',     'Iconic dolerite peak, Dove Lake circuit and the start of the Overland Track.', -41.6833, 145.9500, 25, true,  30, true),
  ('tas', 'freycinet',          'Freycinet Peninsula', 'East Coast',         'Wineglass Bay lookout, pink-granite Hazards and kayaking the sheltered coves.', -42.1597, 148.2956, 25, true,  40, true),
  ('tas', 'port-arthur',        'Port Arthur',         'Tasman Peninsula',   'World-heritage convict settlement, ghost-tour evenings and Tasman cliffs day trips.', -43.1467, 147.8511, 20, false, 50, true),
  ('tas', 'bay-of-fires',       'Bay of Fires',        'East Coast',         'Orange-lichen granite boulders against aqua water — one of the world''s most photographed beaches.', -41.0500, 148.2833, 30, false, 60, true),
  ('tas', 'bruny-island',       'Bruny Island',        'Hobart Region',      'Ferry from Kettering — oysters, cheese, penguins and the Neck isthmus viewpoint.', -43.3833, 147.3333, 25, false, 70, true),
  ('tas', 'tasman-peninsula',   'Tasman Peninsula',    'Tasman Peninsula',   'Three Capes walk, Tasman Arch, Devil''s Kitchen and the Remarkable Cave.', -43.1000, 147.8500, 30, false, 80, true),
  ('tas', 'strahan',            'Strahan',             'West Coast',         'Gordon River cruises, Macquarie Harbour wilderness and the wild west-coast port.', -42.1500, 145.3333, 30, false, 90, true),
  ('tas', 'huon-valley',        'Huon Valley',         'Hobart Region',      'Apple country, Tahune AirWalk and the southern hemisphere''s tallest hardwood trees.', -43.0333, 146.9667, 30, false, 100, true),
  ('tas', 'east-coast',         'East Coast Tasmania', 'East Coast',         'St Helens to Bicheno to Coles Bay — the sunniest stretch of coastline in the state.', -41.8000, 148.3000, 70, false, 110, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ───────────────────────────── NORTHERN TERRITORY ─────────────────────────────
INSERT INTO autravel.destinations (state_code, slug, name, region, intro, lat, lng, radius_km, is_featured, display_order, active) VALUES
  ('nt', 'darwin',              'Darwin',              'Top End',          'Tropical capital — Mindil Beach sunset market, Litchfield day trips and the Kakadu jump-off.', -12.4634, 130.8456, 30, true,  10, true),
  ('nt', 'uluru',               'Uluru',               'Red Centre',       'Ayers Rock sunrise, sunset and the Field of Light — the spiritual heart of Australia.', -25.3444, 131.0369, 30, true,  20, true),
  ('nt', 'kakadu',              'Kakadu',              'Top End',          'World-heritage wetlands, rock art at Ubirr, Jim Jim Falls and croc-filled billabongs.', -13.1333, 132.5000, 80, true,  30, true),
  ('nt', 'alice-springs',        'Alice Springs',       'Red Centre',       'MacDonnell Ranges base camp, Todd River riverbed and the Royal Flying Doctor Service HQ.', -23.6980, 133.8807, 30, true,  40, true),
  ('nt', 'kings-canyon',        'Kings Canyon',        'Red Centre',       'Watarrka National Park — the Rim Walk, Lost City and red sandstone cliffs.', -24.2667, 131.4833, 25, false, 50, true),
  ('nt', 'litchfield',          'Litchfield',          'Top End',          'Wangi, Florence and Buley Rockhole swimming — an easier, croc-light Kakadu alternative.', -13.2000, 130.7667, 35, false, 60, true),
  ('nt', 'katherine',           'Katherine',           'Top End',          'Nitmiluk (Katherine) Gorge cruises, Edith Falls and the Stuart Highway hub.', -14.4667, 132.2667, 30, false, 70, true),
  ('nt', 'macdonnell-ranges',   'MacDonnell Ranges',   'Red Centre',       'East & West MacDonnells — Ormiston, Ellery Creek, Standley Chasm bushwalking and the Larapinta Trail.', -23.7000, 133.0000, 70, false, 80, true),
  ('nt', 'arnhem-land',         'Arnhem Land',         'Top End',          'Permit-access Aboriginal land — rock art, Injalak Hill, buffalo safaris and remote fishing.', -12.6500, 134.0000, 100, false, 90, true),
  ('nt', 'tiwi-islands',        'Tiwi Islands',        'Top End',          'Bathurst + Melville — AFL-mad island community, art centres and day-trip ferries from Darwin.', -11.5833, 130.7500, 30, false, 100, true)
ON CONFLICT (state_code, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();
