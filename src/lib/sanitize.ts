// Server-side sanitiser to strip external links from user-submitted text.
// Internal links (bugbitten.com, relative paths) are preserved.

const ALLOWED_HOST = /^(?:.+\.)?bugbitten\.com$/i;

// Matches URLs with http(s):// or starting with www.
const URL_RE = /\b(?:https?:\/\/|www\.)[a-zA-Z0-9.\-_]+(?:\.[a-zA-Z]{2,})(?:[/?#][^\s<>"']*)?/gi;

function isInternal(url: string): boolean {
  try {
    const norm = url.startsWith('http') ? url : 'https://' + url;
    const u = new URL(norm);
    return ALLOWED_HOST.test(u.hostname);
  } catch { return false; }
}

/**
 * Replace any external URL inside the string with [link removed].
 * Internal bugbitten.com links and relative paths are kept as-is.
 * Returns null if input is null/undefined.
 */
export function stripExternalLinks(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (typeof text !== 'string') return text as any;
  return text.replace(URL_RE, (match) => isInternal(match) ? match : '[link removed]');
}

/**
 * For URL-only fields (website, etc.) — return the URL only if internal,
 * otherwise null. Empty string also returns null.
 */
export function onlyInternalUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed; // relative path — internal
  return isInternal(trimmed) ? trimmed : null;
}
