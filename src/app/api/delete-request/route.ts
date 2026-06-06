import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    // 3 per IP per hour — this fires 2 emails per request, abuse = $ + noise
    if (ip && !(await rateLimit(`delete-req:${ip}`, 3, 3600))) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }
    const { name, email, platform, userId, reason } = await req.json()

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    // Also rate-limit by (possibly spoofed) email to prevent targeted spam of a victim's inbox
    if (!(await rateLimit(`delete-req-email:${email.trim().toLowerCase()}`, 2, 3600))) {
      return NextResponse.json({ error: 'Duplicate request received. Check your email.' }, { status: 429 })
    }

    const submitted = new Date().toUTCString()
    const esc = (s: string) => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]!)
    const safe = { name: esc(name), email: esc(email), platform: esc(platform), userId: esc(userId), reason: esc(reason) }

    // 1. Notify the BugBitten team
    await resend.emails.send({
      from: 'BugBitten Privacy <privacy@bugbitten.com>',
      to: ['accounts@bugbitten.com'],
      subject: `[Data Deletion Request] ${String(name).slice(0, 80)} <${String(email).slice(0, 120)}>`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="color:#c8440a;margin-bottom:0.5rem">Data Deletion Request</h2>
          <p style="color:#666;margin-bottom:2rem;font-size:0.9rem">Submitted: ${submitted}</p>
          <table style="width:100%;border-collapse:collapse">
            <tr style="border-bottom:1px solid #eee"><td style="padding:0.75rem 0;font-weight:600;color:#444;width:160px">Full Name</td><td style="padding:0.75rem 0;color:#222">${safe.name}</td></tr>
            <tr style="border-bottom:1px solid #eee"><td style="padding:0.75rem 0;font-weight:600;color:#444">Email</td><td style="padding:0.75rem 0;color:#222">${safe.email}</td></tr>
            <tr style="border-bottom:1px solid #eee"><td style="padding:0.75rem 0;font-weight:600;color:#444">Platform</td><td style="padding:0.75rem 0;color:#222">${safe.platform || 'Not specified'}</td></tr>
            <tr style="border-bottom:1px solid #eee"><td style="padding:0.75rem 0;font-weight:600;color:#444">Username / ID</td><td style="padding:0.75rem 0;color:#222">${safe.userId || 'Not specified'}</td></tr>
            <tr><td style="padding:0.75rem 0;font-weight:600;color:#444;vertical-align:top">Reason</td><td style="padding:0.75rem 0;color:#222">${safe.reason || 'Not provided'}</td></tr>
          </table>
          <div style="margin-top:2rem;padding:1rem;background:#fff7ed;border-radius:0.5rem;border:1px solid #fed7aa">
            <p style="margin:0;color:#9a3412;font-size:0.9rem"><strong>Action required:</strong> Verify this request by emailing ${safe.email} and complete deletion within 30 days.</p>
          </div>
        </div>
      `
    })

    // 2. Send confirmation to the user
    await resend.emails.send({
      from: 'BugBitten Privacy <privacy@bugbitten.com>',
      to: [email],
      subject: 'Your data deletion request has been received  BugBitten',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="color:#0f0e0c;margin-bottom:0.5rem">Hi ${safe.name},</h2>
          <p style="color:#444;line-height:1.7">We have received your request to delete your BugBitten account and all associated personal data.</p>
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:0.75rem;padding:1.25rem 1.5rem;margin:1.5rem 0">
            <p style="margin:0;color:#166534;font-size:0.95rem"><strong>Request received:</strong> ${submitted}</p>
          </div>
          <h3 style="color:#0f0e0c;margin-bottom:0.75rem">What happens next</h3>
          <ol style="color:#444;line-height:2;padding-left:1.25rem">
            <li>We will send you a verification email within <strong>24 hours</strong> to confirm this request came from you.</li>
            <li>Once verified, all personal data associated with your account will be permanently deleted.</li>
            <li>Deletion will be complete within <strong>30 days</strong> of verification.</li>
            <li>You will receive a final confirmation email when deletion is complete.</li>
          </ol>
          <p style="color:#444;line-height:1.7;margin-top:1.5rem">If you did not make this request, please ignore this email or contact us immediately at <a href="mailto:privacy@bugbitten.com" style="color:#c8440a">privacy@bugbitten.com</a>.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:2rem 0"/>
          <p style="color:#999;font-size:0.8rem;margin:0">BugBitten &mdash; <a href="https://bugbitten.com/user-data" style="color:#c8440a">bugbitten.com/user-data</a></p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-request error]', err)
    return serverError(err, 'delete-request', req)
  }
}
