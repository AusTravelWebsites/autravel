#!/usr/bin/env node
/**
 * ai-generate-article-at-url.mjs — for URLs that Google's still hitting but
 * have no Wayback snapshot, infer intent from the URL and write a proper
 * article AT THAT URL using Claude. Per Craig's rule: "find or create the
 * exact right url and redirect it there, if it doesn't exist, build it."
 *
 * Per page spec:
 *   - 1500+ words
 *   - Named-team voice (deterministic author from autravel.authors by slug-hash)
 *   - 3 internal links (to real destinations/articles)
 *   - 2 external links (non-competitor — gov, info, official)
 *   - Full SEO meta + Article JSON-LD on the page render
 *   - Cover image from Unsplash (search by inferred topic)
 *   - Inserted as DRAFT — staggered publisher promotes over time
 *
 * Usage:
 *   node --env-file=.env.local scripts/ai-generate-article-at-url.mjs \
 *        --state wa --targets /tmp/wa-misses-to-build.json [--limit 1] [--dry-run]
 *
 * targets JSON: [{ "path": "/perth/accommodation/budget-accommodation/", "hits": 4 }, ...]
 *
 * Cost: ~$0.10 per article on Sonnet 4.6.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import Anthropic from '@anthropic-ai/sdk'

const args = process.argv.slice(2)
function arg(name, fallback = null) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const STATE   = (arg('state') || '').toLowerCase()
const TARGETS = arg('targets')
const LIMIT   = Number(arg('limit', '0')) || null
const DRY     = args.includes('--dry-run')
const MODEL   = arg('model') || 'claude-sonnet-4-6'

if (!STATE || !TARGETS) { console.error('need --state and --targets <json>'); process.exit(1) }

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connection: { search_path: 'autravel, public' } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STATE_NAMES = {
  qld: 'Queensland', nsw: 'New South Wales', vic: 'Victoria', wa: 'Western Australia',
  sa: 'South Australia', tas: 'Tasmania', nt: 'Northern Territory', aunz: 'Australia & New Zealand',
}
const STATE_NAME = STATE_NAMES[STATE] || STATE.toUpperCase()

function pathToSlug(p) {
  return p.replace(/^\/+|\/+$/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80)
}

// Infer article intent from the URL structure.
//   /perth/accommodation/budget-accommodation/ → topic: "Budget accommodation in Perth", destination_slug: 'perth'
//   /south-west-of-western-australia/cruises/ → topic: "Cruises in South West Western Australia"
//   /coral-princess-cruises/ → topic: "Coral Princess Cruises in WA"
//   /aat-kings-9-day-broome-darwin.html → topic: "AAT Kings 9-day Broome to Darwin tour"
function inferIntent(path) {
  const noExt = path.replace(/\.html$/i, '').replace(/^\/+|\/+$/g, '')
  let segs = noExt.split('/').filter(Boolean)
  // Strip the noise prefix /destinations/ — the real subject starts after it
  if (segs[0] === 'destinations') segs = segs.slice(1)
  const titleWords = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
  if (segs.length >= 2) {
    const dest = segs[0]
    const topic = segs.slice(1).map(titleWords).join(' — ')
    return { destination: dest, topic, h1: `${topic} in ${titleWords(dest)}`, isSubpage: true }
  }
  return { destination: null, topic: titleWords(segs[0] || 'guide'), h1: titleWords(segs[0] || 'guide'), isSubpage: false }
}

async function pickAuthor() {
  // Round-robin from the active state-relevant authors (or any if none state-tagged).
  const rows = await sql`
    SELECT slug, name, role FROM autravel.authors
     WHERE is_active = true
       AND (${STATE} = ANY(state_codes) OR cardinality(state_codes) = 0)
     ORDER BY random() LIMIT 1`
  return rows[0]
}

async function pickInternalLinks(destinationSlug) {
  // 3 internal links: prefer the matching destination + 2 others from same state.
  const links = []
  if (destinationSlug) {
    const [d] = await sql`SELECT slug, name FROM autravel.destinations WHERE state_code=${STATE} AND slug=${destinationSlug} AND active LIMIT 1`
    if (d) links.push({ href: `/${d.slug}/`, text: d.name })
  }
  const others = await sql`
    SELECT slug, name FROM autravel.destinations
     WHERE state_code=${STATE} AND active
       AND slug != ${destinationSlug || ''}
     ORDER BY display_order ASC NULLS LAST, random() LIMIT 4`
  for (const r of others) {
    if (links.length >= 3) break
    links.push({ href: `/${r.slug}/`, text: r.name })
  }
  return links
}

const SYSTEM = `You write travel-guide articles for a community-author voice on an Australian travel site.

Constraints:
- 1500+ words. Real, useful content — not filler.
- British/Australian English (colour, neighbourhood, kilometre).
- Write as the named author at the top. Use "we", "I went", "I'd recommend" — first-person but warm and informed.
- NO marketing fluff. NO exclamation marks. NO hashtags. NO "discover", "unveil", "embark".
- Output STRICT JSON with these fields exactly:
  { "title": "...", "excerpt": "...", "body_html": "<p>...</p>...", "external_links": [{"href":"https://...","text":"..."}] }
- title: 40-60 chars. seo-friendly. matches the URL's intent.
- excerpt: 140-160 chars. concrete and specific.
- body_html: real HTML — <p>, <h2>, <h3>, <ul><li>, <blockquote>. Include the internal-link <a> tags I give you in the body naturally. Include 2 external <a> tags pointing at authoritative non-competitor sites (state tourism boards, parks authorities, Wikipedia, gov, official operator sites — never another travel-comparison site).
- Wrap external links in: <a href="..." target="_blank" rel="noopener">...</a>
- Wrap internal links plain: <a href="...">...</a>
- Open with a 1-2 sentence personal observation by the author.
- Include 3-5 <h2> sections, at least one <h3> per section where useful.
- end body_html with a 2-3 sentence closer offering practical advice for the reader.
- DO NOT mention "AI" or that this is generated content.
- Return ONLY the JSON object. No code fence, no prose.`

function buildUserPrompt({ author, intent, path, internalLinks, hits }) {
  return `Path: ${path}
Inferred intent: ${intent.h1}
State: ${STATE_NAME}
Author voice: ${author.name} (${author.role || 'travel writer'})
Hits-per-month from real visitors: ${hits}

Internal links you MUST include in the body (each used at least once, in context):
${internalLinks.map((l, i) => `  ${i+1}. <a href="${l.href}">${l.text}</a>`).join('\n')}

For external links (you choose 2, must be authoritative + non-competitor):
- State tourism site (e.g. westernaustralia.com, visitnsw.com)
- Government / parks / official operator / Wikipedia

Write the article now. Return only the JSON.`
}

const ts = () => new Date().toISOString()
const log = (...a) => console.log(`[ai-gen ${ts()}]`, ...a)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// URL paths that should NEVER become articles — utility routes, malformed URLs,
// admin paths, etc. AI-generated content at these would either collide with real
// routes or be nonsense (e.g. an "article about Login").
const NEVER_GENERATE = /^\/(login|logout|signup|signin|register|admin|api|account|settings|cart|checkout|dashboard|profile|trips|messages|notifications)(\/|$)/i

function shouldSkip(path) {
  if (NEVER_GENERATE.test(path)) return 'utility-route'
  if (/%[0-9a-f]{2}.*%[0-9a-f]{2}/i.test(path)) return 'malformed-url-encoded'
  if (path.length > 200) return 'too-long'
  // Path with multiple deeply-nested slugs that don't look like real content
  if ((path.match(/\//g) || []).length > 6) return 'too-deeply-nested'
  return null
}

async function generateOne(target) {
  const skip = shouldSkip(target.path)
  if (skip) { log(`  skip ${target.path} (${skip})`); return }
  const slug = pathToSlug(target.path)
  const intent = inferIntent(target.path)
  log(`→ ${target.path} (slug: ${slug}, intent: "${intent.h1}")`)

  const author = await pickAuthor()
  if (!author) throw new Error('no author available')
  const internalLinks = await pickInternalLinks(intent.destination)
  if (internalLinks.length < 2) throw new Error('not enough internal links')

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildUserPrompt({ author, intent, path: target.path, internalLinks, hits: target.hits || 0 }) }],
  })
  const text = resp.content[0]?.text || ''
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart < 0) throw new Error(`no JSON in response: ${text.slice(0,200)}`)
  let obj
  try { obj = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) }
  catch (e) { throw new Error(`bad JSON: ${e.message}`) }
  if (!obj.title || !obj.body_html) throw new Error('missing title or body')

  // Sanity: must contain at least 1 of the internal links
  const hasInternal = internalLinks.some(l => obj.body_html.includes(l.href))
  if (!hasInternal) log('  ⚠ no internal link in body — model ignored prompt')

  // Prepend a tiny byline so the named-author signal is on-page
  const bylineHtml = `<p class="byline" style="color:#6b7280;font-size:14px;margin-bottom:18px"><em>By ${author.name} — ${author.role || 'travel writer'}</em></p>`
  const body_html = bylineHtml + obj.body_html

  if (DRY) {
    log(`  DRY: "${obj.title}" — ${body_html.length} chars, ${internalLinks.length} internals, author=${author.slug}`)
    return
  }

  await sql`
    INSERT INTO autravel.articles (state_code, slug, legacy_path, title, excerpt, body_html,
                                   post_type, status, source, source_raw,
                                   author, author_slug, published_at)
    VALUES (${STATE}, ${slug}, ${target.path}, ${obj.title}, ${obj.excerpt || null}, ${body_html},
            'post', 'draft', 'ai-generated',
            ${sql.json({ model: MODEL, intent, hits: target.hits || 0, generated_at: new Date().toISOString() })},
            ${author.name}, ${author.slug}, NULL)
    ON CONFLICT (state_code, slug) DO UPDATE SET
      title = EXCLUDED.title, body_html = EXCLUDED.body_html, excerpt = EXCLUDED.excerpt,
      legacy_path = EXCLUDED.legacy_path, source = EXCLUDED.source,
      source_raw = EXCLUDED.source_raw, author = EXCLUDED.author, author_slug = EXCLUDED.author_slug,
      status = EXCLUDED.status,  -- re-publish bad-capture archives back to draft
      updated_at = NOW()`
  log(`  ✓ saved — ${body_html.length} chars, author=${author.name}`)
}

const targets = JSON.parse(readFileSync(TARGETS, 'utf8'))
const toRun = LIMIT ? targets.slice(0, LIMIT) : targets
log(`generating ${toRun.length} articles for ${STATE} via ${MODEL}`)
let ok = 0, fail = 0
for (const t of toRun) {
  try { await generateOne(t); ok++; await sleep(800) }
  catch (e) { fail++; log(`  ✗ ${t.path}: ${e.message}`) }
}
log(`done: ok=${ok} fail=${fail}`)
await sql.end()
