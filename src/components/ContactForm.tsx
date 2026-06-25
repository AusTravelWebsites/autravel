'use client'
/**
 * Client-side contact form. POSTs to /api/contact/ which routes the submission
 * to the per-tenant info@ inbox via Resend.
 *
 * Includes a honeypot "website" input (hidden from real users; bots fill it
 * and the server silently drops the submission).
 */
import { useState, FormEvent } from 'react'

const C = { border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealDark: 'var(--brand-dark)', err: '#b91c1c', ok: '#15803d' }

export function ContactForm({ tenantName }: { tenantName: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string>('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      subject: String(fd.get('subject') || ''),
      message: String(fd.get('message') || ''),
      website: String(fd.get('website') || ''), // honeypot
    }
    try {
      const res = await fetch('/api/contact/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('ok')
      e.currentTarget.reset()
    } catch {
      setError('Network error. Please try again.')
      setState('error')
    }
  }

  if (state === 'ok') {
    return (
      <div style={{ padding: '20px 22px', background: '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: 12, color: C.ok }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>Message sent.</strong>
        <span style={{ fontSize: 14 }}>Thanks for getting in touch with {tenantName}. We aim to reply within two business days.</span>
      </div>
    )
  }

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${C.border}`,
    borderRadius: 8, fontSize: 14, color: C.text, fontFamily: 'inherit', background: '#fff',
  }
  const rowStyle: React.CSSProperties = { marginBottom: 14 }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Honeypot — must stay empty. Hidden from sighted users + screen readers. */}
      <div style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div style={rowStyle}>
        <label htmlFor="cf-name" style={labelStyle}>Your name *</label>
        <input id="cf-name" name="name" type="text" required maxLength={200} autoComplete="name" style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label htmlFor="cf-email" style={labelStyle}>Email address *</label>
        <input id="cf-email" name="email" type="email" required maxLength={200} autoComplete="email" style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label htmlFor="cf-subject" style={labelStyle}>Subject</label>
        <input id="cf-subject" name="subject" type="text" maxLength={200} style={inputStyle}
               placeholder="e.g. Correction for a tour listing" />
      </div>
      <div style={rowStyle}>
        <label htmlFor="cf-message" style={labelStyle}>Message *</label>
        <textarea id="cf-message" name="message" required maxLength={5000} rows={6}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                  placeholder="Include a page URL if you're flagging an error so we can find it quickly." />
      </div>

      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: `1px solid #fecaca`, borderRadius: 8, color: C.err, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={state === 'sending'}
              style={{
                background: state === 'sending' ? C.sub : C.teal,
                color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: state === 'sending' ? 'wait' : 'pointer',
                opacity: state === 'sending' ? 0.7 : 1,
              }}>
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p style={{ fontSize: 12, color: C.sub, marginTop: 12, lineHeight: 1.5 }}>
        Your message goes straight to the {tenantName} inbox. We don&rsquo;t share your email and we&rsquo;ll only use it to reply.
      </p>
    </form>
  )
}
