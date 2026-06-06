import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE } from '@/lib/admin-session'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/',
  })
  return NextResponse.json({ ok: true })
}
