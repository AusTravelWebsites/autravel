#!/usr/bin/env node
/**
 * Group D: build 8 missing pages + insert .html→clean redirects.
 *
 * Pages built with clean URLs as legacy_path. .html legacy URLs get redirected
 * to the clean versions.
 */
import postgres from 'postgres'
import { config as dotenv } from 'dotenv'
import { resolve } from 'node:path'

dotenv({ path: resolve(process.cwd(), '.env.local') })
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

const STATE = 'qld'
const COVER = (q) =>
  `https://images.unsplash.com/photo-1558575316-b01a9adccd31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080&ixlib=rb-4.1.0&auto=format&utm_source=qldtravel&utm_medium=cover&hint=${encodeURIComponent(q)}`

function build(ctx) {
  const { hook, about, expect, getting, when: whenSection, why, tipBullets, internalLinks, externalLinks, name, location } = ctx
  const internal = internalLinks.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('\n')
  const external = externalLinks.map(([href, label]) => `<li><a href="${href}" rel="nofollow noopener" target="_blank">${label}</a></li>`).join('\n')
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
${whenSection}

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
  {
    slug: 'tannum-sands',
    legacy: '/directory-qldtravel/listing/tannum-sands/',
    altLegacy: '/tannum-sands/',
    title: 'Tannum Sands — Coastal Township &amp; Beach Suburb of Gladstone',
    seo_title: 'Tannum Sands — Beach Town near Gladstone, Queensland',
    seo_desc: 'Tannum Sands is a coastal township just south of Gladstone with a long protected beach, the Boyne River estuary, and easy access to the southern Great Barrier Reef.',
    excerpt: 'Tannum Sands is a relaxed coastal township 20km south of Gladstone, with a long protected swimming beach, the Boyne River estuary, and easy access to Heron and Wilson Islands on the southern Great Barrier Reef.',
    categories: ['Destinations', 'Beaches', 'Gladstone Region'],
    destination_slug: 'gladstone',
    location: 'Tannum Sands',
    author: 'Sam Davies',
    ctx: {
      name: 'Tannum Sands',
      location: 'Tannum Sands',
      hook: 'Tannum Sands is the easy-going beach suburb 20km south of Gladstone — a long stinger-net swimming beach, the Boyne River mouth for fishing and crabbing, and the closest mainland access point to the southern Great Barrier Reef cays.',
      about: `<p>Tannum Sands sits at the mouth of the Boyne River on Queensland&rsquo;s Discovery Coast, about 20 minutes south of Gladstone by car and roughly halfway between Bundaberg and Rockhampton. The township is a residential beach community of around 6,000 people that doubles as a quiet alternative to staying in industrial Gladstone for anyone visiting the southern reef cays — Heron Island, Wilson Island, Lady Musgrave Island and Lady Elliot Island are all reached from the Gladstone marina.</p>
<p>The town grew up around the Boyne Aluminium Smelter, which is still the region&rsquo;s major employer, but the beachfront and the river estuary draw visitors year-round for swimming, fishing, paddle-craft, and the protected Wild Cattle Creek estuary system. Tannum is genuinely uncrowded outside school holidays.</p>`,
      expect: `<p>The main attraction is Tannum Sands beach itself — a four-kilometre stretch of white sand running south from the Boyne River mouth, with a stinger-netted swimming enclosure in season, lifeguard patrols during peak periods, and an excellent paved boardwalk for evening strolls. The water is generally calm and clean, well suited to families.</p>
<p>The Boyne River estuary is the local focus for fishing and crabbing — flathead, bream, whiting and mud crabs are all targets, and most local tackle shops can point you to the productive spots. Kayaks and paddleboards can be hired from operators in town for exploring the river upstream past the casuarinas.</p>
<p>For day trips, Gladstone Marina is a 25-minute drive away and is the launching point for catamaran ferries to Heron Island and other southern reef destinations. The Boyne Tannum Hookup, held over the May long weekend each year, is one of the largest amateur fishing competitions in Australia and brings around 3,000 anglers to the region.</p>`,
      getting: `<p>Tannum Sands is on the Bruce Highway exit at Calliope, 460km north of Brisbane and 110km south of Rockhampton. Driving is the most practical access — Gladstone Airport has connections from Brisbane and Sydney and is 25 minutes from Tannum, and there&rsquo;s a Queensland Rail Tilt Train service to Gladstone with a 25-minute road transfer to Tannum from there.</p>
<p>Accommodation is mostly self-contained units, motel-style properties and a caravan park; there are no large resort properties in the town itself. Gladstone has more accommodation if Tannum is fully booked during peak periods.</p>`,
      when: `<p>The dry season (April–September) is the most comfortable visiting period — warm clear days, low humidity, and the best swimming conditions. School holiday periods are noticeably busier; the Boyne Tannum Hookup over the May long weekend fills accommodation across the region.</p>
<p>Wet season (October–March) is hotter and more humid, with marine stingers requiring the netted swimming enclosure. November–April rainfall can also produce dramatic afternoon thunderstorms but generally the weather is still good for beach activities.</p>`,
      why: `<p>If you&rsquo;re visiting the southern Great Barrier Reef and don&rsquo;t want to base yourself in industrial Gladstone, Tannum Sands is the obvious alternative. The beach is genuinely good — uncrowded, clean and family-safe — and the town has enough restaurants and amenities for a comfortable stay without being a tourist precinct. Our team uses Tannum as a 1–2 night layover when heading to or from <a href="/all-queensland-islands/heron-island/">Heron Island</a>.</p>
<p>For travellers seeking a quiet east-coast beach town away from the bigger tourist destinations, Tannum is one of the more honest options in the region.</p>`,
      tipBullets: [
        'Book the Boyne Tannum Hookup weekend (May) months ahead — accommodation fills',
        'Hire a kayak and paddle the Boyne River upstream at low tide for the best estuary fishing',
        'Use the stinger-net enclosure October–May; the open beach is fine outside stinger season',
        'Drive to Gladstone Marina for any reef trip — there\'s no ferry from Tannum',
        'Stop at the Wild Cattle Creek boardwalk on Lions Park Drive for sunset',
      ],
      internalLinks: [
        ['/all-queensland-islands/heron-island/', 'Heron Island'],
        ['/discovery-coast/', 'Discovery Coast'],
        ['/destinations/', 'Queensland destinations'],
      ],
      externalLinks: [
        ['https://www.gladstoneregion.info/', 'Gladstone Region — official tourism'],
        ['https://parks.des.qld.gov.au/parks/great-sandy-marine', 'Great Sandy Marine Park'],
      ],
    },
  },

  {
    slug: 'motor-home',
    legacy: '/motor-home/',
    title: 'Motor Home &amp; Campervan Hire in Australia — Complete Guide',
    seo_title: 'Motorhome &amp; Campervan Hire Australia — Operator Guide',
    seo_desc: 'Comparison guide to motorhome and campervan hire in Australia: Apollo, Britz, Maui, Kea, Jucy, Cruisin and more, with route advice and seasonal pricing tips.',
    excerpt: 'A practical guide to motorhome and campervan hire in Australia — the major rental brands (Apollo, Britz, Maui, Kea, Jucy, Cruisin), the typical routes, the licence requirements, and the seasonal pricing patterns.',
    categories: ['Transport', 'Motorhome Hire'],
    destination_slug: null,
    location: 'Australia',
    author: 'Beth Hartley',
    ctx: {
      name: 'motorhome and campervan hire in Australia',
      location: 'Australia',
      hook: 'Hiring a motorhome or campervan is one of the best ways to see Australia at your own pace — but the operator landscape is confusing, the seasonal pricing swings dramatically, and the licence and insurance rules trip up first-timers. This is our practical operator-by-operator guide.',
      about: `<p>Australia has a mature motorhome and campervan rental industry built around a handful of major operators who account for the bulk of the fleet. The biggest names are Apollo Motorhome Holidays, Britz, Maui (the premium arm of the Britz/Maui group), Kea Campers, Jucy and Cruisin. Each operates from depots in the capital cities and major regional centres, and most allow one-way hires between depots for a relocation fee.</p>
<p>The vehicles range from small 2-berth budget campervans (typically converted Hi-Ace or similar) through to large 6-berth motorhomes with full bathroom, kitchen and slide-out beds. Premium operators (Maui in particular) run newer fleets with better fit-outs; budget operators (Jucy, Cruisin) offer older vehicles at lower daily rates.</p>`,
      expect: `<p>Standard hire conditions across most operators include unlimited kilometres on most rates, basic insurance with a substantial standard excess, 24-hour roadside assistance, and a one-way drop fee for inter-state hires. Daily &ldquo;liability reduction&rdquo; products are sold to bring the excess down — these are often expensive and may be cheaper to cover via a travel-insurance rental excess policy instead.</p>
<p>Most motorhomes can be driven on a standard Australian car licence as long as the gross vehicle mass is under 4.5 tonnes. Vehicles over 4.5t require a Light Rigid licence. International licences are accepted in English or accompanied by an International Driving Permit.</p>
<p>What to watch for: bedding and kitchen kits are often charged as extras rather than included; airport transfers from depot to terminal are usually paid; and most operators don&rsquo;t allow motorhomes off bitumen — Fraser Island, the Cape York track and most national park dirt roads are off-limits. Specialist 4WD camper operators handle those routes.</p>`,
      getting: `<p>Pickup depots are concentrated in the capital cities: <a href="/all-queensland-islands/">Brisbane</a>, Sydney, Melbourne, Perth, Adelaide, Cairns, Hobart, Darwin and Alice Springs. Most operators allow one-way hires between major cities for a relocation fee, which varies from a few hundred dollars for short hops up to AU$2,000+ for transcontinental drops. Relocation deals — where you help reposition a vehicle for the operator at near-zero daily cost — are an excellent budget option if your dates and route align.</p>
<p>Allow 1.5–2 hours at pickup for paperwork, vehicle orientation and pre-departure checks. Most depots are open 8am–5pm; out-of-hours pickup attracts a fee.</p>`,
      when: `<p>Peak season is December–January (Australian summer school holidays) when rates can be 2–3× the winter low-season prices. Easter, June–July (winter school break), September school break and the November Schoolies period are secondary peaks.</p>
<p>The best value windows are February–March, May, and the October-November shoulder. Last-minute deals from major operators with surplus fleet can be extraordinary — sometimes under AU$50 per day for a 4-berth — but require flexibility on dates.</p>`,
      why: `<p>A motorhome trip works particularly well in regions with established free or low-cost overnight stay options — most of Queensland&rsquo;s Bruce Highway corridor, the New South Wales north coast, southwest Western Australia and the Top End fit this pattern. The vehicle removes the need to book accommodation each night, gives you complete itinerary flexibility, and the marginal cost per day of running a motorhome is competitive with hotel + car-hire alternatives once you account for everything.</p>
<p>Motorhomes work less well in cities (parking is hard and expensive), in monsoon-season Top End, or for itineraries that involve a lot of dirt-road driving. For Fraser Island, the Daintree beyond Cape Trib, or the Tip of Cape York, hire a 4WD specialist instead.</p>`,
      tipBullets: [
        'Check operator-by-operator pricing on Camplify or Motorhome Republic before booking',
        'Always check excess reduction costs against your travel-insurance rental excess cover',
        'Relocation deals are real and excellent — Imoova and Transfercar list current offers',
        'Allow 2 hours for vehicle pickup, including the orientation walk-through',
        'Don\'t take a standard motorhome onto dirt — your insurance won\'t cover you',
      ],
      internalLinks: [
        ['/apollo-motorhome-holidays/', 'Apollo Motorhome Holidays'],
        ['/maui-australia-new-zealand/', 'Maui Motorhomes'],
        ['/britz-australia-new-zealand/', 'Britz Campervans'],
      ],
      externalLinks: [
        ['https://www.cmca.net.au/', 'Campervan &amp; Motorhome Club of Australia'],
        ['https://www.qld.gov.au/transport/licensing', 'Queensland licensing — vehicle classes'],
      ],
    },
  },

  {
    slug: 'oaks-group-hotels-resorts',
    legacy: '/oaks-group-hotels-resorts/',
    title: 'Oaks Hotels, Resorts &amp; Suites — Australia &amp; Queensland Guide',
    seo_title: 'Oaks Hotels &amp; Resorts — Queensland Property Guide',
    seo_desc: 'Oaks Hotels, Resorts &amp; Suites operates apartment-style properties across Queensland including the Gold Coast, Cairns, Hervey Bay, Brisbane and Port Douglas.',
    excerpt: 'Oaks Hotels, Resorts &amp; Suites is one of Australia\'s larger apartment-style hotel operators, with a strong Queensland portfolio spanning the Gold Coast, Cairns, Brisbane, Hervey Bay and Port Douglas.',
    categories: ['Accommodation', 'Hotel Brands'],
    destination_slug: null,
    location: 'Queensland',
    author: 'Beth Hartley',
    ctx: {
      name: 'Oaks Hotels, Resorts &amp; Suites',
      location: 'Queensland',
      hook: 'Oaks Hotels, Resorts &amp; Suites is the apartment-hotel chain we&rsquo;d consider in any major Queensland city — they consistently offer self-contained kitchens, full laundries, and central locations at rates that often beat equivalent hotel rooms once you factor in cooking and washing.',
      about: `<p>Oaks Hotels, Resorts &amp; Suites is one of Australia&rsquo;s largest apartment-hotel operators, founded in Queensland and now part of Minor Hotels (the Thai-headquartered hospitality group that also operates Anantara and Avani). The brand operates more than 50 properties across Australia, New Zealand and Asia, with a particularly strong Queensland footprint that reflects its origins.</p>
<p>The Oaks model is centred on self-contained apartments rather than traditional hotel rooms — every Oaks property offers studio, one, two and (at most properties) three-bedroom apartments with kitchens, laundries and separate living areas. This is the standard Queensland apartment-hotel format and Oaks has refined it across decades.</p>`,
      expect: `<p>A typical Oaks apartment includes a king bed (or twin configuration), separate lounge with sofa bed, full kitchen (oven, cooktop, fridge, dishwasher, microwave, kettle, full crockery and cutlery), private balcony, washer/dryer in the apartment, and air conditioning. The two- and three-bedroom configurations add separate bedrooms and a second or third bathroom.</p>
<p>Most Oaks properties include a swimming pool, gymnasium, paid undercover parking, and a reception desk staffed through business hours with an after-hours phone for late arrivals. Some larger properties (Oaks Calypso Plaza, Oaks Resort Spa Hervey Bay) add restaurant, day-spa or kids&rsquo; club facilities.</p>
<p>The Queensland properties cover the major tourist destinations: Gold Coast (Oaks Calypso Plaza Coolangatta, Oaks Hervey Bay, Oaks Casino Towers Brisbane, Oaks Festival Towers, Oaks Charlotte Towers, Oaks Lexicon Apartments, Oaks Aurora Tower), Cairns (Oaks Cairns Resort, Oaks Lagoons), Port Douglas (Oaks Port Douglas Resort), and Brisbane (multiple). Pricing is broadly mid-range — typically lower than international hotel chains and higher than budget motel options.</p>`,
      getting: `<p>Oaks bookings can be made directly through the brand website (oakshotels.com), through the major OTAs (Expedia, Booking.com, Agoda), or through travel agents. Direct booking typically includes member benefits — the &ldquo;Discovery&rdquo; loyalty program offers room upgrades, late check-out and discount rates after a few stays.</p>
<p>Most Queensland properties are in central tourist precincts walking distance from beaches, dining and attractions. Some (Oaks Lagoons, Oaks Calypso Plaza) are resort-style with beachfront positions; others are CBD towers (Oaks Festival Towers in Brisbane).</p>`,
      when: `<p>Oaks Queensland rates follow standard regional patterns — peak during December-January, Easter and June-July school holidays, with shoulder pricing March-May and October-November. The Schoolies period in late November pushes Gold Coast Oaks rates significantly higher. Winter (June-August) sees the highest demand in the tropical north (Cairns, Port Douglas).</p>
<p>Loyalty member discount rates can save 10-15% on direct bookings; check both the OTAs and direct rates before booking.</p>`,
      why: `<p>For families and groups travelling Queensland who want full kitchens and laundries — for self-catering breakfasts, longer stays, or just to manage the realities of travelling with kids — Oaks delivers a consistent product across destinations. The Queensland portfolio is strong enough that you can plan a multi-city trip (Brisbane to Gold Coast to Hervey Bay to Cairns to Port Douglas) staying with Oaks at each stop with similar room standards throughout.</p>
<p>For solo travellers or short overnight stops, a standard hotel room is often better value — Oaks is at its strongest on 3+ night stays where the kitchen and laundry start paying for themselves.</p>`,
      tipBullets: [
        'Book direct via oakshotels.com for member-rate savings of 10–15%',
        'Two-bedroom apartments are often only marginally more expensive than premium hotel rooms — better value for families',
        'Self-cater breakfast — the kitchens are full-featured, not token',
        'Check the Oaks Discovery loyalty terms before joining — the benefits scale with stay count',
        'Multi-city trips work well booking Oaks at each stop for consistency',
      ],
      internalLinks: [
        ['/gold-coast/', 'Gold Coast travel guide'],
        ['/cairns/', 'Cairns travel guide'],
        ['/hervey-bay/', 'Hervey Bay travel guide'],
      ],
      externalLinks: [
        ['https://www.oakshotels.com/', 'Oaks Hotels — official site'],
        ['https://www.minorhotels.com/', 'Minor Hotels Group'],
      ],
    },
  },

  {
    slug: 'rendezvous-hotels',
    legacy: '/rendezvous-hotels/',
    title: 'Rendezvous Hotels — Queensland &amp; Australian Property Guide',
    seo_title: 'Rendezvous Hotels — Australian Hotel Brand Guide',
    seo_desc: 'Rendezvous Hotels is a boutique-style Australian hotel brand part of TFE Hotels, with property across Australia including Queensland CBD locations.',
    excerpt: 'Rendezvous Hotels is a boutique-style four-star Australian hotel brand, part of TFE Hotels, with properties across the country and a long-running presence in Queensland\'s CBD markets.',
    categories: ['Accommodation', 'Hotel Brands'],
    destination_slug: null,
    location: 'Queensland',
    author: 'Beth Hartley',
    ctx: {
      name: 'Rendezvous Hotels',
      location: 'Australia',
      hook: 'Rendezvous Hotels is the four-star Australian boutique brand we&rsquo;d look at for CBD stays — refurbished heritage buildings or well-located modern towers, full hotel services rather than apartment-style self-catering, and a price point that sits sensibly between budget chains and the international five-star brands.',
      about: `<p>Rendezvous Hotels is part of TFE Hotels — Toga Far East Hotels, the Australian-Asian joint venture that also operates the Adina Apartment Hotels, Vibe Hotels, Travelodge and Quincy brands. Rendezvous sits at the four-star &ldquo;boutique&rdquo; tier of the TFE portfolio, with properties chosen for distinctive architecture (often heritage refurbishments) or premium CBD locations.</p>
<p>The brand operates a handful of properties across Australia — typically one or two per major capital city — rather than the wide hotel-chain footprint of the apartment brands like Oaks or Mantra. This is intentional: each Rendezvous property is selected to reinforce a boutique-character positioning rather than a uniform-product chain identity.</p>`,
      expect: `<p>The Rendezvous experience is conventional four-star hotel rather than apartment-hotel: rooms rather than apartments, traditional housekeeping, restaurant and bar service, room service, fitness facilities, and concierge. Suites are available at most properties but the bulk of inventory is standard king, twin or studio rooms.</p>
<p>The brand&rsquo;s strength is the property characters. Heritage-building conversions (the former Rendezvous Hotel Melbourne in the 1913 Federal Coffee Palace building was a notable example) have a different feel from the standardised business-hotel product, and that&rsquo;s the appeal.</p>
<p>What Rendezvous doesn&rsquo;t typically include: in-room laundry facilities (this is hotel, not apartment), full kitchens (small kitchenettes in some rooms only), and the family-friendly four-bed configurations that apartment hotels do well. For travellers wanting those features, a sister TFE Hotels brand like Adina is a better fit.</p>`,
      getting: `<p>Rendezvous bookings can be made directly via tfehotels.com or rendezvoushotels.com, through the major OTAs, or through corporate travel programs (Rendezvous participates in most major corporate booking platforms). TFE&rsquo;s &ldquo;TFE Hotels Stash Rewards&rdquo; loyalty program covers the Rendezvous portfolio along with the other TFE brands.</p>
<p>Properties are typically in CBD or near-CBD locations chosen for walking access to business districts, dining and major transit.</p>`,
      when: `<p>Hotel rates in Australia&rsquo;s CBDs follow the business-travel pattern: weekday rates are higher Tuesday–Thursday, weekend rates are lower outside major event weekends, and pricing softens significantly through Christmas-New Year when corporate travel halts. Leisure peak is school holidays and major event windows (sporting events, festivals, conventions).</p>
<p>Look for weekend leisure rates if your travel dates are flexible — Rendezvous routinely discounts Friday-Sunday by 30%+ off the weekday corporate rate.</p>`,
      why: `<p>For business travellers and couples who want a four-star hotel experience in a CBD with some character — heritage architecture, distinctive design, full hotel services — Rendezvous delivers more interesting properties than the larger international chains at competitive pricing. The TFE Hotels loyalty program is also strong if you stay across multiple TFE brands.</p>
<p>For families needing apartment-style kitchens and laundries, look at the sister brand Adina instead. For budget stays, the sister Travelodge is the better fit.</p>`,
      tipBullets: [
        'Book weekend rates if you can — corporate-rate weekdays are noticeably more expensive',
        'Join TFE Stash Rewards for cross-brand loyalty earning across the TFE portfolio',
        'Check the property\'s heritage credentials before booking — that\'s the brand\'s differentiator',
        'For apartment-style stays, switch to TFE\'s Adina brand instead',
        'Direct booking via tfehotels.com often beats OTA pricing for Rendezvous',
      ],
      internalLinks: [
        ['/destinations/', 'Queensland destinations'],
        ['/peppers-resorts-retreats/', 'Peppers Resorts'],
        ['/mantra-group-hotels-resorts/', 'Mantra Group Hotels'],
      ],
      externalLinks: [
        ['https://www.tfehotels.com/', 'TFE Hotels — official site'],
        ['https://www.qualityhotels.com.au/', 'Quality Tourism Australia accreditation'],
      ],
    },
  },

  {
    slug: 'breakfree-resorts-accommodation',
    legacy: '/breakfree-resorts-accommodation/',
    title: 'BreakFree Resorts — Affordable Apartment Hotel Brand Australia',
    seo_title: 'BreakFree Resorts — Affordable Apartment Hotels Australia',
    seo_desc: 'BreakFree Resorts is Accor\'s affordable apartment-hotel brand in Australia, with properties across major Queensland destinations including the Gold Coast and Cairns.',
    excerpt: 'BreakFree Resorts is Accor\'s affordable apartment-hotel brand — self-contained apartments at lower price points than the premium Accor brands, with properties across the Gold Coast, Cairns, Brisbane and beyond.',
    categories: ['Accommodation', 'Hotel Brands'],
    destination_slug: null,
    location: 'Australia',
    author: 'Beth Hartley',
    ctx: {
      name: 'BreakFree Resorts',
      location: 'Australia',
      hook: 'BreakFree Resorts is Accor&rsquo;s affordable apartment-hotel brand in Australia — self-contained one and two-bedroom apartments at notably lower nightly rates than Peppers, Sebel or Mantra, with strong representation in the Gold Coast, Cairns and Brisbane markets.',
      about: `<p>BreakFree Resorts is part of the Accor portfolio in Australia (alongside Peppers, The Sebel, Mantra, Pullman, Novotel, Ibis and others). Within Accor&rsquo;s apartment-hotel tier, BreakFree sits at the affordable end — older buildings, simpler fit-outs and lower nightly rates than the Peppers or Sebel premium brands, but with the same self-contained apartment format that distinguishes Australian apartment hotels from international standard hotel rooms.</p>
<p>The Queensland portfolio is centred on the Gold Coast (BreakFree Diamond Beach Broadbeach, BreakFree The Cosmopolitan, BreakFree Penthouse, BreakFree Mooloolaba), Brisbane and the Sunshine Coast. Most properties are in central tourist locations within easy walking distance of beaches and dining precincts.</p>`,
      expect: `<p>Apartments are typically studio, one, two and three-bedroom configurations, all with full kitchens (oven, cooktop, fridge, microwave), private bathroom, laundry facilities (in-apartment or shared block), separate living area in the larger configurations, and balcony or courtyard. The kitchen and laundry combination is the value proposition versus a standard hotel room.</p>
<p>Resort facilities depend on the property — most have a swimming pool, basic gymnasium, and undercover paid parking. The premium-brand polish (concierge, daily housekeeping, in-room dining) is largely absent — BreakFree is positioned for guests who want the apartment-hotel format at the lowest sensible price rather than a full-service hotel experience.</p>
<p>What this means in practice: rooms may be smaller or showing age compared with newer properties, housekeeping may be on request rather than automatic, and the on-site services are basic. The trade-off is rates that are typically 30-40% below equivalent Peppers or Sebel properties in the same locations.</p>`,
      getting: `<p>BreakFree bookings can be made through Accor.com, the BreakFree brand site (breakfree.com.au), the major OTAs, or through travel agents. Accor&rsquo;s ALL loyalty program covers BreakFree stays for point-earning across the broader Accor portfolio.</p>
<p>Property locations are usually in central tourist precincts — most Queensland properties are walking distance from beaches and main dining areas, with public transport and taxi access for further exploration.</p>`,
      when: `<p>BreakFree rates follow standard Queensland holiday-region patterns: peak during Australian school holidays (December–January, Easter, June–July, September break), with shoulder pricing March–May and October–November. Gold Coast properties see significant additional premium during Schoolies in late November and major event weekends like the Gold Coast 600.</p>
<p>Last-minute weekend deals are common in shoulder seasons — checking Wotif and Hotels Combined alongside the direct site sometimes reveals 25%+ savings on a weekend stay.</p>`,
      why: `<p>If you want apartment-style accommodation in central Queensland tourist locations but don&rsquo;t need the polish of the Peppers or Sebel premium brands, BreakFree delivers good value. The properties show their budget positioning — older buildings, simpler decor — but the kitchens work, the laundries work, and the locations are central. For families on multi-day stays who need to self-cater meals and wash clothes, the value-per-night beats most equivalent options.</p>
<p>For couples wanting a polished short-stay or business travellers wanting full hotel services, Peppers, Sebel or even Mantra would be better fits within the Accor portfolio.</p>`,
      tipBullets: [
        'Compare direct (accor.com) versus OTA rates — both have advantage windows',
        'Two-bedroom apartments often beat hotel-room rates for families when split',
        'Join Accor ALL Rewards if you stay at any Accor brand annually',
        'Self-cater breakfast — significant savings over a multi-night stay',
        'Request a higher floor for less street noise in Gold Coast properties',
      ],
      internalLinks: [
        ['/gold-coast/', 'Gold Coast travel guide'],
        ['/cairns/', 'Cairns travel guide'],
        ['/peppers-resorts-retreats/', 'Peppers Resorts &amp; Retreats'],
      ],
      externalLinks: [
        ['https://www.breakfree.com.au/', 'BreakFree Resorts — official site'],
        ['https://all.accor.com/', 'Accor ALL Rewards'],
      ],
    },
  },

  {
    slug: 'cairns-fishing-charters',
    legacy: '/cairns/cairns-fishing-charters/',
    title: 'Cairns Fishing Charters — Reef, Estuary &amp; Game Fishing Guide',
    seo_title: 'Cairns Fishing Charters — Reef &amp; Game Fishing Guide',
    seo_desc: 'Cairns fishing charter guide: outer Great Barrier Reef sportfishing, inshore estuary trips, heavy-tackle game fishing for marlin, and the best operators and seasons.',
    excerpt: 'A practical guide to fishing charters from Cairns — outer Great Barrier Reef sportfishing, inshore estuary trips for barramundi and mangrove jack, heavy-tackle marlin game fishing, and what operators and seasons to consider.',
    categories: ['Activities', 'Fishing', 'Cairns'],
    destination_slug: 'cairns',
    location: 'Cairns',
    author: 'Mick Gallagher',
    ctx: {
      name: 'Cairns Fishing Charters',
      location: 'Cairns',
      hook: 'Cairns offers three genuinely different fishing experiences in one destination — outer reef sportfishing for big trevally and red emperor, estuary jack-and-barra in the rivers behind the city, and the heavy-tackle marlin grounds that make Cairns one of the top three big-game fishing destinations on Earth. This is our practical guide to picking the right trip.',
      about: `<p>Cairns is one of the few places in the world that combines world-class outer-reef sportfishing, productive inshore estuary systems, and an internationally significant heavy-tackle marlin fishery — all accessible from a single port. The mix of habitats reflects Cairns&rsquo; geography: the city sits between the Great Barrier Reef (a 90-minute boat ride east), several major river systems (the Barron, Mulgrave and Russell), and the deep continental drop-off where the marlin grounds begin in September each year.</p>
<p>The fishing charter industry is correspondingly large and varied. There are full-day reef sportfishing day boats, multi-day liveaboards that combine fishing with reef cruising, dedicated estuary specialists, and the highly specialised heavy-tackle game-fishing operators who run September-December out of Cairns to chase grander marlin (1,000+ pound fish).</p>`,
      expect: `<p>Outer reef sportfishing typically targets red emperor, large-mouth nannygai, coral trout, sweetlip and Spanish mackerel on light to medium tackle. Most charter operators provide all bait and tackle; you can bring your own gear if you prefer. A standard day trip departs Cairns around 6:30am and returns 4:30–5:00pm, with most of the actual fishing happening between 9am and 3pm at the reef.</p>
<p>Estuary trips work the river systems south of Cairns — chasing mangrove jack and barramundi in season — and typically run as half-day or full-day options aboard smaller flats-style boats. These are productive year-round but barra are at their best in the warmer months (October–April) within seasonal closure limits.</p>
<p>Heavy-tackle marlin fishing is a different beast entirely — purpose-built game boats with fighting chairs, 80–130-pound tackle, and crews specialised in tag-and-release of granders. The September–December season is internationally famous; the boats are typically booked up months in advance and the day rates are correspondingly substantial. This isn&rsquo;t a beginner&rsquo;s activity.</p>`,
      getting: `<p>Most Cairns fishing charters depart from Reef Fleet Terminal on the Esplanade — walking distance from central Cairns accommodation — or from Marlin Marina nearby. Game-fishing operators sometimes depart from Yorkeys Knob, 15 minutes north of the city. Most charters offer pickup from <a href="/cairns/accommodation/">Cairns Northern Beaches accommodation</a> for an additional fee.</p>
<p>Cairns Airport handles regular flights from all Australian capitals and several international destinations. The fishing season is busiest June–November, which overlaps with the Cairns winter tourism peak — book accommodation alongside any charter at least a month ahead in this window.</p>`,
      when: `<p>Reef sportfishing is consistent year-round but most comfortable May–October during the dry season, when the seas are calmer and the visibility is better. Spanish mackerel runs heavily May–September. Red emperor and nannygai are productive year-round.</p>
<p>Estuary jacks are best September–November (warmer water but pre-monsoon clarity). Barramundi season runs February to November in Queensland (the closure runs Nov 1–Feb 1 in tidal waters); the warmer months produce more action but check the current QPWS closure dates before booking.</p>
<p>Heavy-tackle marlin season runs September through early December, peaking in October. The largest marlin are typically caught in the second half of the season; the early-season fish run smaller but more numerous.</p>`,
      why: `<p>For visiting anglers, Cairns is one of the most versatile fishing destinations in Australia. You can do a day of reef sportfishing, a half-day estuary jack session, and a multi-day game-fishing extension all from the same base — and the operators are professional, well-equipped, and used to handling everyone from first-time anglers to international tournament fishermen.</p>
<p>For families combining fishing with non-fishing reef activities, the reef day boats work well as standalone fishing trips while other family members go on snorkel-focused day trips departing from the same terminal.</p>`,
      tipBullets: [
        'Book heavy-tackle marlin boats 6+ months ahead for the September–December peak',
        'Reef sportfishing day trips work well as a single day in a Cairns reef itinerary',
        'Check QLD barra closures before booking a barramundi trip — closures vary by region',
        'Take seasickness medication 30 minutes before any reef trip',
        'Bring polarised sunglasses, sunscreen, hat and a light long-sleeve shirt — UV is intense year-round',
      ],
      internalLinks: [
        ['/cairns/', 'Cairns travel guide'],
        ['/cairns/accommodation/', 'Cairns accommodation'],
        ['/the-great-barrier-reef/', 'Great Barrier Reef overview'],
      ],
      externalLinks: [
        ['https://www.daf.qld.gov.au/business-priorities/fisheries/recreational', 'Queensland Recreational Fishing'],
        ['https://www.gfaa.asn.au/', 'Game Fishing Association of Australia'],
      ],
    },
  },

  {
    slug: 'eli-creek',
    legacy: '/all-queensland-islands/fraser-island/eli-creek/',
    title: 'Eli Creek — Fraser Island\'s Crystal-Clear Sand Cascade',
    seo_title: 'Eli Creek Fraser Island — Visitor Guide &amp; Drift Float',
    seo_desc: 'Eli Creek is the largest stream on Fraser Island\'s east coast, with a 400-metre boardwalk and a famous drift-float swim through crystal-clear water under a canopy of paperbark forest.',
    excerpt: 'Eli Creek is the largest east-coast stream on Fraser Island (K\'gari) — a clear sand-bed creek with a 400-metre boardwalk and a famously beautiful drift float on the gentle current beneath a paperbark canopy.',
    categories: ['Attractions', 'Fraser Island'],
    destination_slug: 'fraser-island',
    location: 'Fraser Island',
    author: 'Sam Davies',
    ctx: {
      name: 'Eli Creek',
      location: 'Fraser Island',
      hook: 'Eli Creek is the largest stream on Fraser Island&rsquo;s east coast and one of the genuinely magical experiences on K&rsquo;gari — a glass-clear, sand-bed creek where you walk a kilometre upstream on a raised boardwalk and then float back down on the gentle current under a paperbark canopy.',
      about: `<p>Eli Creek discharges around 80 million litres of water per day into the Pacific Ocean — by far the largest of the many freshwater streams on Fraser Island&rsquo;s eastern coast. The water is rainwater that has filtered through the island&rsquo;s perched dune lakes and the deep sand profile that sits beneath the entire island, emerging cold and remarkably clear at the creek&rsquo;s headwaters in the rainforest interior.</p>
<p>The site is one of the most-visited stops on Fraser Island day-trip and four-wheel-drive self-tour itineraries. A 400-metre raised timber boardwalk runs alongside the creek through the paperbark forest, and the standard visitor experience is to walk the boardwalk upstream, drop into the creek with a pool float or just on bare feet, and drift back down on the slow current that carries you towards the beach.</p>`,
      expect: `<p>The boardwalk takes about 10 minutes to walk one-way. It&rsquo;s gentle gradient and accessible to most walkers; the creek itself is calf to waist deep in most spots with a sandy bottom and almost no current variation across the channel. Most visitors do the upstream-walk-and-downstream-float loop in 45–90 minutes including time to swim, photograph, and let kids play.</p>
<p>The creek temperature is consistent year-round at around 22&deg;C — refreshing in summer, brisk in winter. The water is so clear you can see every fish and grain of sand on the bottom; the surrounding paperbark and palm forest filters the light into a green, gold cathedral effect that makes Eli Creek one of the most photographed places on Fraser Island.</p>
<p>There are no facilities at Eli Creek itself beyond the boardwalk — no toilets, no shop, no shelter. Most visitors arrive on guided day tours that provide morning tea and lunch elsewhere on the island, or as part of self-drive 4WD trips with their own provisions. The creek is at 75 Mile Beach (the famous east-coast highway-beach), which is the access point for most island travel.</p>`,
      getting: `<p>Eli Creek is on Fraser Island&rsquo;s east coast about midway up the island, between Eurong and Happy Valley. Access is via 75 Mile Beach — the wide flat tidal beach that serves as the main north-south road on the island. A four-wheel-drive vehicle is mandatory; conventional two-wheel-drive cars are not permitted on the island.</p>
<p>Day visitors typically arrive on guided tour day trips departing Hervey Bay (a 50-minute barge ride to the island&rsquo;s western coast plus 4WD tour), departing Rainbow Beach (a shorter barge ride from the south), or as self-drive 4WD hire from Hervey Bay or Noosa. Multi-day stays usually base out of Kingfisher Bay Resort, Eurong Beach Resort, or one of the dingo-fenced camping areas.</p>`,
      when: `<p>Eli Creek is accessible year-round and the water temperature is consistent. The drift-float experience is most pleasant in the cooler months (May–September) when the air is also cooler — the contrast with summer&rsquo;s tropical heat is dramatic. Summer (December–April) is the wet season; the creek is still beautiful but visits can be interrupted by sudden tropical downpours.</p>
<p>Tide timing matters for getting to the creek — 75 Mile Beach is only passable for a few hours either side of low tide. Tour operators time arrivals accordingly; self-drivers need to consult the tide tables before setting off and never drive on the beach in the two hours either side of high water.</p>`,
      why: `<p>Eli Creek is one of the experiences on Fraser Island that consistently exceeds expectations. Photographs don&rsquo;t quite capture the clarity of the water or the quality of the light through the paperbark canopy — you really need to be standing in the creek, watching tiny rainbow fish around your ankles, to understand why it&rsquo;s one of Australia&rsquo;s favourite freshwater swim spots.</p>
<p>For families with children, the calm current and shallow water make Eli Creek one of the few Fraser Island sites where kids can swim safely without worrying about ocean conditions. Pair it with Lake McKenzie (a perched dune lake further inland) for a full day of remarkable freshwater swimming.</p>`,
      tipBullets: [
        'Bring a pool float — most tour operators don\'t provide them and the float is the point',
        'Plan visits for low tide so the beach is passable',
        'Take a waterproof case for your phone — the clarity is photo-worthy',
        'No facilities on-site — empty your bladder before the boardwalk',
        'Combine with Lake McKenzie further inland for a full day of freshwater swimming',
      ],
      internalLinks: [
        ['/all-queensland-islands/fraser-island/', 'Fraser Island travel guide'],
        ['/hervey-bay/', 'Hervey Bay travel guide'],
        ['/all-queensland-islands/fraser-island/accommodation/', 'Fraser Island accommodation'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/kgari-fraser', 'K\'gari (Fraser Island) National Park — QPWS'],
        ['https://whc.unesco.org/en/list/630/', 'Fraser Island — UNESCO World Heritage listing'],
      ],
    },
  },

  {
    slug: 'moreton-bay-whale-watching',
    legacy: '/moreton-bay-whale-watching/',
    title: 'Moreton Bay Whale Watching — Humpback Tours from Brisbane',
    seo_title: 'Moreton Bay Whale Watching — Brisbane Humpback Tours',
    seo_desc: 'Moreton Bay whale watching from Brisbane: half-day humpback tours from the Redcliffe Peninsula and Manly during the June–November season, with several operators.',
    excerpt: 'Moreton Bay whale watching is Brisbane\'s answer to Hervey Bay — half-day humpback tours from Redcliffe and Manly during the June–November season, with the bay\'s sheltered waters providing reliably calm conditions.',
    categories: ['Activities', 'Whale Watching', 'Brisbane'],
    destination_slug: 'brisbane',
    location: 'Brisbane',
    author: 'Beth Hartley',
    ctx: {
      name: 'Moreton Bay Whale Watching',
      location: 'Brisbane',
      hook: 'Moreton Bay whale watching is the Brisbane-doable alternative to driving four hours to Hervey Bay — half-day humpback tours from Redcliffe and Manly between June and November, with calm sheltered water and reliable sightings during the migration peaks.',
      about: `<p>Moreton Bay is the large sheltered body of water immediately east of Brisbane, formed by the barrier islands of Bribie, Moreton and North Stradbroke. The migration corridor for east-coast humpback whales runs along the bay&rsquo;s eastern edge — northbound June–July as the whales head to tropical breeding waters, and southbound August–November as cow-calf pairs return south. The protected bay provides much calmer water than the open ocean, which means more comfortable tours and better in-water photo opportunities.</p>
<p>Several operators run half-day tours during the season, departing primarily from Redcliffe (north of Brisbane) and Manly (east of Brisbane). The major operators include Brisbane Whale Watching, Whales in Paradise (which also operates from the Gold Coast) and several smaller boats running smaller-group tours. Vessel sizes vary from 80-passenger multi-deck catamarans to 25-passenger smaller boats.</p>`,
      expect: `<p>A standard half-day tour runs around 3.5 hours including approximately 2 hours of whale-watching time. Most operators include morning tea or lunch, refreshments, on-board commentary from a marine naturalist, and underwater hydrophones so you can hear whale song through the boat&rsquo;s PA when whales are nearby.</p>
<p>The bay environment means consistently calm water — seasickness is rarely an issue here, in contrast with open-ocean tours further south or offshore. The whale encounters themselves vary: early in the season (June–July) the whales are in northbound migration mode and tend to be transient; from August onwards the southbound cow-calf pairs spend more time playing and resting and the encounters tend to be longer.</p>
<p>The bay tours operate under the standard Queensland whale-watching code of conduct — boats can approach to within 100 metres but no closer; whales can and frequently do approach the boats themselves, sometimes nudging the hull or breaching alongside.</p>`,
      getting: `<p>The Redcliffe departure point is at Newport Marina, about 45 minutes drive from central Brisbane — accessible by car, by Translink bus (route 690), or by Redcliffe Line train to Mango Hill plus a short connecting service. Manly departures use Manly Boat Harbour, about 25 minutes from central Brisbane and accessible by Translink train to Manly station plus a 10-minute walk.</p>
<p>Brisbane Whale Watching offers paid shuttle transfers from Brisbane city hotels for an additional fee. Allow time for parking — the marinas fill up on weekends during peak whale season.</p>`,
      when: `<p>The Moreton Bay whale watching season runs from early June through early November. Northbound migration peaks in late June and early July (whales are in transit and tend to be quicker encounters); southbound migration with cow-calf pairs runs August through early November (slower, more playful encounters, generally considered the better viewing window).</p>
<p>Bay conditions are at their calmest in the morning before the afternoon sea breeze, so morning tours are usually more comfortable than afternoon ones. The August–September window is the most reliably productive — the cow-calf pairs are playful, the boats encounter multiple groups per trip, and the in-water mugging behaviour is at its most frequent.</p>`,
      why: `<p>If you&rsquo;re visiting Brisbane during the June–November window and you can&rsquo;t make the four-hour drive to Hervey Bay, Moreton Bay is a genuinely good substitute. The encounter rate is high, the bay conditions are calm, and you can do a half-day tour and still be back in Brisbane by lunchtime. The whale-watching itself isn&rsquo;t quite at the level of Hervey Bay&rsquo;s Platypus Bay (which has more concentrated whale activity at peak), but it&rsquo;s a strong second.</p>
<p>For dedicated whale-watching trips of more than a day, Hervey Bay remains the better destination. For Brisbane visitors with a day to spare during the season, Moreton Bay is the right call.</p>`,
      tipBullets: [
        'Book a morning tour for the calmest water and best light',
        'August–September is the peak — book at least two weeks ahead in that window',
        'Bring a wide-brimmed hat, sunglasses, and a windbreaker — the bay is exposed',
        'Take a polarised camera filter — reduces water glare on photos',
        'Listen for the hydrophone announcement — whale song is the auditory highlight',
      ],
      internalLinks: [
        ['/all-queensland-islands/moreton-island/', 'Moreton Island travel guide'],
        ['/hervey-bay/', 'Hervey Bay travel guide'],
        ['/destinations/', 'Queensland destinations'],
      ],
      externalLinks: [
        ['https://parks.des.qld.gov.au/parks/moreton-bay', 'Moreton Bay Marine Park'],
        ['https://environment.des.qld.gov.au/wildlife/animals/living-with/whales-dolphins', 'QLD whale watching code of conduct'],
      ],
    },
  },
]

console.log(`Will insert ${listings.length} listings into autravel.articles.`)

let inserted = 0, skipped = 0
for (const l of listings) {
  const body = build(l.ctx)
  const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

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
      ${STATE}, ${l.slug}, ${l.legacy}, ${l.title}, ${l.excerpt}, ${body},
      ${COVER(l.location)}, ${JSON.stringify(l.categories)}::jsonb,
      ${l.destination_slug || null}, 'post', ${l.author}, 'published',
      'backlinks-restore-d', now(), ${l.seo_title}, ${l.seo_desc}
    )
  `
  console.log(`OK [${wordCount}w]  ${l.slug}  ->  ${l.legacy}`)
  inserted++
}

console.log(`\nNow inserting .html → clean redirects...`)
// .html legacy variants → clean URL
const htmlRedirects = [
  ['/cairns/cairns-fishing-charters.html', '/cairns/cairns-fishing-charters/'],
  ['/fraser-island/eli-creek.html', '/all-queensland-islands/fraser-island/eli-creek/'],
  ['/fraser-island/eli-creek/', '/all-queensland-islands/fraser-island/eli-creek/'],
  ['/brisbane/moreton-bay-whale-watching.html', '/moreton-bay-whale-watching/'],
  ['/brisbane/moreton-bay-whale-watching/', '/moreton-bay-whale-watching/'],
  // Also alias the standalone /tannum-sands/ URL to the directory-listing page
  ['/tannum-sands/', '/directory-qldtravel/listing/tannum-sands/'],
]
let rinserted = 0
for (const [from, to] of htmlRedirects) {
  try {
    await sql`
      INSERT INTO autravel.redirects (state_code, from_path, to_path, match_type, redirect_type, is_active, notes)
      VALUES (${STATE}, ${from}, ${to}, 'exact', 301, true, 'backlinks restore: .html or alias redirect to canonical page')
      ON CONFLICT (COALESCE(state_code, ''::text), from_path) DO NOTHING
    `
    console.log(`REDIR  ${from}  ->  ${to}`)
    rinserted++
  } catch (e) {
    console.log(`SKIP redirect ${from}: ${e.message}`)
  }
}

console.log(`\nInserted ${inserted} pages, ${skipped} skipped. ${rinserted} redirects inserted.`)
await sql.end()
