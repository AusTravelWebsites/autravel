#!/usr/bin/env node
/**
 * seed-offroad-tracks.mjs — create autravel.tracks and seed the curated set of
 * iconic Australian off-road / outback 4WD tracks for The Australian Explorer
 * (state_code='auex'). Idempotent (CREATE TABLE IF NOT EXISTS + UPSERT on slug).
 *
 *   node --env-file=.env.local scripts/seed-offroad-tracks.mjs
 *
 * Structured facts grounded in well-known public info; the rich guide copy is
 * generated separately by scripts/enrich-tracks.mjs.
 */
import 'dotenv/config'
import postgres from 'postgres'

const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 4 })
const STATE = 'auex'

await sql`
  CREATE TABLE IF NOT EXISTS autravel.tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    region text,
    states text[] DEFAULT '{}',
    grade text,                 -- 'Easy 4WD' | 'Moderate 4WD' | 'Hard 4WD' | 'Extreme'
    length_km int,
    days text,                  -- '4-6 days'
    best_season text,
    permits text,
    fuel_range text,
    water text,
    remoteness text,            -- 'Moderate' | 'High' | 'Extreme'
    corrugations text,
    recovery_gear text,
    epirb_recommended boolean DEFAULT true,
    lat numeric(9,6), lng numeric(9,6),
    blurb text,                 -- short curated factual seed (AI grounding)
    description_ai text,
    highlights_ai jsonb,
    what_to_expect_ai text,
    good_to_know_ai text,
    cover_image text,
    seo_title text, seo_description text,
    source text DEFAULT 'curated',
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (state_code, slug)
  )`
await sql`CREATE INDEX IF NOT EXISTS idx_tracks_state_active ON autravel.tracks (state_code, active)`
await sql`CREATE INDEX IF NOT EXISTS idx_tracks_state_grade ON autravel.tracks (state_code, grade) WHERE active`

// [name, region, states, grade, length_km, days, best_season, permits, fuel_range, water, remoteness, corrugations, lat, lng, blurb]
const T = [
  ['Canning Stock Route','Western Desert, WA',['wa'],'Extreme',1850,'14-21 days','May–Sep','Yes — DBCA + traditional-owner permits','Fuel drop required (no fuel ~1100 km)','Carry all water; wells unreliable','Extreme','Severe',-23.2,124.5,'The longest and most remote stock route in the world, 51 wells from Halls Creek to Wiluna. Sand dunes, deep corrugations, total self-sufficiency and a fuel drop are mandatory.'],
  ['Gibb River Road','Kimberley, WA',['wa'],'Moderate 4WD',660,'5-7 days','May–Oct','No (station/gorge entry fees)','Stations every 200–300 km','Gorges & stations','High','Severe',-16.4,126.2,'The Kimberley\'s legendary cattle-country road linking Derby and Kununurra, with side tracks to Bell, Manning, El Questro and Mitchell Falls. Corrugations and river crossings; closed in the wet.'],
  ['Old Telegraph Track (Cape York)','Cape York, QLD',['qld'],'Hard 4WD',350,'5-7 days','Jun–Oct','No','Bramwell, Moreton, Bamaga','Creek crossings','High','Moderate',-11.5,142.5,'The OTT is Cape York\'s rite of passage — Palm, Gunshot, Nolan\'s and the Jardine catchment creek crossings. Hard, scenic and best tackled in a convoy in the dry.'],
  ['Simpson Desert — French Line','Simpson Desert, NT/SA/QLD',['nt','sa','qld'],'Hard 4WD',500,'4-6 days','Apr–Sep (closed summer)','Desert Parks Pass','Mt Dare / Birdsville only','Carry all water','Extreme','Soft sand',-25.5,137.0,'The classic west-to-east desert crossing over 1,100+ parallel dunes to Big Red and Birdsville. Sand flags, lowered tyres and full self-sufficiency required; park closed Dec–mid Mar.'],
  ['Madigan Line','Simpson Desert, NT/SA',['nt','sa'],'Extreme',670,'6-8 days','May–Aug','Desert Parks Pass','None — carry all fuel','Carry all water','Extreme','Soft sand, scrub',-25.0,136.5,'The remote northern Simpson crossing following Madigan\'s 1939 camps. No fuel, no water, no tracks-side help — the desert at its most committing.'],
  ['Birdsville Track','Outback SA/QLD',['sa','qld'],'Easy 4WD',517,'1-2 days','Apr–Oct','No','Marree, Mungerannie, Birdsville','Carry water','High','Moderate',-27.5,138.5,'A formed outback road from Marree to Birdsville across the Sturt Stony Desert. Manageable in a 2WD in the dry but treacherous when wet; iconic dust, gibber and big skies.'],
  ['Oodnadatta Track','Outback SA',['sa'],'Easy 4WD',620,'2-3 days','Apr–Oct','No','Marree, William Creek, Oodnadatta','Carry water','High','Moderate',-28.0,135.7,'Follows the old Ghan railway and Overland Telegraph past Lake Eyre, mound springs and ruins. A formed dirt road suiting most high-clearance vehicles in the dry.'],
  ['Strzelecki Track','Outback SA',['sa'],'Easy 4WD',460,'1-2 days','Apr–Oct','No','Lyndhurst, Innamincka','Carry water','High','Moderate',-28.7,140.0,'Lyndhurst to Innamincka through the Strzelecki Desert and Cooper Creek country — Burke and Wills, gas fields and Sturt\'s desert pea. A wide formed road, slippery when wet.'],
  ['Gunbarrel Highway','Gibson Desert, WA/NT',['wa','nt'],'Hard 4WD',1350,'5-8 days','May–Sep','Yes — Aboriginal-land permits','Warburton, Carnegie','Carry all water','Extreme','Severe',-25.2,126.0,'Len Beadell\'s original Gibson Desert road — the old Gunbarrel is rough, overgrown and remote, a true desert expedition for self-sufficient convoys.'],
  ['Anne Beadell Highway','Great Victoria Desert, SA/WA',['sa','wa'],'Hard 4WD',1350,'6-9 days','May–Sep','Yes — multiple (Maralinga, Aboriginal lands, Woomera)','Coober Pedy, Ilkurlka, Laverton','Carry all water','Extreme','Severe',-29.5,131.0,'A 1,300 km desert traverse from Coober Pedy to Laverton across the Great Victoria Desert. Several permits, vast distances and zero services — deep-outback only.'],
  ['Tanami Track','Tanami Desert, NT/WA',['nt','wa'],'Moderate 4WD',1000,'2-3 days','Apr–Oct','Yes — Aboriginal-land transit permit','Tilmouth Well, Billiluna','Carry water','High','Severe corrugations',-20.5,130.0,'The dusty short-cut between Alice Springs and Halls Creek across the Tanami. Long, corrugated and remote, with a single fuel option mid-way; mining-road sections.'],
  ['Plenty Highway','NT/QLD outback',['nt','qld'],'Moderate 4WD',740,'2-3 days','Apr–Oct','No','Gemtree, Jervois, Boulia','Carry water','High','Severe corrugations',-22.9,136.0,'Part of the Outback Way linking Alice Springs to Boulia, the Plenty is notorious for bone-shaking corrugations and big distances between fuel. Gem fossicking at Gemtree.'],
  ['Outback Way (Great Central Road)','WA/NT/QLD',['wa','nt','qld'],'Moderate 4WD',1100,'4-6 days','Apr–Oct','Yes — Aboriginal-land permits (WA/NT)','Laverton, Warburton, Warakurna, Yulara','Carry water','High','Corrugations',-25.8,127.5,'Australia\'s longest short-cut, Laverton to Winton — the Great Central Road section crosses the Centre past Uluru and the Docker River. Permits and a tough, corrugated surface.'],
  ['Cape York Telegraph Road (Bamaga Rd)','Cape York, QLD',['qld'],'Moderate 4WD',1000,'7-14 days','Jun–Oct','No','Coen, Bramwell, Bamaga','Carry water','High','Corrugations',-12.5,142.6,'The main Peninsula Developmental and Bamaga roads to the Tip of Australia — long corrugated dirt with the OTT as an optional hard alternative. The classic Cape pilgrimage.'],
  ['Kalumburu Road','Kimberley, WA',['wa'],'Hard 4WD',267,'2-4 days','May–Sep','Yes — community + Mitchell Plateau','Drysdale River Station','Carry water','High','Severe',-14.9,126.6,'The rough northern Kimberley road off the Gibb to Mitchell Falls and Kalumburu. Sharp rock, corrugations and creek crossings; carry two spares.'],
  ['Mitchell Falls Track (Port Warrender Rd)','Kimberley, WA',['wa'],'Hard 4WD',85,'1-2 days','May–Sep','Yes — Mitchell River NP','Drysdale River Station','Carry water','High','Severe',-14.8,125.7,'The brutal but spectacular spur to Punamii-Uunpuu (Mitchell Falls) — slow, rocky and corrugated, ending at a short walk to one of the Kimberley\'s great waterfalls.'],
  ['Steep Point Track','Shark Bay, WA',['wa'],'Hard 4WD',60,'1-2 days','Apr–Oct','Yes — DBCA camping/access','Denham, Overlander','Carry water','Moderate','Soft sand',-26.1,113.2,'Sand-driving to the westernmost point of mainland Australia — soft dunes, big tides and world-class shore fishing. Tyres down and momentum.'],
  ['Googs Track','Eyre Peninsula, SA',['sa'],'Hard 4WD',200,'2 days','Apr–Oct','No','Ceduna, Glendambo','Carry water','Moderate','Soft sand',-31.5,133.5,'A privately built track over ~360 sand dunes between Ceduna and the transcontinental railway — a great first desert-style trip with soft, scenic dune running.'],
  ['Holland Track','Wheatbelt/Goldfields, WA',['wa'],'Hard 4WD',600,'3-5 days','Apr–Oct','No','Hyden, Coolgardie','Carry water','Moderate','Mud, scrub, ruts',-32.2,119.8,'John Holland\'s 1893 gold-rush route from Broomehill to Coolgardie — tight scrub, mud holes and history. Pinstriping guaranteed; best after the wet has dried.'],
  ['Cape Leveque Road (Dampier Peninsula)','Kimberley, WA',['wa'],'Moderate 4WD',200,'1-2 days','Apr–Oct','Yes — community permits','Broome, Beagle Bay','Carry water','Moderate','Sealed + sandy spurs',-16.4,122.9,'Now mostly sealed to the red-cliff beaches of the Dampier Peninsula, with sandy community spurs to Cape Leveque, Cygnet Bay and One Arm Point.'],
  ['Binns Track','Northern Territory',['nt'],'Moderate 4WD',2230,'7-10 days','Apr–Oct','Mostly no (some parks)','Towns along route','Carry water','High','Corrugations',-23.7,134.9,'The NT\'s purpose-built outback drive from Mt Dare to Timber Creek via the East MacDonnells, gem fields and Gulf country — a long, varied red-dirt journey.'],
  ['Savannah Way (Gulf section)','QLD/NT Gulf',['qld','nt'],'Moderate 4WD',900,'4-7 days','May–Oct','No','Normanton, Borroloola','Carry water','High','Corrugations, crossings',-17.7,139.0,'Tropical-savannah touring across the Gulf between Normanton and the NT — corrugated dirt, river crossings and Lawn Hill/Boodjamulla gorge. Wet-season closures.'],
  ['Old Andado Track','Simpson fringe, NT',['nt'],'Moderate 4WD',320,'1-2 days','Apr–Oct','No','Alice Springs, Mt Dare','Carry water','High','Sand, corrugations',-25.4,135.4,'Alice Springs to the historic Old Andado homestead on the Simpson\'s edge via the Mac Clark (Acacia peuce) reserve — sandy, remote and a classic Centre day-and-a-half.'],
  ['Mereenie Loop','Red Centre, NT',['nt'],'Easy 4WD',200,'1 day','Apr–Oct','Yes — Mereenie Tour Pass','Kings Canyon, Hermannsburg','Carry water','Moderate','Corrugations',-24.0,132.0,'The dirt short-cut linking Kings Canyon and the West MacDonnells via Aboriginal land — a straightforward but corrugated Red Centre connector needing a transit pass.'],
  ['Finke / Old South Road','Red Centre, NT',['nt'],'Moderate 4WD',230,'1-2 days','Apr–Oct','No','Alice Springs, Kulgera','Carry water','Moderate','Sand, corrugations',-25.0,133.6,'Following the old Ghan line south of Alice to Finke (Aputula) and Lambert Centre (Australia\'s geographic centre) — sandy whoops made famous by the Finke Desert Race.'],
  ['Connie Sue Highway','Great Victoria Desert, WA',['wa'],'Hard 4WD',650,'4-6 days','May–Sep','Yes — Aboriginal-land permits','Rawlinna, Warburton','Carry all water','Extreme','Sand, scrub',-28.0,124.0,'Another Beadell desert road, Rawlinna to Warburton across the Great Victoria Desert — sandy, overgrown and very remote; an expedition for prepared convoys.'],
  ['Sandy Blight Junction Road','NT/WA desert',['nt','wa'],'Hard 4WD',600,'4-6 days','May–Sep','Yes — Aboriginal-land permits','Kintore, Docker River','Carry all water','Extreme','Sand, scrub',-23.3,129.4,'Len Beadell\'s favourite road, through the Kintore and Schwerin Mural ranges — remote desert touring with marker trees and big dune country.'],
  ['Victorian High Country — Wonnangatta',"Alpine, VIC",['vic'],'Hard 4WD',150,'2-3 days','Nov–Apr (closed winter)','No (parks)','Dargo, Licola','Creeks, tanks','Moderate','Steep, slippery',-37.2,146.8,'The historic Wonnangatta Valley and surrounding alpine tracks — steep climbs, river crossings and high-country huts. Seasonally closed; chains and a winch in the wet.'],
  ['Billy Goat Bluff Track','Alpine, VIC',['vic'],'Hard 4WD',8,'Half day','Nov–Apr','No','Dargo','Carry water','Low','Steep, loose',-37.4,147.2,'One of the High Country\'s steepest climbs to the Pinnacles fire tower — a relentless loose, rocky ascent with huge views. Low range and good tyres essential.'],
  ['Blue Rag Range Track','Alpine, VIC',['vic'],'Hard 4WD',16,'Half day','Dec–Apr','No','Dargo, Hotham','Carry water','Low','Narrow ridgeline',-37.0,147.1,'A knife-edge ridge run to the Blue Rag trig with 360° alpine views — narrow, exposed and unforgettable in clear weather; impassable in snow.'],
  ['Wonnangatta–Moroka / Zeka Spur','Alpine, VIC',['vic'],'Hard 4WD',120,'2 days','Nov–Apr','No','Licola','Creeks','Moderate','Steep',-37.4,146.9,'Classic Gippsland high-country touring linking Moroka, Zeka Spur and the Wonnangatta — huts, snow gums and steep timbered climbs.'],
  ['Flinders Ranges — Skytrek (Willow Springs)','Flinders Ranges, SA',['sa'],'Hard 4WD',80,'1 day','Apr–Oct','Station fee','Hawker, Wilpena','Station','Low','Rocky',-31.5,138.7,'A private self-drive over Willow Springs station to the Razorback Lookout high above the Flinders — rocky climbs and some of SA\'s best ranges scenery.'],
  ['Arkaroola — Echo Camp Backtrack','Northern Flinders, SA',['sa'],'Hard 4WD',30,'Half day','Apr–Oct','Sanctuary fee','Arkaroola','Sanctuary','Moderate','Very rocky',-30.3,139.3,'The rugged ridgetop tracks of Arkaroola Wilderness Sanctuary in the northern Flinders — slow, rocky and spectacular, with the Ridgetop Tour nearby.'],
  ['K’gari (Fraser Island)','Great Sandy, QLD',['qld'],'Moderate 4WD',120,'2-3 days','Year-round','Yes — vehicle + camping','Mainland; limited on island','Tanks/bring water','Low','Soft sand, tides',-25.2,153.1,'The world\'s largest sand island — beach highways, inland sand tracks, perched lakes and dingoes. Tide-timed driving, big soft patches and a barge crossing.'],
  ['Teewah / Rainbow Beach (Cooloola)','Sunshine Coast, QLD',['qld'],'Moderate 4WD',50,'1 day','Year-round','Yes — vehicle access','Rainbow Beach, Noosa','Bring water','Low','Soft sand, tides',-26.0,153.1,'Coloured-sand cliffs and a long beach highway from Noosa North Shore to Rainbow Beach — accessible sand-driving best timed to a falling tide.'],
  ['Stockton Beach (Worimi)','Port Stephens, NSW',['nsw'],'Moderate 4WD',32,'1 day','Year-round','Yes — Worimi permit','Anna Bay, Williamtown','Bring water','Low','Soft dunes, tides',-32.8,152.0,'The largest moving sand mass in the southern hemisphere — towering dunes and beach running near Newcastle. Permit, tyres-down and tide awareness essential.'],
  ['Border Track (Big Desert)','Mallee, VIC/SA',['vic','sa'],'Moderate 4WD',120,'1-2 days','Apr–Oct','No','Pinnaroo, Murrayville','Carry water','Moderate','Soft sand, scrub',-35.3,141.0,'A remote sandy track through the Big Desert and Wyperfeld mallee on the SA/VIC border — soft scrubby dunes and a real sense of wilderness close to the south-east.'],
  ['Googs… Nullarbor — Old Eyre Hwy / Eyre Bird Obs','Nullarbor, WA',['wa'],'Hard 4WD',55,'1 day','Apr–Oct','Yes — booking','Cocklebiddy','Carry water','High','Steep sand descent',-32.2,126.3,'The sandy descent off the Hampton Tableland to the historic Eyre Bird Observatory — a short but committing soft-sand and limestone track on the Nullarbor\'s edge.'],
  ['Cape Range — Yardie Creek / Ningaloo','Ningaloo, WA',['wa'],'Moderate 4WD',90,'1 day','Apr–Oct','Park fees','Exmouth, Coral Bay','Bring water','Moderate','Soft sand crossing',-22.3,113.8,'Yardie Creek and the sandy southern Cape Range tracks linking Ningaloo\'s reef camps — a soft creek crossing (tide-dependent) and turquoise-water campsites.'],
  ['Hay River Track','Simpson Desert, NT',['nt'],'Extreme',420,'5-7 days','May–Aug','Permit (Atnetye) + Desert Parks','Mt Dare / Birdsville','Carry all water','Extreme','Soft sand',-24.0,137.2,'A remote alternative crossing of the northern Simpson down the Hay River channel country — soft, scenic and seldom travelled; full desert prep required.'],
  ['Munja Track','Kimberley, WA',['wa'],'Extreme',200,'3-5 days','May–Sep','Station/community','Mt Elizabeth Station','Carry water','Extreme','Severe, crossings',-16.2,125.5,'A remote and demanding Kimberley track off Mt Elizabeth Station to Walcott Inlet — deep crossings, steep jump-ups and true wilderness; convoy only.'],
  ['Old Coast Road — Cape to Cape (4WD beaches)','South West, WA',['wa'],'Moderate 4WD',40,'1 day','Oct–Apr','Some beach permits','Margaret River, Augusta','Bring water','Low','Soft sand',-34.0,115.0,'Beach and dune tracks along the Margaret River coast linking surf breaks and fishing spots between the capes — soft sand, tides and stunning South-West coastline.'],
  ['Lancelin Sand Dunes','Wheatbelt coast, WA',['wa'],'Moderate 4WD',10,'Half day','Year-round','No','Lancelin','Bring water','Low','Soft white dunes',-31.0,115.3,'A vast field of white coastal dunes north of Perth — the closest big sand-driving and dune-play to the city, popular for first-timers learning soft-sand technique.'],
  ['Old Ghan Heritage Trail','Outback SA',['sa'],'Easy 4WD',200,'1-2 days','Apr–Oct','No','Marree, Oodnadatta','Carry water','Moderate','Sandy sidings',-29.4,137.7,'Tracing the original narrow-gauge Ghan railway through the Pichi Richi and outback sidings — easy formed touring past ruins, bridges and ghost sidings.'],
  ['Googs Lake & Yumbarra','Eyre Peninsula, SA',['sa'],'Hard 4WD',60,'1 day','Apr–Oct','No','Ceduna','Carry water','Moderate','Soft sand',-31.7,133.6,'A side trip off Googs Track to the white salt expanse of Googs Lake and the Yumbarra dune country — soft, scenic mallee-and-dune driving on the Eyre Peninsula.'],
]

let ok = 0
function slugify(s){return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)}
for (const t of T) {
  const [name,region,states,grade,length_km,days,best_season,permits,fuel_range,water,remoteness,corrugations,lat,lng,blurb] = t
  const slug = slugify(name)
  try {
    await sql`
      INSERT INTO autravel.tracks (state_code, slug, name, region, states, grade, length_km, days, best_season, permits, fuel_range, water, remoteness, corrugations, epirb_recommended, lat, lng, blurb, source, active)
      VALUES (${STATE}, ${slug}, ${name}, ${region}, ${states}, ${grade}, ${length_km}, ${days}, ${best_season}, ${permits}, ${fuel_range}, ${water}, ${remoteness}, ${corrugations}, ${remoteness==='Extreme'||remoteness==='High'}, ${lat}, ${lng}, ${blurb}, 'curated', true)
      ON CONFLICT (state_code, slug) DO UPDATE SET
        name=EXCLUDED.name, region=EXCLUDED.region, states=EXCLUDED.states, grade=EXCLUDED.grade,
        length_km=EXCLUDED.length_km, days=EXCLUDED.days, best_season=EXCLUDED.best_season,
        permits=EXCLUDED.permits, fuel_range=EXCLUDED.fuel_range, water=EXCLUDED.water,
        remoteness=EXCLUDED.remoteness, corrugations=EXCLUDED.corrugations, lat=EXCLUDED.lat,
        lng=EXCLUDED.lng, blurb=EXCLUDED.blurb, updated_at=now()`
    ok++
  } catch (e) { console.warn('  FAIL', name, e.message) }
}
console.log(`seeded ${ok}/${T.length} off-road tracks (state_code='${STATE}')`)
await sql.end()
