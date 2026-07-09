import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyPassword, makeCookieValue, getStoredPasswordHash, ADMIN_COOKIE, ADMIN_MAX_AGE_S } from '@/lib/admin-session'
import { getIP, rateLimit } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (ip && !(await rateLimit(`admin-login:${ip}`, 8, 300))) {
    return NextResponse.json({ error: 'Too many attempts. Wait 5 minutes.' }, { status: 429 })
  }

  let email: string, password: string
  try {
    const body = await req.json()
    email = String(body.email || '').trim().toLowerCase()
    password = String(body.password || '')
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  // Multi-admin: any email with a credential row (or the bootstrap superadmin)
  // can sign in. getStoredPasswordHash only returns the env bootstrap hash for
  // the configured superadmin, so unknown emails resolve to null → rejected.
  const storedHash = await getStoredPasswordHash(email)
  if (!storedHash || !verifyPassword(password, storedHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, makeCookieValue(email), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ADMIN_MAX_AGE_S,
    path: '/',
  })
  return NextResponse.json({ ok: true })
}
