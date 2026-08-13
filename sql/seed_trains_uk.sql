-- UK (New Forest) train services — seeds autravel.trains for the 'uk' tenant.
-- Re-runnable: ON CONFLICT (slug) DO UPDATE. Mirrors sql/seed_trains.sql pattern.
-- Content style: page-per-train information hubs incl. getting to/from the
-- New Forest, per Craig 2026-08-13. UK English.

INSERT INTO autravel.trains
  (slug, name, operator, operator_url, booking_url, state_codes, is_national, is_heritage,
   route_summary, from_city, to_city, key_stations, classes, frequency, duration_label,
   intro, body_html, seo_title, seo_description, display_order, active)
VALUES

-- ─────────────────────────────────────────────────────────── main lines ──
(
  'south-west-main-line',
  'South West Main Line',
  'South Western Railway',
  'https://www.southwesternrailway.com/',
  'https://www.southwesternrailway.com/',
  '{uk}', false, false,
  'London Waterloo ↔ Bournemouth & Weymouth — straight through the Forest',
  'London', 'Weymouth',
  '{"London Waterloo","Winchester","Southampton Central","Totton","Ashurst New Forest","Beaulieu Road","Brockenhurst","Sway","New Milton","Bournemouth"}',
  '{"Standard","First Class"}',
  'Several trains an hour',
  'From about 1 hr 30 min, London → Brockenhurst',
  $intro$This is the big one: the London Waterloo to Weymouth main line runs right through the middle of the New Forest, which makes the Forest one of the easiest national parks in Britain to reach without a car.$intro$,
  $body$<p>South Western Railway runs two flavours of train down this line. The <strong>fast services</strong> from London Waterloo call at Winchester and Southampton before stopping at Brockenhurst — the Forest's main station — in around an hour and a half. The <strong>stopping services</strong> are the ones that serve the smaller Forest halts, and they're worth knowing about, because a couple of those halts drop you straight onto open heathland.</p>
<h2>Which station should you get off at?</h2>
<ul>
<li><strong>Brockenhurst</strong> — the hub. Fast trains from London stop here, the Lymington branch leaves from here, there's cycle hire a short walk from the platform, and the village (ponies included) is on your doorstep. If in doubt, book to Brockenhurst.</li>
<li><strong>Ashurst New Forest</strong> — best for the northern woods and a walkable 2.5 miles from Lyndhurst, the Forest's little capital.</li>
<li><strong>Beaulieu Road</strong> — a tiny halt in the middle of open heath. Step off the train and you're immediately on a walk; it's about 4 miles across the heath to Beaulieu village and the National Motor Museum.</li>
<li><strong>Sway</strong> — quiet village base for the south-western Forest and Setley Common.</li>
<li><strong>New Milton</strong> — handiest for the coast at Barton-on-Sea and its clifftop walks.</li>
<li><strong>Totton</strong> — the eastern gateway, next to Eling and its tide mill.</li>
</ul>
<h2>Getting to the New Forest by train</h2>
<p><strong>From London:</strong> direct from Waterloo — no changes, around 90 minutes on a fast service to Brockenhurst.</p>
<p><strong>From the Midlands and the North:</strong> CrossCountry runs direct trains from Manchester and Birmingham that call at Brockenhurst — see our CrossCountry page — or change at Reading onto a Southampton-bound service.</p>
<p><strong>From the West Country and Bristol:</strong> travel to Southampton Central and change onto any Bournemouth or Weymouth train; Brockenhurst is two to four stops away.</p>
<p><strong>Flying in?</strong> Southampton Airport Parkway is on this line — the Forest is well under half an hour from the terminal by rail.</p>
<h2>Tickets & tips</h2>
<ul>
<li>Off-Peak returns are the workhorse fare; on longer journeys, booking an Advance ticket ahead of time is usually much cheaper.</li>
<li>A Railcard (Family & Friends, Two Together, Senior, 16–25) knocks about a third off most fares.</li>
<li>Buy your ticket before boarding — the small Forest halts are unstaffed.</li>
<li>Bikes travel free on South Western Railway, and Brockenhurst is one of the best places in Britain to step off a train and straight onto a cycle trail.</li>
<li>In summer, the open-top New Forest Tour bus and local Bluestar buses link the stations with Lyndhurst, Beaulieu, Lymington and the villages between — handy for a car-free loop.</li>
</ul>$body$,
  'London to the New Forest by Train — South West Main Line',
  'Direct trains from London Waterloo run through the New Forest in about 90 minutes. Which station to choose, routes, tickets, bikes and onward travel.',
  10, true
),
(
  'lymington-branch-line',
  'Lymington Branch Line',
  'South Western Railway',
  'https://www.southwesternrailway.com/',
  'https://www.southwesternrailway.com/',
  '{uk}', false, false,
  'Brockenhurst ↔ Lymington Pier — the Forest''s own branch line',
  'Brockenhurst', 'Lymington',
  '{"Brockenhurst","Lymington Town","Lymington Pier"}',
  '{"Standard"}',
  'Roughly every half hour',
  'About 10 minutes end to end',
  $intro$Five and a half miles of pure branch-line charm: a little shuttle that rattles from Brockenhurst across the Forest edge to the Georgian sailing town of Lymington and its Isle of Wight ferry.$intro$,
  $body$<p>The Lymington branch is the kind of railway most of Britain lost decades ago — a short shuttle timed to meet the main-line trains at Brockenhurst. Until 2010 it was famously the last place in the country you could ride a slam-door train in regular service. Today's units are more modern, but the journey is the same ten-minute hop across the marshes.</p>
<h2>The two Lymington stations</h2>
<ul>
<li><strong>Lymington Town</strong> — get off here for the town itself: the cobbled quay, the Georgian high street and the famous Saturday market.</li>
<li><strong>Lymington Pier</strong> — the end of the line, built for one job: stepping straight off the train onto the <strong>Wightlink ferry to Yarmouth</strong> on the Isle of Wight (about a 40-minute crossing).</li>
</ul>
<h2>Getting to and from the Forest</h2>
<p>Change at <strong>Brockenhurst</strong> — the branch connects with fast London trains and the CrossCountry services from the Midlands, and you can book a through ticket from anywhere on the network to Lymington. Heading the other way, it's the classic finish to a Forest walking day: hike or cycle to Lymington, then let the train haul you back up the hill to Brockenhurst.</p>
<h2>Tips</h2>
<ul>
<li>Book through tickets to "Lymington Town" or "Lymington Pier" — no separate branch ticket needed.</li>
<li>Heading to the Isle of Wight? Combined rail-and-ferry tickets are sold to Yarmouth via the Pier.</li>
<li>The Solent Way footpath from Lymington toward Keyhaven and Hurst Castle is one of the best flat coastal walks in the Forest — the branch line is its perfect start point.</li>
</ul>$body$,
  'Lymington Branch Line — Brockenhurst to Lymington Pier',
  'The New Forest''s own branch line: Brockenhurst to Lymington Town & Pier in 10 minutes, connecting with the Wightlink ferry to the Isle of Wight.',
  20, true
),
(
  'crosscountry-bournemouth',
  'CrossCountry (Manchester – Bournemouth)',
  'CrossCountry',
  'https://www.crosscountrytrains.co.uk/',
  'https://www.crosscountrytrains.co.uk/',
  '{uk}', false, false,
  'Manchester & Birmingham ↔ the New Forest & Bournemouth, no changes',
  'Manchester', 'Bournemouth',
  '{"Manchester Piccadilly","Birmingham New Street","Oxford","Reading","Winchester","Southampton Central","Brockenhurst","Bournemouth"}',
  '{"Standard","First Class"}',
  'Roughly hourly through the day',
  'About 2 hr 45 min, Birmingham → Brockenhurst',
  $intro$The no-changes route to the Forest from the Midlands and the North: CrossCountry's long green trains run from Manchester and Birmingham all the way down to Brockenhurst and Bournemouth.$intro$,
  $body$<p>If you're coming from the top half of England, this is your train. The route threads Manchester, Stoke, Birmingham, Coventry, Leamington Spa, Banbury, Oxford and Reading together, then drops south through Winchester and Southampton before calling at <strong>Brockenhurst</strong> — the New Forest's main station — on its way to Bournemouth.</p>
<h2>Getting to the New Forest on CrossCountry</h2>
<p>Alight at <strong>Brockenhurst</strong>. You're in the middle of the national park the moment you leave the platform: cycle hire nearby, the Lymington branch across the island platform, and buses and taxis out front. There's no need to go to Bournemouth and double back.</p>
<p>From towns not on the route, one change usually does it: hop onto CrossCountry at Birmingham New Street, Oxford or Reading. From Scotland and the North East, change at Birmingham.</p>
<h2>Tips for this route</h2>
<ul>
<li><strong>Book an Advance ticket</strong> — they're released around 12 weeks ahead and are dramatically cheaper than turn-up-and-go fares on this route.</li>
<li>CrossCountry trains are busy and not enormous — <strong>reserve a seat</strong> when you book, especially on summer Saturdays.</li>
<li>Taking a bike? Bike spaces are limited and need a <strong>free reservation</strong> — sort it when you buy your ticket.</li>
<li>Coming back north, evening trains from Brockenhurst connect the whole route home in one seat — check the last direct departure before you plan a long Forest day.</li>
</ul>$body$,
  'CrossCountry to the New Forest — Direct from the Midlands & North',
  'CrossCountry trains run direct from Manchester, Birmingham, Oxford and Reading to Brockenhurst in the New Forest. Route, tips and how to book.',
  30, true
),

-- ─────────────────────────────────────────────── steam & heritage lines ──
(
  'exbury-gardens-railway',
  'Exbury Gardens Steam Railway',
  'Exbury Gardens',
  'https://www.exbury.co.uk/',
  'https://www.exbury.co.uk/',
  '{uk}', false, true,
  'A steam railway inside the New Forest''s great garden estate',
  'Exbury', 'Exbury',
  '{"Exbury Central","Exbury North","American Garden"}',
  '{"Open carriages"}',
  'Seasonal — runs on garden open days',
  'About 20 minutes for the full circuit',
  $intro$The only steam railway actually inside the New Forest: a 12¼-inch gauge line that loops for a mile and a quarter through the Rothschilds'' famous gardens at Exbury, near Beaulieu.$intro$,
  $body$<p>Exbury's little steam locomotives haul open carriages on a twenty-minute circuit through parts of the estate you can't otherwise reach — over a bridge, through a tunnel, past the ponds and the American Garden. It's genuinely lovely in late spring when the rhododendrons and azaleas that made Exbury famous are in full riot, and the railway runs whenever the gardens are open, roughly March to November.</p>
<h2>Getting there from the rest of the Forest</h2>
<p>Exbury sits on the quiet eastern side of the Forest near Beaulieu. There's no mainline station nearby — it's about a 20-minute drive or taxi from <strong>Brockenhurst</strong> station, and cycling there through Beaulieu is a flat, pretty ride. Check Exbury's site for garden opening days and current railway ticket arrangements before you set out.</p>$body$,
  'Exbury Gardens Steam Railway — New Forest',
  'Ride the 12¼-inch gauge steam railway through Exbury Gardens near Beaulieu — the only steam line inside the New Forest. Season, journey and getting there.',
  40, true
),
(
  'watercress-line',
  'Watercress Line (Mid Hants Railway)',
  'Mid Hants Railway',
  'https://www.watercressline.co.uk/',
  'https://www.watercressline.co.uk/',
  '{uk}', false, true,
  'Alton ↔ Alresford — ten miles of Hampshire steam',
  'Alton', 'Alresford',
  '{"Alton","Medstead & Four Marks","Ropley","Alresford"}',
  '{"Standard heritage stock","First (selected services)"}',
  'Seasonal timetable — most days in summer',
  'About 35 minutes each way',
  $intro$Hampshire's flagship heritage railway: ten miles of proper main-line steam between Alton and the watercress town of Alresford, an easy add-on to a New Forest trip.$intro$,
  $body$<p>The Watercress Line — officially the Mid Hants Railway — earned its name carrying fresh watercress from Alresford's beds to London's markets. Today its big steam locomotives climb "over the Alps", the steeply graded line through Ropley and Medstead & Four Marks (Hampshire's highest station), with dining trains, real-ale evenings and family events through the year.</p>
<h2>Getting there from the New Forest</h2>
<p>It's about a 45-minute drive from the central Forest villages up the M3/A31 to Alresford. Prefer rail all the way? <strong>Alton station shares its platforms with South Western Railway</strong> — trains from London Waterloo terminate there — so from the Forest you can ride via Winchester or Woking and arrive by train, which feels like the proper way to visit a railway.</p>$body$,
  'Watercress Line Steam Railway — Day Trip from the New Forest',
  'The Mid Hants Railway runs steam trains between Alton and Alresford, 45 minutes from the New Forest. Timetable pattern, route and how to get there.',
  50, true
),
(
  'swanage-railway',
  'Swanage Railway',
  'Swanage Railway',
  'https://www.swanagerailway.co.uk/',
  'https://www.swanagerailway.co.uk/',
  '{uk}', false, true,
  'Norden ↔ Swanage past Corfe Castle, across Poole Bay from the Forest',
  'Norden', 'Swanage',
  '{"Norden","Corfe Castle","Harman''s Cross","Herston","Swanage"}',
  '{"Standard heritage stock"}',
  'Most days in season — steam & heritage diesel',
  'About 25 minutes each way',
  $intro$Steam trains beneath the ruins of Corfe Castle: the Swanage Railway is one of Britain''s most photogenic heritage lines, and it sits just across Poole Bay from the New Forest.$intro$,
  $body$<p>Rebuilt from nothing by volunteers after closure in 1972, the Swanage Railway runs steam and heritage diesel trains through the Purbeck Hills — the view of a train passing under Corfe Castle's ruined keep is one of the great railway photographs in England. Swanage itself is a proper Victorian seaside town with a pier and a sweep of safe, sandy beach.</p>
<h2>Getting there from the New Forest</h2>
<ul>
<li><strong>By rail and bus:</strong> take a South Western Railway train from Brockenhurst or New Milton to <strong>Wareham</strong>, then the Purbeck Breezer bus toward Corfe Castle and Swanage. Board the steam train at Corfe Castle or Norden.</li>
<li><strong>By road:</strong> the fun way is via the Sandbanks chain ferry from the Bournemouth side; otherwise loop round via Wareham on the A351. Use the big park-and-ride at <strong>Norden</strong> and ride the train in — parking in Corfe and Swanage is tight in summer.</li>
</ul>$body$,
  'Swanage Railway & Corfe Castle — Steam Near the New Forest',
  'Ride steam trains past Corfe Castle to the seaside at Swanage — an easy day out from the New Forest by rail via Wareham, or via the Sandbanks ferry.',
  60, true
),
(
  'isle-of-wight-steam-railway',
  'Isle of Wight Steam Railway',
  'Isle of Wight Steam Railway',
  'https://iwsteamrailway.co.uk/',
  'https://iwsteamrailway.co.uk/',
  '{uk}', false, true,
  'Victorian steam across the Solent — reached via the Lymington ferry',
  'Wootton', 'Smallbrook Junction',
  '{"Wootton","Havenstreet","Ashey","Smallbrook Junction"}',
  '{"Victorian & Edwardian carriages"}',
  'Seasonal timetable — most days in summer',
  'About 1 hr for the round trip',
  $intro$Cross the Solent from Lymington and you can ride a genuinely Victorian railway: gas-lit-era carriages and island-built steam locomotives running through five miles of Wight countryside.$intro$,
  $body$<p>The Isle of Wight Steam Railway at Havenstreet is a time capsule — much of its rolling stock is over a century old and beautifully restored, running between Wootton and Smallbrook Junction, where it meets the Island Line trains from Ryde. The museum, engine sheds and woodland walks at Havenstreet make it an easy full day.</p>
<h2>Getting there from the New Forest</h2>
<p>This is the trip the <strong>Lymington branch line</strong> was made for: train from Brockenhurst to Lymington Pier, Wightlink ferry across to Yarmouth (about 40 minutes), then bus or drive across the island to Havenstreet. Alternatively, foot passengers can cross from Southampton to Cowes. Either way you can do the whole day out — Forest, Solent crossing, Victorian steam — without a car.</p>$body$,
  'Isle of Wight Steam Railway — via the Lymington Ferry',
  'Combine the Lymington branch line, the Wightlink ferry and the Isle of Wight Steam Railway for a car-free Victorian rail day out from the New Forest.',
  70, true
)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  operator = EXCLUDED.operator,
  operator_url = EXCLUDED.operator_url,
  booking_url = EXCLUDED.booking_url,
  state_codes = EXCLUDED.state_codes,
  is_national = EXCLUDED.is_national,
  is_heritage = EXCLUDED.is_heritage,
  route_summary = EXCLUDED.route_summary,
  from_city = EXCLUDED.from_city,
  to_city = EXCLUDED.to_city,
  key_stations = EXCLUDED.key_stations,
  classes = EXCLUDED.classes,
  frequency = EXCLUDED.frequency,
  duration_label = EXCLUDED.duration_label,
  intro = EXCLUDED.intro,
  body_html = EXCLUDED.body_html,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active,
  updated_at = now();
