import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { rateLimit, getIP, checkBlocklist } from '@/lib/admin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    const normEmail = email.trim().toLowerCase();
    const ip = getIP(req);
    const blocked = await checkBlocklist({ ip, email: normEmail });
    if (blocked) return NextResponse.json({ error: 'Blocked' }, { status: 403 });
    // 5 links per IP per 15min, 3 per email per 15min
    if (ip && !(await rateLimit(`magic:ip:${ip}`, 5, 900))) {
      return NextResponse.json({ error: 'Too many requests, try again later' }, { status: 429 });
    }
    if (!(await rateLimit(`magic:email:${normEmail}`, 3, 900))) {
      return NextResponse.json({ error: 'Too many requests for this email, try again later' }, { status: 429 });
    }

    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bugbitten.com'}/login`,
      handleCodeInApp: true,
    };

    let link: string;
    try {
      link = await getAdminAuth().generateSignInWithEmailLink(normEmail, actionCodeSettings);
    } catch (e: any) {
      console.error('[magic-link] generateSignInWithEmailLink failed:', e?.code, e?.message, e?.stack?.slice(0, 500));
      return NextResponse.json({ error: 'Auth service error: ' + (e?.code || e?.message || 'unknown') }, { status: 500 });
    }

    const { error } = await resend.emails.send({
      from: 'BugBitten <noreply@bugbitten.com>',
      to: normEmail,
      subject: 'Your BugBitten sign-in link',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0b1420; color: #e8f0fe; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://media.bugbitten.com/brand/logo.webp?v=2" alt="BugBitten" width="180" style="display: inline-block; height: auto; max-width: 180px;" />
          </div>
          <p style="font-size: 16px; margin-bottom: 24px;">Click the button below to sign in to your BugBitten account. This link expires in 1 hour.</p>
          <a href="${link}" style="display: inline-block; background: #14b8a6; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">Sign in to BugBitten</a>
          <p style="margin-top: 24px; font-size: 13px; color: #8ba3c7;">If you didn\'t request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Magic link error:', err);
    return serverError(err, 'auth/magic-link', req);
  }
}
