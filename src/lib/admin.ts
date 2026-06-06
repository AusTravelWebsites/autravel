import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyCookieValue, ADMIN_COOKIE } from '@/lib/admin-session';

export async function verifyAdmin(req: NextRequest) {
  const value = req.cookies.get(ADMIN_COOKIE)?.value;
  const session = verifyCookieValue(value);
  if (!session) return null;
  return { id: session.email, firebaseUid: session.email };
}

export function getIP(req: NextRequest): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]!.trim();
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

// Sliding-window-ish rate limiter backed by a single row per key.
// Returns true if the request is allowed, false if it's over the limit.
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const [row] = await db`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < NOW() - (${windowSec} * INTERVAL '1 second') THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < NOW() - (${windowSec} * INTERVAL '1 second') THEN NOW() ELSE rate_limits.window_start END
      RETURNING count`;
    return (row?.count ?? 0) <= limit;
  } catch (e) { console.error('[rateLimit]', e); return true; }
}

export async function logAction(admin: { id: string }, action: string, opts: { targetType?: string; targetId?: string; metadata?: any; ip?: string | null } = {}) {
  try {
    await db`INSERT INTO admin_actions (admin_id, action, target_type, target_id, metadata, ip)
             VALUES (${admin.id}::text, ${action}, ${opts.targetType ?? null}, ${opts.targetId ?? null}, ${opts.metadata ?? null as any}, ${opts.ip ?? null})`;
  } catch (e) { console.error('[admin_actions]', e); }
}

// Blocklist check — returns a reason if blocked, null if clear.
export async function checkBlocklist({ ip, email, phone }: { ip?: string | null; email?: string | null; phone?: string | null }): Promise<string | null> {
  try {
    if (ip) {
      const [r] = await db`SELECT reason FROM blocklist WHERE kind = 'ip' AND LOWER(value) = LOWER(${ip}) LIMIT 1`;
      if (r) return `IP blocked: ${r.reason || 'no reason'}`;
    }
    if (email) {
      const [r] = await db`SELECT reason FROM blocklist WHERE kind = 'email' AND LOWER(value) = LOWER(${email}) LIMIT 1`;
      if (r) return `Email blocked: ${r.reason || 'no reason'}`;
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        const [d] = await db`SELECT reason FROM blocklist WHERE kind = 'email_domain' AND LOWER(value) = LOWER(${domain}) LIMIT 1`;
        if (d) return `Email domain blocked: ${d.reason || 'no reason'}`;
      }
    }
    if (phone) {
      const [r] = await db`SELECT reason FROM blocklist WHERE kind = 'phone' AND value = ${phone} LIMIT 1`;
      if (r) return `Phone blocked: ${r.reason || 'no reason'}`;
      // Prefix (e.g. "+234" to block Nigerian prefix) — check common lengths
      for (const len of [2,3,4,5,6]) {
        if (phone.length <= len) continue;
        const pref = phone.slice(0, len);
        const [p] = await db`SELECT reason FROM blocklist WHERE kind = 'phone_prefix' AND value = ${pref} LIMIT 1`;
        if (p) return `Phone prefix blocked: ${p.reason || 'no reason'}`;
      }
    }
  } catch (e) { console.error('[checkBlocklist]', e); }
  return null;
}
