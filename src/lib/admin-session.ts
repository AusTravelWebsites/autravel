import crypto from 'crypto'
import { db } from '@/lib/db'

const COOKIE_NAME = '__autravel_admin'
const MAX_AGE_S = 60 * 60 * 24 * 14 // 14 days
const RESET_TTL_S = 60 * 30 // 30 minutes

function secret() {
  const s = process.env.AUTRAVEL_ADMIN_SECRET
  if (!s || s.length < 32) throw new Error('AUTRAVEL_ADMIN_SECRET missing or too short (need 32+ chars)')
  return s
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const got = crypto.scryptSync(plain, salt, expected.length)
  return crypto.timingSafeEqual(expected, got)
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(plain, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function makeCookieValue(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S
  const payload = `${email}|${exp}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

export function verifyCookieValue(value: string | undefined | null): { email: string } | null {
  if (!value) return null
  const [b64, sig] = value.split('.')
  if (!b64 || !sig) return null
  let payload: string
  try { payload = Buffer.from(b64, 'base64url').toString('utf8') } catch { return null }
  const expectedSig = sign(payload)
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
  const [email, expStr] = payload.split('|')
  const exp = Number(expStr)
  if (!email || !exp || exp < Math.floor(Date.now() / 1000)) return null
  return { email }
}

export const ADMIN_COOKIE = COOKIE_NAME
export const ADMIN_MAX_AGE_S = MAX_AGE_S
export const RESET_TOKEN_TTL_S = RESET_TTL_S

// --- Admin accounts (multi-admin) --------------------------------------------
// Any email with a row in autravel.admin_credentials is an admin. The env
// AUTRAVEL_ADMIN_EMAIL + AUTRAVEL_ADMIN_PASSWORD_HASH pair is the "bootstrap"
// superadmin: a recovery account that always exists even with an empty table
// and cannot be removed from the UI.

function bootstrapEmail(): string {
  return (process.env.AUTRAVEL_ADMIN_EMAIL || '').trim().toLowerCase()
}
function bootstrapHash(): string {
  return process.env.AUTRAVEL_ADMIN_PASSWORD_HASH || ''
}

/** True if `email` is the configured bootstrap superadmin. */
export function isBootstrapAdminEmail(email: string): boolean {
  const boot = bootstrapEmail()
  return !!boot && email.trim().toLowerCase() === boot
}

export async function getStoredPasswordHash(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase()
  try {
    const [row] = await db`SELECT password_hash FROM autravel.admin_credentials WHERE email = ${e} LIMIT 1`
    if (row?.password_hash) return row.password_hash as string
  } catch (err) { console.error('[getStoredPasswordHash]', err) }
  // The env hash is a bootstrap fallback for the superadmin ONLY. Returning it
  // for any other email would let every address log in with one shared password.
  if (e && isBootstrapAdminEmail(e) && bootstrapHash()) return bootstrapHash()
  return null
}

export async function setStoredPasswordHash(email: string, hash: string): Promise<void> {
  await db`
    INSERT INTO autravel.admin_credentials (email, password_hash)
    VALUES (${email.trim().toLowerCase()}, ${hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
  `
}

/** Is this email allowed to reset/log in — has a credential row or is bootstrap? */
export async function isKnownAdmin(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase()
  if (!e) return false
  if (isBootstrapAdminEmail(e) && bootstrapHash()) return true
  try {
    const [row] = await db`SELECT 1 FROM autravel.admin_credentials WHERE email = ${e} LIMIT 1`
    return !!row
  } catch (err) { console.error('[isKnownAdmin]', err); return false }
}

export type AdminAccount = { email: string; updatedAt: string | null; bootstrap: boolean }

/** Every admin account: DB credential rows unioned with the bootstrap superadmin. */
export async function listAdmins(): Promise<AdminAccount[]> {
  const boot = bootstrapEmail()
  const map = new Map<string, AdminAccount>()
  if (boot && bootstrapHash()) map.set(boot, { email: boot, updatedAt: null, bootstrap: true })
  try {
    const rows = await db<Array<{ email: string; updated_at: string }>>`
      SELECT email, updated_at FROM autravel.admin_credentials ORDER BY email ASC`
    for (const r of rows) {
      map.set(r.email, { email: r.email, updatedAt: r.updated_at, bootstrap: r.email === boot })
    }
  } catch (e) { console.error('[listAdmins]', e) }
  return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email))
}

/** Remove an admin. The bootstrap superadmin cannot be removed. */
export async function deleteAdmin(email: string): Promise<void> {
  const e = email.trim().toLowerCase()
  if (isBootstrapAdminEmail(e)) throw new Error('The primary admin account cannot be removed')
  await db`DELETE FROM autravel.admin_credentials WHERE email = ${e}`
}

// --- Password-reset tokens (signed, single-use via reset_used table) ---

export function makeResetToken(email: string): { token: string; tokenHash: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + RESET_TTL_S
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `reset:${email}|${exp}|${nonce}`
  const sig = sign(payload)
  const token = `${Buffer.from(payload).toString('base64url')}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiresAt: exp }
}

export function verifyResetToken(token: string | undefined | null): { email: string; tokenHash: string } | null {
  if (!token) return null
  const [b64, sig] = token.split('.')
  if (!b64 || !sig) return null
  let payload: string
  try { payload = Buffer.from(b64, 'base64url').toString('utf8') } catch { return null }
  const expectedSig = sign(payload)
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
  if (!payload.startsWith('reset:')) return null
  const parts = payload.slice('reset:'.length).split('|')
  if (parts.length !== 3) return null
  const [email, expStr] = parts
  const exp = Number(expStr)
  if (!email || !exp || exp < Math.floor(Date.now() / 1000)) return null
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { email, tokenHash }
}

export async function isResetTokenUsed(tokenHash: string): Promise<boolean> {
  try {
    const [row] = await db`SELECT 1 FROM autravel.admin_password_reset_used WHERE token_hash = ${tokenHash} LIMIT 1`
    return !!row
  } catch (e) { console.error('[isResetTokenUsed]', e); return false }
}

export async function markResetTokenUsed(tokenHash: string): Promise<void> {
  await db`INSERT INTO autravel.admin_password_reset_used (token_hash) VALUES (${tokenHash}) ON CONFLICT (token_hash) DO NOTHING`
}
