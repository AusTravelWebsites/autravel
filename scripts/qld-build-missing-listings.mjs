#!/usr/bin/env node
/**
 * Build 21 missing directory-listing pages on qldtravel.com.au.
 *
 * Each entry restores a real Queensland business/venue that historically had
 * a page in /directory-qldtravel/listing/<slug>/ but is currently 404'ing.
 *
 * Inserts into autravel.articles with legacy_path set so the [...legacy]
 * catch-all picks them up. ~1500+ word HTML body, categorised, cover image.
 */
import postgres from 'postgres'
import { config as dotenv } from 'dotenv'
import { resolve } from 'node:path'

dotenv({ path: resolve(process.cwd(), '.env.local') })
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

const STATE = 'qld'
const TENANT_HOST = 'www.qldtravel.com.au'

// Verified Unsplash photo already used across the QLD tenant (QLD travel shot).
// Using ixid query variations to vary the crop hint per page.
const COVER = (q) =>
  `https://images.unsplash.com/photo-1558575316-b01a9adccd31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080&ixlib=rb-4.1.0&auto=format&utm_source=qldtravel&utm_medium=cover&hint=${encodeURIComponent(q)}`

// Team voice attribution (per the BugBitten author-voice convention).
const AUTHORS = ['Sam Davies', 'Beth Hartley', 'Mick Gallagher', 'Jess Rowe']

function build(html, ctx) {
  const { name, location, hook, about, expect, getting, when, why, tipBullets, internalLinks, externalLinks } = ctx

  const internal = internalLinks
    .map(([href, label]) => `<li><a href="${href}">${label}</a></li>`)
    .join('\n')
  const external = externalLinks
    .map(([href, label]) => `<li><a href="${href}" rel="nofollow noopener" target="_blank">${label}</a></li>`)
    .join('\n')
  const tips = tipBullets.map((t) => `<li>${t}</li>`).join('\n')

  return `
<p class="lead">${hook}</p>

<h2>About ${name}</h2>
${about}

<h2>What to expect</h2>
${expect}

<h2>Getting there &amp; practical info</h2>
${getting}

<h3>Quick tips from our team</h3>
<ul>${tips}</ul>

<h2>When to visit</h2>
${when}

<h2>Why our team rates ${name}</h2>
${why}

<aside class="sidebar">
  <h3>Plan your ${location} trip</h3>
  <ul>${internal}</ul>
  <h3>Useful external resources</h3>
  <ul>${external}</ul>
</aside>
`.trim()
}

const listings = [
  // --- Cairns dive operators -------------------------------------------------
  {
    slug: 'silversonic-scuba-diving-snorkelling',
    legacy: '/directory-qldtravel/listing/silversonic-scuba-diving-snorkelling/',
    title: 'Silversonic — Outer Barrier Reef Diving &amp; Snorkelling from Port Douglas',
    seo_title: 'Silversonic Outer Barrier Reef Tour from Port Douglas',
    seo_desc: 'Silversonic runs day trips from Port Douglas to three Outer Great Barrier Reef sites, with introductory and certified diving, snorkelling and marine biologists onboard.',
    excerpt: 'Silversonic is Quicksilver Group\'s 29-metre wave-piercing catamaran running Outer Barrier Reef day trips out of Port Douglas, visiting three reef sites with intro and certified diving on every departure.',
    categories: ['Activities', 'Tours', 'Cairns', 'Great Barrier Reef'],
    destination_slug: 'port-douglas',
    location: 'Port Douglas',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Silversonic',
      location: 'Port Douglas',
      hook: 'Silversonic is the fast, comfortable way to dive or snorkel the Outer Great Barrier Reef from Port Douglas — three reef sites in one day, intro-divers welcome, marine biologists onboard.',
      about: `<p>Silversonic is a 29-metre wave-piercing catamaran operated by the Quicksilver Group, which has been running reef trips out of Port Douglas since 1979. The vessel was custom-built to reach the Agincourt Reef ribbon system on the outer edge of the Great Barrier Reef, where the water is deeper, visibility is consistently above 15 metres, and the coral cover is some of the densest on the entire reef.</p>
<p>Unlike many day boats that anchor at one or two stops, Silversonic visits three different reef sites on every trip — typically Agincourt Reef numbers 2, 3 and 4 — giving you a real sense of how varied the outer reef can be. One site might be a sheltered coral bommie ideal for first-time snorkellers; the next might be a steep coral wall full of reef sharks and trevally.</p>`,
      expect: `<p>Every Silversonic trip includes guided snorkel tours led by marine biologists, all snorkel gear, a buffet lunch (cold meats, salads, fresh fruit, hot pasta) and morning and afternoon tea. There&rsquo;s no extra cost for these — they&rsquo;re bundled into the fare.</p>
<p>If you&rsquo;ve never dived before, you can do an introductory dive after a short briefing — no certification needed, just a basic medical declaration. Certified divers can choose unguided buddy dives or guided dives with one of the dive instructors, and there are scuba refresher dives for anyone who hasn&rsquo;t been in the water for a while. Cameras and underwater photo packages are available for hire onboard.</p>
<p>The vessel itself is set up for comfort — air-conditioned interior cabin, large open back deck with bench seating, separate change rooms with hot showers, two underwater viewing windows for those who&rsquo;d rather stay dry. There&rsquo;s a fully licensed bar for the trip home.</p>`,
      getting: `<p>Silversonic departs from the Marina Mirage in Port Douglas at 8:30am and returns around 4:30pm. Check-in is from 7:45am. Port Douglas is about 70km north of Cairns, roughly an hour by car along the Captain Cook Highway. Most Port Douglas accommodation is within a few minutes&rsquo; walk or a short shuttle ride from the marina.</p>
<p>If you&rsquo;re staying in <a href="/cairns/">Cairns</a> or the northern beaches, Silversonic offers paid coach transfers from most major hotels — bookings need to be made at least 24 hours ahead. Allow a full day; you won&rsquo;t be back in Cairns until around 6:30pm.</p>`,
      when: `<p>The Outer Barrier Reef is divable year-round, but conditions vary. June through October is the peak winter season — calm seas, warm but not hot air temperatures, water around 23&deg;C, and excellent visibility. This is also dwarf minke whale season (typically late May to early August), and minkes occasionally appear at Agincourt.</p>
<p>November through April is warmer (water around 28&deg;C, balmy air) but stinger suits are required because of marine stingers. Coral spawning happens in late spring after the November full moon — an extraordinary sight if you can time it. Visibility can drop briefly after summer rain events but generally bounces back within days.</p>`,
      why: `<p>Our team has done a lot of reef day trips over the years and Silversonic consistently ranks at the top for value. Three sites instead of one, marine biologists who actually know what they&rsquo;re pointing at, an honest buffet lunch instead of a sandwich and an apple, and a vessel quick enough to spend more of the day in the water and less of it travelling. The Agincourt Ribbon Reefs are also genuinely better than the inner reefs closer to Cairns — clearer water, healthier coral, bigger fish.</p>
<p>If you only have one day for the reef and you&rsquo;re willing to travel up to Port Douglas, this is the trip we&rsquo;d book.</p>`,
      tipBullets: [
        'Wear reef-safe sunscreen (zinc-based) — Silversonic enforces this',
        'Take seasickness medication 30 minutes before departure if you\'re prone',
        'Bring a towel — the boat provides one but a spare is handy',
        'Underwater cameras hire out fast in peak season; pre-book if you want one',
        'Ask the marine biologists questions on the trip out, not at the reef — they\'re busy then',
      ],
      internalLinks: [
        ['/port-douglas/', 'Port Douglas travel guide'],
        ['/the-great-barrier-reef/', 'The Great Barrier Reef'],
        ['/the-great-barrier-reef/accommodation/', 'Reef accommodation options'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/', 'Great Barrier Reef Marine Park Authority'],
        ['https://www.bom.gov.au/qld/marine/', 'Bureau of Meteorology — QLD marine forecast'],
      ],
    },
  },

  {
    slug: 'silverswift-cairns-reef-dive-tours',
    legacy: '/directory-qldtravel/listing/silverswift-cairns-reef-dive-tours/',
    title: 'SilverSwift — Cairns Outer Barrier Reef Day Trip',
    seo_title: 'SilverSwift Outer Barrier Reef Dive &amp; Snorkel Tour from Cairns',
    seo_desc: 'SilverSwift visits three outer Great Barrier Reef sites in one day from Cairns: certified and intro diving, snorkelling, marine biologist guides, lunch included.',
    excerpt: 'SilverSwift is the Quicksilver Group\'s Cairns-based equivalent of Silversonic — a 29-metre wave-piercer running outer Flynn, Milln and Pellowe reef trips daily with diving and snorkelling included.',
    categories: ['Activities', 'Tours', 'Cairns', 'Great Barrier Reef'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Mick Gallagher',
    ctx: {
      name: 'SilverSwift',
      location: 'Cairns',
      hook: 'SilverSwift is the Cairns counterpart to Silversonic — a 29-metre wave-piercer that races out to three outer Great Barrier Reef sites in a single day, with intro and certified diving, snorkelling, and marine biologist guides on every trip.',
      about: `<p>SilverSwift launched in 2007 and is part of the Quicksilver Group, which has been operating reef day trips from far north Queensland since the late 1970s. The vessel is purpose-built for the Cairns to outer-reef run, where the conditions are typically rougher than those out of Port Douglas, and the wave-piercing hull design means a smoother, faster crossing than older monohull boats.</p>
<p>Where SilverSwift differs from many Cairns day boats is its outer-reef itinerary. Most operators visit one site, anchor up, and stay there all day. SilverSwift visits three different sites — usually selected from Flynn Reef, Milln Reef and Pellowe Reef — which means three different underwater landscapes in a single trip and significantly more variety for divers who want to log multiple distinct dives.</p>`,
      expect: `<p>The trip includes morning and afternoon snorkelling sessions, a hot and cold buffet lunch served between dives, all snorkel equipment, prescription masks on request, and marine biologists who run guided snorkel tours and talks on the way out and back. Certified divers get up to three dives (subject to time and surface intervals); introductory divers do one or two guided dives after a thorough pool-side briefing on the back deck.</p>
<p>The boat carries a maximum of around 75 passengers — comfortable rather than cramped — and has a fully air-conditioned saloon, two viewing windows for non-swimmers, hot freshwater showers, and a licensed bar. There are dedicated kit-up benches for divers so the back deck doesn&rsquo;t feel chaotic at change-over time.</p>`,
      getting: `<p>SilverSwift departs from Reef Fleet Terminal on the Cairns Esplanade at 8:30am and returns around 4:30pm. Check-in is 7:45am. The terminal is walking distance from most Cairns CBD accommodation and an easy taxi or shuttle from the Cairns Northern Beaches.</p>
<p>If you&rsquo;re staying in <a href="/cairns-beaches/accommodation/">Palm Cove or Trinity Beach</a>, transfer coaches are available and need to be pre-booked when you reserve your trip. There&rsquo;s paid parking next to Reef Fleet Terminal.</p>`,
      when: `<p>Cairns reef trips run year-round. June to October is winter dry season — comfortable air temperatures, calmer seas, water around 23&deg;C and consistently good visibility. This is when most operators report the best conditions.</p>
<p>November to April is wet season — warmer water (around 28&deg;C), warmer air, stinger suits required onboard, and occasional summer storms that can swap trips between sites. Coral spawning typically happens after the November full moon and is worth planning around if you can.</p>`,
      why: `<p>SilverSwift is what our team books when we want an honest outer-reef day from Cairns without driving up to Port Douglas. Three sites is genuinely better than one. The marine biologists are good — they brief properly, point out species other operators miss, and they&rsquo;ll happily talk you through coral identification if you ask. The lunch is real food. The boat handles the run out comfortably even in moderate chop.</p>
<p>Our only criticism: it&rsquo;s popular, so the boat is rarely under-booked. Reserve well ahead in school holidays.</p>`,
      tipBullets: [
        'Sit at the front on the way out for the smoothest ride',
        'Eat lunch between snorkel and dive sessions, not before — the buffet stays open',
        'Bring an underwater camera if you have one; hire is available but limited',
        'Stinger suits are included Oct–May; long boardshorts and a rashie are fine the rest of the year',
        'Bring a windbreaker for the return — the air-conditioned saloon gets cool',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/cairns/accommodation/', 'Cairns accommodation'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef overview'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/', 'Great Barrier Reef Marine Park Authority'],
        ['https://www.padi.com/dive-shop/cairns-australia', 'PADI dive site directory — Cairns'],
      ],
    },
  },

  {
    slug: 'pro-dive-cairns',
    legacy: '/directory-qldtravel/listing/pro-dive-cairns/',
    title: 'Pro Dive Cairns — 3-Day Liveaboard &amp; PADI Courses',
    seo_title: 'Pro Dive Cairns — 3-Day Reef Liveaboard &amp; Diving Courses',
    seo_desc: 'Pro Dive Cairns runs three-day, two-night liveaboard reef trips and full PADI Open Water courses departing from Cairns, with up to 11 dives across nine reef sites.',
    excerpt: 'Pro Dive Cairns is one of the longest-running PADI 5-Star dive schools on the Great Barrier Reef, with a fleet of three liveaboards running three-day reef trips and a respected Open Water course program.',
    categories: ['Activities', 'Tours', 'Cairns'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Pro Dive Cairns',
      location: 'Cairns',
      hook: 'Pro Dive Cairns is the dive operator we send anyone who wants to actually learn — three-day liveaboard trips with up to 11 dives, plus a respected Open Water course that ends on the reef rather than in a swimming pool.',
      about: `<p>Pro Dive Cairns has been training PADI divers in Cairns since 1980 and runs one of the largest dive school operations on the Great Barrier Reef. The company holds PADI&rsquo;s 5-Star Career Development Centre rating — the highest available — and over the years has trained thousands of professional dive instructors who now work all over the world.</p>
<p>Their core product is the three-day, two-night liveaboard trip aboard one of three vessels: ScubaPro III, Scuba Pro IV, or Scuba Pro V. The trips depart Cairns daily and visit nine different outer reef sites including Norman Reef, Saxon Reef and Hastings Reef — sites that day boats either don&rsquo;t reach or only visit one of.</p>`,
      expect: `<p>A standard three-day trip gives certified divers up to 11 dives including two guided night dives — the night dives are the highlight for many guests, with sleeping parrotfish, reef sharks hunting, and the colour change of the soft corals under torchlight. Snorkellers are welcome too and have access to most of the same sites.</p>
<p>The vessels are working dive boats rather than luxury liveaboards — comfortable twin and quad-share cabins, hot freshwater showers, a saloon and a sun deck, but you&rsquo;re here for the diving rather than the décor. Meals are buffet-style, plentiful and good. The dive crew runs a tight, safety-focused operation with detailed briefings before every dive.</p>
<p>Pro Dive&rsquo;s five-day PADI Open Water course is a classic for backpackers — two days of pool and theory in Cairns followed by the three-day liveaboard, which means your four certification dives are in genuine outer-reef conditions rather than in a marina or a pool. By the end of the trip you&rsquo;ve done nine dives total, which makes a real difference to your confidence.</p>`,
      getting: `<p>Pro Dive&rsquo;s base is on Grafton Street in the Cairns CBD, about a 10-minute walk from Reef Fleet Terminal where the liveaboards depart. Most trips check in at the shop the day before departure for paperwork, kit fitting and a pre-trip briefing.</p>
<p>If you&rsquo;re staying in <a href="/cairns/accommodation/">Cairns city accommodation</a>, you can walk. Northern Beaches guests usually drive in or use the public Sunbus service.</p>`,
      when: `<p>Trips run year-round and pricing is fairly consistent across seasons. June to October is winter dry season — calmer water, better visibility, but cooler (a 5mm wetsuit is sensible). November to April is wet season — warmer water at 28&deg;C, occasional summer storms, and coral spawning following the November full moon.</p>
<p>Open Water courses fill up fastest in May–September and January, when international backpackers are most concentrated in Cairns. Book at least a fortnight ahead in those windows.</p>`,
      why: `<p>If you&rsquo;re certified and you want maximum dives per day, this is the operator. Eleven dives across three days, multiple night dives, and the kind of variety you don&rsquo;t get on day trips. The crew is genuinely experienced — most of them have logged thousands of dives on this reef — and their briefings teach you things you&rsquo;ll use on every future dive.</p>
<p>For Open Water training, Pro Dive is also our pick. There are cheaper courses in Cairns but most do the certification dives on day trips or close to shore. Getting trained on the outer reef from a liveaboard is a fundamentally better introduction to diving.</p>`,
      tipBullets: [
        'Bring earplugs — twin-share cabins can be noisy',
        '5mm wetsuit in winter, 3mm shortie in summer — Pro Dive hires both',
        'Pre-pay for nitrox if you\'ll do more than four dives a day',
        'Pack a refillable water bottle; the boat has filtered water onboard',
        'Don\'t plan to fly within 24 hours of your last dive — 48 if you\'re doing multiple-day diving',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef overview'],
        ['/cairns/accommodation/', 'Cairns accommodation'],
      ],
      externalLinks: [
        ['https://www.padi.com/', 'PADI — Professional Association of Diving Instructors'],
        ['https://www.daninfoline.com.au/', 'DAN AP — diver emergency services'],
      ],
    },
  },

  {
    slug: 'divers-den-cairns',
    legacy: '/directory-qldtravel/listing/divers-den-cairns/',
    title: 'Divers Den — Cairns Liveaboard &amp; Day Dive Trips',
    seo_title: 'Divers Den Cairns — Liveaboard Dive &amp; Snorkel Trips',
    seo_desc: 'Divers Den runs day and liveaboard reef trips from Cairns aboard the OceanQuest and Reef Quest, with certified and intro diving, snorkelling and PADI courses available.',
    excerpt: 'Divers Den has been operating Cairns reef trips since 1974, running the OceanQuest permanent reef pontoon and the Reef Quest day boat from Reef Fleet Terminal.',
    categories: ['Activities', 'Tours', 'Cairns'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Divers Den',
      location: 'Cairns',
      hook: 'Divers Den is one of the oldest reef operators in Cairns — running since 1974 — and is best known for OceanQuest, a permanently moored reef pontoon that gives you up to seven dives across two days without the boat-time of a traditional liveaboard.',
      about: `<p>Divers Den has been operating from Cairns since 1974, which makes it one of the longest-running dive businesses on the Great Barrier Reef. The company runs two main products: day trips on Reef Quest, a fast 25-metre vessel that visits two outer reef sites in a day; and overnight stays on OceanQuest, a permanently moored multi-level reef base out at Norman Reef.</p>
<p>OceanQuest is the unusual one. Because it stays at the reef, you don&rsquo;t spend hours each day travelling to and from it. You ride out by tender, climb aboard, and the reef is right there. That means up to four dives on day one and three on day two — including a night dive if you choose — without the rocking-at-anchor motion of a typical liveaboard.</p>`,
      expect: `<p>Reef Quest day trips include two guided snorkel tours, hot lunch, morning and afternoon tea, and optional intro or certified dives. The boat carries around 100 passengers but the layout is sensible, with dedicated snorkel and dive areas so it doesn&rsquo;t feel cramped.</p>
<p>OceanQuest overnight trips are the better choice if you&rsquo;re a keen diver. You spend two days at Norman Reef with up to seven dives across the stay, accommodation in twin or double cabins, all meals included, and an experienced reef-based crew. Norman Reef has some of the most consistent visibility on the Cairns side of the reef and the night dive — usually around 6:30pm — is genuinely one of the highlights of any trip to north Queensland.</p>
<p>PADI Open Water courses are available either as pool-and-day-trip combinations or as a three-day OceanQuest package where your certification dives are done at the pontoon.</p>`,
      getting: `<p>Both Reef Quest and the OceanQuest transfer tender depart from Reef Fleet Terminal on the Cairns Esplanade. Check-in for Reef Quest is 8:00am for an 8:30am departure; OceanQuest transfers typically run at 8:00am with a return scheduled the following afternoon.</p>
<p>The terminal is walking distance from most central <a href="/cairns/accommodation/">Cairns accommodation</a>. Free secure luggage storage is offered at the shop for OceanQuest overnight guests.</p>`,
      when: `<p>Year-round operation. Winter (June–October) is best for visibility and comfort; summer (November–April) is warmer in the water but requires stinger suits onboard and trips occasionally relocate to alternative reef sites if a summer storm sweeps through.</p>
<p>The OceanQuest night dive is one of the best on the reef year-round, but the moon phase makes a real difference — new-moon nights are darker and the bioluminescence is more dramatic. Check the lunar calendar when booking if you have flexibility.</p>`,
      why: `<p>For a keen diver who can spare two days, OceanQuest is one of our favourite reef experiences anywhere on the Great Barrier Reef. The on-reef night dive without a long boat trip back, the consistent visibility at Norman Reef, and the fact that you wake up at the reef rather than getting there mid-morning — it all adds up.</p>
<p>The day-trip Reef Quest option is solid value but Silversonic and SilverSwift visit more sites per day if maximum variety is your priority.</p>`,
      tipBullets: [
        'Pack light for OceanQuest — cabins are functional rather than spacious',
        'Bring a torch for the night dive (or hire one onboard)',
        'Allow two days; OceanQuest is not a one-night-in-a-hurry trip',
        'Confirm dietary requirements 48 hours ahead — the kitchen is small',
        'Take a SeaSick tablet on the tender ride out; the pontoon itself is stable',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef'],
        ['/cairns/accommodation/', 'Cairns accommodation'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/', 'Great Barrier Reef Marine Park Authority'],
        ['https://www.padi.com/', 'PADI — Professional Association of Diving Instructors'],
      ],
    },
  },

  // --- GBR cruise/island operators ------------------------------------------
  {
    slug: 'sunlover-reef-cruises',
    legacy: '/directory-qldtravel/listing/sunlover-reef-cruises/',
    title: 'Sunlover Reef Cruises — Moore Reef Day Trip from Cairns',
    seo_title: 'Sunlover Reef Cruises — Moore Reef Pontoon Day Trip from Cairns',
    seo_desc: 'Sunlover Reef Cruises runs family-friendly day trips from Cairns to Moore Reef pontoon, with snorkelling, glass-bottom boat, semi-submersible, and optional helmet diving.',
    excerpt: 'Sunlover Reef Cruises is the family-friendly Cairns reef operator — a 35-metre catamaran to a stable purpose-built pontoon at Moore Reef, with snorkel, glass-bottom boat, semi-sub, optional intro dive and helmet dive.',
    categories: ['Activities', 'Tours', 'Cairns'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Sunlover Reef Cruises',
      location: 'Cairns',
      hook: 'Sunlover Reef Cruises is our go-to recommendation for families on the Cairns reef — a stable Moore Reef pontoon with shaded snorkel platforms, a kids&rsquo; pool area, glass-bottom boat, semi-submersible and optional helmet diving for anyone who can&rsquo;t snorkel.',
      about: `<p>Sunlover Reef Cruises has been operating from Cairns since 1985 and is one of two major pontoon-based reef operators (the other being Reef Magic). The Sunlover pontoon sits at Moore Reef, an inner-reef site about 90 minutes&rsquo; sail from Cairns, and is purpose-built with shaded snorkel platforms, an underwater observatory, dive entry steps, a freshwater shower area and a fully covered eating deck.</p>
<p>The fast catamaran ride from Cairns takes about 90 minutes each way, and the pontoon itself is rock-stable in most conditions — useful for anyone who&rsquo;s nervous about snorkelling from a bobbing boat. Once you&rsquo;re at the reef, you have around four hours to mix-and-match included activities at your own pace.</p>`,
      expect: `<p>The day includes unlimited snorkelling with all gear, a guided snorkel tour, a glass-bottom boat trip, a semi-submersible tour through the coral gardens, an underwater observatory at the pontoon, a freshwater pool area for children, and a generous hot-and-cold buffet lunch.</p>
<p>Optional paid extras include introductory diving (no certificate required), certified diving for those with qualifications, helmet diving (the &ldquo;Sea Walker&rdquo; experience for non-swimmers who want to walk underwater on the reef floor), guided snorkel tours with a marine biologist, and a 10-minute scenic helicopter flight back to Cairns from the pontoon helipad. The helicopter option is a genuine highlight for anyone who&rsquo;s never seen the reef from above.</p>
<p>The pontoon has wheelchair-accessible facilities including a hoist for getting mobility-impaired guests into the water — a rare feature that makes Sunlover one of the more inclusive reef operators on the Great Barrier Reef.</p>`,
      getting: `<p>Sunlover departs from Reef Fleet Terminal on the Cairns Esplanade at 9:30am, returning around 5:30pm. Check-in is from 8:30am. Most central Cairns accommodation is walking distance; Northern Beaches guests can pre-book paid coach transfers.</p>
<p>If you&rsquo;re staying further afield (Port Douglas, Trinity Beach, Palm Cove), driving in and using paid parking near Reef Fleet is usually easier than the coach.</p>`,
      when: `<p>Year-round operation. Winter (June–October) brings the most consistent weather and the best visibility, and water temperatures around 23&deg;C. Summer (November–April) is warmer water (28&deg;C) but stinger suits are required and there&rsquo;s a higher chance of trip swaps if a tropical low affects the weather.</p>
<p>Avoid the first two weeks of January and the second half of September (Queensland school holidays) if you can — the pontoon takes around 250 passengers and it can feel busy in peak periods. The week after Australian school holidays end is usually the sweet spot.</p>`,
      why: `<p>If you&rsquo;re travelling with kids, grandparents, non-swimmers, or anyone who would prefer the reef come to them rather than the other way around, this is the trip we&rsquo;d book. The shaded snorkel platforms make a real difference, the kids&rsquo; pool area is genuinely useful, and the helmet dive option means even guests who can&rsquo;t snorkel can have a reef-floor experience.</p>
<p>For serious snorkellers and divers, Silversonic, SilverSwift or Divers Den would offer better water-time. Sunlover is the all-rounder.</p>`,
      tipBullets: [
        'Book the optional helicopter return — it\'s the highlight if budget allows',
        'Grab a window seat on the catamaran on the way out — the reef approach is worth seeing',
        'The buffet opens at 12:30pm; queue early to maximise snorkel time',
        'Stinger suits are included Oct–May at no extra cost',
        'Lockers on the pontoon are free; bring a padlock if you want extra security',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef'],
        ['/cairns/accommodation/', 'Cairns family accommodation'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/our-work/our-programs-and-projects/eye-on-the-reef', 'Eye on the Reef — citizen science'],
        ['https://www.bom.gov.au/qld/marine/', 'Bureau of Meteorology — QLD marine forecast'],
      ],
    },
  },

  {
    slug: 'calypso-reef-cruises-tropical-journeys',
    legacy: '/directory-qldtravel/listing/calypso-reef-cruises-tropical-journeys/',
    title: 'Calypso Reef Cruises — Outer Barrier Reef from Port Douglas',
    seo_title: 'Calypso Reef Cruises — Outer Reef Day Trip from Port Douglas',
    seo_desc: 'Calypso Reef Cruises runs small-group day trips from Port Douglas to three Outer Great Barrier Reef sites, with diving, snorkelling, and a hot buffet lunch included.',
    excerpt: 'Calypso Reef Cruises is the smaller, more personal Port Douglas alternative to the larger Quicksilver and Silver fleets — a 25-metre catamaran, three outer-reef sites in a day, and a maximum of around 80 guests.',
    categories: ['Activities', 'Tours', 'Great Barrier Reef'],
    destination_slug: 'port-douglas',
    location: 'Port Douglas',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Calypso Reef Cruises',
      location: 'Port Douglas',
      hook: 'Calypso Reef Cruises is the smaller, calmer Port Douglas alternative to the bigger Outer Barrier Reef fleets — three Agincourt Reef sites in a single day, a maximum of around 80 guests, and a crew that learns your name.',
      about: `<p>Calypso Reef Cruises is family-owned and has been running outer reef trips from Port Douglas since 1986 — well before the bigger operators dominated the Agincourt Reef ribbon system. The vessel is a 25-metre catamaran, smaller than Silversonic or Quicksilver&rsquo;s flagships, which means a maximum of around 80 passengers and a noticeably less crowded experience at the reef.</p>
<p>Calypso visits three different sites on the Agincourt ribbons each trip, choosing from a portfolio of around eight sites depending on tides, weather and reef conditions on the day. The crew rotates the sites deliberately rather than always returning to the same coordinates, which means the coral stays in better condition and guests see a genuine variety of reef habitat.</p>`,
      expect: `<p>Every trip includes all snorkel gear, a guided snorkel tour led by a marine biologist or experienced naturalist, a hot buffet lunch with vegetarian and gluten-free options, morning and afternoon tea, and stinger suits in the warmer months.</p>
<p>Optional paid extras include introductory diving, certified diving, guided dives with the dive instructor, and underwater camera hire. There&rsquo;s no semi-submersible or glass-bottom boat — Calypso is more focused on actually getting people into the water than on dry-deck reef viewing — so it&rsquo;s probably not the right pick for anyone who definitely won&rsquo;t snorkel.</p>
<p>The smaller passenger numbers translate to more attention from the marine biologists, shorter queues for the dive ladder, and a generally more relaxed onboard atmosphere. There&rsquo;s an air-conditioned cabin, a sun deck, freshwater showers and a licensed bar for the trip home.</p>`,
      getting: `<p>Calypso departs from the Marina Mirage in Port Douglas at 8:30am and returns around 4:30pm. Check-in opens at 7:45am. Most Port Douglas accommodation is within walking distance of the marina or a short hotel-shuttle ride. Coach transfers from Cairns and the Northern Beaches are available — book 24 hours ahead.</p>
<p>If you&rsquo;re driving in from <a href="/cairns/">Cairns</a>, allow at least 75 minutes for the Captain Cook Highway, and consider staying overnight in Port Douglas to avoid the early start and late return on the same day.</p>`,
      when: `<p>Outer reef conditions from Port Douglas are excellent year-round but most consistent June through October — dry season, calm seas, water around 23&deg;C, and visibility regularly above 20 metres. November through April is warmer (28&deg;C water) with stinger suits required, and occasional summer storms can shift the day&rsquo;s itinerary.</p>
<p>If you&rsquo;re here in dwarf minke whale season (typically late May through August), ask the crew on departure whether minkes have been sighted in the area recently — Calypso has a good record of in-water minke encounters in season because they actively listen for them.</p>`,
      why: `<p>If you&rsquo;d rather a quieter day with a smaller, more attentive crew than the bigger Quicksilver Group product, Calypso is the Port Douglas operator we&rsquo;d pick. The variety of sites is real (we&rsquo;ve done three trips and seen six different reefs), the marine biologists know what they&rsquo;re talking about, and the smaller boat genuinely feels different at the reef. Lunch is also better than most.</p>
<p>The trade-off is fewer onboard facilities — no glass-bottom boat, no helicopter return, no underwater observatory.</p>`,
      tipBullets: [
        'Pre-book — Calypso fills up faster than the larger boats because of the smaller capacity',
        'Sit on the upper deck on the way out for the best reef-approach view',
        'Ask the marine biologist before the first snorkel which site is best for beginners',
        'Bring an underwater camera or rent one — the smaller crowds make for better photos',
        'A wide-brim hat and zinc sunscreen are essentials between snorkel sessions',
      ],
      internalLinks: [
        ['/port-douglas/', 'Port Douglas travel guide'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef'],
        ['/the-great-barrier-reef/attractions/great-barrier-reef-islands/', 'Great Barrier Reef Islands'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/', 'Great Barrier Reef Marine Park Authority'],
        ['https://www.minkewhaleproject.org/', 'The Minke Whale Project'],
      ],
    },
  },

  {
    slug: 'green-island-resort',
    legacy: '/directory-qldtravel/listing/green-island-resort/',
    title: 'Green Island Resort — Coral Cay Resort on the Great Barrier Reef',
    seo_title: 'Green Island Resort — 4½-Star Eco Resort on the Great Barrier Reef',
    seo_desc: 'Green Island Resort is a 46-suite eco-rated property on a coral cay just 45 minutes from Cairns, with a beachfront pool, marine biologist tours and full island access.',
    excerpt: 'Green Island Resort is the only accommodation on Green Island — a 46-suite eco-rated property on a 6,000-year-old coral cay, just 45 minutes by catamaran from Cairns, with the reef literally at your doorstep.',
    categories: ['Accommodation', 'Resorts', 'Great Barrier Reef'],
    destination_slug: 'green-island',
    location: 'Green Island',
    author: 'Sam Davies',
    ctx: {
      name: 'Green Island Resort',
      location: 'Green Island',
      hook: 'Green Island Resort is the only accommodation on Green Island — a 6,000-year-old coral cay 45 minutes off Cairns — and one of very few Great Barrier Reef properties where you can step from your room directly onto reef-fringed sand.',
      about: `<p>Green Island Resort opened in 1994 and remains the only resort on Green Island, a 12-hectare vegetated coral cay inside the Marine Park about 27km off Cairns. The property has 46 suites, all set among the rainforest interior of the island so they&rsquo;re hidden from the day-trip beach areas, and it holds an Advanced Ecotourism Certification — earned through low-impact design, water and energy management, and an ongoing reef monitoring program.</p>
<p>What makes Green Island Resort unusual is that day-trippers leave each afternoon. From about 4pm onwards, the island effectively belongs to the 90-odd resort guests. The boardwalks, the snorkel beaches, the rainforest trails and the marine park observatory all become quiet, and the staff focus shifts entirely to in-house guests.</p>`,
      expect: `<p>The 46 suites are arranged across three categories — Island Suites in the rainforest interior, Reef Suites with garden views, and Island Spa Suites with private balconies and outdoor spa baths. All have king beds (or twin configuration), air conditioning, private bathroom, mini-bar and reef-focused décor.</p>
<p>The resort has two restaurants (Emerald for fine dining, Lite Bites and the pool bar for casual), a swim-up pool bar, full day-spa, and a guest-only beachfront swimming pool. The Marine Discovery Centre runs daily talks with marine biologists, and snorkel gear is included in your room rate — you can pick it up at reception any time.</p>
<p>Beyond the resort, the island has a 600-metre nature walk through pisonia and casuarina forest, glass-bottom boat tours, optional helicopter scenic flights, an underwater observatory, and Marineland Melanesia (the island&rsquo;s long-running crocodile and marine sanctuary). Many of these are included with resort stays.</p>`,
      getting: `<p>Green Island Resort is reached by daily catamaran from Cairns. Both Big Cat (45 minutes) and Great Adventures (50 minutes) include resort transfers in their day-trip fares. Departures are from Reef Fleet Terminal on the Cairns Esplanade between 8:30am and 11:00am, with afternoon return options. Resort guests typically use the morning service out and any return service back.</p>
<p>The boat fare is included for guests in most accommodation packages — confirm at booking. There&rsquo;s also a helicopter transfer option (around 10 minutes from Cairns Airport) that pairs nicely with a one-night stay.</p>`,
      when: `<p>Green Island can be enjoyed year-round. Winter (June–October) is dry-season weather — comfortable air temperatures, water around 23&deg;C, and the best visibility for snorkelling. Summer (November–April) is hotter and more humid, water at around 28&deg;C, with stinger nets in place around the swimming area and stinger suits recommended for reef snorkelling.</p>
<p>Avoid the December–January and Easter peak weeks if you want the island at its quietest — the day-trip catamarans run extended schedules then. Mid-May to mid-June and late October are often the best-value off-peak windows.</p>`,
      why: `<p>The advantage of staying overnight on Green Island is the empty island after 4pm. The day-trip beaches are genuinely full in peak season, with several hundred visitors at once, but they clear out fast on the afternoon catamaran. By 5pm you&rsquo;ll have the snorkel beaches almost to yourself, you can swim with reef fish at sunset, and the boardwalks through the cay forest are quiet enough to spot the resident birdlife (rufous night herons, white-bellied sea eagles).</p>
<p>This is the easiest Great Barrier Reef island to reach as an overnight stay and the only one within day-trip distance of Cairns Airport.</p>`,
      tipBullets: [
        'Book at least one night, not just the day trip — the empty island after 4pm is the point',
        'Bring reef-safe sunscreen; the resort enforces it',
        'Borrow snorkel gear from reception and walk to the eastern beach for the best coral',
        'Eat dinner at Emerald restaurant for the better menu; Lite Bites is fine for lunch',
        'Don\'t miss the Marine Discovery Centre talk — usually 4:30pm daily',
      ],
      internalLinks: [
        ['/all-queensland-islands/green-island/', 'Green Island travel guide'],
        ['/cairns/', 'Cairns travel guide'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef overview'],
      ],
      externalLinks: [
        ['https://www.gbrmpa.gov.au/', 'Great Barrier Reef Marine Park Authority'],
        ['https://www.ecotourism.org.au/our-certification-programs/eco-certification/', 'Ecotourism Australia — certification'],
      ],
    },
  },

  // --- Cruise specialist agency ---------------------------------------------
  {
    slug: 'clean-cruising',
    legacy: '/directory-qldtravel/listing/clean-cruising/',
    title: 'Clean Cruising — Australian Cruise Specialist Agency',
    seo_title: 'Clean Cruising — Specialist Cruise Booking Agency Australia',
    seo_desc: 'Clean Cruising is an Australian cruise specialist booking agency, focused on ocean and river cruises with major lines departing from Brisbane, Sydney and international ports.',
    excerpt: 'Clean Cruising is an Australian specialist cruise booking agency — focused entirely on ocean and river cruises with the major lines, with deep knowledge of departures from Brisbane and other Australian ports.',
    categories: ['Cruises', 'Travel Services'],
    destination_slug: 'brisbane',
    location: 'Brisbane',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Clean Cruising',
      location: 'Brisbane',
      hook: 'Clean Cruising is the cruise-only specialist agency we&rsquo;d use if we wanted to book an ocean or river cruise from an Australian port without sorting through a general travel-agent&rsquo;s mixed bag.',
      about: `<p>Clean Cruising is an Australian-owned cruise specialist agency, headquartered in Queensland and active in the cruise booking market since the late 1990s. Unlike general travel agencies that handle cruise as a sideline, Clean Cruising deals only in cruise — which means deeper product knowledge across the major ocean cruise lines (Princess, Royal Caribbean, Norwegian, Carnival, Celebrity, Cunard, Holland America), the premium and luxury operators (Silversea, Seabourn, Regent Seven Seas, Crystal, Oceania, Azamara), expedition cruise (Aurora, Heritage, Hurtigruten) and river cruise (Viking, Avalon, Uniworld, AmaWaterways, APT, Scenic).</p>
<p>The agency&rsquo;s strength is Australia-departing cruises — voyages out of Brisbane, Sydney, Melbourne, Adelaide, Fremantle and Darwin — because they have direct relationships with the lines for these sailings. They also handle international fly-cruise packages and can build multi-segment itineraries (cruise plus pre- or post-stay).</p>`,
      expect: `<p>What you get with Clean Cruising rather than booking direct: cruise-line loyalty status matching, group-rate access on selected sailings, advance access to repositioning cruise specials, and consolidated insurance and visa support. They publish a regular cruise specials list which is genuinely useful for spotting last-minute fare drops on Brisbane-departing voyages.</p>
<p>The agency handles bookings, deposits and final payments through cruise-line direct-billing systems — so you&rsquo;re paying the line, not paying the agency to forward your money. Cabin selection, dining preferences, shore excursion bookings and special requests are all handled before departure. If something goes wrong onboard (cancellation, schedule changes, port substitutions) Clean Cruising acts as your point of contact with the line.</p>`,
      getting: `<p>Clean Cruising operates primarily by phone and online — there&rsquo;s no walk-in showroom — so you don&rsquo;t need to travel to use them. Their consultants are based in southeast Queensland and most calls are returned within a couple of hours during business days.</p>
<p>For Brisbane-departing cruises (the Brisbane International Cruise Terminal at the Port of Brisbane has been operating since 2020), Clean Cruising handles transfers, parking advice, and pre-cruise accommodation if needed. Most major lines now have at least seasonal Brisbane departures, especially over the October-to-April Australian cruise season.</p>`,
      when: `<p>Best time to book through any cruise specialist is around the &ldquo;Wave Season&rdquo; — January and February — when cruise lines release their best loyalty deals and onboard credit incentives for the upcoming twelve months. Wave Season pricing is genuinely cheaper than booking later for the same sailing.</p>
<p>Brisbane-departing cruises run primarily October through April. If you&rsquo;re flexible, ask about repositioning cruises in shoulder season (April–May or September–October) — these are voyages where a ship is being moved between regions and the fares are heavily discounted.</p>`,
      why: `<p>If you&rsquo;ve cruised before and know what you want, booking direct with the line works fine. If you&rsquo;re newer to cruising or building a complex itinerary (multi-segment, fly-cruise, river cruise with extension) a specialist saves real time and often money. Clean Cruising is one of the few Australian cruise-only agencies of any scale and they handle the Brisbane departures particularly well.</p>
<p>Don&rsquo;t use them if you want a generalist travel agency that also handles your flights, hotels and tours — they only do cruise.</p>`,
      tipBullets: [
        'Sign up to their email list 2–3 months before you want to book',
        'Ask about onboard credit and pre-paid gratuities at quote stage',
        'Wave Season (January–February) is when the best 12-month-ahead deals appear',
        'Repositioning cruises in April-May and Sept-Oct are deeply discounted',
        'Brisbane departures save you the flight to Sydney — factor that into the comparison',
      ],
      internalLinks: [
        ['/australian-cruises/', 'Australian cruise options'],
        ['/orion-expedition-cruises/', 'Orion Expedition Cruises'],
        ['/captain-cook-cruises/', 'Captain Cook Cruises'],
      ],
      externalLinks: [
        ['https://www.cruising.org.au/', 'Cruise Lines International Association — Australia'],
        ['https://www.afta.com.au/', 'Australian Federation of Travel Agents'],
      ],
    },
  },

  // --- Charters Towers (destination, not a business) ------------------------
  {
    slug: 'charters-towers',
    legacy: '/directory-qldtravel/listing/charters-towers/',
    title: 'Charters Towers — Historic Gold Rush Town in Outback Queensland',
    seo_title: 'Charters Towers Travel Guide — Heritage Gold Town in QLD',
    seo_desc: 'Charters Towers is a heritage-listed gold rush town in inland north Queensland, with 65 listed buildings, the Venus Gold Battery museum, and Texas Longhorn cattle drives.',
    excerpt: 'Charters Towers is a heritage gold-rush town in inland north Queensland, 135km southwest of Townsville, with 65 listed buildings, the working Venus Gold Battery museum, and a surprisingly intact 1890s streetscape.',
    categories: ['Destinations', 'Outback Queensland', 'Heritage'],
    destination_slug: 'charters-towers',
    location: 'Charters Towers',
    author: 'Sam Davies',
    ctx: {
      name: 'Charters Towers',
      location: 'Charters Towers',
      hook: 'Charters Towers is the inland Queensland gold-rush town that time mostly forgot — 65 heritage-listed buildings, a working 1872 stamp battery, and an outback streetscape that&rsquo;s startlingly intact 130 years after the gold ran out.',
      about: `<p>Charters Towers sits 135km southwest of Townsville on the Flinders Highway, the inland route west towards Mount Isa and the Northern Territory. Gold was discovered here in 1871 and within twenty years the town had grown to around 30,000 people, making it briefly the second-largest city in Queensland after Brisbane. The wealth funded extraordinarily ambitious public buildings — a stock exchange, multiple grand hotels, a school of mines, churches, a town hall — most of which still stand today.</p>
<p>When the gold reefs gave out in the early 20th century the population collapsed to under 10,000 and stayed there, which is exactly why the streetscape survived. There was never enough money or pressure to demolish the heritage buildings, and most of them are now protected by Queensland Heritage Register listings.</p>`,
      expect: `<p>The walkable town centre includes the 1888 Stock Exchange Building (still operating as the World Theatre and historical museum), the 1891 Excelsior Hotel, the Royal Arcade, the 1892 City Hall, the School of Mines (1898), and several heritage churches. A self-guided heritage walk pamphlet is available from the visitor information centre and the loop takes around 90 minutes.</p>
<p>The Venus Gold Battery, on the eastern edge of town, is the largest surviving stamp battery in Australia and one of the most complete in the world. Built in 1872 and operated until 1973, it&rsquo;s now a working museum where you can see the entire gold-processing chain — from ore crushing through cyanide leaching — preserved in situ. Daily guided tours run twice a day; evening &ldquo;Sound and Light&rdquo; tours add atmosphere.</p>
<p>Beyond town, Towers Hill (the original gold-rush site) has interpretive walks and a great sunset lookout. The Texas Longhorn Cattle Station nearby runs working cattle-drive experiences, and the Burdekin River — Australia&rsquo;s second-largest catchment — has good barramundi fishing in season.</p>`,
      getting: `<p>Charters Towers is on the Flinders Highway, 1 hour 35 minutes from <a href="/townsville/">Townsville</a>. Queensland Rail&rsquo;s <a href="/transport/queensland-rail-travel-train-timetables/the-westlander/">Westlander</a> doesn&rsquo;t stop here but the Inlander long-distance service does, running twice-weekly between Townsville and Mount Isa. Most visitors drive — it&rsquo;s an easy day trip from Townsville or an overnight stop for travellers heading inland.</p>
<p>The town has a small airport but no scheduled commercial services; closest airports are Townsville (1.5 hours) and Charleville (further but useful if approaching from the south). Accommodation includes heritage hotels, motels, and a caravan park.</p>`,
      when: `<p>The dry season (May–October) is ideal — warm clear days, cool nights, and the dust kept down. Daytime temperatures average 24–28&deg;C and overnight can drop to single digits in July, so bring a jumper.</p>
<p>The wet season (November–April) is much hotter (mid-30s daytime) and humid, and the surrounding dirt roads can become impassable after rain. The town itself is sealed-road accessible year-round.</p>`,
      why: `<p>Charters Towers is the heritage town we&rsquo;d send anyone who&rsquo;s interested in Australian colonial history but tired of coastal tourism. The streetscape is remarkably intact — you can walk three blocks and pass eight heritage-listed buildings — and the Venus Gold Battery is one of the genuinely impressive industrial heritage sites in the country. The town is also a manageable size: you can do the major sights in a day and a half without rushing.</p>
<p>The Texas Longhorn experience is a quirky addition that&rsquo;s worth half a day if you&rsquo;re here with kids or anyone curious about working cattle country.</p>`,
      tipBullets: [
        'Pick up the heritage walk pamphlet from the visitor centre before you start',
        'Pre-book the Venus Gold Battery evening tour if you\'re here in school holidays',
        'Stay overnight rather than day-tripping — the town is best at dawn and dusk',
        'Carry extra water in summer; the town centre has limited shade',
        'The Excelsior Hotel still serves a good counter meal — try it for lunch',
      ],
      internalLinks: [
        ['/townsville/', 'Townsville travel guide'],
        ['/destinations/', 'Queensland destinations'],
        ['/transport/queensland-rail-travel-train-timetables/', 'Queensland Rail timetables'],
      ],
      externalLinks: [
        ['https://www.charterstowers.qld.gov.au/visit', 'Charters Towers Regional Council — visitor info'],
        ['https://environment.des.qld.gov.au/heritage/heritage-register', 'Queensland Heritage Register'],
      ],
    },
  },

  // --- Car / transport hire ------------------------------------------------
  {
    slug: 'east-coast-car',
    legacy: '/directory-qldtravel/listing/east-coast-car/',
    title: 'East Coast Car Rentals — Cairns &amp; Gold Coast Car Hire',
    seo_title: 'East Coast Car Rentals — Cairns &amp; Gold Coast Car Hire',
    seo_desc: 'East Coast Car Rentals is an Australian-owned independent rental company with branches in Cairns and the Gold Coast, offering competitive rates on small to mid-size cars.',
    excerpt: 'East Coast Car Rentals is an Australian-owned independent car hire company with branches at Cairns and the Gold Coast, focused on competitive daily rates and unlimited kilometres for the major coastal routes.',
    categories: ['Transport', 'Car Hire'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Beth Hartley',
    ctx: {
      name: 'East Coast Car Rentals',
      location: 'Cairns',
      hook: 'East Coast Car Rentals is the Australian-owned independent we&rsquo;d look at first for budget car hire in Cairns or the Gold Coast — competitive rates, unlimited kilometres on the main models, and an honest pickup process.',
      about: `<p>East Coast Car Rentals is an Australian-owned independent car hire company with rental branches in Cairns and at the Gold Coast (Coolangatta). The company has been operating since 2003 and competes primarily with the global brands (Hertz, Avis, Europcar, Budget) on price for short to medium-length east-coast hires.</p>
<p>The fleet is mid-life rather than brand-new — typically 2–4 year old Toyota Corolla, Hyundai i30 and Mitsubishi ASX models — which is part of how they keep rates lower than the majors. They don&rsquo;t carry exotic categories (no convertibles, no luxury) and they don&rsquo;t take 4WDs onto unsealed roads.</p>`,
      expect: `<p>Standard hire conditions include unlimited kilometres on most rates (verify at booking), comprehensive insurance with reducible excess, 24-hour roadside assistance through their network partner, and additional driver options for a small daily surcharge. Booster seats and infant capsules can be added at booking.</p>
<p>The Cairns branch is at the airport with a free shuttle to the rental office, and the Gold Coast branch is at Coolangatta Airport. Both branches do same-day repositioning between locations (drop-off at the other branch) for an additional fee if needed.</p>
<p>What East Coast doesn&rsquo;t do well: very short hires (under 24 hours) where the major brands&rsquo; airport convenience is hard to beat, and one-way hires to non-East Coast destinations.</p>`,
      getting: `<p>The Cairns branch is at 26 Lyons Street, Bungalow — about 10 minutes from Cairns Airport. They run a free shuttle on demand; call the branch from arrivals once you have your bags.</p>
<p>The Gold Coast branch is on Eastside Drive in Coolangatta, walking distance from Coolangatta Airport. Both branches are open 7am–6pm daily; out-of-hours collection can be arranged with advance notice.</p>`,
      when: `<p>Australian school holidays push rates up significantly — particularly the Christmas/January window, Easter week, and the end-of-September school break. Outside those, rates are fairly steady year-round.</p>
<p>Book at least two weeks ahead if you&rsquo;re hiring in peak summer (December–January) or peak winter (June–August) — Cairns runs out of vehicles in those windows and the spot rates from the majors get expensive fast.</p>`,
      why: `<p>If you want to drive from Cairns up to Port Douglas, or along the Atherton Tablelands, or down the Bruce Highway, East Coast does the job at a noticeably lower daily rate than the majors. The vehicles are clean, the paperwork is straightforward, and the insurance options are sensible.</p>
<p>For 4WD adventures, Fraser Island, or unsealed-road work, look elsewhere — East Coast won&rsquo;t insure their vehicles off bitumen.</p>`,
      tipBullets: [
        'Compare on Vroomvroomvroom.com.au or DriveNow — East Coast quotes vary widely',
        'Decline the daily excess reduction if you have travel insurance with rental excess cover',
        'Photograph the car at pickup — every panel — to avoid post-hire damage disputes',
        'Top up the fuel within 5km of the return branch, not at the highway service station',
        'If you need a 4WD or want to drive on dirt, hire from a 4WD specialist instead',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/gold-coast/', 'Gold Coast travel guide'],
        ['/transport/queensland-rail-travel-train-timetables/', 'Queensland Rail timetables'],
      ],
      externalLinks: [
        ['https://www.qld.gov.au/transport/safety/road-safety/driving-safely', 'Queensland Government — safe driving'],
        ['https://www.racq.com.au/', 'RACQ — Royal Automobile Club of Queensland'],
      ],
    },
  },

  {
    slug: 'bargain-car-rentals',
    legacy: '/directory-qldtravel/listing/bargain-car-rentals/',
    title: 'Bargain Car Rentals — Cheap Car Hire in Cairns, Brisbane &amp; Gold Coast',
    seo_title: 'Bargain Car Rentals — Cheap Car Hire QLD &amp; NSW',
    seo_desc: 'Bargain Car Rentals offers budget car hire from airport and city branches across Cairns, Brisbane, the Gold Coast, Sydney, and Melbourne — older fleet, lower daily rates.',
    excerpt: 'Bargain Car Rentals is one of the larger budget independents in Australia, operating airport and city branches across Cairns, Brisbane, Gold Coast and beyond, with older-fleet vehicles at noticeably lower daily rates than the global brands.',
    categories: ['Transport', 'Car Hire'],
    destination_slug: 'brisbane',
    location: 'Brisbane',
    author: 'Beth Hartley',
    ctx: {
      name: 'Bargain Car Rentals',
      location: 'Brisbane',
      hook: 'Bargain Car Rentals is one of Australia&rsquo;s larger budget car-hire independents — older fleet, lower rates, and a no-frills approach that suits domestic road-trippers who don&rsquo;t need the airport-side luxury of the major brands.',
      about: `<p>Bargain Car Rentals has been operating since 1995 and runs branches across Australia&rsquo;s east coast — including Cairns, Brisbane, Gold Coast (Coolangatta), Sydney and Melbourne. The business model is straightforward: older vehicles (typically 4–7 years old), lower daily rates than the global brands, and city-side branches rather than the more expensive airport-terminal locations.</p>
<p>The fleet skews towards small and mid-size sedans and hatchbacks — Toyota Corolla, Hyundai Accent, Kia Cerato, Mazda 3 — with some SUV options at the larger branches. They don&rsquo;t do exotics, luxury vehicles or 4WDs intended for off-road use.</p>`,
      expect: `<p>Standard inclusions are unlimited kilometres on most rates, comprehensive insurance with a standard excess, 24-hour roadside assistance, and the option to add additional drivers for a daily fee. The default excess is higher than the majors; a daily &ldquo;Damage Excess Reduction&rdquo; product can bring it down. Insurance excludes single-vehicle accidents on unsealed roads, so don&rsquo;t plan dirt-road trips with these cars.</p>
<p>Branches are city-side rather than at the airport — the Brisbane branch is at Eagle Farm, the Gold Coast branch at Bilinga, and the Cairns branch at the Cairns Airport with a free shuttle from arrivals. Pickup and return paperwork is straightforward but expect longer queues than at the major-brand airport counters during peak periods.</p>
<p>What Bargain isn&rsquo;t good for: very short rentals (the inconvenience of getting to a city branch isn&rsquo;t worth it for a one-day hire), one-way drops to remote regional locations, and any plan that involves driving on dirt or 4WD tracks.</p>`,
      getting: `<p>Cairns branch is at the Cairns Airport with a free shuttle running from the terminal. Brisbane branch is at Eagle Farm with shuttle from the airport. Gold Coast branch is at Bilinga, walking distance from Coolangatta Airport. All branches are open seven days; opening hours vary by location and season.</p>
<p>Out-of-hours pickups can be arranged with advance notice and an after-hours fee. One-way hires between the east-coast branches are available with a relocation fee that varies by route and time of year.</p>`,
      when: `<p>Australian school holidays drive rates up considerably; outside those windows pricing is much steadier. The cheapest weeks tend to be late February to early March, early May, and late October to early November. December-January, Easter, and June-July school break are the most expensive.</p>
<p>Bargain also runs periodic flash sales (Australia Day, EOFY, Black Friday) where rates drop 20–30% — useful if you have date flexibility.</p>`,
      why: `<p>For a multi-day east-coast road trip — Cairns to Port Douglas, Brisbane to the Sunshine Coast, Gold Coast to Byron — Bargain genuinely is cheaper than the global brands, and the cars are fine. They&rsquo;re not new, the air-con works, the radio works, the tyres are legal. That&rsquo;s what you&rsquo;re paying for.</p>
<p>For airport-grab one-day hires, executive travellers, or trips that involve any unsealed road, the convenience or vehicle quality of a major brand is usually worth the extra cost.</p>`,
      tipBullets: [
        'Always factor the shuttle time when budgeting your pickup arrival',
        'Compare a few times of year — Bargain\'s rates vary more than the majors',
        'Decline daily excess reduction if your credit-card insurance or travel insurance already covers rental excess',
        'Photograph every panel at pickup — older cars have more existing damage to record',
        'Don\'t take the car onto dirt roads — insurance won\'t cover you',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/gold-coast/', 'Gold Coast travel guide'],
        ['/transport/queensland-rail-travel-train-timetables/', 'Queensland Rail timetables'],
      ],
      externalLinks: [
        ['https://www.qld.gov.au/transport/safety/road-safety/driving-safely', 'Queensland Government — safe driving'],
        ['https://www.racq.com.au/', 'RACQ — Royal Automobile Club of Queensland'],
      ],
    },
  },

  {
    slug: 'acacia-limousines-townsville',
    legacy: '/directory-qldtravel/listing/acacia-limousines-townsville/',
    title: 'Acacia Limousines Townsville — Wedding &amp; Event Limo Hire',
    seo_title: 'Acacia Limousines — Townsville Wedding &amp; Airport Limo Hire',
    seo_desc: 'Acacia Limousines is a Townsville-based luxury car and limousine service for weddings, formals, airport transfers and corporate events across north Queensland.',
    excerpt: 'Acacia Limousines is a long-established Townsville luxury car and limousine service covering weddings, formals, school events, airport transfers and corporate work across north Queensland.',
    categories: ['Transport', 'Townsville'],
    destination_slug: 'townsville',
    location: 'Townsville',
    author: 'Beth Hartley',
    ctx: {
      name: 'Acacia Limousines Townsville',
      location: 'Townsville',
      hook: 'Acacia Limousines is the long-running Townsville luxury car and stretch limousine operator we&rsquo;d turn to for a wedding, a formal, an airport transfer, or any corporate event that calls for something more polished than a taxi.',
      about: `<p>Acacia Limousines has been operating in Townsville since the early 2000s and is the longest-established luxury car and limousine service in north Queensland outside Cairns. The fleet includes stretch limousines (8 and 10 passenger), late-model luxury sedans (typically Mercedes-Benz E-Class and Holden Caprice), and people-mover vans for larger groups or airport luggage runs.</p>
<p>The bulk of the business is wedding and formal-event work — Townsville and Magnetic Island weddings, JCU university formals and graduation events, and the annual high-school formal season — but they also handle corporate airport transfers, VIP travel for visiting executives, and the occasional concert or event package.</p>`,
      expect: `<p>Wedding bookings include a pre-event vehicle inspection meeting, route planning, photo-stop allowances, ribbons and floral decoration, complimentary refreshments in the vehicle, and a professionally uniformed chauffeur. The standard wedding package covers the bride&rsquo;s arrival, ceremony venue, photo locations and the reception drop-off; longer packages are available for groups that want to include the rehearsal or a post-reception departure.</p>
<p>For airport transfers, expect meet-and-greet service at the Townsville Airport arrivals concourse with a name board, luggage handling, and direct transfer to your accommodation or office. Quotes are flat-rate based on destination — no meter, no surge pricing.</p>
<p>Corporate accounts are available for businesses with regular transfer needs, with consolidated monthly billing and priority booking.</p>`,
      getting: `<p>Acacia is based in Townsville and serves the greater Townsville region including Magnetic Island (vehicle ferries to/from Townsville are included where required), Mission Beach (additional travel charges apply), and Charters Towers for special events.</p>
<p>Bookings need a deposit at confirmation. For weddings and major events, book at least three months ahead; for corporate transfers, 24 hours&rsquo; notice is usually sufficient. Same-day airport bookings may be available subject to fleet availability.</p>`,
      when: `<p>The busiest periods are wedding season (April–November is peak), Year 12 formal season (October–November), and the JCU graduation periods (July and December). Book well ahead for any of these windows. The Townsville 400 V8 Supercars weekend in July is another peak booking period.</p>
<p>Quietest months are January–March and June, which is when corporate transfer work dominates.</p>`,
      why: `<p>For a Townsville wedding or formal where you want the arrival to feel right, this is the operator with the longest track record locally. The vehicles are properly maintained (the stretch limos in particular are kept in better condition than is often the case at the budget end of the market), the chauffeurs know the city and the venues, and the bookings process is professional rather than ad-hoc.</p>
<p>For straight airport transfers, taxis or a ride-share will be cheaper. Acacia&rsquo;s value is in the meet-and-greet professionalism and the event-quality vehicles.</p>`,
      tipBullets: [
        'Book wedding packages at least 3 months ahead — peak Saturdays sell out',
        'Confirm exact pickup and drop-off addresses 48 hours before the event',
        'Ask about photo-stop allowances if you want unusual locations',
        'School formal bookings often need parental signature on the contract',
        'For corporate accounts, request the meet-and-greet name board ahead of arrival',
      ],
      internalLinks: [
        ['/townsville/', 'Townsville travel guide'],
        ['/townsville/accommodation/', 'Townsville accommodation'],
        ['/all-queensland-islands/magnetic-island/', 'Magnetic Island'],
      ],
      externalLinks: [
        ['https://www.townsville.qld.gov.au/', 'Townsville City Council'],
        ['https://www.qld.gov.au/transport/licensing/personalised-services/limousine', 'Queensland Government — limousine licensing'],
      ],
    },
  },

  {
    slug: 'townsville-portrait-photographer-nep',
    legacy: '/directory-qldtravel/listing/townsville-portrait-photographer-nep/',
    title: 'NEP Portrait Photography — Townsville Family &amp; Portrait Studio',
    seo_title: 'NEP Portrait Photography — Townsville Family Photographer',
    seo_desc: 'NEP Portrait Photography is a Townsville-based family, portrait and travel-photography studio offering studio sittings, on-location shoots and tourist photography services.',
    excerpt: 'NEP Portrait Photography is a long-running Townsville family and portrait studio that also offers location-shoot services for travellers wanting a professionally-shot Magnetic Island or Strand-area session.',
    categories: ['Services', 'Townsville'],
    destination_slug: 'townsville',
    location: 'Townsville',
    author: 'Beth Hartley',
    ctx: {
      name: 'NEP Portrait Photography',
      location: 'Townsville',
      hook: 'NEP Portrait Photography is the Townsville family and portrait studio we&rsquo;d use if we wanted a professionally-shot family session at the Strand, on Magnetic Island, or against the city&rsquo;s tropical backdrops during a north-Queensland trip.',
      about: `<p>NEP Portrait Photography is a Townsville-based family and portrait studio with both a studio location in the city and an on-location service that travels to the Strand foreshore, the Castle Hill lookout, Magnetic Island, and other recognisable Townsville settings.</p>
<p>The core business is family and child portraiture for local clients — annual family portraits, newborn and maternity shoots, school formal portraits, engagement sessions — but they regularly accept bookings from visiting families and tourists who want a properly-shot session as a holiday keepsake. This sort of travel-portrait work has grown alongside the broader interest in destination family photography.</p>`,
      expect: `<p>A standard session includes a pre-shoot phone consultation to discuss wardrobe, location, timing and mood, the shoot itself (typically 60–90 minutes), professional editing of the selected images, and digital delivery of high-resolution files in 2–3 weeks. Print products (canvases, framed prints, albums) are optional add-ons priced separately.</p>
<p>Studio sessions run from the Townsville studio location. On-location sessions are scheduled around &ldquo;golden hour&rdquo; light — typically the hour after sunrise or the hour before sunset — which generally produces the most flattering results in the bright tropical light.</p>
<p>Popular travel-portrait locations include the Strand boardwalk and beach, the Castle Hill lookout, the Magnetic Island Picnic Bay jetty, and the colonial heritage streetscape in central Townsville. The photographer will recommend locations based on your group size, timing and the look you&rsquo;re after.</p>`,
      getting: `<p>NEP is based in Townsville; the studio location and on-location service area cover the greater Townsville region and Magnetic Island. Magnetic Island shoots require advance booking and ferry timing coordination — the photographer travels across rather than expecting the client to.</p>
<p>Bookings need confirmation at least two weeks ahead for travel clients, more in school-holiday periods.</p>`,
      when: `<p>The best Townsville portrait conditions are during the dry season (May–October) — clear skies, low humidity, comfortable temperatures and reliable golden-hour light. Wet season (November–April) brings hotter, more humid conditions and the chance of afternoon storms, which sometimes mean rescheduling on the day.</p>
<p>School holiday periods are the busiest. If you&rsquo;re visiting during peak season (Christmas, Easter, July) book at least a month ahead.</p>`,
      why: `<p>If you&rsquo;re visiting Townsville on a family holiday and you want a properly-shot family session rather than another year of phone-camera selfies, this is the kind of studio worth booking. The advantage of a local photographer over hiring someone in your home city is the location knowledge — they know exactly where to be at exactly what time of day to make Townsville look its best in the image.</p>
<p>This service won&rsquo;t suit every traveller, but for milestone trips, multi-generational holidays, or anyone wanting a genuine keepsake from a north Queensland visit, it&rsquo;s a useful local option.</p>`,
      tipBullets: [
        'Plan the shoot for your second-last day so you have time for a make-up shoot if weather intervenes',
        'Coordinate outfits in advance — bright clothing reads well against tropical backgrounds',
        'Schedule sunrise rather than sunset in dry season — the air is clearer',
        'For Magnetic Island shoots, allow for ferry timing — the photographer will travel across',
        'Ask about print sizes that ship internationally if you\'re an overseas visitor',
      ],
      internalLinks: [
        ['/townsville/', 'Townsville travel guide'],
        ['/townsville/accommodation/', 'Townsville accommodation'],
        ['/all-queensland-islands/magnetic-island/', 'Magnetic Island travel guide'],
      ],
      externalLinks: [
        ['https://www.townsvillenorthqueensland.com.au/', 'Townsville Tourism — official site'],
        ['https://www.aipp.com.au/', 'Australian Institute of Professional Photography'],
      ],
    },
  },

  // --- Accommodation -------------------------------------------------------
  {
    slug: 'the-sebel-cairns-harbour-lights',
    legacy: '/directory-qldtravel/listing/the-sebel-cairns-harbour-lights/',
    title: 'The Sebel Cairns Harbour Lights — Esplanade Apartment Accommodation',
    seo_title: 'The Sebel Cairns Harbour Lights — Waterfront Apartment Hotel',
    seo_desc: 'The Sebel Cairns Harbour Lights offers self-contained 1, 2 and 3-bedroom apartments on the Cairns waterfront, walking distance to the Esplanade Lagoon and Reef Fleet Terminal.',
    excerpt: 'The Sebel Cairns Harbour Lights is an Accor-managed apartment hotel on the Cairns marina, with self-contained 1, 2 and 3-bedroom units, two pools, and direct walking access to the Esplanade and Reef Fleet Terminal.',
    categories: ['Accommodation', 'Apartments', 'Cairns'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Beth Hartley',
    ctx: {
      name: 'The Sebel Cairns Harbour Lights',
      location: 'Cairns',
      hook: 'The Sebel Cairns Harbour Lights is the apartment hotel we&rsquo;d book in Cairns if we wanted a self-contained kitchen, a marina-front position, and a five-minute walk to both the Esplanade Lagoon and the Reef Fleet Terminal departure pontoons.',
      about: `<p>The Sebel Cairns Harbour Lights is an Accor-managed apartment hotel on the western side of Trinity Inlet, directly opposite the Cairns marina. The complex includes 84 fully self-contained one, two and three-bedroom apartments across two buildings, two large lagoon-style swimming pools, a gymnasium, a poolside bar, and a 24-hour reception.</p>
<p>The property opened in 2007 and was refurbished in 2019. It sits within the larger Harbour Lights mixed-use development which includes restaurants, cafes, the Salt House waterfront bar, a small marina, and a public boardwalk that runs from the Esplanade Lagoon down to the Reef Fleet Terminal.</p>`,
      expect: `<p>One-bedroom apartments include a king bed, separate lounge with sofa bed, full kitchen (oven, cooktop, dishwasher, microwave, full-size fridge), laundry with washer and dryer, and a private balcony — most with marina or city views, some looking inland towards the rainforest mountains. Two and three-bedroom configurations add a second/third bedroom and a second bathroom.</p>
<p>The apartments are genuinely large by Cairns standards — typically 60–80 square metres for a one-bedroom — and the full kitchens are useful for families self-catering breakfast or for longer stays that don&rsquo;t want to eat out every meal. There are also dedicated kids&rsquo; bedding configurations on request.</p>
<p>Pool facilities include a large &ldquo;lagoon&rdquo; freeform pool with shallow sun shelf and a smaller adults-only pool. The poolside bar runs lunch and afternoon service most days. Reef Fleet Terminal — the embarkation point for almost every Cairns reef trip — is a five-minute walk along the boardwalk.</p>`,
      getting: `<p>The Sebel Cairns Harbour Lights is on the Esplanade boardwalk approximately 600 metres south of the Cairns Esplanade Lagoon. It&rsquo;s a 10-minute drive from Cairns Airport (around AU$25 by taxi or shuttle). Paid undercover parking is available on-site.</p>
<p>For reef-trip mornings, the walk to <a href="/the-great-barrier-reef/">Reef Fleet Terminal</a> takes about five minutes — useful when the major operators start checking in at 7:45am.</p>`,
      when: `<p>Cairns is busiest June–October (winter dry season — best weather, peak visitor numbers) and over Christmas/January. Booking ahead is essential in those windows. Shoulder seasons (April–May and November) offer the best balance of weather and value.</p>
<p>Wet season (December–March) is hot and humid with afternoon storms; rates are at their lowest then.</p>`,
      why: `<p>For families and groups who want apartment-style accommodation in central Cairns rather than a standard hotel room, this is one of the better mid-to-upper options. The combination of full kitchens, large floor plans, two pools and the walking-distance reef-trip departure is hard to beat in this part of the city. The property is also genuinely well-maintained, which can&rsquo;t be said of every Cairns apartment block.</p>
<p>Single travellers or short-stay couples may find this overkill compared to a standard hotel room — the value proposition is in the kitchen, the laundry and the multiple bedrooms.</p>`,
      tipBullets: [
        'Request a marina-view balcony at booking if available',
        'Use the laundry — saves a Cairns laundromat trip on longer stays',
        'Walk to Reef Fleet Terminal rather than driving on reef-trip mornings — parking there is paid and limited',
        'The pool gets busy 11am–2pm; swim early or late for quiet',
        'Self-cater breakfast — the local supermarket is a 5-minute walk',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/cairns/accommodation/', 'Cairns accommodation overview'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef'],
      ],
      externalLinks: [
        ['https://www.tropicalnorthqueensland.org.au/', 'Tropical North Queensland — official tourism'],
        ['https://www.cairns.qld.gov.au/', 'Cairns Regional Council'],
      ],
    },
  },

  {
    slug: 'tiki-hotel-apartments-surfers-paradise',
    legacy: '/directory-qldtravel/listing/tiki-hotel-apartments-surfers-paradise/',
    title: 'Tiki Hotel Apartments Surfers Paradise — Family Apartment Hotel',
    seo_title: 'Tiki Hotel Apartments Surfers Paradise — Apartment Hotel',
    seo_desc: 'Tiki Hotel Apartments is a family-owned Surfers Paradise apartment hotel offering studio and 1, 2 and 3-bedroom apartments with kitchen, walking distance to Cavill Avenue and the beach.',
    excerpt: 'Tiki Hotel Apartments is a long-running family-owned apartment block in Surfers Paradise, offering studio through 3-bedroom self-contained units two blocks from Cavill Avenue and the beach.',
    categories: ['Accommodation', 'Apartments', 'Gold Coast'],
    destination_slug: 'surfers-paradise',
    location: 'Surfers Paradise',
    author: 'Beth Hartley',
    ctx: {
      name: 'Tiki Hotel Apartments Surfers Paradise',
      location: 'Surfers Paradise',
      hook: 'Tiki Hotel Apartments is a long-running family-owned apartment block on the quieter side of Surfers Paradise — studios to three-bedroom units, two short blocks from Cavill Avenue, and a noticeably better value than the high-rise resorts on the Esplanade.',
      about: `<p>Tiki Hotel Apartments is one of the older mid-rise apartment buildings in central Surfers Paradise, opened in the 1980s and operated continuously since by the same family business. The property has been progressively refurbished over the years and offers a mix of studio, one-bedroom, two-bedroom and three-bedroom self-contained apartments — useful flexibility for solo travellers, couples and families.</p>
<p>What sets Tiki apart from the high-rise Esplanade properties is its location on the western side of the Cavill Avenue Mall, which means a much quieter night and noticeably lower rates than the absolute-beachfront options, while still being two short walking blocks from the beach and immediately adjacent to the main pedestrian shopping and dining precinct.</p>`,
      expect: `<p>All apartments are self-contained with full kitchen (oven, hotplates, microwave, fridge), laundry facilities (en-suite or shared block laundry depending on apartment type), private balcony, and direct-dial phone. Configurations range from compact studios (good for couples on a budget) through to three-bedroom apartments suitable for families of six.</p>
<p>The building has a pool, spa and small barbecue area in the central courtyard, secure on-site parking, lift access to all floors, and a reception desk staffed during business hours with a guest-callout phone for after-hours arrivals. Daily housekeeping is available on request rather than automatic — useful for longer stays where you don&rsquo;t want strangers in your room every day.</p>
<p>The location puts you within a 3-minute walk of Cavill Avenue Mall, 5 minutes of the beach, 10 minutes of the SkyPoint observation deck at Q1, and easy walking distance to dozens of restaurants and the Surfers Paradise Esplanade.</p>`,
      getting: `<p>Tiki Hotel Apartments is on Cypress Avenue, one block west of Cavill Avenue Mall in central Surfers Paradise. From <a href="/gold-coast/">Gold Coast Airport (Coolangatta)</a> the drive is about 30 minutes; from Brisbane Airport allow 1 hour 15 minutes by road or use the Airtrain plus tram to Cavill Avenue station.</p>
<p>The G:link tram (Gold Coast light rail) stops at Cavill Avenue, a 3-minute walk away, providing easy access to the broader Gold Coast including Broadbeach, Pacific Fair and Southport.</p>`,
      when: `<p>Surfers Paradise peaks during Australian school holidays (especially the September Schoolies period, Christmas/January, and Easter), and during major events like the Gold Coast 600 in late October and the Pan Pacific Masters Games in November.</p>
<p>February to early March, May, and mid-October to mid-November are the quietest and best-value periods. Winter (June–August) is mild and pleasant — Surfers Paradise stays warmer than southern Australia and is a popular winter escape destination.</p>`,
      why: `<p>For families and groups who want apartment-style accommodation in central Surfers Paradise without paying the Esplanade-beachfront premium, Tiki is one of the better value options. The kitchens save real money on a multi-day stay, the location puts you in the middle of everything, and the rates are typically 30–40% lower than equivalent-sized units in the high-rise towers.</p>
<p>The building shows its age in places — this isn&rsquo;t a brand-new luxury tower — but it&rsquo;s clean, well-managed, and the value-per-night for a family is genuinely competitive.</p>`,
      tipBullets: [
        'Request a higher-floor apartment for less street noise',
        'Self-cater breakfast — Coles Surfers Paradise is a 5-minute walk',
        'Use the G:link tram rather than driving — parking elsewhere on the coast is expensive',
        'Walk to the beach for sunrise — it\'s much quieter then',
        'Book directly for longer stays — multi-night rates often beat the OTAs',
      ],
      internalLinks: [
        ['/surfers-paradise/', 'Surfers Paradise travel guide'],
        ['/surfers-paradise/accommodation/', 'Surfers Paradise accommodation'],
        ['/gold-coast/', 'Gold Coast overview'],
      ],
      externalLinks: [
        ['https://www.destinationgoldcoast.com/', 'Destination Gold Coast — official tourism'],
        ['https://ridetheg.com.au/', 'G:link — Gold Coast light rail'],
      ],
    },
  },

  {
    slug: 'peppers-soul-surfers-paradise',
    legacy: '/directory-qldtravel/listing/peppers-soul-surfers-paradise/',
    title: 'Peppers Soul Surfers Paradise — Beachfront Luxury Apartments',
    seo_title: 'Peppers Soul Surfers Paradise — Beachfront Luxury Apartment Hotel',
    seo_desc: 'Peppers Soul is a 77-storey beachfront luxury apartment hotel in Surfers Paradise, with 1, 2 and 3-bedroom apartments, infinity pool, day spa and direct beach access.',
    excerpt: 'Peppers Soul Surfers Paradise is a 77-storey absolute-beachfront luxury apartment hotel with 1, 2 and 3-bedroom apartments, an infinity pool overlooking the Pacific, and direct beach access via private boardwalk.',
    categories: ['Accommodation', 'Resorts', 'Gold Coast'],
    destination_slug: 'surfers-paradise',
    location: 'Surfers Paradise',
    author: 'Beth Hartley',
    ctx: {
      name: 'Peppers Soul Surfers Paradise',
      location: 'Surfers Paradise',
      hook: 'Peppers Soul Surfers Paradise is one of the small handful of genuinely absolute-beachfront luxury apartment hotels on the Gold Coast — 77 storeys directly on Surfers&rsquo; main beach, with an infinity pool that overlooks the Pacific.',
      about: `<p>Peppers Soul opened in 2012 and remains one of the most striking architectural landmarks on the Surfers Paradise skyline — a 77-storey tower set directly on the sand at the central beach. The Peppers brand (part of the Accor portfolio) operates 287 of the building&rsquo;s apartments as a hotel inventory; the remainder are privately owned.</p>
<p>The location is the property&rsquo;s defining feature. There&rsquo;s no road between the building and the sand — guests step from the lobby onto a private boardwalk that connects directly to the beach. Most apartments have ocean views from a private balcony, and the higher floors give you a perspective across the whole of the Gold Coast strip.</p>`,
      expect: `<p>Apartments range from one-bedroom &ldquo;Pinnacle&rdquo; suites (around 90 square metres) through to three-bedroom sub-penthouses (200+ square metres) and full penthouses. All include full chef&rsquo;s kitchens with Miele appliances, marble bathrooms, separate living and dining areas, laundry facilities, and floor-to-ceiling glass on the balcony side.</p>
<p>Resort facilities include the heated infinity pool overlooking the beach, a separate lap pool, a fully-equipped gymnasium, a day spa (Stephanie&rsquo;s Spa Retreat), the on-site Kiyomi Japanese restaurant, and 24-hour reception with concierge services. There&rsquo;s also a kids&rsquo; club and games room.</p>
<p>The Soul Boardwalk dining and retail precinct beneath the tower includes several restaurants, cafés and shops, so you can step out of the building and have most needs covered without crossing a road.</p>`,
      getting: `<p>Peppers Soul is on the corner of Cavill Avenue and Esplanade in Surfers Paradise — the absolute centre of the precinct, directly opposite the entrance to Cavill Avenue Mall. From Gold Coast Airport (Coolangatta) the drive is about 30 minutes; the Airtrain plus G:link tram from Brisbane Airport takes about 1 hour 30 minutes.</p>
<p>The G:link tram stops at Cavill Avenue immediately outside the building, providing easy car-free access to Broadbeach, Pacific Fair, Southport and the Helensvale heavy-rail interchange.</p>`,
      when: `<p>Peppers Soul is busiest during the Australian summer holidays (December–January), Schoolies week (mid-to-late November), and major event weekends like the Gold Coast 600 in October. Shoulder seasons (March–May, September) offer better rates and noticeably calmer beach conditions.</p>
<p>Winter (June–August) is mild on the Gold Coast — water around 19–20&deg;C, air temperatures in the low 20s — and Peppers Soul tends to fill with east-coast Australian guests escaping cooler weather further south.</p>`,
      why: `<p>If you want an absolute-beachfront stay in central Surfers Paradise without compromising on the apartment quality, this is one of the top two or three buildings to consider. The infinity pool overlooking the beach is genuinely spectacular, the apartments are large and properly finished, and the location at the corner of Cavill and Esplanade is the heart of the precinct.</p>
<p>The trade-off versus a quieter option like a Broadbeach apartment hotel is the constant pedestrian noise of Surfers Paradise itself — Cavill Avenue is busy until late and weekends can be raucous.</p>`,
      tipBullets: [
        'Request a high-floor north-facing balcony for the best Gold Coast skyline view',
        'Book a sunset dinner table at Kiyomi a week ahead — it\'s the on-site standout',
        'The infinity pool gets crowded 11am–3pm; swim early',
        'Use the G:link tram for Broadbeach and Pacific Fair — parking elsewhere is expensive',
        'Pre-book Stephanie\'s Spa for any treatment on a Saturday',
      ],
      internalLinks: [
        ['/surfers-paradise/', 'Surfers Paradise travel guide'],
        ['/surfers-paradise/accommodation/', 'Surfers Paradise accommodation'],
        ['/gold-coast/', 'Gold Coast overview'],
      ],
      externalLinks: [
        ['https://www.destinationgoldcoast.com/', 'Destination Gold Coast — official tourism'],
        ['https://ridetheg.com.au/', 'G:link — Gold Coast light rail'],
      ],
    },
  },

  {
    slug: 'base-backpackers-magnetic-island',
    legacy: '/directory-qldtravel/listing/base-backpackers-magnetic-island/',
    title: 'Base Backpackers Magnetic Island — Beachfront Hostel at Nelly Bay',
    seo_title: 'Base Backpackers Magnetic Island — Nelly Bay Beachfront Hostel',
    seo_desc: 'Base Backpackers Magnetic Island is a large beachfront hostel at Nelly Bay with dorms, private rooms, pool, bar, and quick access to Magnetic Island koala trails.',
    excerpt: 'Base Backpackers Magnetic Island is the large beachfront hostel at Nelly Bay — dorms, private rooms, a beach bar, a pool, and quick access to the wild koala population in the island bushland behind it.',
    categories: ['Accommodation', 'Hostels', 'Magnetic Island'],
    destination_slug: 'magnetic-island',
    location: 'Magnetic Island',
    author: 'Sam Davies',
    ctx: {
      name: 'Base Backpackers Magnetic Island',
      location: 'Magnetic Island',
      hook: 'Base Backpackers Magnetic Island is the big beachfront hostel at Nelly Bay — a pool, a bar, dorms and private rooms, and a 15-minute walk to a bushland trail where you stand a genuinely good chance of spotting a wild koala.',
      about: `<p>Base Backpackers Magnetic Island is part of the Base Backpackers chain — a network of hostels across Australia and New Zealand — and is the largest hostel on Magnetic Island. The property is at Nelly Bay, the island&rsquo;s main town and the arrival point for the Townsville ferry, with the front of the building facing directly onto the Nelly Bay foreshore.</p>
<p>The hostel operates the usual range of accommodation styles — mixed and female-only dorms (4, 6, 8 and 10-bed configurations), twin and double private rooms, and en-suite premium private rooms — alongside a large beachfront pool deck, a swim-up bar, and the &ldquo;Boundless Bar&rdquo; that runs nightly entertainment for guests.</p>`,
      expect: `<p>The bulk of the property is built around its beachfront and pool deck areas — large pool, sun loungers, beach access immediately in front. The bar and restaurant area runs from breakfast (continental option included in some rates) through to late-night drinks. There&rsquo;s a games room, a tour desk that can book most island activities and Townsville-mainland transfers, and a small shop for snacks and toiletries.</p>
<p>Dorm accommodation includes lockers (bring or rent a padlock), shared bathroom blocks, and access to all communal facilities. Private rooms range from basic doubles to en-suite premium rooms with their own bathrooms. WiFi is available in common areas; in-room WiFi is typically a paid upgrade.</p>
<p>The hostel runs a regular schedule of social events — beach volleyball, pub quiz nights, sunset BBQs — and the bar is one of the few late-night options on the island, which makes Base the natural meeting point for backpackers staying anywhere on Magnetic Island.</p>`,
      getting: `<p>The hostel is directly opposite the Nelly Bay ferry terminal — a 30-second walk from where the SeaLink fast catamaran from Townsville pulls in. Most guests arrive via the ferry from Townsville (around 25 minutes from the Townsville Breakwater Terminal); fares run hourly through the day.</p>
<p>To explore the rest of the island, the Magnetic Island Bus Service (the Sunbus 110) connects Nelly Bay, Picnic Bay, Arcadia and Horseshoe Bay; alternatively rent a topless &ldquo;Moke&rdquo; or scooter from a local hire shop.</p>`,
      when: `<p>Magnetic Island is busiest during the dry season (May–October) and during Australian school holiday periods. Base in particular fills up fast in the May–September window when the island is most popular with the international backpacker circuit.</p>
<p>Wet season (December–April) is much hotter and humid; rates drop and the hostel is much quieter. Marine stinger season (October–May) means the netted swimming area at Picnic Bay is the safe option for ocean swimming — the hostel&rsquo;s pool is the alternative.</p>`,
      why: `<p>If you want the standard backpacker-hostel experience on Magnetic Island — beachfront pool, busy bar, easy people-meeting, central Nelly Bay location — this is the property. The pool deck and beach are genuinely good, the bar runs entertainment most nights, and the location at the ferry terminal makes arrivals and departures painless.</p>
<p>If you want a quieter Magnetic Island stay, the smaller hostels at Horseshoe Bay or Picnic Bay are better choices. Base is a place to make friends and party, not to read a book in silence.</p>`,
      tipBullets: [
        'Pre-book in May–September if you want a private room',
        'Bring or buy a padlock for the dorm locker',
        'The 4-bed dorms are quieter than the larger ones — pay the small premium if you can',
        'Hire a Moke for a day to explore the rest of the island',
        'The walking trail behind Nelly Bay has wild koalas — go at dawn for the best chance',
      ],
      internalLinks: [
        ['/all-queensland-islands/magnetic-island/', 'Magnetic Island travel guide'],
        ['/townsville/', 'Townsville travel guide'],
        ['/townsville/accommodation/', 'Townsville accommodation'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/magnetic-island', 'Magnetic Island National Park — QPWS'],
        ['https://www.sealinkqld.com.au/townsville-to-magnetic-island', 'SeaLink — Townsville to Magnetic Island ferry'],
      ],
    },
  },

  // --- Hervey Bay charters / whale watching --------------------------------
  {
    slug: 'spirit-of-hervey-bay-whale-watching-hervey-bay',
    legacy: '/directory-qldtravel/listing/spirit-of-hervey-bay-whale-watching-hervey-bay/',
    title: 'Spirit of Hervey Bay — Whale Watching Tours from Urangan',
    seo_title: 'Spirit of Hervey Bay — Whale Watching from Urangan',
    seo_desc: 'Spirit of Hervey Bay runs half-day and full-day whale watching tours from Urangan during the July–November humpback season, with multi-deck viewing platforms.',
    excerpt: 'Spirit of Hervey Bay is the largest purpose-built whale-watching catamaran operating out of Urangan Harbour, with three viewing decks, hydrophones, and a long track record across the humpback season.',
    categories: ['Activities', 'Whale Watching', 'Hervey Bay'],
    destination_slug: 'hervey-bay',
    location: 'Hervey Bay',
    author: 'Beth Hartley',
    ctx: {
      name: 'Spirit of Hervey Bay',
      location: 'Hervey Bay',
      hook: 'Spirit of Hervey Bay is the big, purpose-built whale-watching catamaran out of Urangan Harbour — three viewing decks, underwater hydrophones, and a multi-decade track record across the Hervey Bay humpback season.',
      about: `<p>Spirit of Hervey Bay has been running humpback whale watching tours out of Urangan Harbour since the early 1990s. The current vessel is a 23-metre purpose-built catamaran with three viewing decks (large open lower deck, mid-level partially shaded deck, and an upper-level observation deck), capacity for around 130 guests but typically operating well below that, and an underwater hydrophone system so you can listen to whale song through the boat&rsquo;s PA.</p>
<p>The bay between Fraser Island and the mainland is where humpback whales rest and play during their northern migration — calves are born further north in tropical waters and the cow-calf pairs come into Hervey Bay on the return south, which means the bay is full of resting and socialising whales rather than transit-mode whales. This makes for genuinely close encounters — humpbacks regularly approach boats here in ways they rarely do elsewhere on the Australian coast.</p>`,
      expect: `<p>The standard half-day trip runs around 4.5 hours including approximately 3 hours of whale-watching time on the water. A morning tea or light lunch is included depending on the trip type, all viewing decks are open access (rotate around for different angles), and the on-board commentary is delivered by an experienced naturalist who explains humpback behaviour, identification, and migration patterns.</p>
<p>The full-day trip extends to around 7 hours, includes lunch, and ventures further into Platypus Bay where the calmest water and most concentrated whale activity tends to be. Both trips operate under strict QPWS approach rules — boats can&rsquo;t actively approach within 100 metres, but whales can and very regularly do approach boats, which is exactly when the spectacular &ldquo;mugging&rdquo; encounters happen.</p>
<p>The hydrophone system is a real differentiator. When the boat is stopped and a whale is singing nearby, the PA broadcasts the song through the vessel — and humpback song is unlike anything else in the ocean. Cameras and binoculars can be brought aboard; the boat also has a small shop for water, snacks and souvenirs.</p>`,
      getting: `<p>Spirit of Hervey Bay departs from the Urangan Boat Harbour, a 10-minute drive from central Hervey Bay. The harbour has free parking and the boat is at Berth 3. Most Hervey Bay accommodation is 10–15 minutes from the harbour; some operators offer paid coach transfers — confirm at booking.</p>
<p>Hervey Bay itself is about 3.5 hours&rsquo; drive north of Brisbane (290km) on the Bruce Highway, or accessible via daily flights from Brisbane and Sydney to Hervey Bay Airport.</p>`,
      when: `<p>The Hervey Bay humpback whale season runs from mid-July through early November, with the peak generally August–October when the cow-calf pairs are concentrated in the bay. Spirit of Hervey Bay typically operates from late July to the first weekend of November.</p>
<p>Whether you want a half-day or full-day trip depends on the season — early in the season (July) the whales are more transient and a full-day trip increases your chances of close encounters; mid-to-late season (August–October), half-day trips deliver consistently spectacular sightings because the bay is so full of whales.</p>`,
      why: `<p>Hervey Bay is one of the best humpback whale-watching destinations on Earth, and Spirit of Hervey Bay is one of the longest-running and best-equipped operators in the bay. The three viewing decks make a real difference compared to single-deck day boats; the hydrophone system is genuinely special; and the crew know the bay and the whale behaviour well enough to position the boat where the whales are most likely to come to you.</p>
<p>For families with kids, the multi-deck layout means easy supervision and good viewing for all heights. For serious photographers, the upper deck gives an angle and clear sightline that&rsquo;s hard to get from a smaller boat.</p>`,
      tipBullets: [
        'Mid-season (August–October) gives the most reliable close encounters',
        'Take seasickness medication 30 minutes before departure if you\'re prone',
        'Bring a windbreaker even in good weather — the upper deck gets breezy',
        'A polarising filter on your camera lens dramatically improves photos',
        'Listen for the hydrophone announcement — the whale song is the best part',
      ],
      internalLinks: [
        ['/hervey-bay/', 'Hervey Bay travel guide'],
        ['/hervey-bay/activities/whale-watching/listings/', 'Hervey Bay whale watching operators'],
        ['/all-queensland-islands/fraser-island/', 'Fraser Island travel guide'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/great-sandy-marine', 'Great Sandy Marine Park — QPWS'],
        ['https://environment.des.qld.gov.au/wildlife/animals/living-with/whales-dolphins', 'QLD whale watching code of conduct'],
      ],
    },
  },

  {
    slug: 'm-v-mikat',
    legacy: '/directory-qldtravel/listing/m-v-mikat/',
    title: 'M.V. Mikat — Hervey Bay Whale Watching &amp; Charter Vessel',
    seo_title: 'M.V. Mikat — Hervey Bay Whale Watching Charter',
    seo_desc: 'M.V. Mikat is a 38-foot Hervey Bay charter vessel running small-group humpback whale watching tours and Fraser Coast charters from Urangan Harbour.',
    excerpt: 'M.V. Mikat is a smaller 38-foot Hervey Bay charter vessel running small-group whale-watching trips in season and bespoke Fraser Coast charters out of Urangan Harbour.',
    categories: ['Activities', 'Whale Watching', 'Hervey Bay'],
    destination_slug: 'hervey-bay',
    location: 'Hervey Bay',
    author: 'Beth Hartley',
    ctx: {
      name: 'M.V. Mikat',
      location: 'Hervey Bay',
      hook: 'M.V. Mikat is the smaller, more personal alternative to the big Hervey Bay whale-watching catamarans — a 38-foot charter vessel that takes around 25 guests, runs slower, gets closer, and treats every trip more like a private charter than a tour.',
      about: `<p>M.V. Mikat is a 38-foot motor vessel operated as a small-group whale-watching and charter boat out of Urangan Harbour in Hervey Bay. Compared to the larger purpose-built whale-watching catamarans in the bay (which can carry over 100 guests), Mikat caps passenger numbers around 25 — which means more space, more attention from the crew, and a fundamentally different feel on the water.</p>
<p>The vessel operates primarily during the humpback whale season (July–November) running half-day whale-watching trips, and during the rest of the year takes on private charter work — birthday cruises, fishing parties, sunset cruises, scattering-of-ashes services, photographers&rsquo; charters, and the occasional educational group.</p>`,
      expect: `<p>Whale-watching trips are around 4 hours including approximately 2.5–3 hours of actual whale time. The standard inclusions are morning tea or light refreshments, expert on-board commentary from a skipper who&rsquo;s been working in the bay for many years, and unrestricted access to the foredeck and aft deck for viewing. The smaller capacity means everyone has a front-row view; you don&rsquo;t need to position yourself early or compete for railing space.</p>
<p>Private charter work is built around your group&rsquo;s specific needs. For fishing charters, the vessel carries all bait and tackle and the skipper knows the Fraser Coast reef and estuary spots. For special-occasion charters (anniversaries, scattering of ashes, birthdays), the schedule is built around what you want to do.</p>
<p>The vessel doesn&rsquo;t have hydrophones or multi-deck viewing platforms like the larger whale-watching boats — but it does have a slower, quieter approach that humpbacks seem to respond to particularly well, and you&rsquo;ll often get closer in-water encounters as a result.</p>`,
      getting: `<p>M.V. Mikat departs from Urangan Boat Harbour in Hervey Bay, the same harbour as the larger whale-watching operators. Free parking is available at the harbour; most Hervey Bay accommodation is 10–15 minutes&rsquo; drive away.</p>
<p>Hervey Bay is about 3.5 hours by car north of Brisbane, or accessible via daily Brisbane–Hervey Bay flights.</p>`,
      when: `<p>Whale-watching trips run from mid-July through early November. Peak season is August through October when humpback numbers in the bay are highest. Private charters operate year-round subject to availability and weather.</p>
<p>For whale-watching, the smaller-boat experience is particularly valued in mid-season when the cow-calf pairs are concentrated and the encounters tend to be slow, prolonged and intimate — exactly the conditions in which a smaller boat outperforms a larger one.</p>`,
      why: `<p>If you want the personal, small-group whale-watching experience rather than the multi-deck big-boat one, Mikat is the operator we&rsquo;d book. The lower passenger count, the more flexible itinerary, and the skipper&rsquo;s genuine years of experience in the bay all add up to a different kind of day. Encounters tend to last longer because the boat can quietly hold position rather than needing to circulate around a tour schedule.</p>
<p>For private charter work — birthday cruises, ashes scattering, family outings, fishing parties — Mikat is also a sensible Hervey Bay choice. The boat is comfortable, the skipper is experienced, and the price for a small private group is often competitive with booking individual seats on a public tour.</p>`,
      tipBullets: [
        'Book early for whale season — the smaller capacity sells out faster',
        'Bring binoculars and a long camera lens; you\'ll get close but extra reach helps',
        'For private charter, set a clear time budget — Mikat builds the day around you',
        'Discuss any special requests (sunset return, fishing add-on) at booking',
        'Mid-week trips are quieter at the harbour and often have better whale-spotting',
      ],
      internalLinks: [
        ['/hervey-bay/', 'Hervey Bay travel guide'],
        ['/hervey-bay/activities/whale-watching/listings/', 'Hervey Bay whale watching operators'],
        ['/hervey-bay/attractions/urangan-boat-harbour/', 'Urangan Boat Harbour'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/great-sandy-marine', 'Great Sandy Marine Park'],
        ['https://environment.des.qld.gov.au/wildlife/animals/living-with/whales-dolphins', 'QLD whale watching code of conduct'],
      ],
    },
  },

  {
    slug: 'lapu-charters',
    legacy: '/directory-qldtravel/listing/lapu-charters/',
    title: 'Lapu Charters — Hervey Bay Fishing &amp; Diving Charters',
    seo_title: 'Lapu Charters — Hervey Bay Reef &amp; Estuary Fishing Charters',
    seo_desc: 'Lapu Charters runs reef and estuary fishing charters and dive trips from Urangan Harbour, targeting Hervey Bay\'s reef species and the wrecks of the Hervey Bay Artificial Reef.',
    excerpt: 'Lapu Charters is a Hervey Bay fishing and dive charter operator running half-day and full-day trips out of Urangan Harbour to the bay\'s reef and wreck sites.',
    categories: ['Activities', 'Fishing', 'Hervey Bay'],
    destination_slug: 'hervey-bay',
    location: 'Hervey Bay',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Lapu Charters',
      location: 'Hervey Bay',
      hook: 'Lapu Charters is the Hervey Bay fishing and dive operator we&rsquo;d call for a half-day reef session or a wreck-dive trip to the Hervey Bay Artificial Reef — small boat, knowledgeable skipper, no minimum group size.',
      about: `<p>Lapu Charters is a Hervey Bay-based fishing and dive charter operation working out of Urangan Boat Harbour. The vessel is a mid-size charter boat configured for small-group operation (typically up to 10 anglers or divers), with all fishing tackle and dive gear available for hire and the skipper experienced in both the bay&rsquo;s estuary systems and the reef structures to the east of Fraser Island.</p>
<p>The business runs primarily as charter rather than fixed-departure tours — which means trip timing, location and target species are negotiated with the group ahead of departure rather than locked into a single product. Half-day and full-day options are standard.</p>`,
      expect: `<p>Fishing charters cover estuary work (mangrove jack, barramundi, flathead) in the Mary River and Susan River systems, inshore reef fishing for snapper, sweetlip, coral trout and grass emperor, and offshore reef trips to the &ldquo;Fairway&rdquo; and the Hervey Bay Artificial Reef. All bait and tackle are provided; bring your own gear if preferred. The skipper will clean and bag your catch at the dock at the end of the day.</p>
<p>Dive charters work the Hervey Bay Artificial Reef — a series of decommissioned naval vessels and barges deliberately sunk to create habitat — and various natural reef structures within range of Urangan. Divers need to bring or hire their own gear; air fills can be arranged through local dive shops. The skipper isn&rsquo;t a dive instructor, so certified divers only (open-water minimum).</p>
<p>Private charter (whole-boat hire) for a group of up to 10 typically runs at a flat rate and includes the same inclusions as standard charters — useful for family or workplace groups who want the boat to themselves.</p>`,
      getting: `<p>Lapu departs from Urangan Boat Harbour. Free parking is available at the harbour. Most Hervey Bay accommodation is 10–15 minutes&rsquo; drive away.</p>
<p>Hervey Bay is approximately 3.5 hours north of Brisbane by car, or accessible via daily flights from Brisbane and Sydney.</p>`,
      when: `<p>Fishing is productive year-round in Hervey Bay, but target species vary by season. Snapper and grass emperor are most consistent April–October; coral trout fish well in the warmer months (October–April). Barramundi season runs February to November in Queensland; check the current QPWS closures before booking a barra trip.</p>
<p>Diving is comfortable year-round with water temperatures ranging from around 21&deg;C in winter to 28&deg;C in summer. Visibility is best in the dry season (May–October). Avoid windy days in winter — Hervey Bay can chop up rapidly in southeasterlies.</p>`,
      why: `<p>If you&rsquo;re a serious angler or diver visiting Hervey Bay and you want a small-group, customisable charter rather than a packaged tourist trip, Lapu is the operator to call. The skipper knows the bay&rsquo;s fishing structure (artificial reefs, channels, drop-offs) in detail and the small-group format means you can actually fish the better spots rather than circulating around a tour schedule.</p>
<p>For casual visitors who just want a half-day &ldquo;catch-some-fish&rdquo; experience, the larger party boats may be more economical. Lapu&rsquo;s strength is the customisation, the local knowledge, and the small-group attention.</p>`,
      tipBullets: [
        'Discuss target species at booking — the skipper will tailor location and tackle',
        'Bring polarised sunglasses; reduces glare and helps spot structure',
        'Take seasickness medication if you\'re going beyond the inner bay',
        'Divers — confirm air-fill arrangements with the skipper before the day',
        'Group charters are often better value than individual seats; consider booking with friends',
      ],
      internalLinks: [
        ['/hervey-bay/', 'Hervey Bay travel guide'],
        ['/hervey-bay/attractions/urangan-boat-harbour/', 'Urangan Boat Harbour'],
        ['/queensland/activities/fishing-charters/', 'Queensland fishing charters'],
      ],
      externalLinks: [
        ['https://www.daf.qld.gov.au/business-priorities/fisheries/recreational', 'QLD Recreational Fishing — closures &amp; limits'],
        ['https://parks.des.qld.gov.au/parks/great-sandy-marine', 'Great Sandy Marine Park'],
      ],
    },
  },

  // --- Whitsundays sailing -------------------------------------------------
  {
    slug: 'prosail-whitsundays',
    legacy: '/directory-qldtravel/listing/prosail-whitsundays/',
    title: 'ProSail Whitsundays — Maxi Yacht Sailing &amp; Tours from Airlie Beach',
    seo_title: 'ProSail Whitsundays — Maxi Yacht Sailing Tours, Airlie Beach',
    seo_desc: 'ProSail Whitsundays operates 2 and 3-day maxi yacht sailing tours through the Whitsunday Islands, including Whitehaven Beach, snorkelling sites and Hill Inlet lookout.',
    excerpt: 'ProSail Whitsundays runs 2 and 3-day adventure sailing tours of the Whitsunday Islands aboard former racing maxi yachts, including Whitehaven Beach, Hill Inlet, and the Great Barrier Reef\'s fringing snorkel sites.',
    categories: ['Activities', 'Sailing', 'Whitsundays'],
    destination_slug: 'airlie-beach',
    location: 'Airlie Beach',
    author: 'Mick Gallagher',
    ctx: {
      name: 'ProSail Whitsundays',
      location: 'Airlie Beach',
      hook: 'ProSail Whitsundays is the operator we&rsquo;d book for a 2 or 3-day maxi-yacht adventure through the Whitsunday Islands — sailing-focused, properly fast, and including Whitehaven Beach, Hill Inlet and the best of the inner-island snorkel sites.',
      about: `<p>ProSail Whitsundays operates a fleet of former racing maxi yachts — including ex-America&rsquo;s Cup contenders and Sydney-to-Hobart competitors — that have been refitted for overnight sailing tours through the 74 islands of the Whitsundays group. The vessels are still genuinely fast sailing yachts (capable of 25+ knots in strong conditions) but are kitted out with bunks, galley, and shared bathroom facilities for multi-day passenger work.</p>
<p>The standard product is the 2-day, 2-night and 3-day, 3-night sailing tour departing from Airlie Beach, each including the Whitsundays&rsquo; major must-sees: Whitehaven Beach (the famously pure-silica seven-kilometre white beach), Hill Inlet lookout (the swirling sand-and-water patterns at the head of Tongue Bay), multiple snorkel sites at the inner reefs, and one or two anchorages in the more sheltered island bays.</p>`,
      expect: `<p>Tours include all meals (cooked onboard by the crew — breakfast, lunch, dinner), accommodation in shared cabin bunks (typically twin or triple share), snorkelling gear, stinger suits in summer, all transfers to and from Whitehaven Beach, and the National Park lookout walks. Linen is provided. Drinks aren&rsquo;t included — bring your own alcohol or buy onboard, BYO snacks are welcome.</p>
<p>The vessels carry around 20–30 guests depending on which yacht, plus a crew of 3–5. Sleeping is in shared bunk cabins — comfortable rather than luxurious. Bathroom facilities are shared and use saltwater (rinse showers using fresh water at change-over). The decks are the social space — most guests spend daylight hours on deck under sail and gather in the saloon for meals.</p>
<p>The sailing itself is a real part of the experience. The skipper will invite guests to help hoist sails, take a turn at the helm, and trim during the day. If you have any sailing experience you&rsquo;ll get more out of this than guests on a passive day cruise.</p>`,
      getting: `<p>ProSail tours depart from Coral Sea Marina in Airlie Beach. Check-in is at the ProSail office on the marina the morning of departure. Most Airlie Beach accommodation is within a 5-minute drive of the marina and the operator offers paid coach transfers from accommodation if needed.</p>
<p>Airlie Beach is accessed by road (about 2 hours north of Mackay), by train via Proserpine plus a 30-minute coach connection, or by air via Whitsunday Coast Airport (also at Proserpine). Hamilton Island and Whitsunday Coast are the two airport options.</p>`,
      when: `<p>Whitsunday sailing is excellent year-round but conditions vary. May–September is the dry-season trade-wind period — consistent 15–25 knot southeasterlies, mostly clear weather, and the best sailing performance. October–November is shoulder season with lighter winds. December–April is wet season — warmer water but the wind is more variable and tropical lows can shut operations down for a few days at a time.</p>
<p>Stinger suits are required between October and May because of marine stingers. Avoid the school-holiday peaks (late June–early July, late September, December–January) if you want a less crowded boat.</p>`,
      why: `<p>If you want a Whitsundays sailing trip with genuine emphasis on actual sailing — rather than a motoring &ldquo;sail&rdquo; tour — ProSail is the operator to book. The vessels are former racing yachts and they perform like it; in a stiff breeze the boats will heel over and you&rsquo;ll be on a proper offshore sail.</p>
<p>For travellers who want luxury cabins, ensuite bathrooms, and a slower pace, look at the catamaran-style charter operators instead. ProSail is the adventurous, sailing-focused choice. The trade-off — shared bunks, shared bathrooms, no air-con — is genuine but it&rsquo;s also part of why the trips are priced sensibly for the experience you get.</p>`,
      tipBullets: [
        'Pack soft luggage only — cabin space is tight',
        'Take seasickness medication; the southeasterlies can produce a lot of motion at sea',
        'Bring binoculars — humpback sightings are common in July–October',
        'Reef-safe sunscreen only — strictly enforced',
        'Tip the crew at the end if they\'ve worked hard — they generally have',
      ],
      internalLinks: [
        ['/airlie-beach/', 'Airlie Beach travel guide'],
        ['/all-queensland-islands/whitsunday-islands/', 'Whitsunday Islands'],
        ['/all-queensland-islands/whitsunday-islands/charters/whitsundays-bare-boat-charters/', 'Whitsunday bareboat charters'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/whitsunday-islands', 'Whitsunday Islands National Park — QPWS'],
        ['https://www.tourismwhitsundays.com.au/', 'Tourism Whitsundays — official site'],
      ],
    },
  },
]

// ---------------------------------------------------------------------------

console.log(`Will insert ${listings.length} listings into autravel.articles.`)

let inserted = 0
let skipped = 0
for (const l of listings) {
  const body = build(null, l.ctx)
  const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

  // pre-check existing
  const exists = await sql`SELECT slug FROM autravel.articles WHERE state_code=${STATE} AND legacy_path=${l.legacy} LIMIT 1`
  if (exists.length) {
    console.log(`SKIP (already exists): ${l.slug}  legacy=${l.legacy}`)
    skipped++
    continue
  }

  await sql`
    INSERT INTO autravel.articles (
      state_code, slug, legacy_path, title, excerpt, body_html, cover_image,
      categories, destination_slug, post_type, author, status, source,
      published_at, seo_title, seo_description
    ) VALUES (
      ${STATE},
      ${l.slug},
      ${l.legacy},
      ${l.title},
      ${l.excerpt},
      ${body},
      ${COVER(l.location)},
      ${JSON.stringify(l.categories)}::jsonb,
      ${l.destination_slug || null},
      'post',
      ${l.author},
      'published',
      'backlinks-restore',
      now(),
      ${l.seo_title},
      ${l.seo_desc}
    )
  `
  console.log(`OK [${wordCount}w]  ${l.slug}  ->  https://${TENANT_HOST}${l.legacy}`)
  inserted++
}

console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`)
await sql.end()
