import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, logAction, getIP } from '@/lib/admin'
import {
  hashPassword, setStoredPasswordHash,
  listAdmins, deleteAdmin, isBootstrapAdminEmail,
} from '@/lib/admin-session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/admin/admins — list all admin accounts.
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admins = await listAdmins()
  return NextResponse.json({ admins, me: String(admin.id).toLowerCase() })
}

// POST /api/admin/admins — add a new admin (or reset an existing one's password).
// Body: { email, password }.
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let email = '', password = ''
  try {
    const body = await req.json()
    email = String(body.email || '').trim().toLowerCase()
    password = String(body.password || '')
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 })

  await setStoredPasswordHash(email, hashPassword(password))
  await logAction(admin, 'admin.account.upsert', { targetType: 'admin', targetId: email, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/admins?email=<email> — remove an admin account.
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (isBootstrapAdminEmail(email)) return NextResponse.json({ error: 'The primary admin account cannot be removed' }, { status: 400 })
  if (email === String(admin.id).toLowerCase()) return NextResponse.json({ error: 'You cannot remove the account you are signed in as' }, { status: 400 })

  const admins = await listAdmins()
  if (admins.length <= 1) return NextResponse.json({ error: 'Cannot remove the last admin account' }, { status: 400 })

  await deleteAdmin(email)
  await logAction(admin, 'admin.account.delete', { targetType: 'admin', targetId: email, ip: getIP(req) })
  return NextResponse.json({ ok: true })
}
