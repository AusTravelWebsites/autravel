import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { makeResetToken, RESET_TOKEN_TTL_S } from '@/lib/admin-session'
import { getIP, rateLimit } from '@/lib/admin'
import { tenantForHost } from '@/lib/tenants'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (ip && !(await rateLimit(`admin-forgot:${ip}`, 4, 600))) {
    return NextResponse.json({ error: 'Too many attempts. Wait 10 minutes.' }, { status: 429 })
  }

  let email: string
  try {
    const body = await req.json()
    email = String(body.email || '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const expectedEmail = (process.env.AUTRAVEL_ADMIN_EMAIL || '').trim().toLowerCase()

  if (email && expectedEmail && email === expectedEmail && resend) {
    const { token, expiresAt } = makeResetToken(expectedEmail)
    const host = req.headers.get('host') || ''
    const tenant = tenantForHost(host)
    const origin = `https://${host}`
    const resetUrl = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`
    const minutes = Math.round(RESET_TOKEN_TTL_S / 60)

    const html = `
<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 26px">
      <div style="font-size:11px;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">${tenant.name}</div>
      <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:#111827;line-height:1.3">Reset your admin password</h1>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.55">
        Click the button below to set a new password for the ${expectedEmail} admin account.
        This link expires in ${minutes} minutes and can only be used once.
      </p>
      <div style="text-align:center;margin:18px 0 8px">
        <a href="${resetUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:8px;font-size:14px">Set new password</a>
      </div>
      <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.55">
        If you didn't request this, you can ignore this email — your password won't change.
        Reset requested from ${origin} at ${new Date(expiresAt * 1000 - RESET_TOKEN_TTL_S * 1000).toISOString()}.
      </p>
    </div>
  </div>
</body></html>`

    try {
      // 2026-06-03 — was per-tenant `noreply@<tenant>.com.au`; Resend rejects
      // those with 403 because the autravel domains aren't verified senders.
      // bugbitten.com IS verified, so route admin reset emails from there.
      // The email body still shows the tenant brand so the recipient knows
      // which site they reset.
      const r = await resend.emails.send({
        from: `${tenant.name} Admin <noreply@bugbitten.com>`,
        to: expectedEmail,
        subject: `Reset your ${tenant.name} admin password`,
        html,
      })
      if ((r as any)?.error) console.error('[admin-forgot-password resend rejected]', (r as any).error)
    } catch (e) {
      console.error('[admin-forgot-password send]', e)
    }
  }

  // Always return a generic success — never reveal whether email matched.
  return NextResponse.json({ ok: true })
}
