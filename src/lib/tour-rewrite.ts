// AI rewrite of an imported tour's description and highlights.
// Input: raw Viator/WeTravel text. Output: original-voice BugBitten copy.
// Never copies verbatim — Viator's Partner Agreement forbids that, and it's
// also what makes us different.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'  // cheap + fast; upgrade to sonnet if quality needs it

export type RewriteInput = {
  title: string
  sourceDescription?: string
  highlights?: string[]
  inclusions?: string[]
  exclusions?: string[]
  additionalInfo?: string[]
  duration?: string | null
  destinationName?: string     // e.g. "Bali"
}

export type RewriteOutput = {
  summary: string              // 120-150 words, natural human voice
  highlights: string[]         // 5-8 concise bullets
  whatToExpect: string         // 1-2 paragraphs
  goodToKnow: string           // practical tips paragraph
  model: string
}

const SYSTEM = `You are a travel writer for BugBitten, a traveller-first community. You rewrite tour-operator blurb into fresh, honest, search-friendly copy.

HARD RULES:
- Never copy phrases verbatim from the source text. If a sentence in the source is distinctive, paraphrase it. No "don't miss", no "once-in-a-lifetime", no "immerse yourself".
- British Australian English (Sydney, not Sidney). No American spellings.
- Concrete over abstract. If you can't say something specific, cut the sentence.
- No superlatives unless they're earned and specific ("200+ 5-star reviews" is fine; "the best tour ever" is not).
- Don't invent facts. If the source doesn't say what time it starts, don't guess.
- You're writing for a fellow traveller, not a tourist. Assume they're intelligent and know how travel works.

Return STRICT JSON matching this TypeScript type — no markdown, no commentary, no trailing commas:
{ "summary": string, "highlights": string[], "whatToExpect": string, "goodToKnow": string }

- summary: 120-150 words. One paragraph. Opens with what the tour actually does (not "Experience the..."). Mentions location and duration if known.
- highlights: 5-8 bullets. Each 5-12 words. No bullets starting with generic verbs like "Enjoy" or "See".
- whatToExpect: 1-2 paragraphs, 80-140 words total. Honest walkthrough of what happens — what you do first, what the pace feels like, what the end looks like.
- goodToKnow: one paragraph, 40-80 words. Practical notes only — what to wear, what to bring, fitness level, dietary options, language of guide, pickup. Skip marketing.`

export async function rewriteTour(input: RewriteInput): Promise<RewriteOutput> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')

  const userPrompt = buildUserPrompt(input)

  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 400)}`)
  }

  const data = await r.json() as { content: Array<{ type: string; text?: string }>; model: string }
  const text = data.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim()
  const parsed = extractJson(text)
  if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.highlights)) {
    throw new Error(`rewrite: unexpected response: ${text.slice(0, 200)}`)
  }
  return {
    summary: String(parsed.summary).trim(),
    highlights: parsed.highlights.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 10),
    whatToExpect: String(parsed.whatToExpect || '').trim(),
    goodToKnow: String(parsed.goodToKnow || '').trim(),
    model: data.model || MODEL,
  }
}

function buildUserPrompt(input: RewriteInput): string {
  const parts: string[] = []
  parts.push(`TITLE: ${input.title}`)
  if (input.destinationName) parts.push(`LOCATION: ${input.destinationName}`)
  if (input.duration) parts.push(`DURATION: ${input.duration}`)
  if (input.sourceDescription) parts.push(`\nSOURCE DESCRIPTION (for reference only — do not copy):\n${input.sourceDescription}`)
  if (input.highlights?.length) parts.push(`\nSOURCE HIGHLIGHTS (for reference only):\n- ${input.highlights.join('\n- ')}`)
  if (input.inclusions?.length) parts.push(`\nINCLUSIONS:\n- ${input.inclusions.join('\n- ')}`)
  if (input.exclusions?.length) parts.push(`\nEXCLUSIONS:\n- ${input.exclusions.join('\n- ')}`)
  if (input.additionalInfo?.length) parts.push(`\nADDITIONAL INFO:\n- ${input.additionalInfo.join('\n- ')}`)
  parts.push(`\nRewrite this as fresh original copy per the system rules. Return JSON only.`)
  return parts.join('\n')
}

// Model sometimes wraps JSON in prose — pull the first {...} block.
function extractJson(text: string): any | null {
  try { return JSON.parse(text) } catch {}
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}
