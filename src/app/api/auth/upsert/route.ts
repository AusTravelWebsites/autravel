import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
import { getIP, checkBlocklist, rateLimit } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get('__session')?.value
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const { uid, email, name: decodedName, picture } = decoded
    let displayName: string | undefined, username: string | undefined;
    try { const b = await req.json(); displayName = b.displayName; username = b.username; } catch (_) {}

    const name = stripExternalLinks(displayName || decodedName || '') ?? ''
    const uname = username || (email?.split('@')[0] ?? uid.slice(0, 16))
      .toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)

    // Check if user exists
    const existing = await db`
      SELECT id, username, display_name, avatar_url, is_admin, is_banned
      FROM users WHERE firebase_uid = ${uid} LIMIT 1
    `

    let user
    if (existing.length > 0) {
      // Update
      const updated = await db`
        UPDATE users SET
          email        = ${email ?? ''},
          display_name = COALESCE(NULLIF(${name}, ''), display_name),
          avatar_url   = COALESCE(NULLIF(${picture ?? ''}, ''), avatar_url)
        WHERE firebase_uid = ${uid}
        RETURNING id, username, display_name, avatar_url, is_admin, is_banned
      `
      user = updated[0]
    } else {
      // Rate limit: 5 signups per IP per hour (bot-resistance)
      const ip = getIP(req)
      if (ip && !(await rateLimit(`signup:${ip}`, 5, 3600))) {
        return NextResponse.json({ error: 'Too many sign-ups from this network recently. Please try again later.' }, { status: 429 })
      }
      // Blocklist check before creating account
      const phone = (decoded.phone_number as string) || null
      const reason = await checkBlocklist({ ip, email, phone })
      if (reason) {
        console.warn('[auth/upsert] blocked signup:', reason, { ip, email, phone })
        try { await getAdminAuth().deleteUser(uid) } catch {}
        return NextResponse.json({ error: 'Sign-up blocked by site administrators.' }, { status: 403 })
      }
      // Insert (with signup_ip for fraud detection)
      const inserted = await db`
        INSERT INTO users (firebase_uid, email, display_name, avatar_url, username, signup_ip, last_ip)
        VALUES (${uid}, ${email ?? ''}, ${name}, ${picture ?? ''}, ${uname}, ${ip}, ${ip})
        ON CONFLICT DO NOTHING
        RETURNING id, username, display_name, avatar_url, is_admin, is_banned
      `
      user = inserted[0]
    }

    if (!user) return NextResponse.json({ error: 'DB error' }, { status: 500 })
    if (user.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    return NextResponse.json({ user })
  } catch (e: unknown) {
    return serverError(e, 'auth/upsert', req)
  }
}
