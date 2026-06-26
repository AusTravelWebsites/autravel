#!/usr/bin/env node
/**
 * Write 3 articles for El Questro Wilderness Park's accommodation tiers.
 * One-shot — each article published immediately with proper formatting,
 * named-team voice, 3 internal links, 2 external (non-competitor).
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TARGETS = [
  {
    slug: 'el-questro-the-station',
    legacy_path: '/el-questro-wilderness-park/the-station/',
    title: 'El Questro The Station — Kimberley campground & cabins',
    brief: 'The Station is the campground / mid-tier accommodation hub at El Questro. Powered + unpowered sites, riverside cabins, central pool, Steakhouse Bar & Grill, fuel + general store. Family-friendly base for self-drive Kimberley travellers on the Gibb River Road.',
  },
  {
    slug: 'el-questro-emma-gorge',
    legacy_path: '/el-questro-wilderness-park/emma-gorge/',
    title: 'Emma Gorge Resort — El Questro tented cabins',
    brief: 'Emma Gorge Resort is the mid-tier safari-tent accommodation at El Questro, 65 cabins set in a palm-shaded valley. Walk-in to the Emma Gorge swimming hole (1.5km return). Pool, restaurant, bar. Booking via Discovery Resorts (Anthology Hotels).',
  },
  {
    slug: 'el-questro-homestead',
    legacy_path: '/el-questro-wilderness-park/homestead/',
    title: 'El Questro Homestead — luxury Kimberley lodge',
    brief: `El Questro Homestead is the all-inclusive luxury cliffside lodge — 9 suites perched above the Chamberlain Gorge. All meals + drinks + activities included. April-October only. Bookings via Discovery Resorts (Anthology Hotels). Among Australia's top-tier wilderness lodges.`,
  },
]

const SYSTEM = `You write travel-guide articles for a network of Australian travel sites (qldtravel, watravel, etc).

House style:
- Voice: one of the named travel writers on the autravel team — pick from: "Dale Whitfield", "Priya Sharma", "Em Watson". Use first-person plural ("we", "us") for some sentences ("we'd recommend booking ahead in peak season").
- Tone: warm, plain-English, honest. Mention what's good AND what's not (e.g. "the road in is corrugated and dusty — expect 2-3 hours from Kununurra").
- Australian English spelling.
- Length: ~1,500 words.
- Structure: open with a 1-2 paragraph intro, then 5-7 H2 sections with H3 sub-sections where useful. End with an "Our take" H2 + a short FAQ section (3 questions, dl/dt/dd or just paragraphs).
- Mandatory internal links (use plain <a href="...">):
    1) /el-questro-wilderness-park/  (the parent destination)
    2) /broome/  OR /kununurra/  OR /kimberley/  (nearest big destination)
    3) one related sibling: another property at El Questro
- Mandatory external links (open in same tab; no nofollow):
    1) the official property booking page (https://www.elquestro.com.au/ — Discovery Resorts site)
    2) one authoritative reference: Tourism Western Australia (https://www.westernaustralia.com/), Parks Australia, or a similarly weighty Australian travel publication. NOT a direct booking competitor like Booking.com or Expedia.
- NO links to archive.org, NO links to social media.
- Use <h2>, <h3>, <p>, <ul>/<li>, occasional <blockquote> for memorable quotes.

Return STRICT JSON: {
  "title": string,                       // short page title (~55 chars)
  "excerpt": string,                     // ~140-char meta description
  "author": "Dale Whitfield"|"Priya Sharma"|"Em Watson",
  "body_html": string                    // full article HTML (NO outer <article>, just the inner content)
}
NO prose outside the JSON. NO markdown fence.`

async function generate(t) {
  const prompt = `Write the article for: ${t.title}

URL it will live at: ${t.legacy_path}

What this is about:
${t.brief}

Other properties at El Questro you can reference:
- El Questro The Station (campground, mid-tier)
- Emma Gorge Resort (safari tents)
- El Questro Homestead (luxury cliffside lodge)

Audience: Australian self-drive travellers planning a Kimberley road-trip. Many will be towing a caravan or driving a 4WD. They want to know logistics (drive times, road conditions, when to book), real expectations (what's the room like, what's the food like), and what to do nearby.

Write the article now.`
  const r = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = r.content[0]?.text || ''
  const i = text.indexOf('{')
  const j = text.lastIndexOf('}')
  if (i < 0 || j < 0) throw new Error('no JSON: ' + text.slice(0, 200))
  return JSON.parse(text.slice(i, j + 1))
}

for (const t of TARGETS) {
  console.log(`\n→ ${t.legacy_path}`)
  try {
    const a = await generate(t)
    console.log(`  title: ${a.title}`)
    console.log(`  author: ${a.author}`)
    console.log(`  body: ${a.body_html.length} chars`)
    await sql`
      INSERT INTO articles (state_code, slug, legacy_path, title, excerpt, body_html, post_type, status, source, author, published_at)
      VALUES ('wa', ${t.slug}, ${t.legacy_path}, ${a.title.slice(0, 90)}, ${a.excerpt.slice(0, 500)}, ${a.body_html},
              'post', 'published', 'ai-generated 2026-06-26 (el-questro)', ${a.author}, NOW())
      ON CONFLICT (state_code, slug) DO UPDATE SET
        title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
        source = EXCLUDED.source, updated_at = NOW(), status = 'published'`
    console.log(`  ✓ saved`)
  } catch (e) {
    console.log(`  ✗ ${e.message}`)
  }
}
await sql.end()
