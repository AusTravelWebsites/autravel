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

// --- Password hash storage (DB row takes precedence, env is bootstrap fallback) ---

export async function getStoredPasswordHash(email: string): Promise<string | null> {
  try {
    const [row] = await db`SELECT password_hash FROM autravel.admin_credentials WHERE email = ${email} LIMIT 1`
    if (row?.password_hash) return row.password_hash as string
  } catch (e) { console.error('[getStoredPasswordHash]', e) }
  const env = process.env.AUTRAVEL_ADMIN_PASSWORD_HASH || ''
  return env || null
}

export async function setStoredPasswordHash(email: string, hash: string): Promise<void> {
  await db`
    INSERT INTO autravel.admin_credentials (email, password_hash)
    VALUES (${email}, ${hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
  `
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
