import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getIP, checkBlocklist, rateLimit } from '@/lib/admin'

const SESSION_COOKIE_NAME = '__session'
const SESSION_DURATION_MS = 60 * 60 * 24 * 14 * 1000 // 14 days

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

    let uid: string | null = null, email: string | null = null, phone: string | null = null
    try {
      const decoded = await adminAuth().verifyIdToken(idToken)
      uid = decoded.uid
      email = (decoded.email as string) || null
      phone = (decoded.phone_number as string) || null
    } catch {}

    const ip = getIP(req)
    const ua = req.headers.get('user-agent') || null

    // Rate limit: 10 signin attempts per minute per IP
    if (ip && !(await rateLimit(`signin:${ip}`, 10, 60))) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Please wait a minute and try again.' }, { status: 429 })
    }

    const blockReason = await checkBlocklist({ ip, email, phone })
    if (blockReason) {
      console.warn('[auth] blocked signin:', blockReason, { ip, email })
      return NextResponse.json({ error: 'Sign-in blocked by site administrators.' }, { status: 403 })
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    })

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    })

    if (uid) {
      try {
        const [u] = await db`SELECT id::text FROM users WHERE firebase_uid = ${uid} LIMIT 1`
        if (u) {
          await db`UPDATE users SET last_ip = ${ip}, last_user_agent = ${ua}, last_seen_at = NOW(), signup_ip = COALESCE(signup_ip, ${ip}) WHERE id = ${u.id}`
          await db`INSERT INTO sign_ins (user_id, ip, user_agent) VALUES (${u.id}, ${ip}, ${ua})`
        }
      } catch (e) { console.error('[session track]', e) }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return NextResponse.json({ status: 'ok' })
}
