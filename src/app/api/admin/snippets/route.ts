import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import db from '@/lib/db'
import { adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await adminAuth().verifySessionCookie(session)
    const [user] = await db`SELECT is_admin FROM users WHERE firebase_uid = ${decoded.uid}`
    return user?.is_admin ? decoded : null
  } catch { return null }
}

export async function GET() {
  const snippets = await db`SELECT * FROM site_snippets ORDER BY location, created_at`
  return NextResponse.json(snippets)
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, location, code, is_active } = await req.json()
  const [snippet] = await db`INSERT INTO site_snippets (name, location, code, is_active) VALUES (${name}, ${location}, ${code}, ${is_active ?? true}) RETURNING *`
  revalidateTag('site_snippets')
  return NextResponse.json(snippet)
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, location, code, is_active } = await req.json()
  const [snippet] = await db`UPDATE site_snippets SET name=${name}, location=${location}, code=${code}, is_active=${is_active}, updated_at=now() WHERE id=${id} RETURNING *`
  revalidateTag('site_snippets')
  return NextResponse.json(snippet)
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await db`DELETE FROM site_snippets WHERE id=${id}`
  revalidateTag('site_snippets')
  return NextResponse.json({ ok: true })
}
