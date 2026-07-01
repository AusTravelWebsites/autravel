#!/usr/bin/env node
/**
 * register-wa-destinations.mjs — register WA regions/towns that have child
 * category pages but no destination row (so /{slug}/ 404s instead of rendering
 * a hub). Idempotent upsert on (state_code, slug).
 *
 *   node --env-file=.env.local scripts/register-wa-destinations.mjs [--apply]
 */
import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'

const APPLY = process.argv.includes('--apply')
const CONN = process.env.DATABASE_URL || ''
const sql = postgres(CONN, { ssl: /@(127\.0\.0\.1|localhost)/.test(CONN) ? false : 'require', prepare: false, max: 3 })
const HERO = s => `https://media.bugbitten.com/autravel/destinations/${s}.webp`

const DESTS = [
  {
    slug: 'mandurah', name: 'Mandurah', region: 'Peel',
    intro: "Canals, blue swimmer crabs and wild dolphins an hour south of Perth.",
    lat: -32.5289, lng: 115.7231, radius_km: 30,
    body: `<p>Mandurah is Western Australia's largest regional city, set around a wide estuary where the Serpentine and Murray rivers meet the Indian Ocean about an hour south of Perth. Once a quiet fishing and crabbing town, it has grown into a relaxed waterside holiday destination known for its canal estates, long ocean beaches and resident bottlenose dolphins.</p>
<p>The Peel-Harvey estuary is more than twice the size of Sydney Harbour and is the heart of local life — dolphin and estuary cruises leave from the foreshore, and the summer blue swimmer crab season draws families to the shallows with scoop nets. The redeveloped Mandurah Ocean Marina, waterfront boardwalk cafes and the annual Crab Fest give the town centre its easy, on-the-water feel.</p>
<p>Mandurah also makes a natural base for the wider Peel region: the Yalgorup National Park lakes and ancient thrombolites at Lake Clifton lie just to the south, and the wineries and forests of the South West are within easy reach.</p>`,
    seo_title: 'Mandurah Travel Guide — Things to Do, Tours & Accommodation',
    seo_description: 'Plan a trip to Mandurah, WA: estuary and dolphin cruises, canals, crabbing, beaches, tours and places to stay an hour south of Perth.',
  },
  {
    slug: 'pilbara', name: 'The Pilbara', region: 'North West',
    intro: "Ancient gorges, red earth and the iron-ore coast of WA's north-west.",
    lat: -21.9, lng: 117.5, radius_km: 320,
    body: `<p>The Pilbara is a vast, ancient region in the north-west of Western Australia — red earth, spinifex plains and some of the oldest exposed rock on the planet. It is the engine room of the state's iron-ore industry, but beyond the mines lies extraordinary country for travellers.</p>
<p>Karijini National Park is the region's showpiece, a maze of deep gorges, hidden pools and waterfalls carved into banded ironstone over two billion years. On the coast, Karratha, Port Hedland and Dampier open onto the turquoise waters and coral of the Dampier Archipelago and Murujuga (Burrup Peninsula), home to one of the world's largest collections of Aboriginal rock art.</p>
<p>Distances out here are large and the seasons matter — the cooler, dry months from about April to September are the comfortable time to explore. Whether you're gorge-walking in Karijini, fishing the coast or following the Warlu Way, the Pilbara rewards those who make the trip.</p>`,
    seo_title: 'The Pilbara Travel Guide — Karijini, Gorges, Tours & Stays',
    seo_description: "Explore the Pilbara in WA's north-west: Karijini National Park gorges, the iron-ore coast, rock art, tours and accommodation across the region.",
  },
  {
    slug: 'the-kimberley', name: 'The Kimberley', region: 'Kimberley',
    intro: "Gorges, waterfalls and the Gibb River Road across Australia's last great wilderness.",
    lat: -16.5, lng: 126.0, radius_km: 400,
    body: `<p>The Kimberley is one of the world's last great wildernesses — a rugged expanse of sandstone ranges, tidal rivers and hidden gorges spread across the far north of Western Australia, an area larger than many countries yet home to only a scattering of towns.</p>
<p>This is country of dramatic contrasts: the beehive-striped domes of the Bungle Bungle Range in Purnululu National Park, the thundering wet-season waterfalls of the Mitchell Plateau, the horizontal falls of Talbot Bay, and the pearling town of Broome with its Cable Beach sunsets. The legendary Gibb River Road cuts through the heart of it, linking cattle-station stays, swimming holes and remote gorges between Derby and Kununurra.</p>
<p>The Kimberley runs on two seasons — the dry (roughly May to October), when roads open and the days are warm and clear, and the wet, when the waterfalls come alive. Broome, Kununurra, Derby and Halls Creek are the main gateways, and much of the best country is reached by 4WD, boat or scenic flight.</p>`,
    seo_title: 'The Kimberley Travel Guide — Gorges, Broome, Tours & Stays',
    seo_description: 'Discover the Kimberley in far-north WA: Purnululu, the Gibb River Road, Broome, gorges, waterfalls, tours and accommodation across the region.',
  },
]

for (const d of DESTS) {
  const has = await sql`SELECT 1 FROM autravel.destinations WHERE state_code='wa' AND slug=${d.slug} LIMIT 1`
  const kids = await sql`SELECT count(*)::int c FROM autravel.articles WHERE state_code='wa' AND status='published' AND legacy_path LIKE ${'/'+d.slug+'/%'}`
  console.log(`${d.slug}: ${has.length?'EXISTS':'new'}, ${kids[0].c} child pages, hero=${HERO(d.slug)}`)
  if (!APPLY) continue
  await sql`
    INSERT INTO autravel.destinations
      (state_code, slug, name, region, intro, body, lat, lng, radius_km, hero_image, active, display_order, seo_title, seo_description)
    VALUES
      ('wa', ${d.slug}, ${d.name}, ${d.region}, ${d.intro}, ${d.body}, ${d.lat}, ${d.lng}, ${d.radius_km}, ${HERO(d.slug)}, true, 100, ${d.seo_title}, ${d.seo_description})
    ON CONFLICT (state_code, slug) DO UPDATE SET
      name=EXCLUDED.name, region=EXCLUDED.region, intro=EXCLUDED.intro, body=EXCLUDED.body,
      lat=EXCLUDED.lat, lng=EXCLUDED.lng, radius_km=EXCLUDED.radius_km, hero_image=EXCLUDED.hero_image,
      active=true, seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description, updated_at=now()`
}
console.log(APPLY ? '\nAPPLIED' : '\n(dry run — add --apply)')
await sql.end()
