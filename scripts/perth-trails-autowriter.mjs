#!/usr/bin/env node
/**
 * perth-trails-autowriter.mjs — one fresh article a day for perthtourism.com.au,
 * covering bike paths, bike tours, walks, hikes, guided tours, and general
 * Perth/WA content. Persona-voiced (autravel.authors), grounded in real
 * trails/parks/destinations/tours already in the DB, anti-AI-tells playbook
 * applied, published directly (cron already staggers the run time).
 *
 * Usage:
 *   node --env-file=.env.local scripts/perth-trails-autowriter.mjs [--dry-run]
 */
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes('--dry-run')
const MODEL = 'claude-sonnet-5'
const STATE = 'perth'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOPICS_PATH = path.join(__dirname, 'perth-trails-topics.json')
const PERSONAS_PATH = path.join(__dirname, 'perth-trails-personas.json')
const STATE_PATH = path.join(__dirname, 'perth-trails-state.json')

const TOPICS = JSON.parse(readFileSync(TOPICS_PATH, 'utf8'))
const PERSONAS = JSON.parse(readFileSync(PERSONAS_PATH, 'utf8'))
const runState = JSON.parse(readFileSync(STATE_PATH, 'utf8'))

let PLAYBOOK = ''
try { PLAYBOOK = readFileSync('/etc/seo-autowriter-directives.md', 'utf8') } catch {}

const IMAGE_POOL = [
  { key: 'bike-cyclist',   tags: ['bike-path', 'bike-tour', 'gear-cycling', 'comparison-cycling'] },
  { key: 'bike-dirt-road', tags: ['bike-path', 'bike-tour', 'hidden-gem'] },
  { key: 'bike-group',     tags: ['bike-tour', 'guided-tour', 'comparison-cycling'] },
  { key: 'forest-walk-1',  tags: ['walk-hike', 'hidden-gem'] },
  { key: 'forest-walk-2',  tags: ['walk-hike', 'seasonal-guide', 'camping-crossover'] },
  { key: 'forest-walk-3',  tags: ['walk-hike', 'family-walk'] },
  { key: 'coastal-walk',   tags: ['seasonal-guide', 'general-perth', 'family-walk'] },
  { key: 'wildflowers',    tags: ['seasonal-guide', 'hidden-gem', 'general-perth'] },
]
const IMAGE_BASE = 'https://media.bugbitten.com/autravel/articles/perth-trails/'

const EXTERNAL_LINKS = [
  { url: 'https://trailswa.com.au', name: 'Trails WA', tags: ['bike-path', 'walk-hike', 'bike-tour', 'hidden-gem'] },
  { url: 'https://www.dbca.wa.gov.au', name: 'WA Dept. of Biodiversity, Conservation and Attractions', tags: ['walk-hike', 'seasonal-guide', 'hidden-gem', 'camping-crossover'] },
  { url: 'https://www.bibbulmuntrack.org.au', name: 'Bibbulmun Track Foundation', tags: ['walk-hike', 'seasonal-guide'] },
  { url: 'https://www.mundabiddi.org.au', name: 'Munda Biddi Trail Foundation', tags: ['bike-tour', 'bike-path'] },
  { url: 'https://www.transperth.wa.gov.au', name: 'Transperth', tags: ['general-perth', 'family-walk'] },
  { url: 'https://www.westernaustralia.com', name: 'Tourism Western Australia', tags: ['general-perth', 'guided-tour', 'comparison-general', 'comparison-cycling'] },
  { url: 'https://www.whitemanpark.com.au', name: 'Whiteman Park', tags: ['family-walk', 'bike-path'] },
  { url: 'https://westcycle.org.au', name: 'WestCycle', tags: ['bike-path', 'gear-cycling', 'comparison-cycling'] },
  { url: 'http://www.bom.gov.au', name: 'Bureau of Meteorology', tags: ['seasonal-guide'] },
]

function pick(arr, n) {
  const copy = [...arr]
  const out = []
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  return out
}

function nextTopic() {
  const recentIds = new Set(runState.recent_topic_ids || [])
  let candidates = TOPICS.filter(t => !recentIds.has(t.id))
  if (candidates.length === 0) { runState.recent_topic_ids = []; candidates = TOPICS }
  const lastPersona = (runState.recent_personas || []).at(-1)
  const preferred = candidates.filter(t => t.persona !== lastPersona)
  const pool = preferred.length ? preferred : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}

function nextImage(pillar) {
  const recent = new Set(runState.recent_images || [])
  const byTag = IMAGE_POOL.filter(i => i.tags.includes(pillar) && !recent.has(i.key))
  const pool = byTag.length ? byTag : IMAGE_POOL.filter(i => !recent.has(i.key))
  const chosen = (pool.length ? pool : IMAGE_POOL)[Math.floor(Math.random() * (pool.length || IMAGE_POOL.length))]
  return chosen.key
}

function pickExternalLinks(pillar) {
  const byTag = EXTERNAL_LINKS.filter(l => l.tags.includes(pillar))
  const pool = byTag.length >= 2 ? byTag : EXTERNAL_LINKS
  return pick(pool, 2)
}

async function pickInternalLinks(keywords) {
  const pattern = keywords.map(k => `%${k}%`)
  const results = []
  try {
    const dest = await sql`
      SELECT slug, name FROM destinations
      WHERE state_code = ${STATE} AND active
        AND EXISTS (SELECT 1 FROM unnest(${pattern}::text[]) p WHERE name ILIKE p OR COALESCE(body,'') ILIKE p)
      ORDER BY random() LIMIT 3`
    for (const d of dest) results.push({ href: `/${d.slug}/`, text: d.name, type: 'destination' })
  } catch {}
  try {
    const parks = await sql`
      SELECT slug, name FROM parks
      WHERE state_code = ${STATE} AND active
        AND EXISTS (SELECT 1 FROM unnest(${pattern}::text[]) p WHERE name ILIKE p OR COALESCE(suburb,'') ILIKE p OR COALESCE(region,'') ILIKE p)
      ORDER BY random() LIMIT 2`
    for (const p of parks) results.push({ href: `/parks/${p.slug}/`, text: p.name, type: 'park' })
  } catch {}
  try {
    const trails = await sql`
      SELECT slug, name FROM autravel.trails
      WHERE state_code = ${STATE} AND active
        AND EXISTS (SELECT 1 FROM unnest(${pattern}::text[]) p WHERE name ILIKE p OR COALESCE(area,'') ILIKE p OR COALESCE(description_ai,'') ILIKE p)
      ORDER BY random() LIMIT 3`
    for (const t of trails) results.push({ href: `/walks/${t.slug}/`, text: t.name, type: 'walk' })
  } catch {}
  try {
    const tours = await sql`
      SELECT slug, title FROM tours
      WHERE state_code IN ('perth', 'wa') AND active
        AND EXISTS (SELECT 1 FROM unnest(${pattern}::text[]) p WHERE title ILIKE p)
      ORDER BY random() LIMIT 2`
    for (const t of tours) results.push({ href: `/tours/${t.slug}/`, text: t.title, type: 'tour' })
  } catch {}
  try {
    const articles = await sql`
      SELECT slug, title, legacy_path FROM articles
      WHERE state_code = ${STATE} AND status = 'published'
        AND EXISTS (SELECT 1 FROM unnest(${pattern}::text[]) p WHERE title ILIKE p)
      ORDER BY random() LIMIT 2`
    for (const a of articles) results.push({ href: a.legacy_path || `/articles/${a.slug}/`, text: a.title, type: 'article' })
  } catch {}

  // De-dupe and pick a spread of 4-5.
  const seen = new Set()
  const deduped = results.filter(r => (seen.has(r.href) ? false : (seen.add(r.href), true)))
  if (deduped.length >= 4) return pick(deduped, 5)
  // Not enough topical matches — top up with general perth destinations/parks so we still hit the 3-5 link minimum.
  const topUp = await sql`
    SELECT slug, name FROM destinations WHERE state_code = ${STATE} AND active ORDER BY random() LIMIT 5`
  for (const d of topUp) {
    if (deduped.length >= 4) break
    if (!seen.has(`/${d.slug}/`)) { deduped.push({ href: `/${d.slug}/`, text: d.name, type: 'destination' }); seen.add(`/${d.slug}/`) }
  }
  return deduped
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Page title, sentence case, under 65 chars, includes the focus keyword. Not clickbait.' },
    slug: { type: 'string', description: 'kebab-case URL slug derived from the title, no state/site name in it' },
    excerpt: { type: 'string', description: '140-160 char summary, naturally written, includes the focus keyword' },
    seo_title: { type: 'string', description: 'Under 60 chars, includes focus keyword' },
    seo_description: { type: 'string', description: '140-160 chars, includes focus keyword, naturally written' },
    focus_keyword: { type: 'string', description: 'A natural 2-4 word phrase this article targets' },
    tags: { type: 'array', items: { type: 'string' }, description: '3-6 short topical tags' },
    body_html: { type: 'string', description: 'Full article body as HTML: <h2>/<h3>/<p>/<ul><li> only. 1200-2000 words. Must naturally include every supplied internal link href and both supplied external link hrefs as real <a> tags.' },
  },
  required: ['title', 'slug', 'excerpt', 'seo_title', 'seo_description', 'focus_keyword', 'tags', 'body_html'],
  additionalProperties: false,
}

function buildSystemPrompt(persona) {
  return `You are ${persona.name}, ${persona.role} at Perth Tourism (perthtourism.com.au). You are a real member of a small editorial team, not an AI assistant.

Your voice: ${persona.voice}

Your habits (weave in naturally, don't force all of them into one article):
${persona.tics.map(t => `- ${t}`).join('\n')}

Typo/imperfection profile (apply lightly, 1-2 per article, NEVER in a fact/number/name): ${persona.typo_profile}

Personal-aside options (use one, briefly):
${persona.personal_asides.map(a => `- ${a}`).join('\n')}

Include exactly one measured, mildly contrarian opinion in the piece, in character. Options:
${persona.contrarian_takes.map(c => `- ${c}`).join('\n')}

Write in Australian English for an Australian audience, first person, as yourself.

${PLAYBOOK}

You must return the article as structured JSON matching the given schema. The body_html must incorporate the internal and external links you're given (see the user message) as real <a href="..."> tags, used naturally in context — never invent a different URL, and never invent a trail/park/destination name beyond what's supplied.

Do NOT end the article with a signature line, byline, or "— Name, Role" sign-off — the page template already renders your author bio card automatically below the article. End with the last content paragraph only.`
}

function buildUserPrompt({ topic, internalLinks, externalLinks }) {
  return `Topic for today's article: ${topic.seed}

Internal links to weave into the body (use the exact href and reference the exact name naturally — do not invent alternatives):
${internalLinks.map((l, i) => `${i + 1}. <a href="${l.href}">${l.text}</a> (${l.type})`).join('\n')}

External links to weave into the body (use the exact href, wrap as <a href="${'${href}'}" target="_blank" rel="noopener">name</a>):
${externalLinks.map((l, i) => `${i + 1}. ${l.url} — ${l.name}`).join('\n')}

Write the full article now per the schema.`
}

function sanitizeSlug(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90)
}

const log = (...a) => console.log(`[perth-trails ${new Date().toISOString()}]`, ...a)

async function main() {
  const topic = nextTopic()
  const persona = PERSONAS[topic.persona]
  if (!persona) throw new Error(`no persona profile for ${topic.persona}`)
  log(`topic: ${topic.id} (${topic.pillar}) — persona: ${persona.name}`)

  const internalLinks = await pickInternalLinks(topic.keywords)
  if (internalLinks.length < 3) throw new Error(`only found ${internalLinks.length} internal link candidates for ${topic.id}`)
  const externalLinks = pickExternalLinks(topic.pillar)
  const imageKey = nextImage(topic.pillar)
  log(`  internal links: ${internalLinks.map(l => l.href).join(', ')}`)
  log(`  external links: ${externalLinks.map(l => l.url).join(', ')}`)
  log(`  image: ${imageKey}`)

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: buildSystemPrompt(persona),
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [{ role: 'user', content: buildUserPrompt({ topic, internalLinks, externalLinks }) }],
  })
  const textBlock = resp.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('no text block in response')
  const obj = JSON.parse(textBlock.text)

  const slug = sanitizeSlug(obj.slug || obj.title)
  const missingInternal = internalLinks.filter(l => !obj.body_html.includes(l.href))
  if (missingInternal.length) log(`  ⚠ missing ${missingInternal.length}/${internalLinks.length} internal links in body`)
  const missingExternal = externalLinks.filter(l => !obj.body_html.includes(l.url))
  if (missingExternal.length) log(`  ⚠ missing ${missingExternal.length}/${externalLinks.length} external links in body`)

  const coverImage = `${IMAGE_BASE}${imageKey}.webp`

  if (DRY) {
    log(`DRY RUN — would publish: "${obj.title}" (/${'articles'}/${slug}/) by ${persona.name}, ${obj.body_html.length} chars`)
    return
  }

  await sql`
    INSERT INTO articles (state_code, slug, title, excerpt, body_html, cover_image,
                           post_type, status, source, source_raw, author, author_slug,
                           seo_title, seo_description, tags, published_at)
    VALUES (${STATE}, ${slug}, ${obj.title}, ${obj.excerpt}, ${obj.body_html}, ${coverImage},
            'post', 'published', 'perth-trails-autowriter',
            ${sql.json({ model: MODEL, topic_id: topic.id, pillar: topic.pillar, focus_keyword: obj.focus_keyword, generated_at: new Date().toISOString() })},
            ${persona.name}, ${topic.persona},
            ${obj.seo_title}, ${obj.seo_description}, ${sql.json(obj.tags)}, NOW())
    ON CONFLICT (state_code, slug) DO UPDATE SET
      title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      cover_image = EXCLUDED.cover_image, source_raw = EXCLUDED.source_raw,
      seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
      tags = EXCLUDED.tags, updated_at = NOW()`

  log(`  saved /articles/${slug}/ — "${obj.title}" by ${persona.name}`)

  runState.recent_topic_ids = [...(runState.recent_topic_ids || []), topic.id].slice(-45)
  runState.recent_personas = [...(runState.recent_personas || []), topic.persona].slice(-5)
  runState.recent_images = [...(runState.recent_images || []), imageKey].slice(-5)
  runState.last_run_at = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(runState, null, 2))
}

main()
  .then(() => sql.end())
  .catch(async (e) => { log('FAILED:', e.message); await sql.end(); process.exit(1) })
