// Helpers for cleaning up the WordPress-migrated `body_html` so it renders as
// clean HTML both on the live page and in the admin editor. Pure, no deps,
// safe for client + server.

// 2026-06-03 — `sanitizeForEditor()` is stricter than processWpShortcodes.
// It's used when LOADING content INTO the WYSIWYG editor (and on paste) so
// the operator never sees raw <script>, MS Word XML, or other gibberish.
// The live-render path uses processWpShortcodes only — softer, since by
// then the content has already been written by a human and should be clean.

// Strip the things that have no business in a rich-text editor regardless
// of source. Safe to use both on initial load and on paste.
export function sanitizeForEditor(html: string): string {
  if (!html) return ''
  let out = processWpShortcodes(html)
  // Drop <script>, <style>, <noscript>, <iframe>, <object>, <embed> blocks
  // and any leftover Word-paste MS Office XML noise.
  out = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<meta\b[^>]*\/?>/gi, '')
    .replace(/<link\b[^>]*\/?>/gi, '')
    // MS Word conditional comments: <!--[if gte mso 9]>…<![endif]-->
    .replace(/<!--\[if [\s\S]*?<!\[endif\]-->/gi, '')
    // Generic XML processing instructions / declarations (Word, Office)
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    // Word VML / Office XML tags: <o:p>, <v:shape>, <w:wordDocument>, etc.
    .replace(/<\/?[a-z]+:[^>]+>/gi, '')
    // mso-* inline styles + class names
    .replace(/\s+(?:class)\s*=\s*"[^"]*Mso[^"]*"/gi, '')
    .replace(/\s+(?:style)\s*=\s*"[^"]*mso-[^"]*"/gi, (m) =>
      // If the style attr is JUST mso-* declarations, drop it entirely;
      // otherwise keep but strip the mso-* part.
      m.replace(/mso-[a-z-]+\s*:[^;"]*;?/gi, '').replace(/\s*style\s*=\s*"\s*"/, ''))
    // <font> is deprecated and produces garbage in the editor
    .replace(/<\/?font\b[^>]*>/gi, '')
    // Strip empty inline wrappers that browsers leave behind
    .replace(/<span\s*>\s*<\/span>/gi, '')
    .replace(/<b\s*>\s*<\/b>/gi, '')
    .replace(/<i\s*>\s*<\/i>/gi, '')
    // Collapse runs of nbsp
    .replace(/(?:&nbsp;\s*){3,}/g, '&nbsp;&nbsp;')
  return out
}


// WP articles often include their own <h1> inside body_html; demote to h2 so
// the rendered page has exactly one h1 (the page template's).
export function demoteBodyH1s(html: string): string {
  return html.replace(/<h1(\s[^>]*)?>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>')
}

// Migrated WP body_html still contains shortcodes like [caption]…[/caption] and
// [gallery …] which render as literal text when piped through dangerouslySetInnerHTML.
// Convert the common ones to native HTML and strip the rest so nothing leaks.
// Migrated WordPress bodies frequently carry FULLY-ABSOLUTE media URLs pointing
// at the site's own domain — usually the www. host, e.g.
//   https://www.new-forest-national-park.com/wp-content/uploads/x.webp
// Pages are served from the apex origin, so under CSP `img-src 'self'` those
// www. URLs are a *different origin* and the browser BLOCKS them (broken image) —
// even though www→apex redirects, because CSP is enforced on the request URL
// before any redirect runs. Root-relativising same-site media URLs collapses
// them onto the page origin so they always pass `'self'`, whether the page is
// served from apex or www. Scoped to WP media paths (/wp-content/, /image-files/)
// which our [...path] handlers always serve same-origin, so genuinely external
// images (Unsplash, Viator, media.bugbitten.com) are left untouched.
export function relativizeSameSiteMedia(html: string): string {
  if (!html) return html
  return html.replace(/https?:\/\/[^\s"'()<>]+?(\/(?:wp-content|image-files)\/)/gi, '$1')
}

export function processWpShortcodes(html: string): string {
  let out = relativizeSameSiteMedia(html)
  // Migration corruption: every "[/caption]\r\n" was rewritten to "[/captio<figure>"
  // (n]\r\n → <figure>) somewhere in the import pipeline, leaving an orphan
  // <figure> opener. Repair both the closing tag and drop the orphan opener
  // BEFORE any other shortcode handling so the [caption] regex can match cleanly.
  out = out.replace(/\[\/captio(?!n\b)<figure>/gi, '[/caption]')
  out = out.replace(/\[\/captio(?!n\b)/gi, '[/caption]')
  // [caption …]<a><img/></a> Caption text[/caption] → <figure><a><img/></a><figcaption>…</figcaption></figure>
  // Find where the media ends: prefer </a>, else self-closing img/>, else first >.
  out = out.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_m, inner) => {
    const trimmed = String(inner).trim()
    let mediaEnd = -1
    const closeA = trimmed.search(/<\/a\s*>/i)
    if (closeA !== -1) {
      mediaEnd = closeA + trimmed.slice(closeA).match(/<\/a\s*>/i)![0].length
    } else {
      const selfImg = trimmed.match(/<img\b[^>]*\/?>/i)
      if (selfImg) mediaEnd = (selfImg.index ?? 0) + selfImg[0].length
    }
    const media = mediaEnd > 0 ? trimmed.slice(0, mediaEnd) : trimmed
    const caption = mediaEnd > 0 ? trimmed.slice(mediaEnd).trim() : ''
    return `<figure class="wp-caption">${media}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
  })
  // Drop any remaining paired shortcodes ([gallery]…[/gallery], [embed]…[/embed], etc.)
  out = out.replace(/\[([a-z][a-z0-9_-]*)\b[^\]]*\][\s\S]*?\[\/\1\]/gi, '')
  // Drop self-closing / standalone shortcodes ([gallery ids="…"], [audio …], stray [/caption], etc.)
  out = out.replace(/\[\/?[a-z][a-z0-9_-]*\b[^\]]*\]/gi, '')
  // Strip any remaining orphan <figure> openers/closers that don't pair up
  // (the migration corruption sometimes leaves a bare <figure> with no </figure>).
  const figOpens = (out.match(/<figure\b[^>]*>/gi) || []).length
  const figCloses = (out.match(/<\/figure>/gi) || []).length
  if (figOpens !== figCloses) {
    // Remove unparented <figure> tags that wrap nothing (e.g. "<figure>\n<h2>…").
    // Keeping our generated wp-caption figures intact: those have a class attribute.
    out = out.replace(/<figure(?![^>]*class=)[^>]*>/gi, '')
  }
  return out
}


// ─── Lead image placement ────────────────────────────────────────────────────
// Craig's standing rule (2026-09-16): a post's featured image must never sit at
// the top of the article. The reader gets text first; the image lands mid-way,
// where it breaks up the read instead of pushing the opening copy below the fold.
// Same rule already enforced on imaginehealth.care — mirrored here so it is
// structural rather than something each post has to remember.
//
// This is a RENDER-time transform, not a content edit: body_html in the DB is
// untouched, so the admin editor still shows exactly what was authored.

/** Block-level elements we treat as top-level units when scanning a body. */
const BLOCK_TAGS = 'p|h1|h2|h3|h4|h5|h6|ul|ol|figure|blockquote|table|div|pre|section|aside|dl'
/**
 * Is this block purely media — a figure, a bare img, or a p/div wrapping only
 * an img? Every branch requires an actual <img>: WP bodies carry image-less
 * <figure> wrappers left over from the migration, and those are structure, not
 * a featured image, so they must stay where the author put them.
 */
function isMediaBlock(html: string): boolean {
  if (!/<img\b/i.test(html)) return false
  if (/^<img\b/i.test(html)) return true
  if (/^<figure\b/i.test(html)) return true
  return /^<(p|div)\b[^>]*>\s*(?:<a\b[^>]*>\s*)?<img\b[^>]*\/?>(?:\s*<\/a\s*>)?\s*<\/(?:p|div)>$/i.test(html.trim())
}
/** An image inside the first this-many characters of copy is the post's lead image. */
const LEAD_TEXT_WINDOW = 600
/** Bodies shorter than this have no meaningful "middle" — left alone. */
const MIN_BODY_TEXT = 300

function textLen(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length
}

/** Split `html` into the offsets of its top-level block elements, in order. */
function topLevelBlocks(html: string): { start: number; end: number; html: string }[] {
  const out: { start: number; end: number; html: string }[] = []
  const open = new RegExp(`<(${BLOCK_TAGS}|img|hr)\\b[^>]*?(/?)>`, 'gi')
  let i = 0
  while (i < html.length) {
    open.lastIndex = i
    const m = open.exec(html)
    if (!m) break
    const tag = m[1].toLowerCase()
    const start = m.index
    if (tag === 'img' || tag === 'hr' || m[2] === '/') {
      out.push({ start, end: start + m[0].length, html: m[0] })
      i = start + m[0].length
      continue
    }
    // Walk forward counting same-name opens/closes to find the matching close.
    const pair = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi')
    pair.lastIndex = start
    let depth = 0
    let end = -1
    let p: RegExpExecArray | null
    while ((p = pair.exec(html))) {
      if (p[2] === '/') continue          // self-closing, not a nesting level
      depth += p[1] === '/' ? -1 : 1
      if (depth === 0) { end = p.index + p[0].length; break }
    }
    if (end === -1) return []             // unbalanced markup — bail out, change nothing
    out.push({ start, end, html: html.slice(start, end) })
    i = end
  }
  return out
}

/** Container tags that wrap a whole body without being content themselves. */
const WRAPPER_TAGS = /^<(div|section|article|main)\b/i

/**
 * Top-level blocks of the article's actual CONTENT.
 *
 * Migrated WP bodies are often a single wrapper <div> holding every paragraph,
 * which makes a plain top-level scan see one block and no paragraphs at all —
 * 995 articles of 500+ words were being treated as thin for this reason alone.
 * When the scan yields a lone container, descend into it and rescan, mapping the
 * offsets back onto the original string so callers can still splice safely.
 */
function contentBlocks(html: string): { start: number; end: number; html: string }[] {
  let blocks = topLevelBlocks(html)
  let base = 0
  let guard = 0
  while (blocks.length === 1 && WRAPPER_TAGS.test(blocks[0].html) && guard++ < 5) {
    const open = blocks[0].html.match(/^<[^>]+>/)
    const close = blocks[0].html.match(/<\/(?:div|section|article|main)>$/i)
    if (!open || !close) break
    const innerStart = blocks[0].start + open[0].length
    const inner = html.slice(innerStart, blocks[0].end - close[0].length)
    const nested = topLevelBlocks(inner)
    if (nested.length === 0) break
    base = innerStart
    blocks = nested.map(b => ({ start: b.start + base, end: b.end + base, html: b.html }))
    if (blocks.length > 1) break
  }
  return blocks
}

/**
 * Move a post's lead image(s) out of the opening and down to the middle of the
 * article, so the reader always meets text first.
 *
 * An image counts as a "lead image" when fewer than `floor` characters of copy
 * precede it; every such image moves, so a body that opens with a stack of
 * pictures does not leave one behind. The destination is the block boundary
 * nearest the halfway mark that still has `floor` characters above it,
 * preferring an h2/h3 so the image lands on a section break. Because the same
 * `floor` governs both detection and destination, the result is stable: a
 * second pass finds no lead image and changes nothing.
 *
 * An explicit `<!-- image -->` comment in the body overrides the computed
 * midpoint, matching the imaginehealth convention.
 */
export function leadImageBelowIntro(html: string): string {
  if (!html) return html

  const blocks = contentBlocks(html)
  if (blocks.length < 3) return html

  const total = blocks.reduce((n, b) => n + textLen(b.html), 0)
  if (total < MIN_BODY_TEXT) return html
  // Long posts get a fixed one-paragraph run-up; short ones a proportional one,
  // so even a brief article still opens with text rather than a picture.
  const floor = Math.min(LEAD_TEXT_WINDOW, total * 0.4)

  // Collect every media block sitting above the floor, and the text that isn't.
  const leads: number[] = []
  let seen = 0
  for (let n = 0; n < blocks.length; n++) {
    if (seen >= floor) break
    if (isMediaBlock(blocks[n].html)) leads.push(n)
    else seen += textLen(blocks[n].html)
  }
  if (leads.length === 0) return html
  // All copy is above the floor and none below it — nowhere to move to.
  if (seen < floor) return html

  const leadSet = new Set(leads)
  const media = leads.map(n => blocks[n].html).join('\n')

  // Rebuild the body without the lead images, tracking where each surviving
  // block starts in the new string so we can pick an insertion point.
  let out = ''
  let cursor = 0
  const kept: { at: number; html: string }[] = []
  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]
    out += html.slice(cursor, b.start)
    if (!leadSet.has(n)) kept.push({ at: out.length, html: b.html })
    if (!leadSet.has(n)) out += b.html
    cursor = b.end
  }
  out += html.slice(cursor)

  // An explicit marker wins over the computed midpoint.
  const marker = /<!--\s*image\s*-->/i
  if (marker.test(out)) return out.replace(marker, media)

  // Otherwise: the boundary nearest the halfway mark with `floor` above it,
  // preferring a heading so the image lands on a section break.
  const target = total / 2
  let bestHeading: { at: number; dist: number } | null = null
  let bestAny: { at: number; dist: number } | null = null
  let above = 0
  for (const k of kept) {
    if (above >= floor) {
      const dist = Math.abs(above - target)
      if (/^<h[23]\b/i.test(k.html) && (!bestHeading || dist < bestHeading.dist)) bestHeading = { at: k.at, dist }
      if (!bestAny || dist < bestAny.dist) bestAny = { at: k.at, dist }
    }
    above += textLen(k.html)
  }
  const pick = bestHeading || bestAny
  if (!pick) return html

  return out.slice(0, pick.at) + media + '\n' + out.slice(pick.at)
}


// ─── External links open in a new tab ────────────────────────────────────────
// Craig's rule (2026-09-19): every external link in article copy opens in a new
// page, so a reader following a citation or a sponsor link doesn't lose the
// article. Done here rather than in each post's HTML — the site's own
// components already set target="_blank" on affiliate/tour links, but body_html
// is author-written and can't be relied on to remember.
//
// Render-time only: body_html in the DB is untouched, so the admin editor keeps
// showing what was authored. Links that already carry a target are left exactly
// as the author set them.

/** Hosts that count as "this site" for a given tenant host. */
function isSameSite(linkHost: string, tenantHost: string): boolean {
  const bare = (h: string) => h.toLowerCase().replace(/^www\./, '')
  return bare(linkHost) === bare(tenantHost)
}

/**
 * Add target="_blank" (plus rel="noopener") to every off-site link in a body.
 *
 * Left alone: root-relative and relative hrefs, same-site absolute URLs (with or
 * without www.), in-page anchors, and the non-navigational schemes (mailto:,
 * tel:, javascript:). `rel` is merged, never replaced, so an author's existing
 * nofollow/sponsored survives. We add `noopener` but NOT `noreferrer`, so the
 * destination still sees the referral — that attribution matters for the
 * sponsored placements these articles carry.
 */
export function externalLinksNewTab(html: string, tenantHost: string): string {
  if (!html) return html
  return html.replace(/<a\b([^>]*)>/gi, (tag, attrs: string) => {
    const href = (attrs.match(/\bhref\s*=\s*"([^"]*)"/i) || attrs.match(/\bhref\s*=\s*'([^']*)'/i) || [])[1]
    if (!href) return tag
    const h = href.trim()
    if (/^(?:#|\/|\?|mailto:|tel:|sms:|javascript:|data:)/i.test(h)) return tag
    let linkHost: string
    if (/^https?:\/\//i.test(h)) {
      try { linkHost = new URL(h).host } catch { return tag }
    } else if (h.startsWith('//')) {
      try { linkHost = new URL('https:' + h).host } catch { return tag }
    } else {
      return tag                                    // document-relative: internal
    }
    if (isSameSite(linkHost, tenantHost)) return tag
    if (/\btarget\s*=/i.test(attrs)) return tag     // author already chose

    const rel = (attrs.match(/\brel\s*=\s*"([^"]*)"/i) || [])[1]
    const tokens = new Set((rel || '').split(/\s+/).filter(Boolean))
    tokens.add('noopener')
    const relAttr = ` rel="${[...tokens].join(' ')}"`
    const withoutRel = attrs.replace(/\s*\brel\s*=\s*"[^"]*"/i, '')
    return `<a${withoutRel} target="_blank"${relAttr}>`
  })
}


// ─── In-article ad placement ─────────────────────────────────────────────────
// Ported from stkp-ads.php on stkildapenguins, where hand-placed units replaced
// Auto ads (12-21 unreserved slots per page, mobile CLS 0.38-0.61). Same rules:
// a thin-content gate, fixed positions by paragraph count, and never landing
// inside a figure or a list.
//
// One thing stkildapenguins did not have to handle: leadImageBelowIntro() puts
// the featured image in the MIDDLE of the article, which is exactly where the
// second ad wants to go. Two guards keep them apart — an ad is never placed
// next to a heavy block, and never within MIN_GAP_TEXT characters of COPY of
// one. Measuring the gap in copy rather than in markup matters: a figure is
// ~400 characters of HTML but zero characters of reading, so an offset-based
// gap looks satisfied while the ad still lands under the image.

/** Body text needed before an article carries any in-article ad. */
const AD_MIN_WORDS = 500
/** Paragraph counts at which the first and second in-article ads unlock. */
const AD_MIN_PARAS = 4
const AD_SECOND_MIN_PARAS = 10
/** Characters of readable copy required between an ad and an image or other ad. */
const MIN_GAP_TEXT = 400
/** Paragraph and copy floors before the FIRST ad may appear. Without a floor,
 *  "nearest spot to paragraph 3" happily lands on paragraph 1 when the spots
 *  around 3 are blocked by the mid-article image — which put an ad 593px down a
 *  360px-wide screen, after 33 words. An ad must never be the first thing a
 *  reader meets. */
const AD_FIRST_MIN_PARA = 3
const AD_FIRST_MIN_TEXT = 600

/** Blocks an ad should never sit beside: images and other bulky, non-prose runs. */
function isHeavyBlock(html: string): boolean {
  return /<img\b/i.test(html) || /^<(figure|ul|ol|table|blockquote|pre)\b/i.test(html)
}

/**
 * Insert the configured in-article ads into a rendered body.
 *
 * `ads` holds the HTML for each position; an empty string means that position
 * is not configured and nothing renders. Returns the body unchanged when the
 * article is too short, so thin pages never carry ads.
 */
export function insertAdUnits(
  html: string,
  ads: { in_article_1?: string; in_article_2?: string; content_end?: string },
): string {
  if (!html) return html
  if (!ads.in_article_1 && !ads.in_article_2 && !ads.content_end) return html

  const blocks = contentBlocks(html)
  if (blocks.length === 0) return html

  const words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
  const paras = blocks.filter(b => /^<p\b/i.test(b.html)).length
  // Too short to carry ads at all — not even the end-of-content slot. This is
  // what keeps ads off thin directory stubs, contact pages and policy pages.
  if (words < AD_MIN_WORDS || paras < AD_MIN_PARAS) return html

  // Copy position of each block, so gaps can be measured in reading length.
  const textAt: number[] = []
  let acc = 0
  for (const b of blocks) { textAt.push(acc); acc += textLen(b.html) }

  const heavyText = blocks.map((b, i) => (isHeavyBlock(b.html) ? textAt[i] : -1)).filter(t => t >= 0)

  // A spot sits between blocks[i-1] and blocks[i]. Neither neighbour may be a
  // heavy block, which rules out adjacency outright.
  type Spot = { at: number; text: number; paraNo: number }
  const spots: Spot[] = []
  let paraNo = 0
  for (let i = 0; i < blocks.length; i++) {
    if (/^<p\b/i.test(blocks[i].html)) paraNo++
    const next = blocks[i + 1]
    if (!next) break
    if (isHeavyBlock(blocks[i].html) || isHeavyBlock(next.html)) continue
    spots.push({ at: next.start, text: textAt[i + 1], paraNo })
  }
  if (spots.length === 0) return html

  const placedText: number[] = []
  const clear = (s: Spot) =>
    heavyText.every(t => Math.abs(t - s.text) >= MIN_GAP_TEXT) &&
    placedText.every(t => Math.abs(t - s.text) >= MIN_GAP_TEXT)

  /**
   * Nearest clear spot to `targetPara` that also clears the floors, or null.
   * `minPara`/`minText` are hard minimums, not preferences: an ad placed above
   * them would sit too near the top of the article.
   */
  const pick = (targetPara: number, minPara: number, minText: number): Spot | null => {
    const pool = spots.filter(s =>
      !placedText.includes(s.text) && s.paraNo >= minPara && s.text >= minText && clear(s))
    if (pool.length === 0) return null
    return pool.reduce((best, s) =>
      Math.abs(s.paraNo - targetPara) < Math.abs(best.paraNo - targetPara) ? s : best, pool[0])
  }

  const inserts: { at: number; html: string }[] = []
  let firstText = 0
  if (ads.in_article_1) {
    const s = pick(AD_FIRST_MIN_PARA, AD_FIRST_MIN_PARA, AD_FIRST_MIN_TEXT)
    if (s) { inserts.push({ at: s.at, html: ads.in_article_1 }); placedText.push(s.text); firstText = s.text }
  }
  if (ads.in_article_2 && paras >= AD_SECOND_MIN_PARAS) {
    // Never above the first ad, and never above the floors either.
    const s = pick(Math.round(paras * 0.65), AD_FIRST_MIN_PARA, Math.max(AD_FIRST_MIN_TEXT, firstText + MIN_GAP_TEXT))
    if (s) { inserts.push({ at: s.at, html: ads.in_article_2 }); placedText.push(s.text) }
  }

  // Splice from the end so earlier offsets stay valid.
  let out = html
  for (const ins of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, ins.at) + ins.html + '\n' + out.slice(ins.at)
  }
  return out + (ads.content_end || '')
}
