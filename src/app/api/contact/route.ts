/**
 * /api/contact — per-tenant contact form delivery via Resend.
 *
 * Resolves the destination inbox from the request Host header via tenantForHost,
 * so qldtravel.com.au goes to info@qldtravel.com.au, nswtravel.com.au to
 * info@nswtravel.com.au, etc. — configured in src/lib/tenants.ts.
 *
 * Rate-limit: 3/IP/hour and 2/email/hour to prevent abuse and inbox-targeting.
 * Honeypot field "website" must be empty (bots fill all fields).
 */
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { tenantForHost } from '@/lib/tenants'
import { rateLimit, getIP } from '@/lib/admin'

// Per-tenant Resend account. A tenant on its own Resend account (e.g. the UK /
// New Forest tenant, whose domain is verified in a separate account) sets
// RESEND_API_KEY_<STATECODE>; every other tenant falls back to the shared
// RESEND_API_KEY. This keeps the 8 AU sites on the shared GF account (where
// their domains are verified) while new-forest-national-park.com sends from its
// own account + verified domain.
function resendFor(stateCode: string): Resend | null {
  const key = process.env[`RESEND_API_KEY_${stateCode.toUpperCase()}`] || process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function POST(req: NextRequest) {
  try {
    const tenant = tenantForHost(req.headers.get('host'))
    const ip = getIP(req)

    const resend = resendFor(tenant.state_code)
    if (!resend) {
      console.error('[contact] no Resend API key configured for', tenant.state_code)
      return NextResponse.json({ error: 'Email service unavailable' }, { status: 503 })
    }

    if (ip && !(await rateLimit(`contact:${ip}`, 3, 3600))) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, email, subject, message, website } = body as Record<string, string>

    // Honeypot — real users never fill this hidden field
    if (website && website.trim() !== '') {
      // Silently succeed to avoid telling spambots the honeypot triggered
      return NextResponse.json({ ok: true })
    }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (5000 char max)' }, { status: 400 })
    }

    const senderEmail = email.trim().toLowerCase()
    if (!(await rateLimit(`contact-email:${senderEmail}`, 2, 3600))) {
      return NextResponse.json({ error: 'Duplicate request received. Please wait before resending.' }, { status: 429 })
    }

    const safe = {
      name: esc(name).slice(0, 200),
      email: esc(email).slice(0, 200),
      subject: esc(subject || '(no subject)').slice(0, 200),
      message: esc(message).slice(0, 5000),
    }
    const submitted = new Date().toUTCString()
    const userAgent = (req.headers.get('user-agent') || 'unknown').slice(0, 200)

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px">
          <h2 style="color:var(--brand);margin:0 0 6px;font-size:18px">New contact-form submission</h2>
          <p style="color:#6b7280;margin:0 0 18px;font-size:13px">${tenant.host} &middot; ${submitted}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 0;font-weight:600;color:#374151;width:110px">Name</td><td style="padding:8px 0;color:#111827">${safe.name}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 0;font-weight:600;color:#374151">Email</td><td style="padding:8px 0;color:#111827"><a href="mailto:${safe.email}" style="color:var(--brand)">${safe.email}</a></td></tr>
            <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 0;font-weight:600;color:#374151">Subject</td><td style="padding:8px 0;color:#111827">${safe.subject}</td></tr>
            <tr><td style="padding:12px 0 0;font-weight:600;color:#374151;vertical-align:top">Message</td><td style="padding:12px 0 0;color:#111827;white-space:pre-wrap;line-height:1.55">${safe.message}</td></tr>
          </table>
          <div style="margin-top:20px;padding:10px 12px;background:#f3f4f6;border-radius:6px;color:#6b7280;font-size:11px;line-height:1.5">
            <div>IP: ${esc(ip || 'unknown')}</div>
            <div>User-Agent: ${esc(userAgent)}</div>
            <div>Tenant: ${esc(tenant.state_code)} (${esc(tenant.name)})</div>
          </div>
        </div>
      </div>
    `

    const sendResult = await resend.emails.send({
      from: `${tenant.name} Contact Form <${tenant.fromEmail}>`,
      to: [tenant.contactEmail],
      replyTo: email.trim(),
      subject: `[${tenant.shortName}] ${safe.subject}`,
      html,
    })

    if (sendResult.error) {
      console.error('[contact] resend error', tenant.state_code, tenant.fromEmail, sendResult.error)
      return NextResponse.json({ error: 'Failed to send. Please try again or email us directly.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] send failed', err)
    return NextResponse.json({ error: 'Failed to send. Please try again or email us directly.' }, { status: 500 })
  }
}
