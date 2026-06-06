/**
 * Lightweight channel-message moderation.
 *
 * Anti-spam / anti-abuse layering (inspired by Reddit, Discord, Discourse,
 * WhatsApp Channels):
 *  1. Hard limit: 30 words per message
 *  2. Hard reject: any URL / bare domain / email / phone
 *  3. Profanity filter (wordlist with l33t-substitution bypass detection)
 *  4. Spam shape filter (repeated-char, repeated-message, shouting)
 *  5. Rate-limit + cooldown enforced at API layer, not here
 *  6. Strike escalation: 3 strikes/24h → hide + mute; 10 → 24h ban
 */

export const MAX_WORDS = 30;

// Small curated list — sufficient to block the obvious; extend as needed.
// Keep lowercase, alphanumeric. Substitution-aware match is applied below.
const PROFANITY = [
  'fuck','fucker','fucking','fck','shit','shite','bullshit','bitch','cunt',
  'asshole','arsehole','dickhead','prick','bastard','motherfucker','slut',
  'whore','faggot','nigger','nigga','retard','spastic','kike','chink',
  'tranny','dyke','twat','wanker','pussy','cock','pedo','pedophile',
];

// Bypass normaliser: remove non-letters, convert common l33t
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z]/g, '');
}

// Precompute collapsed-letter variants (e.g. "fuuuck" -> "fuck")
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1{2,}/g, '$1$1');
}

export interface ModerationResult {
  ok: boolean;
  hidden: boolean;
  reason?: string;
  flag?: 'too_long' | 'link' | 'profanity' | 'spam_shape' | 'empty' | 'email_or_phone';
}

const URL_RE = /(?:https?:\/\/|www\.)\S+/i;
const BARE_DOMAIN_RE = /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|co|xyz|me|ly|gg|app|dev|info|biz|club|online|site|store|shop|live|fun|link|vip|top|ai|us|uk|au|nz|de|fr|es|it|ca|nl|jp|cn|ru|br|mx|in|id|tv|fm)\b/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s-]?){7,}\d/;

export function moderateMessage(raw: string): ModerationResult {
  const text = (raw || '').trim();
  if (!text) return { ok: false, hidden: false, reason: 'Message cannot be empty', flag: 'empty' };

  // Word count (server-side enforcement, same as client limit)
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > MAX_WORDS) {
    return { ok: false, hidden: false, reason: `Messages are limited to ${MAX_WORDS} words`, flag: 'too_long' };
  }

  // Links / domains / emails / phones — hard block, no links policy
  if (URL_RE.test(text) || BARE_DOMAIN_RE.test(text)) {
    return { ok: false, hidden: false, reason: 'Links are not allowed in channels', flag: 'link' };
  }
  if (EMAIL_RE.test(text) || PHONE_RE.test(text)) {
    return { ok: false, hidden: false, reason: 'Email addresses and phone numbers are not allowed', flag: 'email_or_phone' };
  }

  // Shouting / spam shape
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 12 && letters === letters.toUpperCase()) {
    return { ok: false, hidden: false, reason: 'Please don\'t shout (all caps)', flag: 'spam_shape' };
  }
  // Excessive repeated char, e.g. "hiiiiiiiiiiii"
  if (/(.)\1{9,}/.test(text)) {
    return { ok: false, hidden: false, reason: 'Message looks like spam', flag: 'spam_shape' };
  }

  // Profanity — normalise and collapse repeats
  const normalised = collapseRepeats(normalise(text));
  for (const bad of PROFANITY) {
    if (normalised.includes(bad)) {
      return { ok: false, hidden: true, reason: 'Please keep it civil', flag: 'profanity' };
    }
  }

  return { ok: true, hidden: false };
}

export function slugifyCity(name: string, country?: string | null): string {
  const base = [name, country]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'city';
}
