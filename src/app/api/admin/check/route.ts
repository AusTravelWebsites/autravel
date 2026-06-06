import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyCookieValue, ADMIN_COOKIE } from '@/lib/admin-session'

export async function GET() {
  const cookieStore = await cookies()
  const value = cookieStore.get(ADMIN_COOKIE)?.value
  const session = verifyCookieValue(value)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, email: session.email })
}
