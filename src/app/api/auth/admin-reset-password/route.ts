import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifyResetToken, isResetTokenUsed, markResetTokenUsed,
  hashPassword, setStoredPasswordHash,
  makeCookieValue, ADMIN_COOKIE, ADMIN_MAX_AGE_S,
} from '@/lib/admin-session'
import { getIP, rateLimit } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (ip && !(await rateLimit(`admin-reset:${ip}`, 10, 600))) {
    return NextResponse.json({ error: 'Too many attempts. Wait 10 minutes.' }, { status: 429 })
  }

  let token: string, password: string
  try {
    const body = await req.json()
    token = String(body.token || '')
    password = String(body.password || '')
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!token) return NextResponse.json({ error: 'Reset token required' }, { status: 400 })
  if (password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 })

  const verified = verifyResetToken(token)
  if (!verified) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })

  const expectedEmail = (process.env.AUTRAVEL_ADMIN_EMAIL || '').trim().toLowerCase()
  if (!expectedEmail || verified.email !== expectedEmail) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  if (await isResetTokenUsed(verified.tokenHash)) {
    return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 })
  }

  const newHash = hashPassword(password)
  await setStoredPasswordHash(verified.email, newHash)
  await markResetTokenUsed(verified.tokenHash)

  // Sign the admin in straight away so they don't have to type the new password.
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, makeCookieValue(verified.email), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ADMIN_MAX_AGE_S,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
