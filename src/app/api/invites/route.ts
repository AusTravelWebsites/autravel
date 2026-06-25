import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await db`SELECT id, username, display_name, email FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/invites — body: { emails: string[], context?: 'review'|'trip'|'meetup', subject_text?: string }
// Sends a friendly invite from the current user to each address. No DB write — fire and forget.
export async function POST(req: NextRequest) {
  const me = await getUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Invites send emails via Resend (real $) — hard cap per user: 20/hour, 100/day
  if (!(await rateLimit(`invite-hr:${me.id}`, 20, 3600))) {
    return NextResponse.json({ error: 'Invite limit: 20/hour. Try again later.' }, { status: 429 })
  }
  if (!(await rateLimit(`invite-day:${me.id}`, 100, 86400))) {
    return NextResponse.json({ error: 'Invite limit: 100/day. Try again tomorrow.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({} as any))
  const emailsIn: string[] = Array.isArray(body.emails) ? body.emails : []
  const context: string = typeof body.context === 'string' ? body.context : 'review'
  const note: string = typeof body.subject_text === 'string' ? body.subject_text.slice(0, 200) : ''

  // Dedupe + sanitise
  const emails = Array.from(new Set(emailsIn.map(e => (e || '').trim().toLowerCase()).filter(e => EMAIL_RE.test(e)))).slice(0, 10)
  if (emails.length === 0) return NextResponse.json({ error: 'No valid emails' }, { status: 400 })

  const fromName = me.display_name || me.username || 'A friend'
  const inviteUrl = `https://bugbitten.com/signup?ref=${encodeURIComponent(me.username || me.id)}`

  const subject = `${fromName} wants to share their travel adventures with you on BugBitten`
  const ctxLine = context === 'trip' ? `${fromName} is documenting a trip on BugBitten`
                : context === 'meetup' ? `${fromName} invited you to a meetup on BugBitten`
                : `${fromName} just posted a review on BugBitten`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#111827">
      <div style="text-align:center;margin-bottom:24px">
        <img src="https://media.bugbitten.com/brand/logo.webp?v=2" alt="BugBitten" style="height:80px"/>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#111827;margin:0 0 12px">You've been invited 🌏</h1>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 8px">${escapeHtml(ctxLine)}.</p>
      ${note ? `<p style="font-size:14px;color:#6b7280;line-height:1.6;background:#f3f4f6;padding:12px 14px;border-radius:8px;margin:16px 0;font-style:italic">${escapeHtml(note)}</p>` : ''}
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:16px 0">BugBitten is your online travel journal — document adventures, share with friends and family, and join meetups with fellow travellers.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:var(--brand);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:10px;font-size:15px">Join free to see ${escapeHtml(fromName)}'s journal</a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:32px">If you didn't expect this, you can ignore the email.</p>
    </div>`

  let sent = 0, failed = 0
  for (const to of emails) {
    try {
      const { error } = await resend.emails.send({
        from: 'BugBitten <noreply@bugbitten.com>',
        to,
        subject,
        html,
      })
      if (error) { failed++; console.error('[invites]', to, error); }
      else sent++
    } catch (e) { failed++; console.error('[invites]', to, e); }
  }

  return NextResponse.json({ ok: true, sent, failed })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}
