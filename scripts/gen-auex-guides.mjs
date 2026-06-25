#!/usr/bin/env node
/**
 * gen-auex-guides.mjs — cornerstone outback/off-road adventure guides for The
 * Australian Explorer (autravel.articles, state_code='auex'). House voice, AU
 * English. Idempotent on slug. Fork of gen-perth-articles.mjs.
 *
 *   node --env-file=.env.local scripts/gen-auex-guides.mjs [--force]
 */
import 'dotenv/config'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const FORCE = process.argv.includes('--force')
const CONN = process.env.DATABASE_URL || ''
const isLocal = /@(127\.0\.0\.1|localhost)[:\/]/.test(CONN)
const sql = postgres(CONN, { ssl: isLocal ? false : 'require', prepare: false, max: 3 })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ARTICLES = [
  { slug: 'outback-driving-preparation-checklist', title: 'Outback driving: the preparation checklist', brief: 'How to prepare a vehicle and yourself for remote outback and 4WD travel — recovery gear, dual battery, tyres and pressures, water and fuel range, comms (UHF, sat phone, EPIRB), spares, first aid, trip planning and telling someone your plan. Link to /off-road-tracks/ and /caravan-park-finder/.' },
  { slug: '4wd-recovery-basics', title: '4WD recovery basics for the outback', brief: 'A practical primer on self-recovery: lowering tyre pressures for sand, using recovery tracks/boards, snatch straps vs winching, bog and bridging, safe technique and what gear to carry. Safety-forward, not a substitute for training. Link to /off-road-tracks/.' },
  { slug: 'crossing-the-simpson-desert', title: 'Crossing the Simpson Desert: what you need to know', brief: 'A planning guide to a Simpson Desert crossing (French Line, WAA Line, Rig Road, Madigan): when to go (closed in summer), Desert Parks Pass, sand flags, convoy travel, fuel and water range, Big Red and Birdsville. Do not invent exact permit costs. Link to the Simpson tracks under /off-road-tracks/.' },
  { slug: 'best-outback-loops-by-season', title: 'The best outback loops, season by season', brief: 'Which outback regions and tracks suit which months — the Kimberley and Cape in the dry (May–Oct), the deserts in the cooler months, the Victorian High Country in summer, the Red Centre in winter. Help readers time a trip around heat, wet-season closures and bushfire danger. Link to /off-road-tracks/ and /walks/.' },
  { slug: 'caravan-camper-or-rooftop-tent-outback', title: 'Caravan, camper or rooftop tent for the outback?', brief: 'An honest comparison for outback touring: off-road caravans vs camper trailers vs rooftop tents vs swags — corrugations and clearance, weight and towing, set-up time, where each works (formed roads vs remote tracks), and matching the rig to the trip. Link to /caravan-park-finder/ and /off-road-tracks/.' },
  { slug: 'permits-and-aboriginal-land-outback', title: 'Permits and Aboriginal land: travelling the outback respectfully', brief: 'A general guide to permits and respectful travel: many desert tracks cross Aboriginal land and national parks needing transit or camping permits; how to check requirements, sacred-site and no-photo areas, staying on formed tracks, and leave-no-trace. Speak generally; tell readers to confirm current permits with the managing authority. Link to /off-road-tracks/.' },
  { slug: 'iconic-australian-multi-day-walks', title: 'Australia’s iconic multi-day walks: where to start', brief: 'An overview of Australia’s great multi-day bushwalks (Overland Track, Larapinta, Cape to Cape, Great Ocean Walk, Three Capes, Jatbula, Australian Alps Walking Track) — what makes each special, difficulty and season, which suit first-timers vs seasoned walkers, and booking/permit notes (general). Link to /walks/.' },
  { slug: 'staying-connected-and-safe-remote-australia', title: 'Staying connected and safe in remote Australia', brief: 'Communications and safety for remote travel: where mobile coverage ends, UHF radio etiquette, satellite phones and messengers, EPIRBs and PLBs, trip intentions, water planning, heat and the rules of staying with a broken-down vehicle. Practical and calm. Link to /off-road-tracks/.' },
]

const SYSTEM = `You write warm, practical Australian-English adventure-travel guides for The Australian Explorer, a site for off-road and outback travellers. House voice: a small, real team of keen four-wheel-drivers and bushwalkers — friendly, experienced, safety-forward, never salesy. Australian spelling and terms.

Write a complete article body as clean semantic HTML (no <html>/<head>/<body>, no markdown): <h2>/<h3>, <p>, <ul>/<li>, <strong>. Aim for 1100–1600 words. Include 2–3 internal links from this set where relevant: /off-road-tracks/ , /walks/ , /caravan-park-finder/ , /parks/ , /tours/ , /trains/ . Include 1–2 external links to genuine non-competitor authorities as <a href> (e.g. relevant state national-parks services, the Bureau of Meteorology http://www.bom.gov.au, Royal Flying Doctor Service). Do NOT invent specific permit costs, phone numbers or exact distances you aren't sure of — speak generally and tell readers to confirm current details. Be safety-forward about remoteness, heat, water, fuel and seasonal/wet-season closures.

Return STRICT JSON only: { "excerpt": string (~25 words), "seo_title": string (<=60 chars), "seo_description": string (<=155 chars), "body_html": string }`

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function gen(a) {
  for (let i = 0; i < 4; i++) {
    try {
      const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 3800, system: SYSTEM, messages: [{ role: 'user', content: `TITLE: ${a.title}\nBRIEF: ${a.brief}\n\nWrite the JSON now.` }] })
      const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
      let p = null; try { p = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]) } catch {} } }
      if (p?.body_html) return p
      throw new Error('bad JSON')
    } catch (e) { if (i === 3) throw e; await sleep([1500, 4000, 10000][i]) }
  }
}

let ok = 0
for (const a of ARTICLES) {
  if (!FORCE) { const [ex] = await sql`SELECT 1 FROM autravel.articles WHERE state_code=${'auex'} AND slug=${a.slug} LIMIT 1`; if (ex) { console.log('  skip', a.slug); continue } }
  try {
    const g = await gen(a)
    await sql`INSERT INTO autravel.articles (state_code, slug, legacy_path, title, excerpt, body_html, author, status, source, post_type, seo_title, seo_description, published_at)
      VALUES (${'auex'}, ${a.slug}, NULL, ${a.title}, ${g.excerpt}, ${g.body_html}, 'editorial', 'published', 'generated', 'post', ${g.seo_title || a.title}, ${g.seo_description || g.excerpt}, now())
      ON CONFLICT (state_code, slug) DO UPDATE SET title=EXCLUDED.title, excerpt=EXCLUDED.excerpt, body_html=EXCLUDED.body_html, seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description, updated_at=now()`
    ok++; console.log(`  ✓ ${a.slug} (${(g.body_html.length / 1000).toFixed(1)}k)`)
  } catch (e) { console.warn(`  ✗ ${a.slug}: ${e.message}`) }
}
console.log(`\nDone: ${ok}/${ARTICLES.length} adventure guides.`)
await sql.end()
