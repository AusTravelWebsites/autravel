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
export function processWpShortcodes(html: string): string {
  let out = html
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
